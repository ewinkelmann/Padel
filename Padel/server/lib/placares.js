// Placares validos: cada dupla pode fazer de 0 a 7 games e nao existe empate -
// uma das duplas sempre precisa ter mais games que a outra.
const MIN_GAMES = 0;
const MAX_GAMES = 7;

/** Retorna null se o placar for valido, ou uma mensagem de erro. */
function validarPlacar(games1, games2) {
  const g1 = Number(games1);
  const g2 = Number(games2);
  if (games1 === '' || games2 === '' || games1 == null || games2 == null ||
      !Number.isInteger(g1) || !Number.isInteger(g2)) {
    return 'Informe o placar em games (numeros inteiros).';
  }
  if (g1 < MIN_GAMES || g1 > MAX_GAMES || g2 < MIN_GAMES || g2 > MAX_GAMES) {
    return `Placar invalido. Cada dupla pode fazer de ${MIN_GAMES} a ${MAX_GAMES} games.`;
  }
  if (g1 === g2) {
    return 'Placar invalido. Nao pode haver empate - uma das duplas precisa ter mais games.';
  }
  return null;
}

module.exports = { MIN_GAMES, MAX_GAMES, validarPlacar };
