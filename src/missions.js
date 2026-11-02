// Story missions (original story set in the fictional city of Porto Sol).
import * as THREE from 'three';
import { Marker } from './fx.js';
import { nodeCoord } from './world.js';
import { LOOKS } from './npc.js';

const B = 'bento', D = 'duda', L = 'player';

const DEFS = [
  {
    id: 'rodas', title: 'Rodas Novas', giver: B,
    intro: [
      [B, 'Léo! Finalmente voltou pra Porto Sol. A cidade mudou muito desde que você foi embora.', 'happy'],
      [L, 'Tio Bento... Vim assim que soube. O que está acontecendo por aqui?', 'worried'],
      [B, 'Os Corvos estão tomando o bairro. Mas primeiro, você precisa de um carro. Pega um na rua e leva pra oficina da Duda.', 'worried'],
      [L, 'Pegar emprestado, né? Deixa comigo.', 'confident'],
    ],
    start(m) { m.stage = 0; },
    update(m, dt) {
      const g = m.g, P = g.player;
      if (m.stage === 0) {
        m.objective('Pegue um carro. Aproxime-se de um veículo e aperte <b>F</b>.');
        if (P.vehicle) { m.stage = 1; m.setTarget(g.world.loc.garage, 0xffd23a, 3); }
      } else if (m.stage === 1) {
        if (!P.vehicle) { m.objective('Volte para um veículo.'); return; }
        if (g.wanted > 0) { m.objective('Despiste a polícia antes de ir à oficina!'); return; }
        m.objective('Leve o carro até a <b>Oficina da Duda</b> (marcador amarelo no mapa).');
        if (m.near(g.world.loc.garage, 4) && Math.abs(P.vehicle.speed) < 7) return 'done';
      }
    },
    outro: [
      [D, 'Opa, carro novo? Bom gosto, Léo. O Bento me falou de você.', 'happy'],
      [L, 'Ele disse que você conhece a cidade inteira.', 'neutral'],
      [D, 'Conheço cada atalho. Volta aqui quando quiser trabalho de verdade.', 'confident'],
    ],
    reward: 500,
  },
  {
    id: 'entrega', title: 'Entrega Quente', giver: D,
    intro: [
      [D, 'Tenho uma entrega urgente. Peças, e nada de perguntas.', 'confident'],
      [L, 'Quanto tempo eu tenho?', 'neutral'],
      [D, 'Pouco. Passa por todos os pontos antes do tempo acabar. Pega o Fúria ali, ele voa.', 'happy'],
    ],
    start(m) {
      const g = m.g, l = g.world.loc.garage;
      m.car = g.spawnParkedCar('sport', l.x + 8, l.z + 6, Math.PI, 0xffb000);
      m.stage = 0; m.cp = 0;
      m.route = [[6, 2], [6, 4], [4, 5], [2, 5], [1, 7], [4, 8], [7, 8], [7, 5], [5, 2]].map(([k, l2]) => new THREE.Vector3(nodeCoord(k), 0, nodeCoord(l2)));
    },
    update(m, dt) {
      const g = m.g, P = g.player;
      if (m.stage === 0) {
        m.objective('Entre no <b>Fúria GT</b>.');
        m.blipOnly(m.car.pos, 0x3ad0ff);
        if (P.vehicle) { m.stage = 1; m.time = 125; m.setTarget(m.route[0], 0xff3a3a, 6); g.hud.big('ENTREGA QUENTE', 'Passe por todos os pontos!', '#ffb000', 2); }
        return;
      }
      m.time -= dt;
      g.hud.setTimer(m.time);
      if (m.time <= 0) return 'fail:O tempo acabou!';
      m.objective(`Passe pelos pontos de entrega: <b>${m.cp}/${m.route.length}</b>`);
      if (P.vehicle && m.near(m.route[m.cp], 7)) {
        m.cp++; g.audio.checkpoint();
        if (m.cp >= m.route.length) { g.hud.setTimer(null); return 'done'; }
        m.setTarget(m.route[m.cp], m.cp === m.route.length - 1 ? 0xffd23a : 0xff3a3a, 6);
      }
    },
    outro: [
      [D, 'Rápido demais! Toma, você mereceu.', 'surprised'],
      [D, 'E leva isso aqui. Com os Corvos na rua, você vai precisar.', 'worried'],
      [L, 'Valeu, Duda. Fico te devendo.', 'happy'],
    ],
    reward: 1500,
    onDone(m) { const P = m.g.player; P.hasPistol = true; P.ammo += 60; m.g.hud.help('Você ganhou uma <b>pistola</b>! Aperte <b>Q</b> para sacar e <b>clique</b> para atirar. Segure o <b>botão direito</b> para mirar.', 7); },
  },
  {
    id: 'corvos', title: 'Asas Cortadas', giver: B,
    intro: [
      [B, 'Os Corvos picharam o muro do nosso bairro e ameaçaram a família do seu Zé.', 'angry'],
      [L, 'Onde eles ficam?', 'angry'],
      [B, 'No pátio velho, a leste daqui. Vai lá e mostra que Porto Sol tem dono.', 'confident'],
      [L, 'Hoje eles aprendem a voar baixo.', 'confident'],
    ],
    start(m) { m.stage = 0; m.thugs = []; m.setTarget(m.g.world.loc.gang, 0xb45aff, 6); },
    update(m) {
      const g = m.g;
      if (m.stage === 0) {
        m.objective('Vá até o território dos <b style="color:#c48aff">Corvos</b>.');
        if (m.near(g.world.loc.gang, 45)) {
          m.stage = 1; m.clearTarget();
          const c = g.world.loc.gang;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const t = g.spawnNPC('thug', LOOKS.thug(), new THREE.Vector3(c.x + Math.cos(a) * 7, 0, c.z + Math.sin(a) * 7));
            t.state = 'fight'; t.threat = g.player; t.hasGun = i % 3 === 0; t.human.showGun(t.hasGun); t.persist = true;
            m.thugs.push(t);
          }
          g.hud.big('OS CORVOS', 'Elimine a gangue', '#c48aff', 2);
        }
        return;
      }
      const alive = m.thugs.filter((t) => t.alive).length;
      m.objective(`Elimine os Corvos: <b>${m.thugs.length - alive}/${m.thugs.length}</b>`);
      m.blips = m.thugs.filter((t) => t.alive).map((t) => ({ pos: t.pos, color: '#c48aff', small: true }));
      if (alive === 0) {
        const c = m.g.world.loc.gang;
        m.leader = m.g.spawnNPC('thug', { ...LOOKS.thug(), shirt: 0x111111, hatColor: 0x2a0a3a, bulk: 1.25 }, new THREE.Vector3(c.x, 0, c.z - 4));
        m.leader.state = 'idle'; m.leader.cower = true; m.leader.persist = true; m.leader.health = 9999;
        m.leader.name = 'Corvo Rei'; m.leader.voice = { pitch: 0.6, rate: 0.92, gender: 'm' };
        return 'done';
      }
    },
    cleanup(m) { (m.thugs || []).forEach((t) => (t.persist = false)); },
    outro: (m) => [
      { who: m.leader, text: 'Chega! Chega! Vocês venceram... O que você quer de mim?', emo: 'worried' },
      {
        choice: ['Some de Porto Sol e não volta nunca mais.', 'A partir de hoje, você trabalha pra gente.'],
        branches: [
          [{ who: L, text: 'Some de Porto Sol e não volta nunca mais.', emo: 'angry' }, { who: m.leader, text: 'Tá bom... Eu vou embora hoje mesmo. Você não me vê mais.', emo: 'sad' }],
          [{ who: L, text: 'A partir de hoje, você trabalha pra gente.', emo: 'confident' }, { who: m.leader, text: 'Fechado. Os Corvos agora voam do lado de vocês.', emo: 'happy' }],
        ],
        onPick: (i) => { m.g.flags.corvo = i === 0 ? 'exiled' : 'recruited'; m.bonus = i === 0 ? 0 : 1000; m.g.player.stats.respect += i === 0 ? 10 : 5; },
      },
    ],
    outroAt: 'none',
    onDone(m) {
      const ld = m.leader; ld.persist = false; ld.cower = false;
      if (m.g.flags.corvo === 'exiled') { ld.state = 'flee'; ld.threat = m.g.player; ld.timer = 25; } else { ld.state = 'walk'; ld.pickCorner(); }
      ld.health = 90;
    },
    reward: 2500,
  },
  {
    id: 'calor', title: 'Calor Total', giver: B,
    intro: [
      [B, 'Fizemos barulho demais. A polícia inteira está atrás de você agora!', 'surprised'],
      [L, 'Então é hora de sumir.', 'confident'],
      [B, 'Despista os homens e volta pro esconderijo. Eu confio em você, sobrinho.', 'worried'],
    ],
    start(m) { m.stage = 0; m.g.setWanted(3); m.g.hud.big('CALOR TOTAL', 'Despiste a polícia!', '#ff4040', 2); },
    update(m) {
      const g = m.g;
      if (m.stage === 0) {
        m.objective('Despiste a polícia! Fique fora da vista das viaturas.');
        if (g.wanted === 0) { m.stage = 1; m.setTarget(g.world.loc.safehouse, 0xffd23a, 3); }
        return;
      }
      if (g.wanted > 0) { m.objective('Despiste a polícia antes de voltar ao esconderijo!'); return; }
      m.objective('Volte ao <b>esconderijo</b> (casa do Bento).');
      if (m.near(g.world.loc.safehouse, 4)) return 'done';
    },
    outro: [
      [B, 'Você conseguiu, Léo. A polícia perdeu o seu rastro.', 'happy'],
      [B, (g) => (g.flags.corvo === 'recruited' ? 'E com os Corvos do nosso lado, ninguém mais mexe com o bairro.' : 'E com os Corvos longe daqui, o bairro finalmente respira.'), 'confident'],
      [L, 'Porto Sol é a nossa casa. Ninguém vai tirar isso da gente.', 'confident'],
      [B, 'Agora a cidade é sua. Aproveita... e não me arruma mais encrenca!', 'happy'],
    ],
    outroAt: B,
    reward: 5000,
    final: true,
  },
];

