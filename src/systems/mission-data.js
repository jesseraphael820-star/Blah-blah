// Definição das missões. Posições são calculadas a partir da cidade gerada.
// Tipos de etapa: enter, goto, pickup, dropoff, race, collect, wanted, lose, speed, chase.

import { T, TT, DIR_BY_BIT } from '../world/constants.js';

export const CATEGORIES = {
  story: { name: 'História', color: '#f2b631', icon: '★' },
  race: { name: 'Corrida', color: '#ff7a2f', icon: '⚑' },
  delivery: { name: 'Entrega', color: '#4fd17a', icon: '▣' },
  transport: { name: 'Transporte', color: '#ffe04a', icon: '◉' },
  explore: { name: 'Exploração', color: '#4fc8f0', icon: '✦' },
  challenge: { name: 'Desafio de direção', color: '#b07cff', icon: '◆' },
  recovery: { name: 'Recuperação', color: '#ff4f5e', icon: '⟲' },
};

export function buildMissions(c) {
  const L = c.locations;
  const I = (k, j) => c.I(k, j);
  const H = (j, k, f) => c.H(j, k, f);
  const sw = (p, dx = 40, dy = 40) => {
    const s = c.nearestSidewalk(p.x + dx, p.y + dy, 8);
    return { x: s.x, y: s.y };
  };
  const lane = (p) => {
    const l = c.nearestRoadLane(p.x, p.y, 8);
    return { x: l.x, y: l.y, a: DIR_BY_BIT[c.dirs[c.idx(l.tx, l.ty)]].a };
  };
  // Vaga livre (estacionamento, pátio ou gramado) com espaço ao redor para um carro.
  const lotSpot = (wx, wy) => {
    const okT = (t) => t === TT.PARKING || t === TT.LOT || t === TT.GRASS || t === TT.PLAZA;
    const n = c.nearest(wx, wy, (x, y) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!okT(c.t(x + dx, y + dy))) return false;
      return true;
    }, 30);
    if (n) return { x: n.x, y: n.y, a: 0 };
    return lane({ x: wx, y: wy });
  };
  const nearOficina = { x: L.oficina.x + 48, y: L.oficina.y - 40, a: 0 };
  const P = (p, name) => ({ x: p.x, y: p.y, name });

  return [
    // ----------------------- HISTÓRIA -----------------------
    {
      id: 's1', cat: 'story', name: 'Bem-vindo a Porto Brasa', giver: L.oficina, contact: 'Dona Celeste',
      desc: 'Dona Celeste, dona da Oficina Brasa, precisa de alguém de confiança ao volante. Primeiro, mostre que você conhece a cidade.',
      reward: 500,
      steps: [
        { t: 'enter', anyVehicle: true, spawn: { model: 'brisa', at: nearOficina }, text: 'Entre em um veículo (aproxime-se e use ENTRAR)' },
        { t: 'goto', at: P(L.plaza, 'Praça da Fonte'), mode: 'vehicle', text: 'Dirija até a Praça da Fonte, no Centro' },
        { t: 'goto', at: P(L.oficina, 'Oficina Brasa'), mode: 'vehicle', stop: true, text: 'Volte e estacione na Oficina Brasa' },
      ],
    },
    {
      id: 's2', cat: 'story', name: 'Peças Urgentes', giver: L.oficina, contact: 'Dona Celeste', unlock: 's1',
      desc: 'Um cliente importante precisa do carro hoje. As peças estão no Armazém 7, no Distrito Fabril. Seja rápido.',
      reward: 1200, time: 160,
      steps: [
        { t: 'enter', anyVehicle: true, spawn: { model: 'tatu', at: nearOficina }, text: 'Pegue um veículo' },
        { t: 'goto', at: P(H(1, 7, 0.5), 'Armazém 7'), mode: 'vehicle', stop: true, text: 'Busque as peças no Armazém 7 (Distrito Fabril)' },
        { t: 'goto', at: P(L.oficina, 'Oficina Brasa'), mode: 'vehicle', mv: true, stop: true, text: 'Entregue as peças na Oficina Brasa' },
      ],
    },
    {
      id: 's3', cat: 'story', name: 'O Cliente Exigente', giver: L.oficina, contact: 'Dona Celeste', unlock: 's2',
      desc: 'O Sr. Arlindo, sócio de Dona Celeste, precisa chegar ao Cais do Navio. Ele odeia solavancos: danos acima de 35% e ele desiste.',
      reward: 1500, time: 150, maxDamage: 0.35,
      steps: [
        { t: 'pickup', at: sw(I(5, 4)), name: 'Sr. Arlindo', text: 'Busque o Sr. Arlindo no Centro' },
        { t: 'dropoff', at: P(L.navio, 'Cais do Navio'), text: 'Leve o Sr. Arlindo ao Cais do Navio' },
      ],
    },
    {
      id: 's4', cat: 'recovery', story: true, name: 'Carro de Volta', giver: L.oficina, contact: 'Dona Celeste', unlock: 's3',
      desc: 'O Grupo Vértice "apreendeu" o Monarca prateado de um cliente. Ele está num pátio do Distrito Fabril. Traga-o para a garagem — o alarme vai disparar.',
      reward: 2500, maxDamage: 0.5,
      steps: [
        { t: 'enter', spawn: { model: 'monarca', color: '#c0c4ca', at: lotSpot(133 * T, 12 * T) }, alarm: 2, text: 'Recupere o Monarca prateado no Distrito Fabril' },
        { t: 'goto', at: P(L.garage, 'Garagem'), mode: 'vehicle', mv: true, stop: true, text: 'Leve o Monarca até a Garagem' },
      ],
    },
    {
      id: 's5', cat: 'story', name: 'Fuga do Cais', giver: L.oficina, contact: 'Dona Celeste', unlock: 's4',
      desc: 'Uma encomenda chegou de navio. O problema: a Vértice tem amigos na polícia. Pegue a encomenda e despiste a perseguição.',
      reward: 3500,
      steps: [
        { t: 'goto', at: P(L.navio, 'Cais do Navio'), mode: 'any', text: 'Busque a encomenda no Cais do Navio' },
        { t: 'wanted', level: 3, text: 'A polícia foi avisada!' },
        { t: 'lose', text: 'Despiste a polícia' },
        { t: 'goto', at: P(L.oficina, 'Oficina Brasa'), mode: 'any', text: 'Leve a encomenda até a Oficina Brasa' },
      ],
    },
    {
      id: 's6', cat: 'recovery', story: true, name: 'Atrás do Furgão', giver: L.oficina, contact: 'Dona Celeste', unlock: 's5',
      desc: 'Um furgão Jangada da Vértice levou as ferramentas da oficina. Persiga-o e bata até ele parar. Depois traga-o para a garagem.',
      reward: 4000,
      steps: [
        { t: 'enter', anyVehicle: true, spawn: { model: 'raio', at: nearOficina }, text: 'Pegue um carro rápido' },
        { t: 'chase', model: 'jangada', at: lane(I(4, 7)), stopAt: 0.4, text: 'Persiga o furgão e danifique-o até parar' },
        { t: 'enter', use: 'target', text: 'Assuma o volante do furgão' },
        { t: 'goto', at: P(L.garage, 'Garagem'), mode: 'vehicle', mv: true, stop: true, text: 'Leve o furgão até a Garagem' },
      ],
    },
    {
      id: 's7', cat: 'race', story: true, name: 'Corrida da Meia-Noite', giver: L.oficina, contact: 'Dona Celeste', unlock: 's6',
      desc: 'Para ganhar respeito nas ruas, vença o circuito clandestino que contorna o Centro antes do tempo acabar.',
      reward: 3000, timeAuto: { speed: 195, extra: 14 },
      steps: [
        { t: 'enter', anyVehicle: true, spawn: { model: 'grauna', at: nearOficina }, text: 'Entre em um veículo' },
        { t: 'race', pts: [I(2, 6), I(4, 6), I(6, 6), I(6, 4), I(6, 2), I(4, 2), I(2, 2), I(2, 4), L.oficina], text: 'Passe por todos os pontos de controle' },
      ],
    },
    {
      id: 's8', cat: 'story', name: 'Golpe Final', giver: L.oficina, contact: 'Dona Celeste', unlock: 's7', final: true,
      desc: 'Hora de acabar com a Vértice. O caminhão Bisão deles carrega os documentos de todos os esquemas. Roube-o na Torre Vértice e leve-o ao navio antes que saia.',
      reward: 10000, time: 260,
      steps: [
        { t: 'goto', at: P(L.vertice, 'Torre Vértice'), mode: 'any', text: 'Vá até a Torre Vértice' },
        { t: 'enter', spawn: { model: 'bisao', color: '#2f5f9a', at: lane({ x: L.vertice.x, y: L.vertice.y + 96 }) }, alarm: 4, text: 'Roube o caminhão Bisão' },
        { t: 'goto', at: P(L.navio, 'Cais do Navio'), mode: 'vehicle', mv: true, stop: true, text: 'Leve o Bisão até o navio no Porto' },
      ],
    },

    // ----------------------- PARALELAS -----------------------
    {
      id: 'r1', cat: 'race', name: 'Circuito do Centro', giver: sw(I(3, 2)), contact: 'Zeca Pistão', unlock: 's1',
      desc: 'Zeca organiza rachas entre os prédios do Centro. Complete o circuito dentro do tempo.',
      reward: 800, timeAuto: { speed: 190, extra: 12 },
      steps: [
        { t: 'enter', anyVehicle: true, text: 'Entre em um veículo' },
        { t: 'race', pts: [I(5, 2), I(6, 3), I(6, 5), I(4, 5), I(3, 4), I(3, 2)], text: 'Passe pelos pontos de controle' },
      ],
    },
    {
      id: 'r2', cat: 'race', name: 'Volta da Orla', giver: sw(I(6, 9)), contact: 'Zeca Pistão', unlock: 's3',
      desc: 'Um percurso longo pela orla e pelo porto. Mantenha o pé embaixo.',
      reward: 1200, timeAuto: { speed: 205, extra: 14 },
      steps: [
        { t: 'enter', anyVehicle: true, text: 'Entre em um veículo' },
        { t: 'race', pts: [I(7, 9), I(9, 9), I(9, 6), I(9, 3), I(9, 0), I(7, 0), I(7, 3), I(6, 6), I(6, 9)], text: 'Passe pelos pontos de controle' },
      ],
    },
    {
      id: 'e1', cat: 'delivery', name: 'Pizza Quente', giver: sw(L.market, 0, 50), contact: 'Pizzaria Forno Vivo', unlock: 's2',
      desc: 'Três pizzas, três endereços no Jardim Aurora. Pizza fria não tem gorjeta!',
      reward: 900, time: 130,
      steps: [
        { t: 'goto', at: P(H(5, 1, 0.5), 'Rua das Acácias'), mode: 'any', text: 'Entrega 1: Rua das Acácias' },
        { t: 'goto', at: P(c.V(0, 3, 0.5), 'Rua do Bosque'), mode: 'any', text: 'Entrega 2: Rua do Bosque' },
        { t: 'goto', at: P(H(2, 2, 0.5), 'Avenida Aurora'), mode: 'any', text: 'Entrega 3: Avenida Aurora' },
      ],
    },
    {
      id: 'e2', cat: 'challenge', name: 'Carga Frágil', giver: sw(L.watertower, 0, 60), contact: 'Vidraçaria Cristal', unlock: 's2',
      desc: 'Uma van cheia de vidros precisa chegar ao Mercado Novo. Qualquer batida forte e a carga já era (máx. 12% de danos).',
      reward: 1500, time: 170, maxDamage: 0.12,
      steps: [
        { t: 'enter', spawn: { model: 'jangada', color: '#e8e8e4', at: lotSpot(L.watertower.x, L.watertower.y + 40) }, text: 'Entre na van da vidraçaria' },
        { t: 'goto', at: P(L.market, 'Mercado Novo'), mode: 'vehicle', mv: true, stop: true, text: 'Entregue a carga no Mercado Novo' },
      ],
    },
    {
      id: 't1', cat: 'transport', name: 'Táxi Noturno', giver: sw(I(5, 3)), contact: 'Cooperativa Brasa Táxi', unlock: 's3',
      desc: 'A cooperativa está sem motoristas. Pegue um táxi e leve três passageiros aos seus destinos.',
      reward: 1800, time: 270,
      steps: [
        { t: 'enter', model: 'taxi', spawn: { model: 'taxi', at: lane(I(5, 3)) }, text: 'Entre em um Táxi Brasa' },
        { t: 'pickup', at: sw(I(4, 4)), name: 'Passageira 1', text: 'Busque a passageira' },
        { t: 'dropoff', at: sw(I(1, 3)), text: 'Leve a passageira ao Jardim Aurora' },
        { t: 'pickup', at: sw(I(1, 2)), name: 'Passageiro 2', text: 'Busque o próximo passageiro' },
        { t: 'dropoff', at: sw(I(6, 5)), text: 'Leve o passageiro ao Centro' },
        { t: 'pickup', at: sw(I(6, 4)), name: 'Passageiro 3', text: 'Busque o último passageiro' },
        { t: 'dropoff', at: sw(I(8, 6)), text: 'Leve o passageiro ao Porto Velho' },
      ],
    },
    {
      id: 'x1', cat: 'explore', name: 'Cartões-Postais', giver: sw(I(4, 3), -40, -40), contact: 'Guia Turístico', unlock: 's1',
      desc: 'Visite os cinco pontos mais famosos de Porto Brasa, em qualquer ordem e do jeito que preferir.',
      reward: 1000,
      steps: [
        { t: 'collect', pts: [P(L.park, 'Parque das Mangueiras'), P(L.farol, 'Farol da Ponta'), P(L.watertower, "Caixa d'Água"), P(L.market, 'Mercado Novo'), P(L.vertice, 'Torre Vértice')], mode: 'any', r: 70, text: 'Visite os pontos turísticos' },
      ],
    },
    {
      id: 'x2', cat: 'explore', name: 'Fotógrafo de Rua', giver: sw(I(3, 4)), contact: 'Revista Brasa', unlock: 's2',
      desc: 'A revista quer fotos tiradas a pé no Centro. Corra até os quatro pontos antes do pôr do sol.',
      reward: 900, time: 95,
      steps: [
        { t: 'collect', pts: [P(L.plaza, 'Praça da Fonte'), P(L.vertice, 'Torre Vértice'), P(L.police, 'Delegacia'), P(sw(I(5, 5)), 'Esquina do Relógio')], mode: 'foot', r: 46, text: 'Fotografe os locais (a pé)' },
      ],
    },
    {
      id: 'd1', cat: 'challenge', name: 'Teste de Velocidade', giver: sw(I(9, 5), -40, 40), contact: 'Revista Motor Brasa', unlock: 's4',
      desc: 'Atinja 170 km/h na reta da Avenida Leste e depois chegue ao ponto final antes do tempo acabar.',
      reward: 1000, time: 80,
      steps: [
        { t: 'enter', anyVehicle: true, spawn: { model: 'faisca', at: lane(I(9, 5)) }, text: 'Entre em um carro veloz' },
        { t: 'speed', kmh: 170, text: 'Atinja 170 km/h' },
        { t: 'goto', at: P(I(9, 1), 'Linha de chegada'), mode: 'vehicle', r: 70, text: 'Chegue à linha de chegada' },
      ],
    },
    {
      id: 'd2', cat: 'challenge', name: 'Motorista Exemplar', giver: sw(I(1, 5)), contact: 'Autoescola Brasa', unlock: 's2',
      desc: 'Prova prática: passe pelos pontos sem danificar o carro (máx. 10%) e sem chamar a atenção da polícia.',
      reward: 1300, maxDamage: 0.1, noWanted: true, timeAuto: { speed: 150, extra: 20 },
      steps: [
        { t: 'enter', anyVehicle: true, spawn: { model: 'corsario', at: lane(I(1, 5)) }, text: 'Entre em um veículo' },
        { t: 'race', pts: [I(0, 5), I(0, 3), I(2, 3), I(2, 5), I(1, 5)], text: 'Passe pelos pontos com cuidado' },
      ],
    },
    {
      id: 'v1', cat: 'recovery', name: 'Reboque Sem Guincho', giver: sw(I(8, 6)), contact: 'Seguradora Âncora', unlock: 's3',
      desc: 'Um Raio V8 segurado foi abandonado no Jardim Aurora. Traga-o à Garagem antes que o depenem.',
      reward: 1500, time: 190,
      steps: [
        { t: 'enter', spawn: { model: 'raio', color: '#e2622a', at: lotSpot(40 * T, 25 * T) }, text: 'Encontre o Raio V8 laranja no Jardim Aurora' },
        { t: 'goto', at: P(L.garage, 'Garagem'), mode: 'vehicle', mv: true, stop: true, text: 'Leve o Raio V8 até a Garagem' },
      ],
    },
  ];
}

export const STORY_ORDER = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];

export const ENDING_TEXT =
  'Com os documentos do Bisão nas mãos da imprensa, o Grupo Vértice desmoronou. ' +
  'A Oficina Brasa virou a garagem mais respeitada de Porto Brasa — e você, a lenda que ' +
  'conhece cada rua da cidade. A cidade continua aberta: complete as missões paralelas, ' +
  'colecione carros na garagem e explore à vontade.';
