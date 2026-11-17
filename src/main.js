// Ponto de entrada: cria o jogo, mostra a tela inicial e registra o modo offline (PWA).

import { Game } from './game.js';

function boot() {
  const canvas = document.getElementById('game');
  let game;
  try {
    game = new Game(canvas);
  } catch (err) {
    document.getElementById('loading').textContent = 'Erro ao iniciar o jogo: ' + err.message;
    throw err;
  }
  window.game = game; // útil para depuração e testes automatizados
  document.getElementById('loading').remove();
  game.ui.showTitle();

  if (!window.__ARTIFACT__ && 'serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.match(/^(localhost|127\.)/)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
