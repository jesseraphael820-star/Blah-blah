// Villagers: daily routines on a navigation graph, activities, quest markers,
// speech-bubble barks and dialogue hooks.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { NPCS, NODES, EDGES } from '../data/npcs.js';
import { Humanoid } from './character.js';
import { dampAngle, dist2d } from '../core/utils.js';
import { t, tr } from '../core/i18n.js';

export function addNode(name, pos, linkTo) {
  NODES[name] = pos;
  (ADJ[name] = ADJ[name] || []).push(linkTo);
  (ADJ[linkTo] = ADJ[linkTo] || []).push(name);
}
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
      label: () => t('ui.talkTo', { name: this.name }),
      can: () => this.visible && !this.talking,
      act: () => G.dialogue.talkTo(this),
    });
  }
  get name() { return this.def.name || t('npc.' + this.id + '.name'); }
  get lk() { return this.def.langKey || this.id; }
  get role() { return t('npc.' + this.lk + '.role'); }

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
      if (this.chatting) pose = 'talk';
      else if (dP < 6 && pose !== 'hammer' && pose !== 'farm' && pose !== 'fish') this.yaw = dampAngle(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), 3, dt);
      else if (act === 'fish') this.yaw = dampAngle(this.yaw, Math.PI / 2, 3, dt);
    }
    if (this.id !== 'spirit') this.pos.y = G.physics.groundAt(this.pos.x, this.pos.z, this.pos.y + 1.2);
    // eyes follow the player
    m.face.lookX = dP < 8 ? Math.max(-1, Math.min(1, Math.round(Math.sin(Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z) - this.yaw) * -1.5))) : 0;
    if (dP < 50 && this.visible) {
      m.root.position.copy(this.pos);
      m.root.rotation.y = this.yaw;
      // villagers glance at the hero when nearby
      let hy = 0;
      if (dP < 6 && pose !== 'walk' && !this.chatting) { hy = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z) - this.yaw; hy = Math.atan2(Math.sin(hy), Math.cos(hy)); hy = Math.max(-0.9, Math.min(0.9, hy)); }
      m.pose(pose, 0, dt, { speed, headY: hy });
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
        const lines = tr('npc.' + this.lk + '.barks');
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
  update(dt) {
    for (const n of this.list) n.update(dt);
    this.updateChats(dt);
  }
  // villagers standing near each other strike up short conversations
  updateChats(dt) {
    if (this.chat) {
      const c = this.chat;
      c.t -= dt;
      const [a, b] = c.pair;
      const ok = a.visible && b.visible && !a.talking && !b.talking && !a.path.length && !b.path.length;
      if (!ok) { this.endChat(); return; }
      a.yaw = dampAngle(a.yaw, Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z), 5, dt);
      b.yaw = dampAngle(b.yaw, Math.atan2(a.pos.x - b.pos.x, a.pos.z - b.pos.z), 5, dt);
      if (c.t <= 0) {
        if (c.i >= c.lines.length) { this.endChat(); return; }
        const sp = c.i % 2 === 0 ? a : b, other = sp === a ? b : a;
        const line = c.lines[c.i++];
        G.ui.bubble(sp, line, 3);
        sp.model.setTalking(true); other.model.setTalking(false);
        sp.model.setExpression(line.includes('!') ? 'happy' : 'smile');
        const near = Math.hypot(sp.pos.x - G.player.pos.x, sp.pos.z - G.player.pos.z);
        if (near < 14) G.audio.sfx('blip', { pitch: sp.def.pitch, vol: 0.35 });
        setTimeout(() => sp.model.setTalking(false), 1400);
        c.t = 3.2;
      }
      return;
    }
    this.chatT = (this.chatT ?? 6) - dt;
    if (this.chatT > 0) return;
    this.chatT = 10 + Math.random() * 12;
    const free = this.list.filter((n) => n.visible && !n.talking && !n.path.length && !n.def.secret && n.id !== 'spirit' && n.activity !== 'hammer' && Math.hypot(n.pos.x - G.player.pos.x, n.pos.z - G.player.pos.z) < 60);
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const a = free[i], b = free[j];
      if (Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > 9) continue;
      const convs = tr('npcChat');
      if (!Array.isArray(convs) || !convs.length) return;
      const lines = convs[Math.floor(Math.random() * convs.length)].map((l) => l.replace('{a}', a.name).replace('{b}', b.name));
      a.chatting = b.chatting = true;
      this.chat = { pair: [a, b], lines, i: 0, t: 0 };
      return;
    }
  }
  endChat() {
    if (!this.chat) return;
    for (const n of this.chat.pair) { n.chatting = false; n.model.setTalking(false); n.model.setExpression('neutral'); }
    this.chat = null;
  }
  get(id) { return this.byId[id]; }
  // a new villager moves into Aurora (village growth)
  addResident(r) {
    const nodeName = 'plot_' + r.plot;
    if (!NODES[nodeName]) addNode(nodeName, r.door, r.link);
    const id = 'res_' + r.plot;
    NPCS[id] = {
      pal: r.pal, hairStyle: r.hair, hat: r.hat || 'none', pitch: r.pitch, name: r.name, langKey: 'villager',
      schedule: [[0, nodeName, 'home'], [7, nodeName, 'idle'], [8, r.day1, 'idle'], [12, 'well', 'idle'], [14, r.day2, 'idle'], [19, 'plaza', 'idle'], [21, nodeName, 'home']],
    };
    const n = new NPC(id);
    this.list.push(n);
    this.byId[id] = n;
    return n;
  }
}
