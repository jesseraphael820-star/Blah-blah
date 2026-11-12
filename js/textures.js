/* Texturas procedurais (canvas) — asfalto, fachadas, telhados, lotes, água, grama */
(function () {
  const C = (window.CITY = window.CITY || {});
  C.N = 64;          // grade N x N
  C.TS = 4;          // tamanho de cada lote em unidades do mundo
  C.FLOOR = 0.62;    // altura de um andar
  C.BAY = 0.72;      // largura de um vão de janela

  // ---------- utilidades ----------
  function rand(seed) {
    let s = (seed >>> 0) || 123456789;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  C.rand = rand;
  C.hash = function (x, z, k) {
    let h = (x * 374761393 + z * 668265263 + (k || 0) * 2147483647) >>> 0;
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    return (h ^ (h >>> 16)) / 4294967296;
  };
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function noise(g, w, h, amt, r, tint) {
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * amt;
      d[i] += n * (tint ? tint[0] : 1);
      d[i + 1] += n * (tint ? tint[1] : 1);
      d[i + 2] += n * (tint ? tint[2] : 1);
    }
    g.putImageData(img, 0, 0);
  }
  function toTex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = C.maxAniso || 8;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function linTex(c, repeat) {
    const t = toTex(c, repeat);
    t.encoding = THREE.LinearEncoding;
    return t;
  }
  C.canvas = canvas;

  const T = (C.tex = {});
  const cache = {};
  function cached(key, fn) {
    if (!cache[key]) cache[key] = fn();
    return cache[key];
  }

  // ---------- grama ----------
  T.grass = () => cached('grass', () => {
    const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rand(11);
    g.fillStyle = '#5d7d3a'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      const x = r() * S, y = r() * S, rad = 10 + r() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const col = pick(r, ['rgba(80,110,45,', 'rgba(110,135,60,', 'rgba(70,95,40,', 'rgba(125,140,70,']);
      gr.addColorStop(0, col + '0.35)'); gr.addColorStop(1, col + '0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 9000; i++) {
      const x = r() * S, y = r() * S;
      g.strokeStyle = pick(r, ['#4c6b2c', '#6f8f45', '#81a052', '#3f5a24', '#8aa45c']);
      g.globalAlpha = 0.45; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4); g.stroke();
    }
    g.globalAlpha = 1;
    noise(g, S, S, 18, r);
    return toTex(c, true);
  });

  // chão do mapa (inclui margens de areia e leito de rio)
  T.ground = function (tiles, N) {
    const P = 32, S = N * P, c = canvas(S, S), g = c.getContext('2d'), r = rand(77);
    const grass = T.grass().image;
    for (let y = 0; y < S; y += 512) for (let x = 0; x < S; x += 512) g.drawImage(grass, x, y);
    // variação por lote
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const h = C.hash(x, z, 3);
      g.fillStyle = h < 0.5 ? 'rgba(40,60,20,' + (0.12 * h) + ')' : 'rgba(160,170,90,' + (0.1 * (h - 0.5)) + ')';
      g.fillRect(x * P, z * P, P, P);
    }
    // areia e leito
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const t = tiles[z * N + x];
      if (t.water) {
        g.fillStyle = '#4b5a4a'; g.fillRect(x * P - 1, z * P - 1, P + 2, P + 2);
      } else {
        let near = false;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, nz = z + dz;
          if (nx >= 0 && nz >= 0 && nx < N && nz < N && tiles[nz * N + nx].water) near = true;
        }
        if (near) {
          const gr = g.createRadialGradient(x * P + P / 2, z * P + P / 2, 2, x * P + P / 2, z * P + P / 2, P);
          gr.addColorStop(0, 'rgba(196,178,130,0.85)'); gr.addColorStop(1, 'rgba(196,178,130,0.25)');
          g.fillStyle = gr; g.fillRect(x * P - P / 2, z * P - P / 2, P * 2, P * 2);
        }
      }
    }
    noise(g, S, S, 10, r);
    const t = toTex(c, false);
    return t;
  };

  // ---------- ruas (16 variações por conexões N/L/S/O) ----------
  // bits: 1 = Norte (z-1), 2 = Leste (x+1), 4 = Sul (z+1), 8 = Oeste (x-1)
  T.road = (mask) => cached('road' + mask, () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = rand(900 + mask);
    // calçada
    g.fillStyle = '#b8b3a8'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(80,76,70,0.35)'; g.lineWidth = 1.5;
    for (let i = 0; i <= S; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(r() * S, r() * S, 20, 20); }
    const a = Math.round(S * 0.18), b = S - a;
    function shape(pad) {
      g.fillRect(a - pad, a - pad, b - a + pad * 2, b - a + pad * 2);
      if (mask & 1) g.fillRect(a - pad, 0, b - a + pad * 2, a);
      if (mask & 4) g.fillRect(a - pad, b, b - a + pad * 2, S - b);
      if (mask & 2) g.fillRect(b, a - pad, S - b, b - a + pad * 2);
      if (mask & 8) g.fillRect(0, a - pad, a, b - a + pad * 2);
    }
    // meio-fio + asfalto
    g.fillStyle = '#7f7c76'; shape(4);
    g.fillStyle = '#3b3c3f'; shape(0);
    // granulação do asfalto
    for (let i = 0; i < 2500; i++) {
      const x = a + r() * (b - a), y = r() * S;
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(x, y, 2, 2);
      const x2 = r() * S, y2 = a + r() * (b - a);
      g.fillRect(x2, y2, 2, 2);
    }
    // remendos
    for (let i = 0; i < 3; i++) {
      g.fillStyle = 'rgba(20,20,22,0.25)';
      g.fillRect(a + r() * (b - a - 40), a + r() * (b - a - 40), 20 + r() * 30, 14 + r() * 20);
    }
    const deg = [1, 2, 4, 8].filter((m) => mask & m).length;
    const mid = S / 2;
    g.lineCap = 'butt';
    function dashed(x1, y1, x2, y2, color, w, dash) {
      g.strokeStyle = color; g.lineWidth = w; g.setLineDash(dash || []);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.setLineDash([]);
    }
    if (deg <= 2) {
      // linha central amarela dupla
      const arms = [];
      if (mask & 1) arms.push([mid, 0]);
      if (mask & 4) arms.push([mid, S]);
      if (mask & 2) arms.push([S, mid]);
      if (mask & 8) arms.push([0, mid]);
      for (const [ex, ey] of arms) {
        const horiz = ey === mid;
        if (horiz) {
          dashed(mid, mid - 3, ex, mid - 3, '#e5c04a', 3);
          dashed(mid, mid + 3, ex, mid + 3, '#e5c04a', 3);
        } else {
          dashed(mid - 3, mid, mid - 3, ey, '#e5c04a', 3);
          dashed(mid + 3, mid, mid + 3, ey, '#e5c04a', 3);
        }
      }
      // faixas de borda brancas
      if ((mask & 5) === 5 && deg === 2) {
        dashed(a + 8, 0, a + 8, S, 'rgba(240,240,235,0.85)', 2);
        dashed(b - 8, 0, b - 8, S, 'rgba(240,240,235,0.85)', 2);
      }
      if ((mask & 10) === 10 && deg === 2) {
        dashed(0, a + 8, S, a + 8, 'rgba(240,240,235,0.85)', 2);
        dashed(0, b - 8, S, b - 8, 'rgba(240,240,235,0.85)', 2);
      }
    } else {
      // faixas de pedestre (zebra) em cada braço do cruzamento
      g.fillStyle = 'rgba(245,245,240,0.92)';
      const zw = 7, zl = a - 10;
      for (let i = a + 6; i < b - 6; i += 14) {
        if (mask & 1) g.fillRect(i, 6, zw, zl);
        if (mask & 4) g.fillRect(i, b + 4, zw, zl);
        if (mask & 2) g.fillRect(b + 4, i, zl, zw);
        if (mask & 8) g.fillRect(6, i, zl, zw);
      }
    }
    // bueiro
    g.fillStyle = 'rgba(25,25,25,0.8)';
    g.beginPath(); g.arc(a + 14, b - 14, 6, 0, Math.PI * 2); g.fill();
    noise(g, S, S, 8, r);
    return toTex(c, false);
  });

  // ---------- fachadas ----------
  const STY = {
    house:   { wall: '#ebe3d2', frame: '#ffffff', glassA: '#7d93a6', glassB: '#2e3d4b', ww: 0.42, wh: 0.46, lit: 0.55 },
    house2:  { wall: '#c4d1d9', frame: '#ffffff', glassA: '#8299ab', glassB: '#2a3846', ww: 0.42, wh: 0.46, lit: 0.55, siding: true },
    house3:  { wall: '#e3c49c', frame: '#f6efe3', glassA: '#7d93a6', glassB: '#2e3d4b', ww: 0.42, wh: 0.46, lit: 0.5 },
    house4:  { wall: '#d9d9cf', frame: '#4b4b4b', glassA: '#6f8696', glassB: '#24303a', ww: 0.5, wh: 0.5, lit: 0.5 },
    brick:   { wall: '#93492f', frame: '#e8e0d4', glassA: '#7a8fa0', glassB: '#26323e', ww: 0.5, wh: 0.55, lit: 0.5, brick: true },
    beige:   { wall: '#d6c4a2', frame: '#f2ece0', glassA: '#7f95a6', glassB: '#2a3744', ww: 0.6, wh: 0.55, lit: 0.45, bands: '#bfac8a' },
    white:   { wall: '#ecebe6', frame: '#c9c7c0', glassA: '#89a3b6', glassB: '#2c3e4f', ww: 0.72, wh: 0.56, lit: 0.45, bands: '#d4d1c9' },
    concrete:{ wall: '#a7a6a1', frame: '#5f5f5c', glassA: '#7d8e99', glassB: '#252e36', ww: 0.66, wh: 0.52, lit: 0.42, panels: true },
    glassBlue:  { glass: true, top: '#a9c4da', bot: '#25425e', spandrel: '#1b2a39', lit: 0.4 },
    glassDark:  { glass: true, top: '#7d8c99', bot: '#151d26', spandrel: '#0e141a', lit: 0.45 },
    glassGreen: { glass: true, top: '#a6cbc4', bot: '#1f4842', spandrel: '#12302b', lit: 0.4 },
    glassGold:  { glass: true, top: '#e7d4a4', bot: '#5a4523', spandrel: '#3a2c14', lit: 0.45 },
    shop:    { wall: '#d8d0c2', frame: '#f4efe6', glassA: '#7f95a6', glassB: '#2a3744', ww: 0.5, wh: 0.5, lit: 0.4, shop: true },
    industrial: { wall: '#8b8d86', frame: '#4c4e4a', glassA: '#8a9aa3', glassB: '#3a4248', ww: 0.7, wh: 0.22, lit: 0.25, corrugated: true },
    stone:   { wall: '#e6e0d2', frame: '#c8bfa9', glassA: '#6f8495', glassB: '#24303b', ww: 0.38, wh: 0.66, lit: 0.6, bands: '#d2c9b4' },
    hospital:{ wall: '#f1f2ef', frame: '#bfc6c6', glassA: '#8fb7bd', glassB: '#24474d', ww: 0.78, wh: 0.5, lit: 0.6, bands: '#dfe2df' },
    school:  { wall: '#c06a3d', frame: '#f1e9dc', glassA: '#8199aa', glassB: '#2b3946', ww: 0.7, wh: 0.55, lit: 0.3, brick: true },
    police:  { wall: '#9aa5b0', frame: '#e9edf0', glassA: '#7c93a6', glassB: '#22303c', ww: 0.6, wh: 0.5, lit: 0.6, stripe: '#1f4f9a' },
    fire:    { wall: '#a73a2c', frame: '#efe7da', glassA: '#7c93a6', glassB: '#22303c', ww: 0.5, wh: 0.5, lit: 0.5, brick: true }
  };
  C.FACADE_STYLES = Object.keys(STY);

  function drawBricks(g, S, r, base) {
    for (let y = 0; y < S; y += 6) {
      const off = (y / 6) % 2 ? 0 : 7;
      for (let x = -14; x < S; x += 14) {
        const v = (r() - 0.5) * 30;
        g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 220 : 0},${v > 0 ? 200 : 0},${Math.abs(v) / 200})`;
        g.fillRect(x + off, y, 13, 5);
      }
      g.fillStyle = 'rgba(210,200,185,0.35)'; g.fillRect(0, y + 5, S, 1);
    }
  }

  T.facade = (style) => cached('fac_' + style, () => {
    const st = STY[style];
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), e = canvas(S, S), ge = e.getContext('2d');
    const r = rand(style.length * 7919 + style.charCodeAt(0));
    ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
    const bay = 64, fl = 64;
    if (st.glass) {
      for (let fy = 0; fy < 4; fy++) {
        const y0 = fy * fl;
        const gr = g.createLinearGradient(0, y0, 0, y0 + fl);
        gr.addColorStop(0, st.top); gr.addColorStop(1, st.bot);
        g.fillStyle = gr; g.fillRect(0, y0, S, fl);
        // reflexo diagonal
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.beginPath(); g.moveTo(r() * S, y0); g.lineTo(r() * S + 60, y0); g.lineTo(r() * S, y0 + fl); g.lineTo(r() * S - 40, y0 + fl); g.fill();
        g.fillStyle = st.spandrel; g.fillRect(0, y0 + fl - 12, S, 12);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y0 + fl - 12, S, 1);
        for (let x = 0; x < S; x += 16) {
          g.fillStyle = 'rgba(15,20,25,0.55)'; g.fillRect(x, y0, 2, fl);
        }
        // luzes noturnas
        let x = 0;
        while (x < S) {
          const len = 16 * (1 + Math.floor(r() * 5));
          if (r() < st.lit) {
            ge.fillStyle = pick(r, ['#dfe8ff', '#fff3d6', '#f0f4ff', '#ffe7b8']);
            ge.globalAlpha = 0.6 + r() * 0.4;
            ge.fillRect(x + 2, y0 + 4, len - 4, fl - 18);
          }
          x += len;
        }
        ge.globalAlpha = 1;
      }
      noise(g, S, S, 6, r);
      return { map: toTex(c, true), emissive: toTex(e, true) };
    }
    g.fillStyle = st.wall; g.fillRect(0, 0, S, S);
    if (st.brick) drawBricks(g, S, r);
    if (st.siding) for (let y = 0; y < S; y += 8) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, y + 6, S, 2); }
    if (st.corrugated) for (let x = 0; x < S; x += 8) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x, 0, 3, S); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 4, 0, 2, S); }
    if (st.panels) { g.strokeStyle = 'rgba(60,60,60,0.25)'; g.lineWidth = 1; for (let x = 0; x <= S; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); } }
    // manchas de intempérie
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(r() * S, r() * S, 3 + r() * 6, 20 + r() * 40); }
    if (st.bands) for (let fy = 0; fy < 4; fy++) { g.fillStyle = st.bands; g.fillRect(0, fy * fl + fl - 7, S, 7); }
    if (st.stripe) { for (let fy = 0; fy < 4; fy++) { g.fillStyle = st.stripe; g.fillRect(0, fy * fl + fl - 9, S, 5); } }
    const curtains = ['#d8cbb0', '#b8c6cf', '#e4d7c4', '#c9b39a', '#9fb2a8'];
    for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
      const x0 = bx * bay, y0 = fy * fl;
      if (st.shop && fy === 3) {
        // térreo comercial — vitrines
        if (bx === 0) {
          g.fillStyle = '#3a3532'; g.fillRect(0, y0 + 6, S, 8);
          const gr = g.createLinearGradient(0, y0 + 14, 0, y0 + fl);
          gr.addColorStop(0, '#9fb6c6'); gr.addColorStop(1, '#2a3640');
          g.fillStyle = gr; g.fillRect(4, y0 + 16, S - 8, fl - 18);
          for (let x = 4; x < S; x += 42) { g.fillStyle = '#e9e3d8'; g.fillRect(x, y0 + 14, 4, fl - 14); }
          for (let k = 0; k < 10; k++) { g.fillStyle = pick(r, ['#d26b4a', '#e2b04a', '#5a8fc8', '#7fb36a', '#e8e1d0']); g.fillRect(8 + r() * (S - 30), y0 + 40 + r() * 14, 10, 10); }
          ge.fillStyle = '#ffe3a8'; ge.globalAlpha = 0.9; ge.fillRect(4, y0 + 16, S - 8, fl - 18); ge.globalAlpha = 1;
        }
        continue;
      }
      const ww = bay * st.ww, wh = fl * st.wh;
      const wx = x0 + (bay - ww) / 2, wy = y0 + fl * 0.2;
      g.fillStyle = st.frame; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      const gr = g.createLinearGradient(wx, wy, wx + ww * 0.6, wy + wh);
      gr.addColorStop(0, st.glassA); gr.addColorStop(1, st.glassB);
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath(); g.moveTo(wx, wy + wh * 0.6); g.lineTo(wx + ww * 0.5, wy); g.lineTo(wx + ww * 0.7, wy); g.lineTo(wx, wy + wh); g.fill();
      if (r() < 0.35) { g.globalAlpha = 0.55; g.fillStyle = pick(r, curtains); g.fillRect(wx, wy, ww * (0.2 + r() * 0.3), wh); g.globalAlpha = 1; }
      g.fillStyle = st.frame; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 4, wy + wh + 3, ww + 8, 3);
      if (r() < st.lit) {
        ge.fillStyle = pick(r, ['#ffd08a', '#ffe0a6', '#ffc06a', '#fff0cf']);
        ge.globalAlpha = 0.7 + r() * 0.3;
        ge.fillRect(wx, wy, ww, wh);
        ge.globalAlpha = 1;
      }
    }
    noise(g, S, S, 12, r);
    return { map: toTex(c, true), emissive: toTex(e, true) };
  });

  // ---------- telhados ----------
  T.roof = (kind) => cached('roof_' + kind, () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = rand(kind.length * 31);
    if (kind === 'clay' || kind === 'slate') {
      const base = kind === 'clay' ? [160, 72, 48] : [72, 76, 84];
      g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 16) {
        const off = (y / 16) % 2 ? 0 : 8;
        for (let x = -16; x < S; x += 16) {
          const v = (r() - 0.5) * 40;
          const gr = g.createLinearGradient(0, y, 0, y + 16);
          gr.addColorStop(0, `rgb(${base[0] + v + 25},${base[1] + v + 15},${base[2] + v + 10})`);
          gr.addColorStop(1, `rgb(${base[0] + v - 35},${base[1] + v - 25},${base[2] + v - 20})`);
          g.fillStyle = gr; g.fillRect(x + off + 1, y, 14, 15);
        }
      }
    } else if (kind === 'metal') {
      g.fillStyle = '#9aa2a6'; g.fillRect(0, 0, S, S);
      for (let x = 0; x < S; x += 10) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, 0, 3, S); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x + 5, 0, 2, S); }
      for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(120,80,40,0.08)'; g.fillRect(r() * S, r() * S, 20, 40); }
    } else if (kind === 'green') {
      g.fillStyle = '#5d7d3a'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 600; i++) { g.fillStyle = pick(r, ['#6f9446', '#4e6d2f', '#89a95a']); g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 5, 0, 7); g.fill(); }
    } else {
      g.fillStyle = '#8b8a85'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 6000; i++) { g.fillStyle = pick(r, ['#6f6e6a', '#a3a29c', '#7c7b76', '#94938d']); g.fillRect(r() * S, r() * S, 2, 2); }
      g.strokeStyle = 'rgba(40,40,40,0.4)'; g.lineWidth = 3; g.strokeRect(2, 2, S - 4, S - 4);
    }
    noise(g, S, S, 10, r);
    return toTex(c, true);
  });

  // ---------- lotes (piso sob os prédios) ----------
  T.lot = (kind) => cached('lot_' + kind, () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = rand(kind.length * 97 + 5);
    if (kind === 'lawn') {
      g.drawImage(T.grass().image, 0, 0, 512, 512, 0, 0, S, S);
      g.fillStyle = 'rgba(40,70,25,0.6)'; g.fillRect(0, 0, S, 10); g.fillRect(0, 0, 10, S); g.fillRect(S - 10, 0, 10, S);
      g.fillStyle = '#c9c2b4'; g.fillRect(S / 2 - 10, S * 0.6, 20, S * 0.4);
      g.fillStyle = '#8c8a86'; g.fillRect(S * 0.74, S * 0.55, 46, S * 0.45);
      for (let i = 0; i < 10; i++) { g.fillStyle = pick(r, ['#c74b5e', '#f0c341', '#ffffff', '#b06ad0']); g.beginPath(); g.arc(20 + r() * 60, S * 0.7 + r() * 60, 3, 0, 7); g.fill(); }
    } else if (kind === 'plaza') {
      g.fillStyle = '#c9c4b8'; g.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.07})`; g.fillRect(x + 1, y + 1, 14, 14); }
      g.strokeStyle = 'rgba(90,85,80,0.3)'; for (let i = 0; i <= S; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
      g.fillStyle = '#5c7d3a'; g.fillRect(10, 10, 40, 40); g.fillRect(S - 50, 10, 40, 40);
    } else if (kind === 'industrial') {
      g.fillStyle = '#8f8c84'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S, rr = 5 + r() * 25; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(30,25,20,0.35)'); gr.addColorStop(1, 'rgba(30,25,20,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      g.fillStyle = '#d8b13a'; for (let x = 20; x < S - 20; x += 36) g.fillRect(x, S - 46, 4, 36);
      g.strokeStyle = 'rgba(60,55,50,0.4)'; g.lineWidth = 2; for (let i = 0; i <= S; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
    } else if (kind === 'parking') {
      g.fillStyle = '#45464a'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 2500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; g.fillRect(r() * S, r() * S, 2, 2); }
      g.fillStyle = 'rgba(240,240,235,0.85)';
      for (let x = 8; x < S; x += 26) { g.fillRect(x, 8, 3, 60); g.fillRect(x, S - 68, 3, 60); }
      g.fillStyle = '#b8b3a8'; g.fillRect(0, 0, S, 6); g.fillRect(0, S - 6, S, 6);
    } else if (kind === 'park') {
      g.drawImage(T.grass().image, 0, 0, 512, 512, 0, 0, S, S);
      g.strokeStyle = '#cdbf9a'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(S / 2, S); g.bezierCurveTo(S * 0.2, S * 0.6, S * 0.8, S * 0.4, S / 2, 0); g.stroke();
      g.beginPath(); g.moveTo(0, S * 0.45); g.bezierCurveTo(S * 0.3, S * 0.6, S * 0.7, S * 0.3, S, S * 0.5); g.stroke();
      for (let i = 0; i < 25; i++) { g.fillStyle = pick(r, ['#e04f6a', '#f5d142', '#ffffff', '#9f6ad8', '#f08a3c']); g.beginPath(); g.arc(r() * S, r() * S, 2.5, 0, 7); g.fill(); }
    } else if (kind === 'gravel') {
      g.fillStyle = '#9e978a'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 7000; i++) { g.fillStyle = pick(r, ['#857e72', '#b2ab9e', '#77706a', '#a8a090']); g.fillRect(r() * S, r() * S, 2, 2); }
    } else {
      // concreto limpo
      g.fillStyle = '#c3c0b9'; g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(80,80,80,0.25)'; g.lineWidth = 1.5;
      for (let i = 0; i <= S; i += 42) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
    }
    noise(g, S, S, 12, r);
    return toTex(c, kind === 'concrete' || kind === 'gravel' || kind === 'plaza');
  });

  // ---------- zona (sobreposição) ----------
  T.zone = () => cached('zone', () => {
    const S = 128, c = canvas(S, S), g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6;
    for (let i = -S; i < S * 2; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 6; g.strokeRect(5, 5, S - 10, S - 10);
    return linTex(c, false);
  });

  // ---------- água ----------
  T.water = () => cached('water', () => {
    const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rand(5);
    const gr = g.createLinearGradient(0, 0, S, S);
    gr.addColorStop(0, '#2f6b86'); gr.addColorStop(1, '#255a72');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) {
      const x = r() * S, y = r() * S, l = 6 + r() * 26;
      g.strokeStyle = `rgba(${r() < 0.6 ? '200,230,240' : '20,50,70'},${0.08 + r() * 0.18})`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke();
      // tile seamless
      if (x + l > S) { g.beginPath(); g.moveTo(x - S, y); g.quadraticCurveTo(x - S + l / 2, y - 3, x - S + l, y); g.stroke(); }
    }
    return toTex(c, true);
  });

  // ---------- painel solar ----------
  T.solar = () => cached('solar', () => {
    const S = 128, c = canvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) {
      const gr = g.createLinearGradient(0, y * 32, 0, y * 32 + 30);
      gr.addColorStop(0, '#3f5f9a'); gr.addColorStop(1, '#14244a');
      g.fillStyle = gr; g.fillRect(x * 21 + 2, y * 32 + 2, 19, 29);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x * 21 + 2, y * 32 + 16, 19, 1);
    }
    return toTex(c, true);
  });

  // ---------- campo esportivo ----------
  T.field = () => cached('field', () => {
    const W = 256, H = 160, c = canvas(W, H), g = c.getContext('2d');
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#4f8a35' : '#5a9a3c'; g.fillRect(i * W / 10, 0, W / 10, H); }
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
    g.strokeRect(8, 8, W - 16, H - 16);
    g.beginPath(); g.moveTo(W / 2, 8); g.lineTo(W / 2, H - 8); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 20, 0, 7); g.stroke();
    g.strokeRect(8, H / 2 - 30, 30, 60); g.strokeRect(W - 38, H / 2 - 30, 30, 60);
    return toTex(c, false);
  });

  // ---------- partícula macia (fumaça) ----------
  T.puff = () => cached('puff', () => {
    const S = 64, c = canvas(S, S), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    return toTex(c, false);
  });

  // ---------- céu (para mapa de ambiente) ----------
  T.sky = () => cached('sky', () => {
    const c = canvas(32, 256), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5f93c9'); gr.addColorStop(0.45, '#a9cbe6'); gr.addColorStop(0.5, '#e6eef2'); gr.addColorStop(0.55, '#8f9a86'); gr.addColorStop(1, '#4f5a45');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 256);
    return toTex(c, false);
  });

  // ---------- placa de texto (letreiros) ----------
  T.sign = (text, bg, fg) => cached('sign_' + text + bg, () => {
    const c = canvas(256, 64), g = c.getContext('2d');
    g.fillStyle = bg || '#1d3d6b'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = fg || '#fff'; g.font = 'bold 34px Segoe UI, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 34);
    return toTex(c, false);
  });
})();
