const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { gerarToken, definirCookie, limparCookie, autenticar } = require('../lib/auth');

const router = express.Router();

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/registrar', (req, res) => {
  const { nome, email, senha } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe seu nome.' });
  if (!email || !validarEmail(email)) return res.status(400).json({ erro: 'Informe um e-mail valido.' });
  if (!senha || senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });

  const emailNorm = email.toLowerCase().trim();
  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(emailNorm);
  if (existente) return res.status(409).json({ erro: 'Ja existe uma conta com este e-mail.' });

  const senha_hash = bcrypt.hashSync(senha, 10);
  const criarUsuario = db.transaction(() => {
    const info = db
      .prepare(`INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, 'jogador')`)
      .run(nome.trim(), emailNorm, senha_hash);
    const usuarioId = info.lastInsertRowid;

    // cria automaticamente a entrada de jogador (ranking) correspondente,
    // reaproveitando um jogador ja cadastrado por nome (mesma grafia) se existir e
    // ainda nao estiver vinculado a outra conta.
    let jogador = db
      .prepare('SELECT id, usuario_id FROM jogadores WHERE nome = ? COLLATE NOCASE')
      .get(nome.trim());
    let jogadorId;
    if (jogador && !jogador.usuario_id) {
      jogadorId = jogador.id;
      db.prepare('UPDATE jogadores SET usuario_id = ? WHERE id = ?').run(usuarioId, jogadorId);
    } else if (!jogador) {
      const jogInfo = db
        .prepare('INSERT INTO jogadores (nome, usuario_id) VALUES (?, ?)')
        .run(nome.trim(), usuarioId);
      jogadorId = jogInfo.lastInsertRowid;
    } else {
      // ja existe um jogador com este nome vinculado a outra conta: cria um jogador
      // separado para nao misturar historicos de pessoas diferentes com nome igual.
      const jogInfo = db
        .prepare('INSERT INTO jogadores (nome, usuario_id) VALUES (?, ?)')
        .run(nome.trim(), usuarioId);
      jogadorId = jogInfo.lastInsertRowid;
    }
    db.prepare('UPDATE usuarios SET jogador_id = ? WHERE id = ?').run(jogadorId, usuarioId);
    return { usuarioId, jogadorId };
  });

  const { usuarioId, jogadorId } = criarUsuario();
  const usuario = { id: usuarioId, nome: nome.trim(), email: emailNorm, role: 'jogador', jogador_id: jogadorId };
  const token = gerarToken(usuario);
  definirCookie(res, token);
  res.status(201).json({ usuario });
});

router.post('/login', (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  const emailNorm = email.toLowerCase().trim();
  const row = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(emailNorm);
  if (!row || !bcrypt.compareSync(senha, row.senha_hash)) {
    return res.status(401).json({ erro: 'E-mail ou senha invalidos.' });
  }
  const usuario = { id: row.id, nome: row.nome, email: row.email, role: row.role, jogador_id: row.jogador_id };
  const token = gerarToken(usuario);
  definirCookie(res, token);
  res.json({ usuario });
});

router.post('/logout', (req, res) => {
  limparCookie(res);
  res.json({ ok: true });
});

router.get('/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

router.put('/senha', autenticar, (req, res) => {
  const { senhaAtual, novaSenha } = req.body || {};
  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }
  const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!row || !bcrypt.compareSync(senhaAtual || '', row.senha_hash)) {
    return res.status(401).json({ erro: 'Senha atual incorreta.' });
  }
  const novoHash = bcrypt.hashSync(novaSenha, 10);
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(novoHash, req.usuario.id);
  res.json({ ok: true });
});

module.exports = router;
