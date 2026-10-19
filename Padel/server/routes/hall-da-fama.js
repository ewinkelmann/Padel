const express = require('express');
const db = require('../db');
const { autenticar } = require('../lib/auth');

const router = express.Router();

/** Monta {id, nome, games} de uma dupla a partir dos jogadores e placar da partida. */
function montarPartida(p) {
  if (!p) return null;
  return {
    id: p.id,
    equipe1: [
      { id: p.equipe1_j1, nome: p.equipe1_j1_nome },
      { id: p.equipe1_j2, nome: p.equipe1_j2_nome },
    ],
    equipe2: [
      { id: p.equipe2_j1, nome: p.equipe2_j1_nome },
      { id: p.equipe2_j2, nome: p.equipe2_j2_nome },
    ],
    games_equipe1: p.games_equipe1,
    games_equipe2: p.games_equipe2,
  };
}

// Lista, etapa por etapa (mais recente primeiro), os jogos do Hall da Fama ja
// gerados (Finalissima e, quando houver, Ultimalissima), com as duplas e o
// placar (se ja tiver sido lançado). Visivel para qualquer usuario logado.
router.get('/', autenticar, (req, res) => {
  const partidas = db
    .prepare(
      `SELECT p.*, e.nome AS etapa_nome, e.data AS etapa_data,
              j1.nome AS equipe1_j1_nome, j2.nome AS equipe1_j2_nome,
              j3.nome AS equipe2_j1_nome, j4.nome AS equipe2_j2_nome
       FROM partidas p
       JOIN etapas e ON e.id = p.etapa_id
       JOIN jogadores j1 ON j1.id = p.equipe1_j1
       JOIN jogadores j2 ON j2.id = p.equipe1_j2
       JOIN jogadores j3 ON j3.id = p.equipe2_j1
       JOIN jogadores j4 ON j4.id = p.equipe2_j2
       WHERE p.tipo != 'normal'
       ORDER BY e.data DESC, e.id DESC`
    )
    .all();

  const porEtapa = new Map();
  for (const p of partidas) {
    if (!porEtapa.has(p.etapa_id)) {
      porEtapa.set(p.etapa_id, {
        etapa: { id: p.etapa_id, nome: p.etapa_nome, data: p.etapa_data },
        finalissima: null,
        ultimalissima: null,
      });
    }
    const item = porEtapa.get(p.etapa_id);
    if (p.tipo === 'finalissima') item.finalissima = montarPartida(p);
    if (p.tipo === 'ultimalissima') item.ultimalissima = montarPartida(p);
  }

  res.json({ itens: Array.from(porEtapa.values()) });
});

// Podio dos maiores ganhadores de Finalissimas. Cada jogador da dupla vencedora
// soma 1 vitoria por Finalissima ganha (so jogos com placar lancado). Como no
// podio de etapas, so aparece quem e Inscrito e Mensalista.
// Desempate: percentual de vitorias (vitorias / Finalissimas disputadas); depois,
// mais Finalissimas disputadas; por fim, ordem alfabetica.
router.get('/podio', autenticar, (req, res) => {
  const partidas = db
    .prepare(
      `SELECT equipe1_j1, equipe1_j2, equipe2_j1, equipe2_j2, games_equipe1, games_equipe2
       FROM partidas
       WHERE tipo = 'finalissima' AND games_equipe1 IS NOT NULL AND games_equipe2 IS NOT NULL`
    )
    .all();

  const stats = new Map(); // jogadorId -> {vitorias, jogos}
  const contar = (jogadorId, venceu) => {
    const s = stats.get(jogadorId) || { vitorias: 0, jogos: 0 };
    s.jogos += 1;
    if (venceu) s.vitorias += 1;
    stats.set(jogadorId, s);
  };
  for (const p of partidas) {
    const time1Venceu = p.games_equipe1 > p.games_equipe2;
    [p.equipe1_j1, p.equipe1_j2].forEach((id) => contar(id, time1Venceu));
    [p.equipe2_j1, p.equipe2_j2].forEach((id) => contar(id, !time1Venceu));
  }

  let linhas = [];
  if (stats.size > 0) {
    const ids = Array.from(stats.keys());
    const jogadores = db
      .prepare(`SELECT id, nome, inscrito, mensalista FROM jogadores WHERE id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids);
    linhas = jogadores
      .filter((j) => j.inscrito && j.mensalista)
      .map((j) => {
        const { vitorias, jogos } = stats.get(j.id);
        return { jogadorId: j.id, nome: j.nome, vitorias, jogos, percentualVitorias: (vitorias / jogos) * 100 };
      })
      .filter((l) => l.vitorias > 0);
  }

  linhas.sort((a, b) => {
    if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
    const fa = a.vitorias / a.jogos;
    const fb = b.vitorias / b.jogos;
    if (fb !== fa) return fb - fa;
    if (b.jogos !== a.jogos) return b.jogos - a.jogos;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  res.json({
    totalFinalissimas: partidas.length,
    podio: linhas.slice(0, 3).map((l, idx) => ({ ...l, posicao: idx + 1 })),
  });
});

module.exports = router;
