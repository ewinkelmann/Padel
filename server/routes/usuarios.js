const express = require('express');
const db = require('../db');
const { autenticar, exigirAdmin } = require('../lib/auth');

const router = express.Router();

// Lista os usuarios cadastrados (nome, e-mail, papel). Nao existe endpoint
// nenhum que exponha a senha - ela e guardada apenas como hash (bcrypt),
// um formato que nem o proprio sistema consegue reverter para o texto
// original. So o administrador pode ver esta lista.
router.get('/', autenticar, exigirAdmin, (req, res) => {
  const usuarios = db
    .prepare(
      `SELECT id, nome, email, role, criado_em
       FROM usuarios ORDER BY nome COLLATE NOCASE`
    )
    .all();
  res.json({ usuarios });
});

// Promove/remove o papel de "organizador" de um usuario (jogador de confianca
// autorizado pelo admin a criar etapas e realizar o sorteio inicial delas).
// Nao e possivel conceder nem remover o papel de administrador por aqui - existe
// sempre um unico admin, definido nas variaveis de ambiente do servidor.
router.put('/:id/papel', autenticar, exigirAdmin, (req, res) => {
  const { role } = req.body || {};
  if (!['jogador', 'organizador'].includes(role)) {
    return res.status(400).json({ erro: 'Papel invalido. Use "jogador" ou "organizador".' });
  }
  const usuario = db.prepare('SELECT id, role FROM usuarios WHERE id = ?').get(req.params.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });
  if (usuario.role === 'admin') {
    return res.status(409).json({ erro: 'Nao e possivel alterar o papel do administrador.' });
  }
  db.prepare('UPDATE usuarios SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
