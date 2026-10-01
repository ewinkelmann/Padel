const express = require('express');
const { autenticar } = require('../lib/auth');
const { calcularRanking, calcularRankingEtapa, periodoAtual } = require('../lib/ranking');

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

// Ranking estatico (historico) de uma unica etapa - usado na aba "Por etapa".
router.get('/etapa/:id', autenticar, (req, res) => {
  try {
    const resultado = calcularRankingEtapa(req.params.id);
    res.json(resultado);
  } catch (e) {
    res.status(e.status || 400).json({ erro: e.message });
  }
});

module.exports = router;
