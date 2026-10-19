// Modelos de sorteio (rodadas/partidas) verificados matematicamente por simulacao.
// Cada modelo usa indices de jogador 0..N-1; no sorteio real, os indices sao
// embaralhados aleatoriamente para os jogadores inscritos (isso e o 'sorteio').
//
// Todos os modelos garantem que cada jogador joga ao lado de (parceiro) e contra
// (adversario) todos os demais pelo menos uma vez, com 1 quadra para ate 7
// jogadores e 2 quadras simultaneas para 8. Alem disso, os modelos foram
// escolhidos para que os confrontos sejam o mais igualitarios possivel:
//
//   jogadores | rodadas | parceiros (min-max) | adversarios (min-max por par)
//   4         | 3       | 1-1                 | 2-2 (perfeito)
//   5         | 5       | 1-1                 | 2-2 (perfeito)
//   6         | 9       | 1-2                 | 2-3 (9 pares com 2 e 6 pares com 3)
//   7         | 11      | 1-2                 | 2-4 (so 1 par chega a 4; os demais, 2)
//   8         | 7       | 1-1                 | 2-2 (perfeito)
//
// Com 6 jogadores usamos 9 rodadas: assim todos jogam exatamente 6 partidas (e
// descansam 3), e nunca ha jogador descansando 2 rodadas seguidas.
// Com 7 jogadores a variacao residual e inevitavel: o total de jogos nao e
// divisivel igualmente (alguns jogadores jogam 1 partida a mais) e, nessas
// condicoes, a matematica obriga que os dois jogadores com mais partidas se
// enfrentem mais vezes. Com 8 jogadores o equilibrio de adversarios e perfeito (cada
// par se enfrenta 2 vezes e e dupla 1 vez); em contrapartida, esse arranjo nao
// permite alternar quadras de forma perfeita para todos: 7 dos 8 jogadores alternam
// entre as quadras 01 e 02 (3 jogos numa e 4 na outra) e 1 jogador (sorteado)
// joga todas as suas partidas na mesma quadra.

const MODELOS = {
  "4": [
    {"matches":[[[2,0],[1,3]]],"resting":[]},
    {"matches":[[[0,1],[3,2]]],"resting":[]},
    {"matches":[[[2,1],[0,3]]],"resting":[]}
  ],
  "5": [
    {"matches":[[[0,2],[1,4]]],"resting":[3]},
    {"matches":[[[1,0],[2,3]]],"resting":[4]},
    {"matches":[[[3,1],[0,4]]],"resting":[2]},
    {"matches":[[[0,3],[2,4]]],"resting":[1]},
    {"matches":[[[1,2],[4,3]]],"resting":[0]}
  ],
  "6": [
    {"matches":[[[0,5],[4,1]]],"resting":[2,3]},
    {"matches":[[[0,1],[2,3]]],"resting":[4,5]},
    {"matches":[[[3,4],[2,5]]],"resting":[0,1]},
    {"matches":[[[5,0],[1,2]]],"resting":[3,4]},
    {"matches":[[[5,3],[4,0]]],"resting":[1,2]},
    {"matches":[[[3,4],[2,1]]],"resting":[0,5]},
    {"matches":[[[1,5],[0,2]]],"resting":[3,4]},
    {"matches":[[[3,0],[5,4]]],"resting":[1,2]},
    {"matches":[[[3,1],[4,2]]],"resting":[0,5]}
  ],
  "7": [
    {"matches":[[[0,6],[2,4]]],"resting":[1,3,5]},
    {"matches":[[[4,5],[0,3]]],"resting":[1,2,6]},
    {"matches":[[[2,6],[1,5]]],"resting":[0,3,4]},
    {"matches":[[[3,1],[4,0]]],"resting":[2,5,6]},
    {"matches":[[[6,4],[3,5]]],"resting":[0,1,2]},
    {"matches":[[[0,5],[1,2]]],"resting":[3,4,6]},
    {"matches":[[[4,3],[1,6]]],"resting":[0,2,5]},
    {"matches":[[[2,0],[3,6]]],"resting":[1,4,5]},
    {"matches":[[[5,2],[3,4]]],"resting":[0,1,6]},
    {"matches":[[[0,1],[6,5]]],"resting":[2,3,4]},
    {"matches":[[[3,2],[4,1]]],"resting":[0,5,6]}
  ],
  "8": [
    {"matches":[[[0,1],[2,3]],[[4,5],[6,7]]],"resting":[]},
    {"matches":[[[0,2],[5,7]],[[1,3],[4,6]]],"resting":[]},
    {"matches":[[[0,3],[5,6]],[[1,2],[4,7]]],"resting":[]},
    {"matches":[[[0,4],[3,7]],[[1,5],[2,6]]],"resting":[]},
    {"matches":[[[0,5],[1,4]],[[2,7],[3,6]]],"resting":[]},
    {"matches":[[[0,6],[2,4]],[[1,7],[3,5]]],"resting":[]},
    {"matches":[[[0,7],[1,6]],[[2,5],[3,4]]],"resting":[]}
  ]
};

module.exports = { MODELOS };
