// Humanos: jogador, pedestres, policiais e passageiros. Movimento com colisão e animação.

import { T } from '../world/constants.js';
import { clamp, pick, rand } from '../core/math.js';

let NEXT_ID = 1;

const SKINS = ['#f1c9a5', '#e0ac85', '#c68863', '#9c6644', '#7a4a2e', '#5c3820'];
const HAIRS = ['#1d1510', '#3b2414', '#6b4423', '#a8742f', '#d8c070', '#7a7a7a', '#b23a2a'];
const SHIRTS = ['#c94f3d', '#3d7ac9', '#e3c34a', '#efefef', '#4aa36b', '#8a4fc9', '#e07a2f', '#2f2f2f', '#2fa3a3', '#c94f8a', '#7c6a4a'];
const PANTS = ['#2b3550', '#3a3a3a', '#5a4a3a', '#1f2a1f', '#6a6a70', '#20252f'];

export const CHARACTERS = [
  { id: 'rafa', name: 'Rafa Monteiro', perk: 'Resistente: +40% de vida', look: { skin: '#c68863', hair: '#1d1510', shirt: '#d8452f', pants: '#2b3550', hairStyle: 'short' }, health: 140, runMul: 1, wantedMul: 1, cashMul: 1 },
  { id: 'nina', name: 'Nina Duarte', perk: 'Atleta: corre 20% mais rápido', look: { skin: '#f1c9a5', hair: '#b23a2a', shirt: '#2fa3a3', pants: '#20252f', hairStyle: 'long' }, health: 100, runMul: 1.2, wantedMul: 1, cashMul: 1 },
  { id: 'teo', name: 'Téo Barreto', perk: 'Discreto: a polícia desiste 30% mais cedo', look: { skin: '#7a4a2e', hair: '#3b2414', shirt: '#3a3f4a', pants: '#5a4a3a', hairStyle: 'cap' }, health: 100, runMul: 1, wantedMul: 0.7, cashMul: 1 },
  { id: 'duda', name: 'Duda Siqueira', perk: 'Negociante: +15% nas recompensas', look: { skin: '#e0ac85', hair: '#d8c070', shirt: '#8a4fc9', pants: '#3a3a3a', hairStyle: 'bun' }, health: 100, runMul: 1, wantedMul: 1, cashMul: 1.15 },
];

export function randomLook() {
  return {
    skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS),
    hairStyle: pick(['short', 'short', 'long', 'bald', 'bun', 'cap']),
  };
}

export const COP_LOOK = { skin: '#c68863', hair: '#1d1510', shirt: '#24324f', pants: '#1a2236', hairStyle: 'police' };

export class Human {
  constructor(kind, x, y, look = randomLook()) {
    this.id = NEXT_ID++;
    this.kind = kind; // 'player' | 'ped' | 'cop' | 'npc'
    this.x = x; this.y = y;
    this.a = rand(0, 6.28);
    this.vx = 0; this.vy = 0;
    this.r = 7;
    this.look = look;
    this.phase = 0;
    this.moving = 0; // 0 parado, 1 andando, 2 correndo
    this.health = 100;
    this.maxHealth = 100;
    this.state = 'walk';
    this.down = 0; // tempo caído
    this.ko = false;
    this.punchT = 0;
    this.fade = 1;
    this.ai = null;
    this.dead = false;
    this.spin = 0;
  }

  knock(vx, vy, strong) {
    this.state = 'down';
    this.down = strong ? 24 : rand(3, 5);
    this.ko = strong;
    this.vx = vx; this.vy = vy;
    this.spin = rand(-8, 8);
  }
}

// Move um humano com colisão contra tiles sólidos (desliza nas paredes).
export function moveHuman(h, dx, dy, city) {
  const r = h.r;
  let nx = h.x + dx;
  if (!blocked(city, nx, h.y, r)) h.x = nx;
  else h.vx = 0;
  let ny = h.y + dy;
  if (!blocked(city, h.x, ny, r)) h.y = ny;
  else h.vy = 0;
}

function blocked(city, x, y, r) {
  const tx0 = Math.floor((x - r) / T), tx1 = Math.floor((x + r) / T);
  const ty0 = Math.floor((y - r) / T), ty1 = Math.floor((y + r) / T);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!city.solid(tx, ty)) continue;
      const px = clamp(x, tx * T, tx * T + T), py = clamp(y, ty * T, ty * T + T);
      if ((x - px) ** 2 + (y - py) ** 2 < r * r) return true;
    }
  }
  return false;
}

