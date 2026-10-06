const express = require('express');
const db = require('../db');
const { autenticar, exigirAdmin, permitirPapeis } = require('../lib/auth');

const router = express.Router();

router.get('/', autenticar, (req, res) => {
  const jogadores = db
    .prepare(
      `SELECT j.id, j.nome, j.usuario_id, j.inscrito, j.mensalista,
              (SELECT COUNT(*) FROM partidas p
                 WHERE p.equipe1_j1 = j.id OR p.equipe1_j2 = j.id
                    OR p.equipe2_j1 = j.id OR p.equipe2_j2 = j.id) AS partidas_disputadas
       FROM jogadores j ORDER BY j.nome COLLATE NOCASE`
    )
    .all();
  res.json({ jogadores });
});

// Renomear um jogador (corrigir erro de digitacao, por exemplo) e liberado para
// o administrador e para organizadores - inclusive em etapas ja encerradas,
// ja que e uma correcao de cadastro, nao do resultado de uma partida.
router.put('/:id', autenticar, permitirPapeis('admin', 'organizador'), (req, res) => {
  const { nome } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe um nome.' });
  const existe = db.prepare('SELECT id FROM jogadores WHERE id = ?').get(req.params.id);
  if (!existe) return res.status(404).json({ erro: 'Jogador nao encontrado.' });
  try {
    db.prepare('UPDATE jogadores SET nome = ? WHERE id = ?').run(nome.trim(), req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(409).json({ erro: 'Ja existe outro jogador com esse nome.' });
  }
});

router.delete('/:id', autenticar, exigirAdmin, (req, res) => {
  const usado = db
    .prepare(
      `SELECT COUNT(*) AS n FROM partidas
       WHERE equipe1_j1 = ? OR equipe1_j2 = ? OR equipe2_j1 = ? OR equipe2_j2 = ?`
    )
    .get(req.params.id, req.params.id, req.params.id, req.params.id);
  if (usado.n > 0) {
    return res.status(409).json({ erro: 'Este jogador ja participou de partidas e nao pode ser excluido.' });
  }
  db.prepare('DELETE FROM etapa_participantes WHERE jogador_id = ?').run(req.params.id);
  db.prepare('DELETE FROM jogadores WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
