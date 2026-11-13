# Porto Sol

Jogo de ação em mundo aberto (visão de cima) para celular, feito em HTML5 Canvas puro — sem dependências.

## Como jogar
Abra `index.html` no navegador (no celular, de preferência na horizontal e em tela cheia).

- **Celular:** analógico à esquerda (toque em qualquer lugar da metade esquerda); botões à direita.
  - A pé: `CORRER`, `SOCO/ATIRAR` (mira automática), `ENTRAR` (rouba o carro mais próximo), `ARMA` (troca de arma)
  - Dirigindo: aponte o analógico para onde quer ir; `FREIO/RÉ`; `DRIFT` (freio de mão); `SAIR`
- **PC:** WASD/setas, Espaço atira/drift, F entra/sai, Shift corre/freia, Q troca arma, Esc pausa

## Conteúdo
- Cidade gerada com centro, subúrbio, zona industrial, parques e orla com praia
- Prédios em pseudo‑3D com paralaxe, ciclo dia/noite com faróis e postes
- Trânsito com IA seguindo faixas e cruzamentos, pedestres que fogem
- Sistema de procurado (5 estrelas), viaturas que perseguem, policiais que prendem/atiram
- 5 missões com história, checkpoints e cronômetro
- Loja de armas, PINTURA (zera estrelas), ponto de salvar, itens espalhados
- Sons sintetizados (WebAudio) e progresso salvo no navegador
- `python3 build.py` gera `dist/porto-sol.html` com tudo em um arquivo só.
