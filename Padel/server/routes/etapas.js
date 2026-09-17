const express = require('express');
const db = require('../db');
const { autenticar, exigirAdmin } = require('../lib/auth');
const { gerarSorteio } = require('../lib/sorteio');

const router = express.Router();

function buscarEtapaOu404(id, res) {
  const etapa = db.prepare('SELECT * FROM etapas WHERE id = ?').get(id);
  if (!etapa) {
    res.status(404).json({ erro: 'Etapa nao encontrada.' });
    return null;
  }
  return etapa;
}

router.get('/', autenticar, (req, res) => {
  const etapas = db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM etapa_participantes ep WHERE ep.etapa_id = e.id) AS total_participantes,
              (SELECT COUNT(*) FROM partidas p WHERE p.etapa_id = e.id) AS total_partidas,
              (SELECT COUNT(*) FROM partidas p WHERE p.etapa_id = e.id AND p.games_equipe1 IS NOT NULL) AS partidas_com_resultado
       FROM etapas e ORDER BY e.data DESC, e.id DESC`
    )
    .all();
  res.json({ etapas });
});

router.post('/', autenticar, exigirAdmin, (req, res) => {
  const { nome, data } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome da etapa.' });
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ erro: 'Informe a data da etapa no formato AAAA-MM-DD.' });
  }
  const info = db
    .prepare(`INSERT INTO etapas (nome, data, status, criado_por) VALUES (?, ?, 'inscricoes', ?)`)
    .run(nome.trim(), data, req.usuario.id);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/:id', autenticar, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;

  const participantes = db
    .prepare(
      `SELECT j.id, j.nome FROM etapa_participantes ep
       JOIN jogadores j ON j.id = ep.jogador_id
       WHERE ep.etapa_id = ? ORDER BY j.nome COLLATE NOCASE`
    )
    .all(etapa.id);

  const partidas = db
    .prepare(
      `SELECT p.*, j1.nome AS equipe1_j1_nome, j2.nome AS equipe1_j2_nome,
              j3.nome AS equipe2_j1_nome, j4.nome AS equipe2_j2_nome
       FROM partidas p
       JOIN jogadores j1 ON j1.id = p.equipe1_j1
       JOIN jogadores j2 ON j2.id = p.equipe1_j2
       JOIN jogadores j3 ON j3.id = p.equipe2_j1
       JOIN jogadores j4 ON j4.id = p.equipe2_j2
       WHERE p.etapa_id = ?
       ORDER BY p.rodada ASC, p.quadra ASC`
    )
    .all(etapa.id);

  res.json({ etapa, participantes, partidas });
});

router.put('/:id', autenticar, exigirAdmin, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  const { nome, data, status } = req.body || {};
  const novoNome = nome && nome.trim() ? nome.trim() : etapa.nome;
  const novaData = data || etapa.data;
  const novoStatus = status || etapa.status;
  db.prepare('UPDATE etapas SET nome = ?, data = ?, status = ? WHERE id = ?').run(
    novoNome, novaData, novoStatus, etapa.id
  );
  res.json({ ok: true });
});

router.delete('/:id', autenticar, exigirAdmin, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  db.prepare('DELETE FROM partidas WHERE etapa_id = ?').run(etapa.id);
  db.prepare('DELETE FROM etapa_participantes WHERE etapa_id = ?').run(etapa.id);
  db.prepare('DELETE FROM etapas WHERE id = ?').run(etapa.id);
  res.json({ ok: true });
});

// Qualquer usuario autenticado pode incluir nomes de jogadores na etapa
// (cria o jogador se o nome ainda nao existir no sistema).
router.post('/:id/participantes', autenticar, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  if (etapa.status !== 'inscricoes') {
    return res.status(409).json({ erro: 'As inscricoes desta etapa ja foram encerradas (sorteio ja realizado).' });
  }
  const { nome } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome do jogador.' });

  const totalAtual = db
    .prepare('SELECT COUNT(*) AS n FROM etapa_participantes WHERE etapa_id = ?')
    .get(etapa.id);
  if (totalAtual.n >= 8) {
    return res.status(409).json({ erro: 'Esta etapa ja atingiu o maximo de 8 jogadores.' });
  }

  const nomeLimpo = nome.trim();
  let jogador = db.prepare('SELECT id FROM jogadores WHERE nome = ? COLLATE NOCASE').get(nomeLimpo);
  let jogadorId;
  if (jogador) {
    jogadorId = jogador.id;
  } else {
    const info = db.prepare('INSERT INTO jogadores (nome) VALUES (?)').run(nomeLimpo);
    jogadorId = info.lastInsertRowid;
  }

  const jaInscrito = db
    .prepare('SELECT 1 FROM etapa_participantes WHERE etapa_id = ? AND jogador_id = ?')
    .get(etapa.id, jogadorId);
  if (jaInscrito) return res.status(409).json({ erro: 'Este jogador ja esta inscrito nesta etapa.' });

  db.prepare('INSERT INTO etapa_participantes (etapa_id, jogador_id, adicionado_por) VALUES (?, ?, ?)').run(
    etapa.id, jogadorId, req.usuario.id
  );
  res.status(201).json({ jogadorId, nome: nomeLimpo });
});

router.delete('/:id/participantes/:jogadorId', autenticar, exigirAdmin, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  if (etapa.status !== 'inscricoes') {
    return res.status(409).json({ erro: 'Nao e possivel remover participantes depois do sorteio.' });
  }
  db.prepare('DELETE FROM etapa_participantes WHERE etapa_id = ? AND jogador_id = ?').run(
    etapa.id, req.params.jogadorId
  );
  res.json({ ok: true });
});

// Gera (ou regenera) o sorteio de partidas da etapa.
router.post('/:id/sortear', autenticar, exigirAdmin, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;

  const participantes = db
    .prepare('SELECT jogador_id FROM etapa_participantes WHERE etapa_id = ?')
    .all(etapa.id);
  const ids = participantes.map((p) => p.jogador_id);

  if (ids.length < 4) {
    return res.status(409).json({ erro: 'E preciso pelo menos 4 jogadores inscritos para sortear.' });
  }
  if (ids.length > 8) {
    return res.status(409).json({ erro: 'No maximo 8 jogadores por etapa.' });
  }

  const algumaComResultado = db
    .prepare('SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND games_equipe1 IS NOT NULL')
    .get(etapa.id);
  if (algumaComResultado.n > 0) {
    return res.status(409).json({
      erro: 'Ja existem resultados lancados nesta etapa. Remova os resultados antes de gerar um novo sorteio.',
    });
  }

  let partidasGeradas;
  try {
    partidasGeradas = gerarSorteio(ids);
  } catch (e) {
    return res.status(400).json({ erro: e.message });
  }

  const transacao = db.transaction(() => {
    db.prepare('DELETE FROM partidas WHERE etapa_id = ?').run(etapa.id);
    const inserir = db.prepare(
      `INSERT INTO partidas (etapa_id, rodada, quadra, equipe1_j1, equipe1_j2, equipe2_j1, equipe2_j2)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of partidasGeradas) {
      inserir.run(etapa.id, p.rodada, p.quadra, p.equipe1[0], p.equipe1[1], p.equipe2[0], p.equipe2[1]);
    }
    db.prepare("UPDATE etapas SET status = 'sorteada' WHERE id = ?").run(etapa.id);
  });
  transacao();

  res.json({ ok: true, totalPartidas: partidasGeradas.length });
});

module.exports = router;
