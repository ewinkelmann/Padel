const express = require('express');
const db = require('../db');
const { autenticar, permitirPapeis } = require('../lib/auth');

const router = express.Router();

// Secao "Inscritos": cadastro dos atletas aptos a jogar as etapas (com a
// informacao se sao ou nao mensalistas). Visivel so para administrador e
// organizador. A lista suspensa de inscricao de uma etapa so oferece quem
// estiver marcado como "inscrito" aqui, e o ranking geral (semestral/anual)
// so considera quem estiver "inscrito" E "mensalista".
router.get('/', autenticar, permitirPapeis('admin', 'organizador'), (req, res) => {
  const jogadores = db
    .prepare(
      `SELECT j.id, j.nome, j.inscrito, j.mensalista,
              (SELECT COUNT(*) FROM partidas p
                 WHERE p.tipo = 'normal'
                   AND (p.equipe1_j1 = j.id OR p.equipe1_j2 = j.id OR p.equipe2_j1 = j.id OR p.equipe2_j2 = j.id)) AS partidas_disputadas
       FROM jogadores j ORDER BY j.inscrito DESC, j.nome COLLATE NOCASE`
    )
    .all();
  res.json({ jogadores });
});

// Cadastra um novo atleta diretamente (sem precisar inscreve-lo numa etapa
// primeiro). Ja entra marcado como "inscrito"; "mensalista" vem do formulario.
router.post('/', autenticar, permitirPapeis('admin', 'organizador'), (req, res) => {
  const { nome, mensalista } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome do atleta.' });
  const nomeLimpo = nome.trim();

  const existente = db.prepare('SELECT id FROM jogadores WHERE nome = ? COLLATE NOCASE').get(nomeLimpo);
  if (existente) {
    return res.status(409).json({
      erro: 'Ja existe um jogador com esse nome. Use a lista abaixo para ativa-lo ou marca-lo como mensalista.',
    });
  }

  const info = db
    .prepare('INSERT INTO jogadores (nome, inscrito, mensalista) VALUES (?, 1, ?)')
    .run(nomeLimpo, mensalista ? 1 : 0);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Atualiza as marcacoes de "inscrito" (apto a jogar etapas) e/ou "mensalista"
// (conta para o ranking geral) de um atleta ja cadastrado.
router.put('/:id', autenticar, permitirPapeis('admin', 'organizador'), (req, res) => {
  const jogador = db.prepare('SELECT id, inscrito, mensalista FROM jogadores WHERE id = ?').get(req.params.id);
  if (!jogador) return res.status(404).json({ erro: 'Jogador nao encontrado.' });

  const { inscrito, mensalista } = req.body || {};
  const novoInscrito = inscrito === undefined ? jogador.inscrito : (inscrito ? 1 : 0);
  const novoMensalista = mensalista === undefined ? jogador.mensalista : (mensalista ? 1 : 0);

  db.prepare('UPDATE jogadores SET inscrito = ?, mensalista = ? WHERE id = ?').run(
    novoInscrito, novoMensalista, jogador.id
  );
  res.json({ ok: true });
});

module.exports = router;
