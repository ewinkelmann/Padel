const path = require('path');
const fs = require('fs');

// Carrega variaveis de ambiente do arquivo .env, se existir (sem dependencia externa).
(function carregarEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const conteudo = fs.readFileSync(envPath, 'utf8');
  conteudo.split('\n').forEach((linha) => {
    const l = linha.trim();
    if (!l || l.startsWith('#')) return;
    const idx = l.indexOf('=');
    if (idx === -1) return;
    const chave = l.slice(0, idx).trim();
    let valor = l.slice(idx + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (!(chave in process.env)) process.env[chave] = valor;
  });
})();

const express = require('express');
const cookieParser = require('cookie-parser');

require('./db'); // garante criacao das tabelas e semeadura do admin antes de subir o servidor

const app = express();
const PORT = process.env.PORT || 3000;

// necessario para que req.protocol reflita "https" corretamente quando o site
// roda atras de um proxy (Render, Railway etc.) - usado para montar o link
// de redefinicao de senha por e-mail.
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/jogadores', require('./routes/jogadores'));
app.use('/api/etapas', require('./routes/etapas'));
app.use('/api/partidas', require('./routes/partidas'));
app.use('/api/ranking', require('./routes/ranking'));
app.use('/api/usuarios', require('./routes/usuarios'));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`[padel-ranking] Servidor rodando na porta ${PORT}`);
});