export class Missions {
  constructor(game, index = 0) {
    this.g = game; this.index = index; this.state = 'idle';
    this.marker = null; this.target = null; this.blips = []; this.cur = null; this.ctx = null;
    this.setupStart();
  }
  get count() { return DEFS.length; }
  lines(arr) { return arr.map(([who, text, emo]) => ({ who, text: typeof text === 'function' ? text(this.g) : text, emo })); }
  giverNPC(who) { return who === B ? this.g.story.bento : who === D ? this.g.story.duda : null; }
  setupStart() {
    this.clearTarget();
    if (this.marker) { this.marker.dispose(); this.marker = null; }
    if (this.index >= DEFS.length) { this.blips = []; return; }
    const def = DEFS[this.index];
    const giver = this.giverNPC(def.giver);
    const p = giver.home.clone(); p.z += 2.5;
    this.startPos = p;
    this.marker = new Marker(this.g.scene, p, 0xffd23a, 1.2, 2.4);
    this.blips = [{ pos: p, color: '#ffd23a', icon: def.giver === B ? 'B' : 'D' }];
  }
  objective(html) { if (this.lastObj !== html) { this.lastObj = html; this.g.hud.setObjective(html); } }
  near(p, r) { const P = this.g.player; const q = P.vehicle ? P.vehicle.pos : P.pos; return Math.hypot(q.x - p.x, q.z - p.z) < r; }
  setTarget(pos, color, r) {
    this.clearTarget();
    const p = pos.clone(); p.y = this.g.world.groundHeight(p.x, p.z);
    this.target = new Marker(this.g.scene, p, color, r, 3.5);
    this.blips = [{ pos: p, color: '#' + color.toString(16).padStart(6, '0'), route: true }];
  }
  blipOnly(pos, color) { this.blips = [{ pos, color: '#' + color.toString(16).padStart(6, '0') }]; }
  clearTarget() { if (this.target) { this.target.dispose(); this.target = null; } this.blips = []; }

