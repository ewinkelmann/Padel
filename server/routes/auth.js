const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { gerarToken, definirCookie, limparCookie, autenticar } = require('../lib/auth');
const { enviarEmailRedefinicaoSenha } = require('../lib/email');

const router = express.Router();
const VALIDADE_TOKEN_MINUTOS = 60;

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

// Passo 1: usuario informa o e-mail, recebe um link de redefinicao por e-mail.
// A resposta e sempre a mesma (mensagem generica), exista ou nao aquele e-mail
// no sistema - isso evita que alguem descubra quais e-mails estao cadastrados.
router.post('/esqueci-senha', async (req, res) => {
  const { email } = req.body || {};
  const mensagemGenerica = {
    ok: true,
    mensagem: 'Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha.',
  };
  if (!email || !validarEmail(email)) return res.json(mensagemGenerica);

  const emailNorm = email.toLowerCase().trim();
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(emailNorm);
  if (!usuario) return res.json(mensagemGenerica);

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiraEm = new Date(Date.now() + VALIDADE_TOKEN_MINUTOS * 60 * 1000).toISOString();

  db.prepare('INSERT INTO reset_tokens (usuario_id, token_hash, expira_em) VALUES (?, ?, ?)').run(
    usuario.id, tokenHash, expiraEm
  );

  const baseUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const link = `${baseUrl}/#/redefinir-senha?token=${token}`;

  await enviarEmailRedefinicaoSenha({ destinatario: usuario.email, nome: usuario.nome, link });

  res.json(mensagemGenerica);
});

// Passo 2: usuario chega pelo link do e-mail e define a nova senha.
router.post('/redefinir-senha', (req, res) => {
  const { token, novaSenha } = req.body || {};
  if (!token) return res.status(400).json({ erro: 'Link invalido ou incompleto.' });
  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const registro = db.prepare('SELECT * FROM reset_tokens WHERE token_hash = ?').get(tokenHash);

  if (!registro || registro.usado || new Date(registro.expira_em) < new Date()) {
    return res.status(400).json({ erro: 'Este link expirou ou ja foi usado. Solicite um novo.' });
  }

  const novoHash = bcrypt.hashSync(novaSenha, 10);
  const transacao = db.transaction(() => {
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(novoHash, registro.usuario_id);
    db.prepare('UPDATE reset_tokens SET usado = 1 WHERE id = ?').run(registro.id);
    // invalida quaisquer outros links de redefinicao pendentes deste usuario
    db.prepare('UPDATE reset_tokens SET usado = 1 WHERE usuario_id = ? AND id != ?').run(
      registro.usuario_id, registro.id
    );
  });
  transacao();

  res.json({ ok: true });
});

module.exports = router;
