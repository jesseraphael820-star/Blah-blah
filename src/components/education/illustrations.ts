/**
 * Ilustrações esquemáticas (não são fotos) para a comparação educativa de Gua Sha.
 * Mostram apenas a ideia de inchaço matinal temporário vs. após massagem leve.
 */
function face(puffy: boolean) {
  const cheek = puffy ? 122 : 98;
  const jl = puffy ? 58 : 84;
  const jr = 320 - jl;
  const chin = puffy ? 356 : 334;
  const outline = `M160 60 C${160 - cheek} 60 ${160 - cheek - 6} 170 ${jl} 250 Q${jl + 12} 330 160 ${chin} Q${jr - 12} 330 ${jr} 250 C${160 + cheek + 6} 170 ${160 + cheek} 60 160 60Z`;
  const eyeBag = puffy
    ? `<path d="M100 196 q22 16 44 0" stroke="#c4a3f5" stroke-width="3" fill="none" opacity=".8"/><path d="M176 196 q22 16 44 0" stroke="#c4a3f5" stroke-width="3" fill="none" opacity=".8"/>`
    : "";
  const arrows = puffy
    ? ""
    : `<g stroke="#e879f9" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9">
        <path d="M120 255 Q95 240 72 205" marker-end="url(#a)"/><path d="M200 255 Q225 240 248 205" marker-end="url(#a)"/>
        <path d="M160 330 Q120 320 95 290" marker-end="url(#a)"/><path d="M160 330 Q200 320 225 290" marker-end="url(#a)"/>
      </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#2a1f45"/><stop offset="1" stop-color="#0b0a12"/></radialGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3156"/><stop offset="1" stop-color="#2a2340"/></linearGradient>
    <marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#e879f9"/></marker>
  </defs>
  <rect width="320" height="400" fill="url(#bg)"/>
  <path d="${outline}" fill="url(#skin)" stroke="#a78bfa" stroke-opacity=".7" stroke-width="2"/>
  <path d="M100 185 q22 -12 44 0 M176 185 q22 -12 44 0" stroke="#ece9f6" stroke-width="3" fill="none"/>
  ${eyeBag}
  <path d="M160 200 L152 250 Q160 256 168 250" stroke="#a78bfa" stroke-width="2.5" fill="none"/>
  <path d="M135 290 Q160 302 185 290" stroke="#ece9f6" stroke-width="3" fill="none"/>
  ${arrows}
</svg>`;
}

const toDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const GUASHA_BEFORE = toDataUrl(face(true));
export const GUASHA_AFTER = toDataUrl(face(false));
