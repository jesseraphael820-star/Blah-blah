// Villagers: daily routines on a navigation graph, activities, quest markers,
// speech-bubble barks and dialogue hooks.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { NPCS, NODES, EDGES } from '../data/npcs.js';
import { Humanoid } from './character.js';
import { dampAngle, dist2d } from '../core/utils.js';
import { t, tr } from '../core/i18n.js';

const ADJ = {};
for (const [a, b] of EDGES) { (ADJ[a] = ADJ[a] || []).push(b); (ADJ[b] = ADJ[b] || []).push(a); }
function bfs(from, to) {
  if (from === to) return [to];
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const n = q.shift();
    for (const m of ADJ[n] || []) {
      if (m in prev) continue;
      prev[m] = n;
      if (m === to) { const path = [m]; let c = n; while (c !== null && c !== from) { path.unshift(c); c = prev[c]; } return path; }
      q.push(m);
    }
  }
  return [to];
}

function markerTexture(ch, color) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1208';
  const px = (a, b, col) => { x.fillStyle = col; x.fillRect(a, b, 1, 1); };
  const shape = ch === '!' ? ['.XX.', '.XX.', '.XX.', '.XX.', '.XX.', '....', '.XX.', '.XX.'] : ['XXXX', 'X..X', '...X', '..XX', '.XX.', '....', '.XX.', '.XX.'];
  for (let r = 0; r < shape.length; r++) for (let k = 0; k < 4; k++) if (shape[r][k] === 'X') {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(6 + k + ox, 4 + r + oy, '#1a1208');
  }
  for (let r = 0; r < shape.length; r++) for (let k = 0; k < 4; k++) if (shape[r][k] === 'X') px(6 + k, 4 + r, color);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const MARKERS = {};
function markerMat(kind) {
  if (!MARKERS[kind]) {
    const [ch, col] = { offerMain: ['!', '#ffc83a'], offerSide: ['!', '#7ad8ff'], turnin: ['?', '#ffc83a'], turninSide: ['?', '#7ad8ff'] }[kind];
    MARKERS[kind] = new THREE.SpriteMaterial({ map: markerTexture(ch, col), depthWrite: false });
  }
  return MARKERS[kind];
}

export class NPC {
  constructor(id) {
    this.id = id;
    this.def = NPCS[id];
    const d = this.def;
    this.model = new Humanoid({ ...d, pal: { ...d.pal }, acc: d.acc, glasses: d.acc === 'glasses' });
    G.scene.add(this.model.root);
    const start = this.scheduleEntry();
    const n = NODES[start[1]] || [0, 0];
    this.pos = new THREE.Vector3(n[0], 0, n[1]);
    this.pos.y = G.physics.groundAt(this.pos.x, this.pos.z, 100);
    this.yaw = Math.random() * 6;
    this.node = start[1];
    this.path = [];
    this.activity = start[2];
    this.talking = false;
    this.barkT = 5 + Math.random() * 10;
    this.visible = true;
    this.marker = new THREE.Sprite(markerMat('offerMain'));
    this.marker.scale.set(1.3, 1.3, 1);
    this.marker.visible = false;
    G.scene.add(this.marker);
    this.forced = null;
    G.world.addInteractable({
      kind: 'npc', npc: this, x: 0, y: 0, z: 0, r: 3.2, dynamic: true,
      pos: () => this.pos,
      label: () => t('ui.talkTo', { name: t('npc.' + id + '.name') }),
      can: () => this.visible && !this.talking,
      act: () => G.dialogue.talkTo(this),
    });
  }
  get name() { return t('npc.' + this.id + '.name'); }

  scheduleEntry() {
    const h = G.state.world.time;
    const s = this.def.schedule;
    let cur = s[0];
    for (const e of s) if (h >= e[0]) cur = e;
    return cur;
  }
  isPresent() {
    const d = this.def;
    if (d.event) return G.events && G.events.active === d.event;
    if (this.id === 'spirit') return (G.quests.isActive('main6') && G.quests.stepIndex('main6') >= 3) || !!G.state.world.flags.storyDone;
    return true;
  }

