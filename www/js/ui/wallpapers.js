// Procedural wallpapers (pure CSS/SVG, no image downloads) + custom images.

const bloomSVG = (c1, c2, c3) => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900' preserveAspectRatio='xMidYMid slice'><defs><radialGradient id='a' cx='50%' cy='55%' r='60%'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c1}' stop-opacity='0'/></radialGradient><linearGradient id='p' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c2}'/><stop offset='1' stop-color='${c3}'/></linearGradient><filter id='b'><feGaussianBlur stdDeviation='18'/></filter></defs><rect width='1600' height='900' fill='#060a18'/><rect width='1600' height='900' fill='url(#a)' opacity='.55'/><g filter='url(#b)' opacity='.95'><path d='M800 210c120 150 330 210 420 360-160-40-300-10-420 120-120-130-260-160-420-120 90-150 300-210 420-360Z' fill='url(#p)'/><path d='M800 300c70 120 230 190 300 300-120-30-220 0-300 90-80-90-180-120-300-90 70-110 230-180 300-300Z' fill='#fff' opacity='.22'/></g></svg>`)}")`;

const MAP = {
  aurora: "background: radial-gradient(1200px 700px at 15% 20%, rgba(76,141,255,.55), transparent 60%), radial-gradient(900px 600px at 85% 30%, rgba(123,92,255,.5), transparent 60%), radial-gradient(1000px 700px at 50% 110%, rgba(0,200,170,.35), transparent 60%), linear-gradient(160deg, #070b1d, #0c1230 50%, #0a0f22);",
  bloom: `background: ${bloomSVG("#2b5bff", "#4cc3ff", "#7b5cff")} center/cover no-repeat, #060a18;`,
  nebula: "background: radial-gradient(800px 500px at 70% 40%, rgba(255,90,170,.45), transparent 60%), radial-gradient(700px 500px at 25% 70%, rgba(90,120,255,.45), transparent 60%), radial-gradient(2px 2px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 60% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 80% 70%, #fff, transparent), radial-gradient(1px 1px at 40% 80%, #fff, transparent), #090515;",
  carbon: `background: radial-gradient(900px 500px at 80% 10%, rgba(255,61,110,.45), transparent 60%), radial-gradient(700px 500px at 10% 90%, rgba(255,150,0,.25), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,.025) 0 2px, transparent 2px 8px), linear-gradient(160deg, #0b0b10, #15101a);`,
  sunset: `background: ${bloomSVG("#ff7a45", "#ff4d8d", "#ffb347")} center/cover no-repeat, #1a0a14;`,
  ocean: "background: radial-gradient(1100px 600px at 50% 120%, rgba(0,180,255,.55), transparent 60%), radial-gradient(800px 500px at 10% 10%, rgba(0,255,200,.25), transparent 60%), linear-gradient(180deg, #03111f, #062a44);",
};
export const WALLPAPER_NAMES = { aurora: "Aurora", bloom: "Bloom", nebula: "Nebulosa", carbon: "Carbono Gamer", sunset: "Pôr do sol", ocean: "Oceano" };

export function wallpaperCSS(id, custom) {
  if (id === "custom" && custom) return `background: url("${custom}") center/cover no-repeat, #000;`;
  return MAP[id] || MAP.aurora;
}
