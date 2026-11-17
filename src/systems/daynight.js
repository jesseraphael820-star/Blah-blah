// Ciclo de dia e noite: 1 minuto real = 1 hora no jogo.

import { clamp } from '../core/math.js';

export class DayNight {
  constructor() {
    this.total = 0; // segundos de jogo decorridos
    this.startHour = 8;
  }

  update(dt) {
    this.total += dt;
  }

  get hours() {
    return (this.startHour + this.total / 60) % 24;
  }

  get day() {
    return Math.floor((this.startHour + this.total / 60) / 24);
  }

  label() {
    const h = this.hours;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // 0 = dia claro, ~0.7 = noite fechada
  get darkness() {
    const h = this.hours;
    if (h >= 7 && h < 18) return 0;
    if (h >= 18 && h < 20.5) return clamp((h - 18) / 2.5, 0, 1) * 0.68;
    if (h >= 20.5 || h < 5) return 0.68;
    return clamp(1 - (h - 5) / 2, 0, 1) * 0.68;
  }

  // tom do entardecer
  get tint() {
    const h = this.hours;
    if (h >= 16.5 && h < 19.5) return Math.sin(((h - 16.5) / 3) * Math.PI) * 0.22;
    if (h >= 5 && h < 7.5) return Math.sin(((h - 5) / 2.5) * Math.PI) * 0.15;
    return 0;
  }
}
