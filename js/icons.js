/* Divine AI — ícones dos provedores (SVG inline, desenhados para esta interface) */
(function () {
  let uid = 0;
  const id = (p) => `${p}-${++uid}`;

  const ICONS = {
    // Ícone próprio da Divine: auréola + estrela de quatro pontas, em gradiente roxo
    divine() {
      const g = id("dv");
      return `<svg viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f3e8ff"/><stop offset=".5" stop-color="#a855f7"/><stop offset="1" stop-color="#6d28d9"/>
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="14" rx="15" ry="4.5" fill="none" stroke="url(#${g})" stroke-width="3"/>
        <path d="M32 20 L37 35 L52 40 L37 45 L32 60 L27 45 L12 40 L27 35 Z" fill="url(#${g})"/>
        <circle cx="32" cy="40" r="2.6" fill="#fff" opacity=".9"/>
      </svg>`;
    },
    // GPT: flor de seis pétalas entrelaçadas
    openai() {
      let petals = "";
      for (let i = 0; i < 6; i++) {
        petals += `<ellipse cx="32" cy="20" rx="7" ry="13" transform="rotate(${i * 60} 32 32)"/>`;
      }
      return `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="3.2">${petals}</g></svg>`;
    },
    // Claude: faísca radial laranja
    claude() {
      let rays = "";
      for (let i = 0; i < 12; i++) {
        const len = i % 2 ? 18 : 24;
        rays += `<line x1="32" y1="32" x2="32" y2="${32 - len}" transform="rotate(${i * 30} 32 32)"/>`;
      }
      return `<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#d97757" stroke-width="5.5" stroke-linecap="round">${rays}</g></svg>`;
    },
    // Grok: barra diagonal com corte
    grok() {
      return `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#fff">
        <path d="M14 50 L42 12 H50 L22 50 Z"/>
        <path d="M14 14 H22 L32 27.5 L28 33 Z" opacity=".85"/>
        <path d="M37 39 L41 33.5 L50 50 H42 Z" opacity=".85"/>
      </g></svg>`;
    },
    // Kimi: lua crescente
    kimi() {
      const m = id("km");
      return `<svg viewBox="0 0 64 64" aria-hidden="true">
        <defs><mask id="${m}"><rect width="64" height="64" fill="#fff"/><circle cx="41" cy="25" r="17" fill="#000"/></mask></defs>
        <circle cx="30" cy="34" r="20" fill="#fff" mask="url(#${m})"/>
        <circle cx="46" cy="16" r="3" fill="#60a5fa"/>
      </svg>`;
    },
    // Gemini: estrela de quatro pontas em gradiente
    gemini() {
      const g = id("gm");
      return `<svg viewBox="0 0 64 64" aria-hidden="true">
        <defs><linearGradient id="${g}" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#4285f4"/><stop offset=".55" stop-color="#9b72cb"/><stop offset="1" stop-color="#d96570"/>
        </linearGradient></defs>
        <path d="M32 4 C34 20 44 30 60 32 C44 34 34 44 32 60 C30 44 20 34 4 32 C20 30 30 20 32 4 Z" fill="url(#${g})"/>
      </svg>`;
    },
    // DeepSeek: baleia estilizada azul
    deepseek() {
      return `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#4d6bfe">
        <path d="M8 34 C8 22 20 16 32 18 C44 20 50 28 52 34 C55 31 58 28 60 24 C61 32 58 40 52 44 C46 50 36 52 26 50 C16 48 8 42 8 34 Z"/>
        <circle cx="22" cy="31" r="2.4" fill="#000"/>
        <path d="M34 26 C38 28 40 32 40 36" stroke="#000" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      </g></svg>`;
    },
  };

  window.DivineIcons = {
    get(name) {
      return (ICONS[name] || ICONS.divine)();
    },
    hydrate(root = document) {
      root.querySelectorAll("[data-icon]").forEach((el) => {
        el.innerHTML = window.DivineIcons.get(el.dataset.icon);
      });
    },
  };
})();
