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
- **💰 Economia**: renda por província (PIB real por país), manutenção do exército, compra de soldados, presentes em dinheiro e paz com indenização.
- **✈ Bombardeio aéreo**: esquadrilhas de 3 aviões bombardeiam o alvo; a defesa antiaérea pode abater aviões.
- **🔬 Tecnologia**: Armamento, Defesa, Indústria, Logística, Marinha e Força Aérea (até o nível 10). Exército e tecnologia pesam mais que o tamanho do país.
- **👆 Clique**: toque no seu território para ganhar dinheiro; melhore o clique para ganhar mais por toque.
- **🏆 Ranking**, data no calendário, indicador de avanço/recuo e gráfico de território em cada guerra.
- **🎬 Estilo de vídeo**: mapa satélite (só países em guerra pintados), divisões com bandeirinhas, tropas escritas na linha de frente, data grande e título da guerra.
- **💾 Salvar**: 3 espaços + salvamento automático a cada 30 s e ao sair; "Continuar" abre o save mais recente.
- **💼 Economia**: impostos, acordos comerciais, empréstimos (pedir e emprestar) e eventos aleatórios.
- **👑 Impérios**: ao passar de 1,6× o território inicial, o país vira império (nome, bandeira imperial pintada no território, +10% de renda e força).
- **📈 Finanças**: mercado (títulos, ações, cripto), obras públicas (usinas, portos, banco central) e nota de crédito.
- **👆 Segurar**: segure o dedo no seu país para ganhar dinheiro sem parar.
- **🎖 Militar**: bases militares e treinamento; ranking de poder militar.
- **Estilo neon**: seu time azul × inimigos vermelhos sobre mapa satélite, bordas brilhando, tropas no centro e bandeirinhas na frente.
- **⚙ Configurações**: animação de guerra com soldados e bandeiras, frente cinza ou listras que avançam e recuam; território ocupado listrado; bordas sombreadas.