  async begin() {
    const def = DEFS[this.index];
    this.state = 'cutscene';
    this.marker.dispose(); this.marker = null; this.blips = [];
    this.g.hud.big(def.title.toUpperCase(), `Missão ${this.index + 1} de ${DEFS.length}`, '#ffd23a', 2.2);
    await this.g.playCutscene(this.lines(def.intro));
    this.ctx = { g: this.g, objective: (h) => this.objective(h), near: (p, r) => this.near(p, r), setTarget: (a, b, c) => this.setTarget(a, b, c), clearTarget: () => this.clearTarget(), blipOnly: (a, b) => this.blipOnly(a, b) };
    Object.defineProperty(this.ctx, 'blips', { set: (v) => (this.blips = v), get: () => this.blips });
    this.cur = def;
    def.start(this.ctx);
    this.state = 'active';
  }

  async complete() {
    const def = this.cur;
    this.state = 'cutscene';
    this.clearTarget(); this.g.hud.setTimer(null); this.g.hud.setObjective('');
    if (def.cleanup) def.cleanup(this.ctx);
    if (this.g.player.vehicle) this.g.player.exitVehicle(true);
    const at = this.giverNPC(def.outroAt || (def.id === 'rodas' ? D : def.giver));
    if (at && at.pos.distanceTo(this.g.player.pos) > 12) {
      // teleport near the speaker so the scene makes sense
      this.g.player.pos.set(at.pos.x, at.pos.y, at.pos.z + 3);
    }
    await this.g.playCutscene(typeof def.outro === 'function' ? def.outro(this.ctx) : this.lines(def.outro));
    const reward = def.reward + (this.ctx.bonus || 0);
    this.g.addMoney(reward);
    const P = this.g.player; P.stats.missions++; P.stats.respect += 15;
    if (def.onDone) def.onDone(this.ctx);
    this.g.audio.mission();
    this.g.hud.big(def.final ? 'FIM DA HISTÓRIA' : 'MISSÃO CONCLUÍDA!', def.final ? `+$${reward} — Porto Sol é sua. Explore à vontade!` : `+$${reward}  ·  +15 respeito`, '#ffd23a', 4);
    this.index++; this.cur = null; this.state = 'idle';
    this.g.save();
    this.setupStart();
    this.lastObj = null;
  }

  fail(reason) {
    if (!this.cur) return;
    const def = this.cur;
    if (def.cleanup) def.cleanup(this.ctx);
    this.cur = null; this.state = 'idle';
    this.g.hud.setTimer(null); this.g.hud.setObjective('');
    this.g.audio.fail();
    this.g.hud.big('MISSÃO FRACASSADA', reason, '#ff4040', 3.5);
    this.lastObj = null;
    this.setupStart();
  }

  update(dt) {
    if (this.marker) this.marker.update(dt);
    if (this.target) this.target.update(dt);
    const g = this.g;
    if (this.state === 'idle' && this.marker && !g.player.vehicle && g.player.alive) {
      const d = this.startPos.distanceTo(g.player.pos);
      if (d < 1.6) {
        if (g.wanted > 0) g.hud.help('Despiste a polícia para começar a missão.', 1);
        else this.begin();
      }
    }
    if (this.state === 'active' && this.cur) {
      const r = this.cur.update(this.ctx, dt);
      if (r === 'done') this.complete();
      else if (typeof r === 'string' && r.startsWith('fail:')) this.fail(r.slice(5));
    }
  }
  onPlayerDown(reason) { if (this.state === 'active') this.fail(reason); }
}