// Física simples de humano caído (deslizando após atropelamento)
export function updateDownHuman(h, dt, city) {
  if (h.vx || h.vy) {
    moveHuman(h, h.vx * dt, h.vy * dt, city);
    const f = Math.exp(-4 * dt);
    h.vx *= f; h.vy *= f;
    h.a += h.spin * dt;
    h.spin *= f;
    if (Math.abs(h.vx) + Math.abs(h.vy) < 4) { h.vx = 0; h.vy = 0; }
  }
}

export function drawHuman(g, h) {
  const L = h.look;
  g.save();
  g.translate(h.x, h.y);
  if (h.fade < 1) g.globalAlpha = Math.max(0, h.fade);
  g.rotate(h.a);
  if (h.state === 'down') {
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.beginPath(); g.ellipse(1, 1, 13, 7, 0, 0, 7); g.fill();
    g.fillStyle = L.pants; g.fillRect(-14, -5, 9, 3.5); g.fillRect(-14, 1.5, 9, 3.5);
    g.fillStyle = L.shirt; g.beginPath(); g.ellipse(0, 0, 6, 7, 0, 0, 7); g.fill();
    g.fillStyle = L.skin; g.fillRect(-1, -11, 4, 4); g.fillRect(-1, 7, 4, 4);
    g.beginPath(); g.arc(9, 0, 4.2, 0, 7); g.fill();
    g.fillStyle = L.hair; g.beginPath(); g.arc(10, 0, 3.6, 0, 7); g.fill();
    g.restore();
    return;
  }
  const amp = h.moving === 2 ? 6 : h.moving === 1 ? 3.8 : 0;
  const sw = Math.sin(h.phase) * amp;
  // sombra
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(2, 2, 7, 8.5, 0, 0, 7); g.fill();
  // pernas
  g.fillStyle = L.pants;
  g.fillRect(-2 + sw, -4.2, 6, 3.4);
  g.fillRect(-2 - sw, 0.8, 6, 3.4);
  // braços
  g.fillStyle = L.skin;
  if (h.punchT > 0) {
    const ext = Math.sin((1 - h.punchT / 0.3) * Math.PI) * 9;
    g.beginPath(); g.arc(2 + ext, 6, 2.5, 0, 7); g.fill();
    g.beginPath(); g.arc(-1, -7, 2.3, 0, 7); g.fill();
  } else {
    g.beginPath(); g.arc(-sw * 0.8, -7.2, 2.3, 0, 7); g.fill();
    g.beginPath(); g.arc(sw * 0.8, 7.2, 2.3, 0, 7); g.fill();
  }
  // tronco
  g.fillStyle = L.shirt;
  g.beginPath(); g.ellipse(0, 0, 4.6, 7.4, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.12)';
  g.beginPath(); g.ellipse(1, -2, 2.2, 4, 0, 0, 7); g.fill();
  // cabeça
  g.fillStyle = L.skin;
  g.beginPath(); g.arc(0.8, 0, 4.2, 0, 7); g.fill();
  g.fillStyle = L.hair;
  switch (L.hairStyle) {
    case 'bald': break;
    case 'long':
      g.beginPath(); g.arc(-0.5, 0, 4.4, Math.PI * 0.45, Math.PI * 1.55); g.fill();
      g.fillRect(-4.5, -3, 3, 6);
      break;
    case 'bun':
      g.beginPath(); g.arc(0, 0, 4.3, Math.PI * 0.4, Math.PI * 1.6); g.fill();
      g.beginPath(); g.arc(-4, 0, 2.3, 0, 7); g.fill();
      break;
    case 'cap':
      g.fillStyle = '#c23a2a';
      g.beginPath(); g.arc(0.5, 0, 4.5, 0, 7); g.fill();
      g.fillRect(3, -3, 3.5, 6);
      break;
    case 'police':
      g.fillStyle = '#1a2236';
      g.beginPath(); g.arc(0.5, 0, 4.6, 0, 7); g.fill();
      g.fillRect(3, -3.5, 3.5, 7);
      g.fillStyle = '#e8c440'; g.fillRect(-0.5, -1, 2, 2);
      break;
    default:
      g.beginPath(); g.arc(0, 0, 4.4, Math.PI * 0.5, Math.PI * 1.5); g.fill();
      g.beginPath(); g.arc(0.3, 0, 3.6, 0, 7); g.fill();
  }
  g.restore();
}

// Prévia de personagem para a tela de seleção
export function drawCharacterPreview(canvas, look, t) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  const h = new Human('npc', 0, 0, look);
  h.a = -Math.PI / 2;
  h.moving = 1;
  h.phase = t * 8;
  g.save();
  g.translate(canvas.width / 2, canvas.height / 2);
  const s = canvas.width / 34;
  g.scale(s, s);
  h.x = 0; h.y = 0;
  drawHuman(g, h);
  g.restore();
}
