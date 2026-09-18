const db = require('../db');

/** Traduz o parametro de periodo em datas de inicio/fim (strings 'YYYY-MM-DD'). */
function limitesPeriodo(tipo, periodo) {
  if (tipo === 'anual') {
    const ano = String(periodo);
    return { inicio: `${ano}-01-01`, fim: `${ano}-12-31`, rotulo: `Ranking anual ${ano}` };
  }
  if (tipo === 'semestral') {
    const [ano, semestre] = String(periodo).split('-');
    if (semestre === '2') {
      return { inicio: `${ano}-07-01`, fim: `${ano}-12-31`, rotulo: `${ano} - 2º semestre` };
    }
    return { inicio: `${ano}-01-01`, fim: `${ano}-06-30`, rotulo: `${ano} - 1º semestre` };
  }
  throw new Error("tipo deve ser 'semestral' ou 'anual'");
}

/** Dado um ano/mes, devolve os identificadores de periodo (para navegacao no front-end). */
function periodoAtual(data = new Date()) {
  const ano = data.getFullYear();
  const semestre = data.getMonth() < 6 ? 1 : 2;
  return { ano, semestre, periodoSemestral: `${ano}-${semestre}`, periodoAnual: `${ano}` };
}

function calcularRanking(tipo, periodo) {
  const { inicio, fim, rotulo } = limitesPeriodo(tipo, periodo);

  const etapas = db
    .prepare(`SELECT id FROM etapas WHERE data BETWEEN ? AND ?`)
    .all(inicio, fim);
  const etapaIds = new Set(etapas.map((e) => e.id));

  const stats = new Map(); // jogadorId -> {vitorias, derrotas, gamesGanhos, gamesPerdidos, partidasJogadas}
  const nomes = new Map();

  function garantir(jogadorId) {
    if (!stats.has(jogadorId)) {
      stats.set(jogadorId, {
        vitorias: 0,
        derrotas: 0,
        gamesGanhos: 0,
        gamesPerdidos: 0,
        partidasJogadas: 0,
      });
    }
    return stats.get(jogadorId);
  }

  if (etapaIds.size > 0) {
    const placeholders = Array.from(etapaIds).map(() => '?').join(',');

    // Todo jogador inscrito em alguma etapa do periodo deve aparecer no ranking,
    // mesmo que ainda nao tenha resultados lancados.
    const participantes = db
      .prepare(
        `SELECT DISTINCT ep.jogador_id, j.nome
         FROM etapa_participantes ep
         JOIN jogadores j ON j.id = ep.jogador_id
         WHERE ep.etapa_id IN (${placeholders})`
      )
      .all(...etapaIds);
    for (const p of participantes) {
      garantir(p.jogador_id);
      nomes.set(p.jogador_id, p.nome);
    }

    const partidas = db
      .prepare(
        `SELECT equipe1_j1, equipe1_j2, equipe2_j1, equipe2_j2, games_equipe1, games_equipe2
         FROM partidas
         WHERE etapa_id IN (${placeholders})
           AND games_equipe1 IS NOT NULL AND games_equipe2 IS NOT NULL`
      )
      .all(...etapaIds);

    for (const p of partidas) {
      const time1 = [p.equipe1_j1, p.equipe1_j2];
      const time2 = [p.equipe2_j1, p.equipe2_j2];
      const g1 = p.games_equipe1;
      const g2 = p.games_equipe2;
      const time1Venceu = g1 > g2;

      for (const jid of time1) {
        const s = garantir(jid);
        s.partidasJogadas += 1;
        s.gamesGanhos += g1;
        s.gamesPerdidos += g2;
        if (time1Venceu) s.vitorias += 1; else s.derrotas += 1;
      }
      for (const jid of time2) {
        const s = garantir(jid);
        s.partidasJogadas += 1;
        s.gamesGanhos += g2;
        s.gamesPerdidos += g1;
        if (!time1Venceu) s.vitorias += 1; else s.derrotas += 1;
      }
    }

    // confronto direto: mapa jogadorA|jogadorB -> vitorias de A sobre B (so quando opostos)
    var confrontos = construirConfrontos(partidas);
  } else {
    var confrontos = new Map();
  }

  // completa nomes que possam faltar (seguranca)
  for (const jid of stats.keys()) {
    if (!nomes.has(jid)) {
      const row = db.prepare('SELECT nome FROM jogadores WHERE id = ?').get(jid);
      nomes.set(jid, row ? row.nome : `Jogador ${jid}`);
    }
  }

  let linhas = Array.from(stats.entries()).map(([jogadorId, s]) => ({
    jogadorId,
    nome: nomes.get(jogadorId),
    vitorias: s.vitorias,
    derrotas: s.derrotas,
    partidasJogadas: s.partidasJogadas,
    gamesGanhos: s.gamesGanhos,
    gamesPerdidos: s.gamesPerdidos,
    saldoGames: s.gamesGanhos - s.gamesPerdidos,
  }));

  linhas = ordenarComCriteriosDeDesempate(linhas, confrontos);

  linhas.forEach((linha, idx) => {
    linha.posicao = idx + 1;
  });

  return { periodo, tipo, rotulo, inicio, fim, ranking: linhas };
}