  update(dt) {
    const present = this.isPresent();
    if (this.id === 'spirit' && present && !this.placed) {
      this.placed = true;
      this.pos.set(-225 + 3, G.world.towerTop, 190 - 3);
    }
    const [, nodeName, act] = this.scheduleEntry();
    const hidden = !present || act === 'home' || act === 'gone';
    if (hidden && !this.talking) {
      // walk home first, then disappear
      if (this.path.length === 0 && (this.node === nodeName || !nodeName)) this.visible = false;
    } else this.visible = true;
    if (nodeName && nodeName !== this.targetNode && !this.talking) {
      this.targetNode = nodeName;
      const nearest = this.nearestNode();
      this.path = bfs(nearest, nodeName).slice();
      if (!this.visible) { // teleport when hidden (left the house elsewhere)
        const n = NODES[nodeName]; this.pos.set(n[0], G.physics.groundAt(n[0], n[1], 100), n[1]); this.path = []; this.node = nodeName;
      }
    }
    this.activity = act;
    const m = this.model;
    m.root.visible = this.visible;
    let pose = 'idle', speed = 0;
    const P = G.player;
    const dP = dist2d(this.pos.x, this.pos.z, P.pos.x, P.pos.z);
    if (this.talking) {
      this.yaw = dampAngle(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), 6, dt);
      pose = this.model.face.talking ? 'talk' : 'idle';
    } else if (this.path.length) {
      const n = NODES[this.path[0]];
      const dx = n[0] - this.pos.x, dz = n[1] - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) { this.node = this.path.shift(); }
      else {
        const sp = (this.def.scale && this.def.scale < 0.8 ? 3 : 2.2) * (G.sky.night > 0.5 ? 1.2 : 1);
        this.pos.x += dx / d * Math.min(d, sp * dt);
        this.pos.z += dz / d * Math.min(d, sp * dt);
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt);
        pose = 'walk'; speed = sp;
      }
    } else if (this.visible) {
      pose = { hammer: 'hammer', farm: 'farm', sit: 'sit', fish: 'fish', read: 'read', guard: 'guard', play: 'play' }[act] || (this.def.float ? 'float' : 'idle');
      if (dP < 6 && pose !== 'hammer' && pose !== 'farm' && pose !== 'fish') this.yaw = dampAngle(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), 3, dt);
      else if (act === 'fish') this.yaw = dampAngle(this.yaw, Math.PI / 2, 3, dt);
    }
    if (this.id !== 'spirit') this.pos.y = G.physics.groundAt(this.pos.x, this.pos.z, this.pos.y + 1.2);
    // eyes follow the player
    m.face.lookX = dP < 8 ? Math.max(-1, Math.min(1, Math.round(Math.sin(Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z) - this.yaw) * -1.5))) : 0;
    if (dP < 50 && this.visible) {
      m.root.position.copy(this.pos);
      m.root.rotation.y = this.yaw;
      m.pose(pose, 0, dt, { speed, headY: 0 });
      m.updateFace(dt);
    }
    // markers
    const mk = G.quests.markerFor(this.id);
    this.marker.visible = this.visible && !!mk && dP < 90;
    if (this.marker.visible) {
      this.marker.material = markerMat(mk);
      this.marker.position.set(this.pos.x, this.pos.y + 2.6 * (this.def.scale || 1) + 0.4 + Math.sin(G.time * 3) * 0.12, this.pos.z);
    }
    // barks
    if (!this.talking && this.visible && dP < 7 && !G.dialogue.active) {
      this.barkT -= dt;
      if (this.barkT <= 0) {
        this.barkT = 18 + Math.random() * 20;
        const lines = tr('npc.' + this.id + '.barks');
        if (Array.isArray(lines) && lines.length) {
          const line = lines[Math.floor(Math.random() * lines.length)];
          G.ui.bubble(this, line, 3.2);
          m.setTalking(true);
          G.audio.sfx('blip', { pitch: this.def.pitch, vol: 0.5 });
          setTimeout(() => { if (!this.talking) m.setTalking(false); }, 1500);
        }
      }
    }
  }
  nearestNode() {
    let best = this.node, bd = Infinity;
    for (const [k, v] of Object.entries(NODES)) {
      const d = dist2d(v[0], v[1], this.pos.x, this.pos.z);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
}

export class NPCManager {
  constructor() {
    this.list = Object.keys(NPCS).map((id) => new NPC(id));
    this.byId = Object.fromEntries(this.list.map((n) => [n.id, n]));
  }
  update(dt) { for (const n of this.list) n.update(dt); }
  get(id) { return this.byId[id]; }
}
