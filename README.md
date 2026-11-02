# Guerra Global

Jogo de estratégia de guerra no mapa-múndi atual (193 países com bandeiras reais) ou num continente gerado aleatoriamente. Abra `index.html` no navegador (funciona no celular).

- Escolha um país tocando no mapa e aperte **Jogar**.
- **⚔ Ataque**: guerra normal, dá pra propor paz a qualquer momento.
- **☠ Até a morte**: sem paz — só termina quando um dos países perde todo o território.
- **🤝 Alianças**: proponha aliança, envie ajuda para melhorar relações e peça ajuda ao aliado — ele entra na guerra e luta até ela acabar.
- **🎯 Foco**: durante a guerra, toque no território inimigo para concentrar o ataque ali.
- Arraste para mover, pinça/scroll para zoom. Velocidade 1x/2x/4x, espaço pausa.
- **☢ Bomba nuclear**: em guerra, toque no botão ☢ e depois no território inimigo. Recarga de 30 segundos. Deixa a área radioativa (defesa mais fraca).

`world-data.js` é gerado por `tools/build-world.js` (Natural Earth via world-atlas, bandeiras de flag-icons) e depois `tools/build-states.js` (estados: Natural Earth admin-1 10m, baixe `ne_10m_admin_1_states_provinces.geojson` para `tools/`).
- **🚢 Navios e marchas**: sem fronteira com o inimigo, frotas cruzam o mar e desembarcam; se não houver caminho por mar, as tropas vão andando por terra.
- **🗺 Estados**: no mundo real, escolha um país e divida-o em estados para jogar com um estado (guerra de estados).
- **🏆 Ranking**, data no calendário, indicador de avanço/recuo e gráfico de território em cada guerra.
- **⚙ Configurações**: animação de guerra com soldados e bandeiras, frente cinza ou listras que avançam e recuam; território ocupado listrado; bordas sombreadas.
