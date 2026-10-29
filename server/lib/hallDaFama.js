const db = require('../db');
const { calcularRankingEtapa } = require('./ranking');

/** Situacao das partidas normais de uma etapa. */
function situacaoNormais(etapaId) {
  const total = db
    .prepare("SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND tipo = 'normal'")
    .get(etapaId).n;
  const comResultado = db
    .prepare("SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND tipo = 'normal' AND games_equipe1 IS NOT NULL")
    .get(etapaId).n;
  return { total, comResultado, completas: total > 0 && total === comResultado };
}

/**
 * Cria os jogos do Hall da Fama a partir do ranking da etapa: Finalissima
 * (1º+4º x 2º+3º) e, com 8 jogadores, Ultimalissima (5º+8º x 6º+7º).
 * Quem chama garante que as partidas normais ja estao completas e que os jogos
 * ainda nao existem. Devolve { ultimalissimaGerada }.
 */
function criarJogos(etapaId) {
  const { ranking } = calcularRankingEtapa(etapaId);
  if (ranking.length < 4) return null;

  const porPosicao = {};
  ranking.forEach((l) => { porPosicao[l.posicao] = l.jogadorId; });

  const inserir = db.prepare(
    `INSERT INTO partidas (etapa_id, rodada, quadra, equipe1_j1, equipe1_j2, equipe2_j1, equipe2_j2, tipo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const geraUltimalissima = ranking.length >= 8;
  db.transaction(() => {
    inserir.run(etapaId, 0, 1, porPosicao[1], porPosicao[4], porPosicao[2], porPosicao[3], 'finalissima');
    if (geraUltimalissima) {
      inserir.run(etapaId, 0, 1, porPosicao[5], porPosicao[8], porPosicao[6], porPosicao[7], 'ultimalissima');
    }
  })();
  return { ultimalissimaGerada: geraUltimalissima };
}

/**
 * Chamado sempre que um resultado de partida normal muda. Em etapas com 8
 * jogadores, gera automaticamente a Finalissima e a Ultimalissima assim que
 * todos os resultados normais estiverem salvos. Se os jogos ja existem mas
 * nenhum recebeu placar ainda, eles sao refeitos (uma correcao de resultado
 * pode ter mudado o ranking); se algum ja tem placar, nada e alterado.
 */
function sincronizarAutomatico(etapaId) {
  const participantes = db
    .prepare('SELECT COUNT(*) AS n FROM etapa_participantes WHERE etapa_id = ?')
    .get(etapaId).n;
  if (participantes !== 8) return;

  const { completas } = situacaoNormais(etapaId);
  const especiais = db
    .prepare("SELECT id, games_equipe1 FROM partidas WHERE etapa_id = ? AND tipo != 'normal'")
    .all(etapaId);

  if (!completas) {
    // um resultado normal foi removido: jogos ainda sem placar perdem o sentido
    if (especiais.length && especiais.every((p) => p.games_equipe1 === null)) {
      db.prepare("DELETE FROM partidas WHERE etapa_id = ? AND tipo != 'normal'").run(etapaId);
    }
    return;
  }
  if (especiais.length) {
    if (!especiais.every((p) => p.games_equipe1 === null)) return;
    db.prepare("DELETE FROM partidas WHERE etapa_id = ? AND tipo != 'normal'").run(etapaId);
  }
  criarJogos(etapaId);
}

module.exports = { situacaoNormais, criarJogos, sincronizarAutomatico };
