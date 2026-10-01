const { MODELOS } = require('./schedules');

/** Embaralhamento Fisher-Yates. */
function embaralhar(lista) {
  const arr = lista.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Gera o sorteio (rodadas/partidas) para uma etapa, a partir da lista de IDs de
 * jogadores inscritos. Usa os modelos matematicamente verificados em schedules.js
 * (cada jogador joga ao lado de e contra todos os demais participantes pelo menos
 * uma vez, no menor numero de rodadas possivel dadas as quadras disponiveis).
 *
 * Regras (conforme especificacao):
 *  - ate 7 jogadores: 1 quadra
 *  - 8 jogadores: 2 quadras simultaneas, 7 rodadas
 */
function gerarSorteio(jogadorIds) {
  const n = jogadorIds.length;
  if (n < 4) {
    throw new Error('E preciso pelo menos 4 jogadores inscritos para gerar o sorteio.');
  }
  if (n > 8) {
    throw new Error('O sorteio automatico suporta no maximo 8 jogadores por etapa.');
  }
  const modelo = MODELOS[String(n)];
  if (!modelo) {
    throw new Error(`Nao ha modelo de sorteio disponivel para ${n} jogadores.`);
  }

  const embaralhados = embaralhar(jogadorIds);
  const partidas = [];

  modelo.forEach((rodadaModelo, idx) => {
    const rodada = idx + 1;
    rodadaModelo.matches.forEach((match, matchIdx) => {
      const quadra = matchIdx + 1;
      const [equipe1Idx, equipe2Idx] = match;
      partidas.push({
        rodada,
        quadra,
        equipe1: equipe1Idx.map((i) => embaralhados[i]),
        equipe2: equipe2Idx.map((i) => embaralhados[i]),
      });
    });
  });

  return partidas;
}

module.exports = { gerarSorteio, embaralhar };
