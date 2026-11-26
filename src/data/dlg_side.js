// Diálogos de missões secundárias, eventos e sistema.
const accept = (q) => [['Aceito.', 'I accept.', null, [{ quest: q }]], ['Agora não.', 'Not now.', null]];
export default {
  // ---------- sistema ----------
  sys_rest: [
    ['narrator', 'neutral', 'Uma cama macia. Descansar até o amanhecer? (O jogo será salvo.)', 'A soft bed. Rest until dawn? (The game will be saved.)'],
    ['>', [['Descansar', 'Rest', null, [{ rest: true }]], ['Agora não', 'Not now', null]]],
  ],
  read_sign: [['narrator', 'neutral', 'Uma placa de madeira gasta pelo tempo. Alguém riscou: "Pela estrada e por quem nela caminha."', 'A sign worn by time. Someone carved: "For the road and for those who walk it."']],
  read_shrine: [['narrator', 'neutral', 'Um santuário antigo coberto de musgo. Você sente uma calma estranha. Seus ferimentos parecem menores.', 'An ancient moss-covered shrine. You feel a strange calm. Your wounds seem smaller.', [{ heal: true }]]],
  read_statue: [['narrator', 'neutral', 'A estátua de um guerreiro sem rosto. Na base: "O primeiro Guardião não tinha nome. Tinha apenas a estrada."', 'The statue of a faceless warrior. At its base: "The first Warden had no name. Only the road."']],
  read_mural: [['narrator', 'neutral', 'Sete figuras ao redor de uma forja. A pintura está desgastada demais para entender mais do que isso... por enquanto.', 'Seven figures around a forge. The paint is too worn to understand more than that... for now.']],
  // ---------- eventos aleatórios ----------
  ev_traveler: [
    ['villager', 'sad', 'Por favor... fui atacado por lobos. Você teria uma poção? Qualquer coisa...', 'Please... I was attacked by wolves. Would you have a potion? Anything...'],
    ['>', [['Dar uma poção', 'Give a potion', 'ev_traveler_thanks', [{ giveTraveler: true }]], ['Sinto muito, não posso.', 'I\'m sorry, I can\'t.', null]]],
  ],
  ev_traveler_thanks: [['villager', 'happy', 'Que os sete o abençoem! Tome, é tudo que eu tenho. A Irmandade ainda tem bom coração.', 'May the seven bless you! Here, it\'s all I have. The Brotherhood still has a good heart.', [{ npcDone: true }]]],
  ev_traveler_nopotion: [['villager', 'sad', 'Lobos... levaram tudo. Se tiver uma poção, volte, por favor...', 'Wolves... took everything. If you have a potion, please come back...']],
  ev_deserter: [
    ['villager', 'fear', 'Não me machuque! Eu... eu larguei a Legião. Não aguento mais marchar contra vizinhos.', 'Don\'t hurt me! I... I left the Legion. I can\'t keep marching against neighbors.'],
    ['villager', 'neutral', 'Dizem no acampamento que o marechal Vargan nem consulta mais o rei. E que uma dama de preto visita o castelo à noite.', 'They say in camp that Marshal Vargan doesn\'t even consult the king anymore. And that a lady in black visits the castle at night.'],
    ['>', [['Vá em paz. Procure abrigo em Eldoria.', 'Go in peace. Seek shelter in Eldoria.', null, [{ rep: { drakmor: 3, varden: 2 } }, { npcDone: true }]], ['Volte para casa, soldado.', 'Go home, soldier.', null, [{ npcDone: true }]]]],
  ],
  // ---------- missões secundárias ----------
  sq_chickens_offer: [
    ['hobb', 'angry', 'Aquela cerca velha caiu de novo e quatro galinhas fugiram pras planícies. Quatro! Minhas pernas não correm atrás de galinha.', 'That old fence fell again and four chickens ran off into the plains. Four! My legs don\'t chase chickens.'],
    ['>', accept('sq_chickens')],
  ],
  sq_chickens_end: [['hobb', 'happy', 'Todas as quatro! Você leva jeito com bicho. Toma, uns trocados e um pão.', 'All four! You\'ve got a way with animals. Here, some coins and some bread.']],
  sq_letter_offer: [
    ['tomas', 'fear', 'Guardião... eu escrevi uma carta pra Nina. Mas toda vez que chego perto dela, minhas pernas viram geleia.', 'Warden... I wrote a letter to Nina. But every time I get near her, my legs turn to jelly.'],
    ['tomas', 'sad', 'Você entregaria pra mim? Por favor?', 'Would you deliver it for me? Please?'],
    ['>', [['Claro, me dá a carta.', 'Sure, give me the letter.', null, [{ quest: 'sq_letter' }, { give: 'q_love_letter' }]], ['Entregue você mesmo, Tomas.', 'Deliver it yourself, Tomas.', null]]],
  ],
  sq_letter_nina: [
    ['nina', 'surprise', 'Uma carta? Do Tomas? Ele... escreveu isso?', 'A letter? From Tomas? He... wrote this?', [{ take: 'q_love_letter' }]],
    ['nina', 'happy', '"...seus olhos são como o mar de Solária que você tanto quer ver..." Ele lembrou disso.', '"...your eyes are like the sea of Solária you so want to see..." He remembered that.'],
    ['>', [['Ele é um bom rapaz. Dê uma chance a ele.', 'He\'s a good lad. Give him a chance.', null, [{ flag: 'nina_yes' }]], ['A decisão é sua, Nina.', 'The decision is yours, Nina.', null]]],
    ['nina', 'happy', 'Diga a ele que... que eu aceito um passeio até a ponte. Amanhã. Ao pôr do sol.', 'Tell him that... that I accept a walk to the bridge. Tomorrow. At sunset.'],
  ],
  sq_letter_end: [['tomas', 'surprise', 'Ela disse SIM?! Pelos sete! Guardião, eu te devo minha vida. Ou pelo menos minha dignidade.', 'She said YES?! By the seven! Warden, I owe you my life. Or at least my dignity.']],
  sq_herbs_offer: [
    ['mira', 'neutral', 'Meu estoque de ervas medicinais está no fim. Elas crescem nas florestas e campos — florzinhas brancas com folhas finas.', 'My stock of medicinal herbs is almost gone. They grow in forests and fields — little white flowers with thin leaves.'],
    ['mira', 'happy', 'Traga cinco e eu preparo poções para você.', 'Bring five and I\'ll brew potions for you.'],
    ['>', accept('sq_herbs')],
  ],
  sq_herbs_end: [['mira', 'happy', 'Perfeitas! Aqui estão suas poções. Tente não precisar de todas no mesmo dia.', 'Perfect! Here are your potions. Try not to need them all on the same day.', [{ take: 'herb', n: 5 }]]],
  sq_dog_offer: [
    ['pip', 'sad', 'O Biscoito sumiu! Ele correu atrás de um coelho pro lado do rio e não voltou!', 'Biscuit is gone! He chased a rabbit toward the river and didn\'t come back!'],
    ['>', accept('sq_dog')],
  ],
  sq_dog_end: [['pip', 'happy', 'BISCOITO! Você achou ele! Quando eu for Guardião, você vai ser meu Mestre!', 'BISCUIT! You found him! When I\'m a Warden, you\'ll be my Master!']],
  sq_fence_offer: [
    ['gerd', 'angry', 'A Ulla mudou a cerca três passos pro MEU lado! Três passos de trigo, Guardião!', 'Ulla moved the fence three steps onto MY side! Three steps of wheat, Warden!'],
    ['>', accept('sq_fence')],
  ],
  sq_fence_ulla: [
    ['ulla', 'angry', 'Mentira! Foi o Gerd que moveu a cerca no ano passado. Eu só coloquei de volta!', 'Lies! Gerd moved the fence last year. I just put it back!'],
    ['ulla', 'neutral', 'Mas olha... ninguém aqui lembra onde a cerca ficava de verdade.', 'But look... no one here really remembers where the fence was.'],
    ['>', [['Dividam a diferença: um passo e meio para cada.', 'Split the difference: a step and a half each.', null, [{ flag: 'fence_fair' }]], ['A cerca volta para onde Gerd diz.', 'The fence goes back where Gerd says.', null, [{ flag: 'fence_gerd' }]], ['A cerca fica onde Ulla colocou.', 'The fence stays where Ulla put it.', null, [{ flag: 'fence_ulla' }]]]],
  ],
  sq_fence_end: [['gerd', 'neutral', 'Hmpf. Se a Irmandade decidiu, tá decidido. Obrigado por não deixar a gente se matar por trigo.', 'Hmpf. If the Brotherhood decided, it\'s decided. Thanks for not letting us kill each other over wheat.']],
  sq_hunter_offer: [
    ['ivo', 'neutral', 'Os cervos estão comendo as mudas sagradas da floresta. A Anciã permite caçar três. Nem mais, nem menos.', 'The deer are eating the forest\'s sacred saplings. The Elder allows three to be hunted. No more, no less.'],
    ['>', accept('sq_hunter')],
  ],
  sq_hunter_end: [['ivo', 'happy', 'Três, como deve ser. Fique com meu arco de caçador. Ele merece mãos que respeitam a floresta.', 'Three, as it should be. Keep my hunter\'s bow. It deserves hands that respect the forest.']],
  sq_oak_offer: [
    ['lio', 'sad', 'O espírito do Carvalho Ancestral está inquieto. As três oferendas foram levadas pelo vento — ou por mãos.', 'The spirit of the Ancestral Oak is restless. The three offerings were carried off by the wind — or by hands.'],
    ['lio', 'neutral', 'Estão espalhadas pela mata ao redor. Pedras verdes, lisas, que brilham de leve.', 'They are scattered in the woods around here. Green, smooth stones that glow faintly.'],
    ['>', accept('sq_oak')],
  ],
  sq_oak_end: [['lio', 'happy', 'O Carvalho respira em paz outra vez. Ele lhe dá este manto de patrulheiro — tecido com fios de suas próprias folhas.', 'The Oak breathes in peace again. It gives you this ranger\'s cloak — woven with threads of its own leaves.']],
  sq_ore_offer: [
    ['tessa', 'neutral', 'Preciso de minério de ferro. Cinco pedaços. Tem nas Montanhas de Ferro — rochas com pintas laranja.', 'I need iron ore. Five pieces. There\'s some in the Iron Mountains — rocks with orange specks.'],
    ['>', accept('sq_ore')],
  ],
  sq_ore_end: [['tessa', 'smirk', 'Bom minério. Fiz um escudo com o que sobrou. Não quebre.', 'Good ore. I made a shield with what was left. Don\'t break it.', [{ take: 'ore', n: 5 }]]],
  sq_mine_offer: [
    ['doro', 'sad', 'Meu irmão trabalhava na mina velha, perto da fronteira de Drakmor. A mina desabou. Ele não voltou.', 'My brother worked in the old mine, near the Drakmor border. The mine collapsed. He didn\'t come back.'],
    ['doro', 'neutral', 'Só quero a picareta dele. Pra ter algo pra enterrar.', 'I just want his pickaxe. To have something to bury.'],
    ['>', accept('sq_mine')],
  ],
  sq_mine_end: [['doro', 'sad', 'É ela. A picareta do Bento... Obrigado, Guardião. Leve esta cota de malha. Ele ia querer que alguém vivo a usasse.', 'That\'s it. Bento\'s pickaxe... Thank you, Warden. Take this chainmail. He\'d want someone alive to wear it.', [{ take: 'q_miner_pick' }]]],
  sq_wolves_offer: [
    ['sigrun', 'angry', 'Uma alcateia de lobos do gelo ataca nossos rebanhos. O líder é enorme, de olhos azuis.', 'A pack of ice wolves attacks our herds. The leader is huge, with blue eyes.'],
    ['>', accept('sq_wolves')],
  ],
  sq_wolves_end: [['sigrun', 'happy', 'O Alfa caiu! Hoje Frostheim canta seu nome na taverna. Tome, um gibão de pele. Vai precisar no inverno.', 'The Alpha has fallen! Tonight Frostheim sings your name in the tavern. Here, a fur coat. You\'ll need it in winter.']],
  sq_bell_offer: [
    ['halden', 'sad', 'O sino do templo rachou na última tempestade, e o badalo caiu na encosta oeste. Bandidos acamparam lá.', 'The temple bell cracked in the last storm, and its clapper fell on the western slope. Bandits have camped there.'],
    ['>', accept('sq_bell')],
  ],
  sq_bell_end: [['halden', 'happy', 'O sino de Frostheim tocará de novo! Que este escudo o proteja como o sino protege a vila.', 'Frostheim\'s bell will ring again! May this shield protect you as the bell protects the village.', [{ take: 'q_bell_piece' }]]],
  sq_smugglers_offer: [
    ['rosa', 'angry', 'Contrabandistas na praia sul estão roubando minhas cargas e vendendo de volta pra mim! Tem descaramento?', 'Smugglers on the south beach are stealing my cargo and selling it back to me! The nerve!'],
    ['>', accept('sq_smugglers')],
  ],
  sq_smugglers_end: [['rosa', 'happy', 'A praia está limpa! Cem moedas e minha gratidão. A gratidão vale menos, mas é sincera.', 'The beach is clear! A hundred coins and my gratitude. The gratitude is worth less, but it\'s sincere.']],
  sq_fisher_offer: [
    ['baltasar', 'happy', 'Quer aprender a pescar, jovem? Tome esta vara velha. Pegue três peixes e eu lhe dou algo especial.', 'Want to learn to fish, youngster? Take this old rod. Catch three fish and I\'ll give you something special.'],
    ['baltasar', 'neutral', 'Fique de frente para a água e interaja. Quando o peixe morder, aperte de novo. Rápido!', 'Face the water and interact. When the fish bites, press again. Quickly!'],
    ['>', [['Vamos lá!', 'Let\'s do it!', null, [{ quest: 'sq_fisher' }, { give: 'fishing_rod' }]], ['Outro dia.', 'Another day.', null]]],
  ],
  sq_fisher_end: [['baltasar', 'happy', 'Três peixes! Você tem paciência de pescador. Fique com meu tridente — pescava tubarões com ele, nos velhos tempos.', 'Three fish! You have a fisher\'s patience. Keep my trident — I used to catch sharks with it, back in the day.']],
  sq_cargo_offer: [
    ['jorund', 'neutral', 'Tenho uma carga de sementes para Cinzamar. Ninguém quer levar, por causa da... história. Você levaria?', 'I have a load of seeds for Cinzamar. No one wants to take it, because of the... history. Would you?'],
    ['>', [['Eu levo.', 'I\'ll take it.', null, [{ quest: 'sq_cargo' }, { give: 'q_cargo' }]], ['Agora não.', 'Not now.', null]]],
  ],
  sq_cargo_halvar: [
    ['halvar', 'surprise', 'Sementes? De Várden? Para Cinzamar?', 'Seeds? From Várden? For Cinzamar?', [{ take: 'q_cargo' }]],
    ['halvar', 'sad', 'Vinte anos sem uma carroça de Várden nas nossas ruas. Agradeça ao mercador. E... obrigado a você também.', 'Twenty years without a Várden cart in our streets. Thank the merchant. And... thank you too.', [{ rep: { cinzamar: 15 } }]],
  ],
  sq_cargo_end: [['jorund', 'happy', 'Entregue? Excelente! Talvez seja o começo de algo. Aqui está sua parte.', 'Delivered? Excellent! Maybe it\'s the beginning of something. Here\'s your share.']],
  sq_child_offer: [
    ['lene', 'fear', 'Minha filha, Lia! Ela seguiu as luzes do pântano ontem à noite e não voltou!', 'My daughter, Lia! She followed the swamp lights last night and didn\'t come back!'],
    ['>', accept('sq_child')],
  ],
  sq_child_found: [
    ['villager', 'fear', 'Você... você não é uma luz do pântano, é?', 'You... you\'re not a swamp light, are you?'],
    ['player', 'happy', 'Não. Sua mãe está te esperando, Lia. Vamos pra casa.', 'No. Your mother is waiting for you, Lia. Let\'s go home.'],
    ['villager', 'happy', 'As luzes eram bonitas... mas eu tava com medo.', 'The lights were pretty... but I was scared.', [{ flag: 'child_found' }, { despawn: 'sqchild' }]],
  ],
  sq_child_end: [['lene', 'happy', 'LIA! Minha menina! Ravencross tem fama de fria, Guardião, mas nunca vou esquecer isso.', 'LIA! My girl! Ravencross is known for being cold, Warden, but I will never forget this.']],
  sq_witch_offer: [
    ['grendela', 'smirk', 'Heh. Um Guardião no meu brejo. Quer elixires? Traga-me cinco cogumelos do pântano. Os roxos.', 'Heh. A Warden in my swamp. Want elixirs? Bring me five swamp mushrooms. The purple ones.'],
    ['>', accept('sq_witch')],
  ],
  sq_witch_end: [['grendela', 'happy', 'Bonitinhos e venenosos. Perfeitos. Aqui, elixires de vigor. Não beba três de uma vez. Ou beba, e me conte depois.', 'Pretty and poisonous. Perfect. Here, vigor elixirs. Don\'t drink three at once. Or do, and tell me afterward.', [{ take: 'mushroom', n: 5 }]]],
  sq_relics_offer: [
    ['cinda', 'neutral', 'O Vale das Cinzas guarda relíquias da Guerra dos Sete. Saqueadores estão atrás delas. Eu quero chegar antes.', 'The Ash Valley holds relics from the War of the Seven. Looters are after them. I want to get there first.'],
    ['>', accept('sq_relics')],
  ],
  sq_relics_end: [['cinda', 'happy', 'Três tabuletas da Guerra dos Sete! Uma delas cita "o pacto das sete chamas". Tome, sua parte.', 'Three tablets from the War of the Seven! One of them mentions "the pact of the seven flames". Here, your share.']],
  sq_coal_offer: [
    ['doro', 'neutral', 'A Tessa de Várden me pediu carvão bom há meses. Ninguém de lá vem buscar. Leva pra ela?', 'Tessa of Várden asked me for good coal months ago. No one from there comes to fetch it. Take it to her?'],
    ['>', [['Levo.', 'I\'ll take it.', null, [{ quest: 'sq_coal' }, { give: 'q_coal_crate' }]], ['Agora não.', 'Not now.', null]]],
  ],
  sq_coal_tessa: [['tessa', 'surprise', 'Carvão de Cinzamar. O melhor que existe. Diga ao Doro que... obrigada.', 'Cinzamar coal. The best there is. Tell Doro... thank you.', [{ take: 'q_coal_crate' }]]],
  sq_library_offer: [
    ['teodoro', 'happy', 'A tumba tem uma biblioteca! Bem, tinha. Três tomos ainda devem estar lá dentro, espalhados.', 'The tomb has a library! Well, it had one. Three tomes must still be in there, scattered.'],
    ['>', accept('sq_library')],
  ],
  sq_library_end: [['teodoro', 'happy', 'Os três tomos! Trezentos anos de história que quase viraram poeira. Tome esta espada, encontrei nas ruínas há décadas.', 'All three tomes! Three hundred years of history that almost turned to dust. Take this sword, I found it in the ruins decades ago.']],
  sq_nevoa_offer: [
    ['bram', 'neutral', 'Já ouviu falar da Névoa? Uma égua branca que galopa pelas planícies ao norte de Várden. Ninguém nunca montou nela.', 'Ever heard of Mist? A white mare who gallops through the plains north of Várden. No one has ever ridden her.'],
    ['bram', 'happy', 'Traga três maçãs e volte aqui. Eu te ensino como ganhar a confiança dela.', 'Bring three apples and come back. I\'ll teach you how to earn her trust.'],
    ['>', accept('sq_nevoa')],
  ],
  sq_nevoa_bram: [
    ['bram', 'happy', 'Três maçãs, ótimo. Agora escute: ande devagar. Nunca corra perto dela. Ofereça uma maçã com a mão aberta.', 'Three apples, great. Now listen: walk slowly. Never run near her. Offer an apple with an open hand.', [{ flag: 'nevoa_trust' }]],
    ['bram', 'neutral', 'Se ela aceitar, ela é sua. E nenhum cavalo do reino vai alcançar vocês.', 'If she accepts, she\'s yours. And no horse in the kingdom will catch you.'],
  ],
  sq_tournament_offer: [
    ['roderic', 'neutral', 'Todo ano fazemos um torneio na praça. Três duelos, sem lâmina afiada. Quer participar?', 'Every year we hold a tournament in the plaza. Three duels, no sharp blades. Want to take part?'],
    ['>', accept('sq_tournament')],
  ],
  sq_tournament_r: [['roderic', 'neutral', 'Próximo adversário! Prepare-se!', 'Next opponent! Get ready!']],
  sq_tournament_end: [['roderic', 'happy', 'Campeão do Torneio de Várden! Este escudo da Irmandade é seu. Que ele aguente o que vier.', 'Champion of the Várden Tournament! This Brotherhood shield is yours. May it withstand whatever comes.']],
  sq_treasure_offer: [
    ['marta', 'smirk', 'Um viajante pagou a conta com um mapa do tesouro. Eu não tenho tempo pra caçar tesouro. Você tem?', 'A traveler paid his bill with a treasure map. I don\'t have time to hunt treasure. Do you?'],
    ['>', [['Fico com o mapa.', 'I\'ll take the map.', null, [{ quest: 'sq_treasure' }, { give: 'q_treasure_map' }]], ['Não, obrigado.', 'No, thanks.', null]]],
  ],
};
