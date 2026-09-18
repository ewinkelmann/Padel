const express = require('express');
const db = require('../db');
const { autenticar, exigirAdmin } = require('../lib/auth');
const { validarPlacar } = require('../lib/placares');

const router = express.Router();

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

  const { games1, games2 } = req.body || {};
  const erroPlacar = validarPlacar(games1, games2);
  if (erroPlacar) return res.status(400).json({ erro: erroPlacar });

  db.prepare(
    `UPDATE partidas SET games_equipe1 = ?, games_equipe2 = ?, resultado_lancado_por = ?, atualizado_em = datetime('now')
     WHERE id = ?`
  ).run(Number(games1), Number(games2), req.usuario.id, partida.id);

  atualizarStatusEtapa(partida.etapa_id);

  res.json({ ok: true });
});

// Exclui uma partida (por exemplo, uma partida retroativa cadastrada com erro).
// Somente o administrador pode excluir.
router.delete('/:id', autenticar, exigirAdmin, (req, res) => {
  const partida = db.prepare('SELECT * FROM partidas WHERE id = ?').get(req.params.id);
  if (!partida) return res.status(404).json({ erro: 'Partida nao encontrada.' });

  db.prepare('DELETE FROM partidas WHERE id = ?').run(partida.id);

  // recalcula o status da etapa (pode voltar a "sorteada" se deixou de estar completa)
  const total = db.prepare('SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ?').get(partida.etapa_id).n;
  const comResultado = db
    .prepare('SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND games_equipe1 IS NOT NULL')
    .get(partida.etapa_id).n;
  const etapa = db.prepare('SELECT status FROM etapas WHERE id = ?').get(partida.etapa_id);
  if (etapa && etapa.status !== 'inscricoes') {
    const novoStatus = total > 0 && total === comResultado ? 'finalizada' : 'sorteada';
    db.prepare('UPDATE etapas SET status = ? WHERE id = ?').run(novoStatus, partida.etapa_id);
  }

  res.json({ ok: true });
});

module.exports = router;
