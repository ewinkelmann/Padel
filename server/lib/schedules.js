// Modelos de sorteio (rodadas/partidas) verificados matematicamente por simulacao.
// Cada modelo usa indices de jogador 0..N-1; no sorteio real, os indices sao
// embaralhados aleatoriamente para os jogadores inscritos (isso e o 'sorteio').
// Cada jogador joga ao lado de (parceiro) e contra (adversario) todos os demais
// pelo menos uma vez, usando o numero minimo de rodadas possivel com as quadras
// disponiveis (1 quadra para ate 7 jogadores, 2 quadras simultaneas para 8).
// O modelo de 8 jogadores foi escolhido de forma que, combinado com a troca de
// quadras por rodada feita em sorteio.js, cada jogador alterne entre as quadras
// 01 e 02 (3 ou 4 jogos em cada uma, nas 7 rodadas).

const MODELOS = {
  "4": [
    {
      "matches": [
        [
          [
            2,
            0
          ],
          [
            1,
            3
          ]
        ]
      ],
      "resting": []
    },
    {
      "matches": [
        [
          [
            0,
            1
          ],
          [
            3,
            2
          ]
        ]
      ],
      "resting": []
    },
    {
      "matches": [
        [
          [
            2,
            1
          ],
          [
            0,
            3
          ]
        ]
      ],
      "resting": []
    }
  ],
  "5": [
    {
      "matches": [
        [
          [
            0,
            2
          ],
          [
            1,
            4
          ]
        ]
      ],
      "resting": [
        3
      ]
    },
    {
      "matches": [
        [
          [
            1,
            0
          ],
          [
            2,
            3
          ]
        ]
      ],
      "resting": [
        4
      ]
    },
    {
      "matches": [
        [
          [
            3,
            1
          ],
          [
            0,
            4
          ]
        ]
      ],
      "resting": [
        2
      ]
    },
    {
      "matches": [
        [
          [
            0,
            3
          ],
          [
            2,
            4
          ]
        ]
      ],
      "resting": [
        1
      ]
    },
    {
      "matches": [
        [
          [
            1,
            2
          ],
          [
            4,
            3
          ]
        ]
      ],
      "resting": [
        0
      ]
    }
  ],
  "6": [
    {
      "matches": [
        [
          [
            0,
            4
          ],
          [
            1,
            2
          ]
        ]
      ],
      "resting": [
        3,
        5
      ]
    },
    {
      "matches": [
        [
          [
            3,
            5
          ],
          [
            1,
            4
          ]
        ]
      ],
      "resting": [
        2,
        0
      ]
    },
    {
      "matches": [
        [
          [
            0,
            5
          ],
          [
            3,
            2
          ]
        ]
      ],
      "resting": [
        4,
        1
      ]
    },
    {
      "matches": [
        [
          [
            1,
            0
          ],
          [
            4,
            5
          ]
        ]
      ],
      "resting": [
        2,
        3
      ]
    },
    {
      "matches": [
        [
          [
            5,
            2
          ],
          [
            3,
            0
          ]
        ]
      ],
      "resting": [
        4,
        1
      ]
    },
    {
      "matches": [
        [
          [
            3,
            1
          ],
          [
            4,
            2
          ]
        ]
      ],
      "resting": [
        5,
        0
      ]
    },
    {
      "matches": [
        [
          [
            0,
            2
          ],
          [
            3,
            4
          ]
        ]
      ],
      "resting": [
        1,
        5
      ]
    },
    {
      "matches": [
        [
          [
            4,
            0
          ],
          [
            1,
            5
          ]
        ]
      ],
      "resting": [
        2,
        3
      ]
    }
  ],
  "7": [
    {
      "matches": [
        [
          [
            3,
            6
          ],
          [
            5,
            0
          ]
        ]
      ],
      "resting": [
        4,
        1,
        2
      ]
    },
    {
      "matches": [
        [
          [
            2,
            6
          ],
          [
            4,
            1
          ]
        ]
      ],
      "resting": [
        3,
        0,
        5
      ]
    },
    {
      "matches": [
        [
          [
            5,
            3
          ],
          [
            4,
            2
          ]
        ]
      ],
      "resting": [
        6,
        0,
        1
      ]
    },
    {
      "matches": [
        [
          [
            0,
            4
          ],
          [
            1,
            2
          ]
        ]
      ],
      "resting": [
        3,
        6,
        5
      ]
    },
    {
      "matches": [
        [
          [
            5,
            6
          ],
          [
            3,
            1
          ]
        ]
      ],
      "resting": [
        2,
        4,
        0
      ]
    },
    {
      "matches": [
        [
          [
            4,
            5
          ],
          [
            0,
            1
          ]
        ]
      ],
      "resting": [
        6,
        2,
        3
      ]
    },
    {
      "matches": [
        [
          [
            2,
            3
          ],
          [
            0,
            6
          ]
        ]
      ],
      "resting": [
        1,
        5,
        4
      ]
    },
    {
      "matches": [
        [
          [
            2,
            5
          ],
          [
            3,
            0
          ]
        ]
      ],
      "resting": [
        1,
        4,
        6
      ]
    },
    {
      "matches": [
        [
          [
            5,
            1
          ],
          [
            6,
            4
          ]
        ]
      ],
      "resting": [
        2,
        3,
        0
      ]
    },
    {
      "matches": [
        [
          [
            6,
            1
          ],
          [
            4,
            3
          ]
        ]
      ],
      "resting": [
        5,
        0,
        2
      ]
    },
    {
      "matches": [
        [
          [
            0,
            2
          ],
          [
            5,
            3
          ]
        ]
      ],
      "resting": [
        1,
        4,
        6
      ]
    }
  ],
  "8": [
    {
      "matches": [
        [
          [
            7,
            0
          ],
          [
            1,
            6
          ]
        ],
        [
          [
            2,
            5
          ],
          [
            3,
            4
          ]
        ]
      ],
      "resting": []
    },
    {
      "matches": [
        [
          [
            7,
            1
          ],
          [
            2,
            0
          ]
        ],
        [
          [
            3,
            6
          ],
          [
            4,
            5
          ]
        ]
      ],
      "resting": []
    },
    {
      "matches": [
        [
          [
            7,
            2
          ],
          [
            3,
            1
          ]
        ],
        [
          [
            4,
            0
          ],
          [
            5,
            6
          ]
        ]
      ],
      "resting": []
    },
    {
      "matches": [
        [
          [
            7,
            3
          ],
          [
            5,
            1
          ]
        ],
        [
          [
            4,
            2
          ],
          [
            6,
            0
          ]
        ]
      ],
      "resting": []
    },
    {
      "matches": [
        [
          [
            7,
            4
          ],
          [
            0,
            1
          ]
        ],
        [
          [
            5,
            3
          ],
          [
            6,
            2
          ]
        ]
      ],
      "resting": []
    },
    {
      "matches": [
        [
          [
            7,
            5
          ],
          [
            1,
            2
          ]
        ],
        [
          [
            6,
            4
          ],
          [
            0,
            3
          ]
        ]
      ],
      "resting": []
    },
    {
      "matches": [
        [
          [
            7,
            6
          ],
          [
            1,
            4
          ]
        ],
        [
          [
            0,
            5
          ],
          [
            2,
            3
          ]
        ]
      ],
      "resting": []
    }
  ]
};

module.exports = { MODELOS };
