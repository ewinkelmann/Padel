// Modelos de sorteio (rodadas/partidas) verificados matematicamente por simulacao.
// Cada modelo usa indices de jogador 0..N-1; no sorteio real, os indices sao
// embaralhados aleatoriamente para os jogadores inscritos (isso e o 'sorteio').
// Cada jogador joga ao lado de (parceiro) e contra (adversario) todos os demais
// pelo menos uma vez, usando o numero minimo de rodadas possivel com as quadras
// disponiveis (1 quadra para ate 7 jogadores, 2 quadras simultaneas para 8).

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
            4,
            1
          ],
          [
            5,
            2
          ]
        ],
        [
          [
            0,
            3
          ],
          [
            7,
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
            3,
            6
          ],
          [
            4,
            5
          ]
        ],
        [
          [
            0,
            7
          ],
          [
            2,
            1
          ]
        ]
      ],
      "resting": []
    },
    {
      "matches": [
        [
          [
            3,
            4
          ],
          [
            1,
            0
          ]
        ],
        [
          [
            2,
            7
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
            3,
            1
          ],
          [
            6,
            2
          ]
        ],
        [
          [
            5,
            7
          ],
          [
            0,
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
            0,
            6
          ],
          [
            5,
            1
          ]
        ],
        [
          [
            3,
            7
          ],
          [
            2,
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
            5,
            3
          ],
          [
            0,
            2
          ]
        ],
        [
          [
            1,
            6
          ],
          [
            7,
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
            5,
            0
          ],
          [
            1,
            7
          ]
        ],
        [
          [
            3,
            2
          ],
          [
            4,
            6
          ]
        ]
      ],
      "resting": []
    }
  ]
};

module.exports = { MODELOS };
