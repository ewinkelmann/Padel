const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'padel.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'jogador',
  jogador_id INTEGER REFERENCES jogadores(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jogadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  usuario_id INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS etapas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inscricoes',
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS etapa_participantes (
  etapa_id INTEGER NOT NULL REFERENCES etapas(id) ON DELETE CASCADE,
  jogador_id INTEGER NOT NULL REFERENCES jogadores(id),
  adicionado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (etapa_id, jogador_id)
);

CREATE TABLE IF NOT EXISTS partidas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  etapa_id INTEGER NOT NULL REFERENCES etapas(id) ON DELETE CASCADE,
  rodada INTEGER NOT NULL,
  quadra INTEGER NOT NULL DEFAULT 1,
  equipe1_j1 INTEGER NOT NULL REFERENCES jogadores(id),
  equipe1_j2 INTEGER NOT NULL REFERENCES jogadores(id),
  equipe2_j1 INTEGER NOT NULL REFERENCES jogadores(id),
  equipe2_j2 INTEGER NOT NULL REFERENCES jogadores(id),
  games_equipe1 INTEGER,
  games_equipe2 INTEGER,
  resultado_lancado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT
);

CREATE INDEX IF NOT EXISTS idx_partidas_etapa ON partidas(etapa_id);
CREATE INDEX IF NOT EXISTS idx_participantes_etapa ON etapa_participantes(etapa_id);
`);

function seedAdmin() {
  const jaTemAdmin = db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE role = 'admin'").get();
  if (jaTemAdmin.n > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_PASSWORD;
  const nome = process.env.ADMIN_NOME || 'Administrador';

  if (!email || !senha) {
    console.warn(
      '\n[padel-ranking] Nenhuma conta admin encontrada e ADMIN_EMAIL/ADMIN_PASSWORD nao foram ' +
      'definidas nas variaveis de ambiente. Defina-as no arquivo .env e reinicie o servidor para ' +
      'criar a conta administradora automaticamente. Veja o README.md.\n'
    );
    return;
  }

  const senha_hash = bcrypt.hashSync(senha, 10);
  const criarUsuario = db.prepare(
    `INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, 'admin')`
  );
  const info = criarUsuario.run(nome, email.toLowerCase().trim(), senha_hash);

  const criarJogador = db.prepare(
    `INSERT INTO jogadores (nome, usuario_id) VALUES (?, ?)`
  );
  const jogInfo = criarJogador.run(nome, info.lastInsertRowid);
  db.prepare('UPDATE usuarios SET jogador_id = ? WHERE id = ?').run(jogInfo.lastInsertRowid, info.lastInsertRowid);

  console.log(`[padel-ranking] Conta administradora criada para ${email}.`);
}

seedAdmin();

module.exports = db;
