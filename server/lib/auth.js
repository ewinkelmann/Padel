const jwt = require('jsonwebtoken');
const db = require('../db');

const SEGREDO = process.env.JWT_SECRET;
if (!SEGREDO) {
  console.warn(
    '[padel-ranking] AVISO: JWT_SECRET nao definido. Usando um segredo temporario apenas para ' +
    'desenvolvimento local - defina JWT_SECRET no .env antes de publicar o site.'
  );
}
const SEGREDO_EFETIVO = SEGREDO || 'dev-secret-troque-isto-nao-usar-em-producao';
const COOKIE_NOME = 'padel_token';
const DIAS_EXPIRACAO = 30;

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role, jogador_id: usuario.jogador_id },
    SEGREDO_EFETIVO,
    { expiresIn: `${DIAS_EXPIRACAO}d` }
  );
}

function definirCookie(res, token) {
  res.cookie(COOKIE_NOME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DIAS_EXPIRACAO * 24 * 60 * 60 * 1000,
  });
}

function limparCookie(res) {
  res.clearCookie(COOKIE_NOME);
}

function autenticar(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NOME];
  if (!token) return res.status(401).json({ erro: 'Nao autenticado. Faca login.' });
  try {
    const payload = jwt.verify(token, SEGREDO_EFETIVO);
    // busca o usuario atualizado no banco (nome/role podem ter mudado desde que o
    // token foi emitido - ex.: o admin promoveu alguem a organizador) em vez de
    // confiar cegamente no que foi gravado no token na hora do login.
    const atual = db.prepare('SELECT id, nome, email, role, jogador_id FROM usuarios WHERE id = ?').get(payload.id);
    if (!atual) return res.status(401).json({ erro: 'Sessao invalida. Faca login novamente.' });
    req.usuario = atual;
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada. Faca login novamente.' });
  }
}

function exigirAdmin(req, res, next) {
  if (!req.usuario || req.usuario.role !== 'admin') {
    return res.status(403).json({ erro: 'Apenas o administrador pode realizar esta acao.' });
  }
  next();
}

/** Middleware-factory: libera a rota apenas para os papeis informados (ex.: permitirPapeis('admin', 'organizador')). */
function permitirPapeis(...papeis) {
  return (req, res, next) => {
    if (!req.usuario || !papeis.includes(req.usuario.role)) {
      return res.status(403).json({ erro: 'Voce nao tem permissao para realizar esta acao.' });
    }
    next();
  };
}

module.exports = { gerarToken, definirCookie, limparCookie, autenticar, exigirAdmin, permitirPapeis, COOKIE_NOME };
