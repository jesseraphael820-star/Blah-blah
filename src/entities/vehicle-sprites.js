// Sprites procedurais dos veículos (desenhados uma vez e guardados em cache).
// O veículo aponta para +X; origem no centro.

import { MODELS } from './vehicle-models.js';

const cache = new Map();
const S = 3; // resolução do sprite (pixels por px de mundo)
const PAD = 4;

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function getVehicleSprite(model, color, wrecked = false) {
  const key = model + color + (wrecked ? 'w' : '');
  let c = cache.get(key);
  if (c) return c;
  const m = MODELS[model];
  const L = m.l, W = m.w;
  const cv = document.createElement('canvas');
  cv.width = (L + PAD * 2) * S;
  cv.height = (W + PAD * 2) * S;
  const g = cv.getContext('2d');
  g.scale(S, S);
  g.translate(PAD + L / 2, PAD + W / 2);
  drawBody(g, m, wrecked ? '#2a2724' : color, wrecked);
  cache.set(key, cv);
  return cv;
}

export const SPRITE_PAD = PAD;

const glass = '#22303c';
const glassHi = 'rgba(160,200,230,.35)';

function drawBody(g, m, color, wrecked) {
  const L = m.l, W = m.w, hl = L / 2, hw = W / 2;
  const dark = shade(color, -0.35), light = shade(color, 0.25);
  // rodas aparecendo
  g.fillStyle = '#111';
  const wx = hl * 0.62;
  for (const sx of [-wx, wx]) for (const sy of [-hw - 0.6, hw - 2.4]) g.fillRect(sx - 3.5, sy, 7, 3);
  if (m.style === 'truck') {
    g.fillRect(-hl * 0.15 - 3.5, -hw - 0.6, 7, 3); g.fillRect(-hl * 0.15 - 3.5, hw - 2.4, 7, 3);
  }

  switch (m.style) {
    case 'truck': {
      const cab = 18;
      // baú/carga
      g.fillStyle = color; rr(g, -hl, -hw + 1, L - cab - 2, W - 2, 2); g.fill();
      g.strokeStyle = dark; g.lineWidth = 0.8;
      for (let x = -hl + 4; x < hl - cab - 4; x += 4) { g.beginPath(); g.moveTo(x, -hw + 2); g.lineTo(x, hw - 2); g.stroke(); }
      g.fillStyle = light; g.fillRect(-hl + 1, -hw + 2, L - cab - 4, 2);
      // cabine
      g.fillStyle = m.style === 'truck' && m.name === 'Mamute' ? '#d0d0cc' : shade(color, -0.1);
      rr(g, hl - cab, -hw + 1.5, cab, W - 3, 3); g.fill();
      g.fillStyle = glass; rr(g, hl - 7, -hw + 3, 5, W - 6, 1.5); g.fill();
      g.fillStyle = glassHi; g.fillRect(hl - 6, -hw + 4, 1.5, W - 8);
      g.fillStyle = '#222'; g.fillRect(hl - cab - 2, -hw + 3, 2, W - 6);
      lights(g, hl, hw, -hl + 0.5);
      break;
    }
    case 'pickup': {
      g.fillStyle = color; rr(g, -hl, -hw, L, W, 4); g.fill();
      g.fillStyle = dark; rr(g, -hl + 2, -hw + 2.5, L * 0.42, W - 5, 1.5); g.fill();
      g.fillStyle = shade(color, -0.55); g.fillRect(-hl + 4, -hw + 4, L * 0.42 - 4, W - 8);
      g.fillStyle = glass; rr(g, -hl + L * 0.45, -hw + 2.5, 4, W - 5, 1.5); g.fill();
      g.fillStyle = light; rr(g, -hl + L * 0.45 + 4, -hw + 2.5, L * 0.18, W - 5, 2); g.fill();
      g.fillStyle = glass; rr(g, hl - L * 0.37, -hw + 2.5, 7, W - 5, 2); g.fill();
      g.fillStyle = glassHi; g.fillRect(hl - L * 0.37 + 1, -hw + 3.5, 2, W - 7);
      lights(g, hl, hw, -hl);
      break;
    }
    case 'van':
    case 'ambulance':
    case 'policevan': {
      g.fillStyle = color; rr(g, -hl, -hw, L, W, 4); g.fill();
      g.fillStyle = light; rr(g, -hl + 3, -hw + 3, L - 14, W - 6, 2); g.fill();
      g.fillStyle = glass; rr(g, hl - 10, -hw + 2.5, 6, W - 5, 2); g.fill();
      g.fillStyle = glassHi; g.fillRect(hl - 9, -hw + 3.5, 2, W - 7);
      if (m.style === 'ambulance') {
        g.fillStyle = '#e8641e'; g.fillRect(-hl + 2, -hw, L - 4, 2.5); g.fillRect(-hl + 2, hw - 2.5, L - 4, 2.5);
        g.fillStyle = '#e8641e'; g.fillRect(-6, -2, 12, 4); g.fillRect(-2, -6, 4, 12);
        g.fillStyle = '#2b6fe0'; g.fillRect(hl - 13, -hw + 2, 2.5, 4); g.fillStyle = '#e02b2b'; g.fillRect(hl - 13, hw - 6, 2.5, 4);
      } else if (m.style === 'policevan') {
        g.fillStyle = '#e8e8e8'; g.fillRect(-hl + 2, -hw, L - 4, 2.5); g.fillRect(-hl + 2, hw - 2.5, L - 4, 2.5);
        g.fillStyle = '#d4d4d4'; g.font = 'bold 5px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.save(); g.rotate(Math.PI / 2); g.fillStyle = '#1b1f27'; g.fillText('TÁTICA', 0, 6); g.restore();
      } else {
        g.strokeStyle = dark; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-hl + 6, -hw + 3); g.lineTo(-hl + 6, hw - 3); g.stroke();
      }
      lights(g, hl, hw, -hl);
      break;
    }
    case 'sport': {
      g.fillStyle = color;
      g.beginPath(); g.moveTo(-hl + 2, -hw); g.lineTo(hl - 8, -hw); g.quadraticCurveTo(hl, -hw + 2, hl, -hw + 6);
      g.lineTo(hl, hw - 6); g.quadraticCurveTo(hl, hw - 2, hl - 8, hw); g.lineTo(-hl + 2, hw); g.quadraticCurveTo(-hl, hw, -hl, hw - 3);
      g.lineTo(-hl, -hw + 3); g.quadraticCurveTo(-hl, -hw, -hl + 2, -hw); g.fill();
      g.fillStyle = glass; rr(g, -6, -hw + 3, 16, W - 6, 4); g.fill();
      g.fillStyle = color; rr(g, -3, -hw + 4.5, 8, W - 9, 2); g.fill();
      g.fillStyle = glassHi; g.fillRect(7, -hw + 4, 2, W - 8);
      g.fillStyle = dark; g.fillRect(-hl, -hw + 3, 3, W - 6); // aerofólio
      g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(-hl + 4, -1.4, L - 12, 1.1); g.fillRect(-hl + 4, 0.6, L - 12, 1.1);
      lights(g, hl, hw, -hl);
      break;
    }
    default: {
      // hatch, sedan, taxi, muscle, suv, police
      const r = m.style === 'suv' ? 4 : 5;
      g.fillStyle = color; rr(g, -hl, -hw, L, W, r); g.fill();
      g.fillStyle = dark; g.fillRect(-hl + 2, -hw + 0.5, L - 4, 1); g.fillRect(-hl + 2, hw - 1.5, L - 4, 1);
      const isHatch = m.style === 'hatch';
      const front = hl - (isHatch ? 9 : 11);
      const rear = -hl + (isHatch ? 4 : 8);
      g.fillStyle = glass;
      rr(g, front, -hw + 2.5, 6, W - 5, 2); g.fill(); // para-brisa
      rr(g, rear, -hw + 3, 4, W - 6, 2); g.fill(); // vidro traseiro
      g.fillStyle = light; rr(g, rear + 4.5, -hw + 2.5, front - rear - 5, W - 5, 2); g.fill(); // teto
      g.fillStyle = glassHi; g.fillRect(front + 1, -hw + 3.5, 1.5, W - 7);
      if (m.style === 'taxi') {
        g.fillStyle = '#222'; g.fillRect(rear + 5, -hw + 0.5, front - rear - 6, 1.6); g.fillRect(rear + 5, hw - 2.1, front - rear - 6, 1.6);
        g.fillStyle = '#fafafa'; rr(g, (front + rear) / 2 - 2, -4, 5, 8, 1); g.fill();
        g.fillStyle = '#222'; g.font = 'bold 3px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.save(); g.translate((front + rear) / 2 + 0.5, 0); g.rotate(Math.PI / 2); g.fillText('TÁXI', 0, 0); g.restore();
      }
      if (m.style === 'muscle') {
        g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-hl + 1, -2.5, L - 2, 1.5); g.fillRect(-hl + 1, 1, L - 2, 1.5);
        g.fillStyle = '#222'; rr(g, hl - 10, -3, 6, 6, 1); g.fill();
      }
      if (m.style === 'police') {
        g.fillStyle = '#f2f2f2'; rr(g, -4, -hw, 14, W, 2); g.fill();
        g.fillStyle = light; rr(g, rear + 4.5, -hw + 2.5, front - rear - 5, W - 5, 2); g.fill();
        g.fillStyle = '#f2f2f2'; g.fillRect(rear + 5, -hw + 3, front - rear - 6, W - 6);
        g.fillStyle = '#2152b8'; g.fillRect(-hl + 2, -hw + 1, L - 4, 1.3); g.fillRect(-hl + 2, hw - 2.3, L - 4, 1.3);
      }
      if (m.style === 'suv') {
        g.strokeStyle = '#333'; g.lineWidth = 0.8;
        for (let x = rear + 7; x < front - 2; x += 4) { g.beginPath(); g.moveTo(x, -hw + 4); g.lineTo(x, hw - 4); g.stroke(); }
      }
      lights(g, hl, hw, -hl);
    }
  }
  if (wrecked) {
    g.fillStyle = 'rgba(0,0,0,.45)';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((i / 6 - 0.5) * L, (i % 2 ? -1 : 1) * hw * 0.4, 4 + (i % 3), 0, 7); g.fill(); }
  }
}

function lights(g, hl, hw, back) {
  g.fillStyle = '#f5f0d0';
  g.fillRect(hl - 1.5, -hw + 2, 1.5, 3.5); g.fillRect(hl - 1.5, hw - 5.5, 1.5, 3.5);
  g.fillStyle = '#8a1c1c';
  g.fillRect(back, -hw + 2, 1.5, 3.5); g.fillRect(back, hw - 5.5, 1.5, 3.5);
}

// Desenha um veículo genérico em um canvas (para menus de garagem)
export function drawVehiclePreview(canvas, model, color) {
  const g = canvas.getContext('2d');
  const sp = getVehicleSprite(model, color);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const m = MODELS[model];
  const sc = Math.min((canvas.width * 0.85) / (m.l + 8), (canvas.height * 0.85) / (m.w + 8));
  g.save();
  g.translate(canvas.width / 2, canvas.height / 2);
  g.scale(sc, sc);
  g.drawImage(sp, -(m.l / 2 + PAD), -(m.w / 2 + PAD), m.l + PAD * 2, m.w + PAD * 2);
  g.restore();
}
