# Porto Sol

Jogo de ação em mundo aberto em 3D para celular, com câmera em terceira pessoa. Feito em HTML5 + Three.js (incluído em `js/vendor`, funciona offline).

## Como jogar
Abra `index.html` no navegador (no celular, de preferência na horizontal e em tela cheia).

- **Celular:** analógico à esquerda; arraste o lado direito da tela para girar a câmera.
  - A pé: o analógico anda na direção da câmera; `CORRER`, `SOCO/ATIRAR` (mira automática), `ENTRAR` (rouba o carro mais próximo), `ARMA`
  - Dirigindo: analógico vira o volante; `ACELERAR`, `FREIO/RÉ`, `FREIO DE MÃO`, `SAIR`, `RÁDIO`. A câmera volta sozinha para trás do carro.
- **PC:** WASD/setas, arrastar o mouse gira a câmera, Espaço atira/freio de mão, F entra/sai, Shift corre/freia, Q arma, R rádio, Esc pausa

## Conteúdo
- Cidade gerada com centro, subúrbio, zona industrial, parques e orla com praia
- Cidade em 3D com sombras, janelas que acendem à noite, ciclo dia/noite, faróis, postes e giroflex
- Câmera em terceira pessoa que não atravessa prédios e se ajusta à velocidade do carro
- Qualidade gráfica automática no celular (resolução e sombras)
- Trânsito com IA seguindo faixas e cruzamentos, pedestres que fogem
- Sistema de procurado (5 estrelas), viaturas que perseguem, policiais que prendem/atiram
- 5 missões com história, checkpoints e cronômetro
- Loja de armas, PINTURA (zera estrelas), ponto de salvar, itens espalhados
- Sons sintetizados (WebAudio) e progresso salvo no navegador
- `python3 build.py` gera `dist/porto-sol.html` com tudo em um arquivo só.