function construirConfrontos(partidas) {
  // chave 'a-b' (a<b) -> {[a]: vitorias sobre b, [b]: vitorias sobre a}
  const mapa = new Map();
  function registrar(a, b, aGanhou) {
    const chave = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!mapa.has(chave)) mapa.set(chave, {});
    const reg = mapa.get(chave);
    reg[a] = (reg[a] || 0) + (aGanhou ? 1 : 0);
  }
  for (const p of partidas) {
    if (p.games_equipe1 === null || p.games_equipe2 === null) continue;
    const time1 = [p.equipe1_j1, p.equipe1_j2];
    const time2 = [p.equipe2_j1, p.equipe2_j2];
    const time1Venceu = p.games_equipe1 > p.games_equipe2;
    for (const a of time1) {
      for (const b of time2) {
        registrar(a, b, time1Venceu);
        registrar(b, a, !time1Venceu);
      }
    }
  }
  return mapa;
}

function vitoriasConfrontoDireto(confrontos, a, b) {
  const chave = a < b ? `${a}-${b}` : `${b}-${a}`;
  const reg = confrontos.get(chave);
  if (!reg) return 0;
  return reg[a] || 0;
}

/**
 * Ordena por: 1) vitorias, 2) saldo de games, 3) games ganhos, 4) confronto direto
 * (calculado apenas dentro do grupo empatado nos 3 primeiros criterios).
 * Caso o empate persista (nunca se enfrentaram, ou confronto circular), a ordem
 * final é alfabética, de forma estável e previsível.
 */
function ordenarComCriteriosDeDesempate(linhas, confrontos) {
  linhas.sort((a, b) => {
    if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
    if (b.saldoGames !== a.saldoGames) return b.saldoGames - a.saldoGames;
    if (b.gamesGanhos !== a.gamesGanhos) return b.gamesGanhos - a.gamesGanhos;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  // agrupa sequencias empatadas nos 3 primeiros criterios e resolve por confronto direto
  let i = 0;
  const resultado = linhas.slice();
  while (i < resultado.length) {
    let j = i + 1;
    while (
      j < resultado.length &&
      resultado[j].vitorias === resultado[i].vitorias &&
      resultado[j].saldoGames === resultado[i].saldoGames &&
      resultado[j].gamesGanhos === resultado[i].gamesGanhos
    ) {
      j++;
    }
    if (j - i > 1) {
      const grupo = resultado.slice(i, j);
      grupo.sort((a, b) => {
        const va = vitoriasConfrontoDireto(confrontos, a.jogadorId, b.jogadorId);
        const vb = vitoriasConfrontoDireto(confrontos, b.jogadorId, a.jogadorId);
        if (vb !== va) return vb - va;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
      for (let k = i; k < j; k++) resultado[k] = grupo[k - i];
    }
    i = j;
  }
  return resultado;
}

module.exports = { calcularRanking, periodoAtual, limitesPeriodo };
