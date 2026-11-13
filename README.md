# Porto Sol

Jogo de ação em mundo aberto em 3D para celular, com câmera em terceira pessoa. Feito em HTML5 + Three.js (incluído em `js/vendor`, funciona offline).

## Como jogar
Abra `index.html` no navegador (no celular, de preferência na horizontal e em tela cheia).

- **Celular:** analógico à esquerda; arraste o lado direito da tela para girar a câmera.
  - A pé: o analógico anda na direção da câmera; `CORRER`, `SOCO/ATIRAR` (mira automática), `ENTRAR` (rouba o carro mais próximo), `ARMA`
  - Dirigindo: analógico vira o volante; `ACELERAR`, `FREIO/RÉ`, `FREIO DE MÃO`, `SAIR`, `💡 FARÓIS`, `RÁDIO`. A câmera volta sozinha para trás do carro.
  - Os botões só aparecem quando servem para algo (ENTRAR perto de um carro, ARMA com 2+ armas, FREIO DE MÃO em velocidade…).
- **PC:** WASD/setas, arrastar o mouse gira a câmera, Espaço atira/freio de mão, F entra/sai, Shift corre/freia, Q arma, R rádio, H faróis, Esc pausa

## Conteúdo
- Cidade gerada com centro, subúrbio, zona industrial, parques e orla com praia
- Cidade em 3D com sombras, janelas que acendem à noite, ciclo dia/noite, faróis, postes e giroflex
- Câmera em terceira pessoa que não atravessa prédios e se ajusta à velocidade do carro
- Qualidade gráfica automática no celular (resolução e sombras)
- Pessoas com joelhos, cotovelos, rosto, cabelos e roupas variadas; animações de andar, correr, telefone, conversa, sentar, mãos ao alto e dança
- NPCs com rotina: atravessam na faixa esperando o semáforo, conversam, sentam em bancos e pontos de ônibus, correm na orla; vendedor e turma dançando na praia; policiais patrulhando
- Carros com carroceria arredondada, rodas com aro, retrovisores, placas, faróis liga/desliga, luz de freio, ré e seta piscando; motorista visível; suspensão que inclina
- Semáforos funcionando, com o trânsito parando no vermelho; carros estacionados nas vagas
- Detalhes: meio-fio, bancos, lixeiras, hidrantes, caixas de correio, pontos de ônibus, casas com telhado e chaminé, toldos, outdoors, caixas d'água, antenas piscando, heliponto, píer, barcos, guarda-sóis, salva-vidas, nuvens, sol, lua e estrelas
- Sistema de procurado (5 estrelas), viaturas que perseguem, policiais que prendem/atiram
- 12 missões com história: entregas, corrida de carro e de moto, táxi com passageiros, carga rural, emboscada em ondas, resgate de refém, roubo de viatura e o golpe final
- Zona rural ao sul da cidade: fazendas com celeiro, silo, moinho, cercas, vacas, plantações, lago com píer, posto de gasolina, cabanas na mata e montanhas no horizonte
- Veículos: sedã, esportivo, van, táxi, viatura, caminhonete, trator, moto e bicicleta (com piloto visível, inclinação e queda em batidas fortes)
- Física: giro nos impactos, amassados na lata, vidro trincado, peças voando, carros da IA que saem rodando, aderência menor em grama/terra/areia, pedestres atropelados voam (ragdoll)
- Tiros: clarão no cano, luz, cápsulas ejetadas, rastro brilhante, faíscas, poeira e sangue no impacto; NPCs armados derrubam a arma ao morrer e você pega encostando
- Mod menu no pause: vida, dinheiro, armas, munição infinita, modo deus, sem polícia, turbo, super velocidade, câmera lenta, gerar veículos, hora do dia, teleporte e pular missões
- Loja de armas, PINTURA (zera estrelas), ponto de salvar, itens espalhados
- Sons sintetizados (WebAudio) e progresso salvo no navegador
- `python3 build.py` gera `dist/porto-sol.html` com tudo em um arquivo só.
