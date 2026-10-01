const express = require('express');
const { autenticar } = require('../lib/auth');
const { calcularPerfil, listarJogadoresComPartidas } = require('../lib/perfil');

const router = express.Router();

router.get('/', autenticar, (req, res) => {
  const jogadores = listarJogadoresComPartidas();
  res.json({ jogadores });
});

router.get('/:jogadorId', autenticar, (req, res) => {
  try {
    const perfil = calcularPerfil(req.params.jogadorId);
    res.json(perfil);
  } catch (e) {
    res.status(e.status || 400).json({ erro: e.message });
  }
});

module.exports = router;
