const express = require('express');
const db = require('../db');
const { autenticar } = require('../lib/auth');

const router = express.Router();

/** Monta {id, nome, games} de uma dupla a partir dos jogadores e placar da partida. */
function montarPartida(p) {
  if (!p) return null;
  return {
    id: p.id,
    equipe1: [
      { id: p.equipe1_j1, nome: p.equipe1_j1_nome },
      { id: p.equipe1_j2, nome: p.equipe1_j2_nome },
    ],
    equipe2: [
      { id: p.equipe2_j1, nome: p.equipe2_j1_nome },
      { id: p.equipe2_j2, nome: p.equipe2_j2_nome },
    ],
    games_equipe1: p.games_equipe1,
    games_equipe2: p.games_equipe2,
  };
}

// Lista, etapa por etapa (mais recente primeiro), os jogos do Hall da Fama ja
// gerados (Finalissima e, quando houver, Ultimalissima), com as duplas e o
// placar (se ja tiver sido lançado). Visivel para qualquer usuario logado.
router.get('/', autenticar, (req, res) => {
  const partidas = db
    .prepare(
      `SELECT p.*, e.nome AS etapa_nome, e.data AS etapa_data,
              j1.nome AS equipe1_j1_nome, j2.nome AS equipe1_j2_nome,
              j3.nome AS equipe2_j1_nome, j4.nome AS equipe2_j2_nome
       FROM partidas p
       JOIN etapas e ON e.id = p.etapa_id
       JOIN jogadores j1 ON j1.id = p.equipe1_j1
       JOIN jogadores j2 ON j2.id = p.equipe1_j2
       JOIN jogadores j3 ON j3.id = p.equipe2_j1
       JOIN jogadores j4 ON j4.id = p.equipe2_j2
       WHERE p.tipo != 'normal'
       ORDER BY e.data DESC, e.id DESC`
    )
    .all();

  const porEtapa = new Map();
  for (const p of partidas) {
    if (!porEtapa.has(p.etapa_id)) {
      porEtapa.set(p.etapa_id, {
        etapa: { id: p.etapa_id, nome: p.etapa_nome, data: p.etapa_data },
        finalissima: null,
        ultimalissima: null,
      });
    }
    const item = porEtapa.get(p.etapa_id);
    if (p.tipo === 'finalissima') item.finalissima = montarPartida(p);
    if (p.tipo === 'ultimalissima') item.ultimalissima = montarPartida(p);
  }

  res.json({ itens: Array.from(porEtapa.values()) });
});

module.exports = router;
