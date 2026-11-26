// Falas ociosas por personagem e por fase da história (paz / guerra / queda), e falas de moradores.
import { loc } from '../core/i18n.js';
const P = (pt, en) => ({ pt, en });
// fase: peace (cap. 1-2), war (cap. 3-4 e pós-libertação), fall (cap. 5 antes da libertação)
const IDLE = {
  kael: { peace: [P('Quer apostar quem chega primeiro na taverna? Perdedor paga.', 'Want to race to the tavern? Loser pays.'), P('O Bram diz que cavalos entendem tudo. Eu acho que a Castanha me odeia.', 'Bram says horses understand everything. I think Chestnut hates me.')],
    war: [P('Às vezes eu olho pro mapa e só vejo linhas. Mas cada linha é gente.', 'Sometimes I look at the map and only see lines. But every line is people.'), P('Tô cansado, {name}. Não do corpo. De outra coisa.', 'I\'m tired, {name}. Not in the body. Something else.')],
    fall: [P('...', '...')], end: [P('Obrigado por não desistir de mim, {name}.', 'Thank you for not giving up on me, {name}.')] },
  oswin: { peace: [P('A estrada ensina paciência. As pessoas, nem sempre.', 'The road teaches patience. People, not always.'), P('Leia os livros da Mira. Ela finge que não, mas adora quando alguém lê.', 'Read Mira\'s books. She pretends otherwise, but she loves it when someone does.')],
    war: [P('Cada território perdido é uma família sem proteção. Nunca esqueça disso.', 'Every territory lost is a family without protection. Never forget that.'), P('Guerra é o que acontece quando as palavras desistem.', 'War is what happens when words give up.')],
    fall: [P('Descanse, Mestre de Campo. Até os Guardiões precisam dormir.', 'Rest, Field Master. Even Wardens need sleep.')], end: [P('O reino é diferente agora. Talvez melhor. Graças a você.', 'The kingdom is different now. Perhaps better. Thanks to you.')] },
  mira: { peace: [P('Sabia que a palavra "Várden" vem de "vigia" na língua antiga? Ninguém sabe disso. Só eu. E agora você.', 'Did you know "Várden" comes from "watcher" in the old tongue? No one knows that. Just me. And now you.'), P('Se encontrar livros antigos por aí, eu pago bem. Em gratidão. Gratidão conta?', 'If you find old books out there, I pay well. In gratitude. Does gratitude count?')],
    war: [P('Os arquivos guardam tudo, inclusive o que alguns preferiam esquecer.', 'The archives keep everything, including what some would rather forget.')],
    fall: [P('Salvei quarenta livros do incêndio. Quarenta, de três mil.', 'I saved forty books from the fire. Forty, out of three thousand.')], end: [P('Vou escrever tudo isso. Alguém precisa lembrar direito dessa vez.', 'I\'m going to write all of this down. Someone needs to remember it right this time.')] },
  tessa: { peace: [P('Ferro bom canta quando bate. Ferro ruim reclama.', 'Good iron sings when struck. Bad iron complains.'), P('Traga minério e ouro, eu melhoro sua arma. Simples.', 'Bring ore and gold, I improve your weapon. Simple.')],
    war: [P('Faço mais espadas que ferraduras agora. Não gosto disso.', 'I make more swords than horseshoes now. I don\'t like it.')], fall: [P('Uma bigorna e um martelo. É tudo que salvei. É o suficiente.', 'An anvil and a hammer. That\'s all I saved. It\'s enough.')] },
  bram: { peace: [P('A Castanha gosta de maçã verde. Não conta pra ela que eu te contei.', 'Chestnut likes green apples. Don\'t tell her I told you.'), P('Um cavalo sente o medo do cavaleiro. Então não tenha medo. Fácil, né?', 'A horse feels its rider\'s fear. So don\'t be afraid. Easy, right?')],
    war: [P('Os cavalos ficam nervosos com o cheiro de fumaça. Eu também.', 'The horses get nervous with the smell of smoke. So do I.')], fall: [P('Perdemos o estábulo, mas não perdemos os cavalos. Isso é o que importa.', 'We lost the stable, but not the horses. That\'s what matters.')] },
  roderic: { peace: [P('Mantenha a guarda alta e a língua curta.', 'Keep your guard high and your tongue short.')], war: [P('Cada Guardião vale por três legionários. Ou pelo menos é o que eu digo pra eles.', 'Every Warden is worth three legionaries. Or at least that\'s what I tell them.')], fall: [P('Vamos voltar pra casa. Eu prometo.', 'We\'re going back home. I promise.')] },
  hobb: { peace: [P('Chuva na hora certa vale mais que ouro.', 'Rain at the right time is worth more than gold.')], war: [P('Soldados pisoteando trigo. Não importa a cor da bandeira, o trigo morre igual.', 'Soldiers trampling wheat. No matter the banner\'s color, the wheat dies the same.')], fall: [P('Minha fazenda... espero que as vacas estejam bem.', 'My farm... I hope the cows are okay.')] },
  elsa: { peace: [P('Pão de mel saindo do forno! Ou quase. Volte em uma hora.', 'Honey bread fresh from the oven! Almost. Come back in an hour.')], war: [P('Jorund não viaja mais sozinho. Eu não deixo.', 'Jorund doesn\'t travel alone anymore. I won\'t allow it.')], fall: [P('Sem forno, faço pão em pedra quente. Não é a mesma coisa.', 'Without an oven, I bake bread on a hot stone. It\'s not the same.')] },
  jorund: { peace: [P('Solária tem um mercado onde vendem peixe que brilha no escuro. Juro!', 'Solária has a market that sells fish that glow in the dark. I swear!')], war: [P('As estradas estão perigosas. Os preços sobem. Os sorrisos descem.', 'The roads are dangerous. Prices go up. Smiles go down.')] },
  marta: { peace: [P('Ensopado de javali, pão e cerveja. A trindade sagrada.', 'Boar stew, bread and ale. The holy trinity.')], war: [P('Taverna cheia de soldado é taverna sem música.', 'A tavern full of soldiers is a tavern without music.')] },
  osric: { peace: [P('Tudo tem preço. Inclusive o desconto.', 'Everything has a price. Including the discount.')], war: [P('A guerra subiu o preço de tudo. Menos da minha simpatia, que continua de graça.', 'The war raised the price of everything. Except my charm, which is still free.')] },
  tomas: { peace: [P('Nada passa por este portão sem eu ver. Exceto gatos. Gatos passam.', 'Nothing gets through this gate without me seeing it. Except cats. Cats get through.')], war: [P('Fico de guarda dobrada agora. Durmo em pé. Literalmente.', 'I\'m on double guard now. I sleep standing up. Literally.')] },
  nina: { peace: [P('Você já viu o mar? Como é?', 'Have you ever seen the sea? What\'s it like?')], war: [P('Minha mãe diz pra eu não sair depois do escurecer.', 'My mom says not to go out after dark.')] },
  pip: { peace: [P('Quando eu crescer vou ter uma capa roxa e um cavalo preto chamado Trovão!', 'When I grow up I\'ll have a purple cloak and a black horse named Thunder!')], war: [P('Eu não tenho medo da guerra. Só um pouquinho.', 'I\'m not afraid of the war. Just a little.')] },
  aldo: { peace: [P('Ordem alfabética é a mais bela das ordens.', 'Alphabetical order is the most beautiful of orders.')] },
  gerd: { peace: [P('Trigo, cerca e paz. Nessa ordem.', 'Wheat, fence and peace. In that order.')] }, ulla: { peace: [P('O Gerd é um bom vizinho. Quando está longe.', 'Gerd is a good neighbor. When he\'s far away.')] },
  sylvara: { peace: [P('A floresta tem memória. Ande com respeito.', 'The forest has memory. Walk with respect.')], war: [P('As árvores choram resina quando o ferro de Drakmor se aproxima.', 'The trees weep resin when Drakmor\'s iron approaches.')] },
  fen: { peace: [P('Um rastro conta onde alguém foi. Dois rastros contam o que queria.', 'One track tells where someone went. Two tracks tell what they wanted.')], war: [P('Fique atento. Há olhos vermelhos na mata.', 'Stay alert. There are red eyes in the woods.')] },
  ivo: { peace: [P('Cace apenas o que vai comer. A floresta cobra os gananciosos.', 'Hunt only what you\'ll eat. The forest charges the greedy.')] },
  lio: { peace: [P('O Carvalho tem mil anos. Ele viu as sete vilas nascerem.', 'The Oak is a thousand years old. It saw the seven villages born.')] },
  faela: { peace: [P('Ervas frescas, colhidas com a lua minguante!', 'Fresh herbs, picked under the waning moon!')] },
  torvald: { peace: [P('Diga a Oswin que um velho rei ainda lembra de um velho amigo.', 'Tell Oswin an old king still remembers an old friend.')], war: [P('Eu assinei a paz. Meu marechal assinou a guerra. Qual de nós é rei?', 'I signed the peace. My marshal signed the war. Which of us is king?')] },
  vargan: { peace: [P('Drakmor não esquece. Drakmor não perdoa.', 'Drakmor does not forget. Drakmor does not forgive.')], war: [P('Saia do meu salão, sulista.', 'Get out of my hall, southerner.')] },
  edrik: { peace: [P('O rei é um homem bom. Isso, às vezes, é uma fraqueza.', 'The king is a good man. That, sometimes, is a weakness.')] },
  grom: { peace: [P('Aço de Drakmor. O melhor do reino. Pergunte a qualquer um que ainda esteja vivo.', 'Drakmor steel. The best in the kingdom. Ask anyone still alive.')] },
  lucan: { peace: [P('Paz é ótima para os negócios. Guerra também, mas com mais papelada.', 'Peace is great for business. War too, but with more paperwork.')], war: [P('Solária é neutra. Neutra e cara.', 'Solária is neutral. Neutral and expensive.')] },
  baltasar: { peace: [P('O mar dá e o mar tira. Hoje, só tirou.', 'The sea gives and the sea takes. Today, it only took.')] },
  rosa: { peace: [P('Tudo que chega pelo mar passa por mim. Tudo.', 'Everything that comes by sea passes through me. Everything.')] },
  brenna: { peace: [P('HA! Um sulista no frio! Beba algo antes que congele.', 'HA! A southerner in the cold! Drink something before you freeze.')], war: [P('Frostheim honra juramentos. Mesmo quando custam caro.', 'Frostheim honors oaths. Even when they cost dearly.')] },
  halden: { peace: [P('O gelo guarda segredos melhor que qualquer cofre.', 'Ice keeps secrets better than any vault.')] },
  sigrun: { peace: [P('Peles boas, preço justo. Ou preço bom, peles justas.', 'Good furs, fair price. Or good price, fair furs.')] },
  halvar: { peace: [P('Várden aqui? Faz tempo que não vejo essa capa nas nossas ruas.', 'Várden here? It\'s been a long time since I saw that cloak in our streets.')], war: [P('Cinzamar não tem exército para guerras. Só para sobreviver.', 'Cinzamar has no army for wars. Only for surviving.')] },
  maren: { peace: [P('Você conhece meu filho? Kael? Ele não escreve há meses.', 'Do you know my son? Kael? He hasn\'t written in months.')], war: [P('Se vir o Kael, diga que a mãe dele está bem. Mesmo que não esteja.', 'If you see Kael, tell him his mother is fine. Even if she isn\'t.')] },
  doro: { peace: [P('Carvão de Cinzamar queima mais quente que ódio.', 'Cinzamar coal burns hotter than hatred.')] },
  cinda: { peace: [P('O Vale das Cinzas já foi um jardim, sabia? Antes da guerra.', 'The Ash Valley was once a garden, did you know? Before the war.')] },
  morwen: { peace: [P('Que agradável. Um Guardião em Ravencross. O que deseja... saber?', 'How pleasant. A Warden in Ravencross. What do you wish to... know?')], war: [P('Todos os caminhos levam a algum lugar. Alguns levam até mim.', 'All roads lead somewhere. Some lead to me.')] },
  grendela: { peace: [P('Heh heh. Não toque nos frascos verdes.', 'Heh heh. Don\'t touch the green flasks.')] },
  lene: { peace: [P('Ravencross não é tão sombria quanto dizem. Só é úmida.', 'Ravencross isn\'t as dark as they say. Just damp.')] },
  teodoro: { peace: [P('Cada pedra destas ruínas tem uma história. Algumas têm três.', 'Every stone of these ruins has a story. Some have three.')] },
};
const VILLAGERS = {
  varden: { peace: [P('Bom dia, Guardião!', 'Good morning, Warden!'), P('Dizem que o festival deste ano vai ter fogos de Solária.', 'They say this year\'s festival will have fireworks from Solária.'), P('Minha avó jura que viu um cavalo branco brilhando nas planícies.', 'My grandmother swears she saw a white horse glowing on the plains.'), P('A taverna da Marta tem o melhor ensopado do reino.', 'Marta\'s tavern has the best stew in the kingdom.'), P('Lobos perto da fazenda do Hobb? Que estranho.', 'Wolves near Hobb\'s farm? How strange.')],
    war: [P('Os soldados de Drakmor estão tão perto...', 'The Drakmor soldiers are so close...'), P('Fiquei sabendo que perdemos a Colina. É verdade?', 'I heard we lost the Hill. Is it true?'), P('Que a Irmandade nos proteja.', 'May the Brotherhood protect us.'), P('Meu filho se alistou nos lanceiros. Estou orgulhosa. E apavorada.', 'My son joined the spearmen. I\'m proud. And terrified.')] },
  eldoria: { peace: [P('As raízes guardem seus passos.', 'May the roots guard your steps.'), P('Não corte árvores sem pedir permissão ao bosque.', 'Don\'t cut trees without asking the grove\'s permission.')], war: [P('Obrigado por defender Eldoria.', 'Thank you for defending Eldoria.'), P('A fumaça das catapultas ainda arde nos olhos.', 'The smoke of the catapults still stings the eyes.')] },
  drakmor: { peace: [P('Ferro e honra, sulista.', 'Iron and honor, southerner.'), P('O rei está doente, dizem. O marechal manda em tudo.', 'The king is ill, they say. The marshal runs everything.')], war: [P('Nem todos em Drakmor querem essa guerra. Lembre-se disso.', 'Not everyone in Drakmor wants this war. Remember that.')] },
  solaria: { peace: [P('Já provou o vinho dos Vinhedos do Sol? Divino!', 'Have you tried the wine from the Sun Vineyards? Divine!'), P('Navios chegando, navios partindo. Solária nunca dorme.', 'Ships arriving, ships leaving. Solária never sleeps.')], war: [P('O comércio caiu pela metade com essa guerra.', 'Trade has fallen by half with this war.')] },
  frostheim: { peace: [P('Frio? Isso é primavera aqui!', 'Cold? This is spring here!'), P('Ouça as sagas na taverna esta noite.', 'Listen to the sagas at the tavern tonight.')], war: [P('Machados afiados, escudos prontos.', 'Axes sharp, shields ready.')] },
  cinzamar: { peace: [P('Várden aqui? Hm.', 'Várden here? Hm.'), P('A cinza é boa para a terra. Ruim para os pulmões.', 'Ash is good for the soil. Bad for the lungs.')], war: [P('Guerra de ricos, fome de pobres. Sempre foi assim.', 'Rich men\'s war, poor men\'s hunger. It was always so.')] },
  ravencross: { peace: [P('...', '...'), P('Não fazemos perguntas aqui. Nem respondemos.', 'We don\'t ask questions here. Nor answer them.')], war: [P('Os corvos estão agitados ultimamente.', 'The ravens have been restless lately.')] },
  survivor: { fall: [P('Ainda dói lembrar da vila queimando.', 'It still hurts to remember the village burning.'), P('Se você acredita que vamos voltar, eu também acredito.', 'If you believe we\'ll go back, I believe it too.'), P('Pela estrada e por quem nela caminha.', 'For the road and for those who walk it.')] },
  caravan: { war: [P('Obrigado, Guardião! Achei que íamos perder tudo.', 'Thank you, Warden! I thought we\'d lose everything.')] },
  guard_varden: { peace: [P('Tudo tranquilo, Guardião.', 'All quiet, Warden.')], war: [P('Olhos abertos, Guardião. Drakmor está perto.', 'Eyes open, Warden. Drakmor is near.')] },
};
for (const f of ['eldoria', 'drakmor', 'solaria', 'frostheim', 'cinzamar', 'ravencross']) VILLAGERS['guard_' + f] = { peace: [P('Circulando, viajante.', 'Move along, traveler.'), P('Sem confusão na vila.', 'No trouble in the village.')] };

const pick = (arr, seed) => arr[Math.abs(seed | 0) % arr.length];
export function idleLine(npc, phase, chapter) {
  const d = IDLE[npc];
  const ph = phase === 'fall' ? 'fall' : chapter >= 3 ? 'war' : 'peace';
  let list = d && (d[ph] || d.war || d.peace);
  if (d && d.end && (globalThis.__G && globalThis.__G.flags.gameComplete)) list = d.end;
  if (!list) return [[npc, 'neutral', loc(P('Olá.', 'Hello.'))]];
  const l = pick(list, Math.floor(Date.now() / 7000));
  return [[npc, ph === 'fall' ? 'sad' : 'neutral', loc(l)]];
}
export function villagerLine(group, phase, seed) {
  const d = VILLAGERS[group] || VILLAGERS.varden;
  const ph = phase === 'fall' ? 'fall' : (globalThis.__G && globalThis.__G.chapter >= 3) ? 'war' : 'peace';
  const list = d[ph] || d.war || d.peace || d.fall;
  return loc(pick(list, seed + Math.floor(Date.now() / 9000)));
}
