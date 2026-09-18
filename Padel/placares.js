// Placares validos de padel conforme a regra 1.5: o jogo termina quando uma
// dupla atinge 3 games, entao os unicos placares possiveis sao 3x0, 3x1 e 3x2.
const PLACARES_VALIDOS = new Set(['3-0', '3-1', '3-2', '0-3', '1-3', '2-3']);

/** Retorna null se o placar for valido, ou uma mensagem de erro. */
function validarPlacar(games1, games2) {
  const g1 = Number(games1);
  const g2 = Number(games2);
  if (!Number.isInteger(g1) || !Number.isInteger(g2)) {
    return 'Informe o placar em games (numeros inteiros).';
  }
  if (!PLACARES_VALIDOS.has(`${g1}-${g2}`)) {
    return 'Placar invalido. Os resultados possiveis no padel sao 3x0, 3x1 ou 3x2 (para qualquer uma das duplas).';
  }
  return null;
}

module.exports = { PLACARES_VALIDOS, validarPlacar };
