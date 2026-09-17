const express = require('express');
const db = require('../db');
const { autenticar } = require('../lib/auth');

const router = express.Router();

// Placares validos de padel conforme a regra 1.5: o jogo termina quando uma
// dupla atinge 3 games, entao os unicos placares possiveis sao 3x0, 3x1 e 3x2.
const PLACARES_VALIDOS = new Set(['3-0', '3-1', '3-2', '0-3', '1-3', '2-3']);

function atualizarStatusEtapa(etapaId) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ?').get(etapaId).n;
  const comResultado = db
    .prepare('SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND games_equipe1 IS NOT NULL')
    .get(etapaId).n;
  const etapa = db.prepare('SELECT status FROM etapas WHERE id = ?').get(etapaId);
  if (!etapa || etapa.status === 'inscricoes') return;
  const novoStatus = total > 0 && total === comResultado ? 'finalizada' : 'sorteada';
  if (novoStatus !== etapa.status) {
    db.prepare('UPDATE etapas SET status = ? WHERE id = ?').run(novoStatus, etapaId);
  }
}

router.put('/:id/resultado', autenticar, (req, res) => {
  const partida = db.prepare('SELECT * FROM partidas WHERE id = ?').get(req.params.id);
  if (!partida) return res.status(404).json({ erro: 'Partida nao encontrada.' });

  const jaTemResultado = partida.games_equipe1 !== null && partida.games_equipe2 !== null;
  if (jaTemResultado && req.usuario.role !== 'admin') {
    return res.status(403).json({
      erro: 'Este resultado ja foi lancado. Somente o administrador pode corrigi-lo.',
    });
  }

  let { games1, games2 } = req.body || {};
  games1 = Number(games1);
  games2 = Number(games2);
  if (!Number.isInteger(games1) || !Number.isInteger(games2)) {
    return res.status(400).json({ erro: 'Informe o placar em games (numeros inteiros).' });
  }
  const chave = `${games1}-${games2}`;
  if (!PLACARES_VALIDOS.has(chave)) {
    return res.status(400).json({
      erro: 'Placar invalido. Os resultados possiveis no padel sao 3x0, 3x1 ou 3x2 (para qualquer uma das duplas).',
    });
  }

  db.prepare(
    `UPDATE partidas SET games_equipe1 = ?, games_equipe2 = ?, resultado_lancado_por = ?, atualizado_em = datetime('now')
     WHERE id = ?`
  ).run(games1, games2, req.usuario.id, partida.id);

  atualizarStatusEtapa(partida.etapa_id);

  res.json({ ok: true });
});

module.exports = router;
