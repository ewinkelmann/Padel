const express = require('express');
const { autenticar } = require('../lib/auth');
const { calcularRanking, periodoAtual } = require('../lib/ranking');

const router = express.Router();

router.get('/', autenticar, (req, res) => {
  const { tipo, periodo } = req.query;
  const atual = periodoAtual();
  const tipoFinal = tipo === 'anual' ? 'anual' : 'semestral';
  const periodoFinal = periodo || (tipoFinal === 'anual' ? atual.periodoAnual : atual.periodoSemestral);

  try {
    const resultado = calcularRanking(tipoFinal, periodoFinal);
    res.json(resultado);
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

module.exports = router;
