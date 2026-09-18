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

module.exports = router;
