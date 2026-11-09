// Entry point
import { Game } from './game.js';

function showFatal(msg) {
  const f = document.getElementById('fatal');
  f.classList.remove('hidden');
  f.innerHTML = `<div><h2>Wild Lands</h2><p>WebGL 2 is required to play. / É necessário WebGL 2.</p><pre>${msg}</pre></div>`;
}

const test = document.createElement('canvas').getContext('webgl2');
if (!test) showFatal('WebGL2 not available');
else {
  const game = new Game();
  window.__game = game;
  game.boot().catch((e) => { console.error(e); showFatal(e.stack || e); });
}
