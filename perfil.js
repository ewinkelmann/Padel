const db = require('../db');

// A partir de quantas partidas (ou, no caso do fisico/teamplay, de quantas
// etapas/parceiros distintos) um indicador passa a valer integralmente. Com
// menos dados que isso, o valor e puxado em direcao a uma media neutra (50),
// para uma unica partida isolada nao gerar notas extremas e pouco confiaveis.
const CONFIANCA_PARTIDAS = 6;
const CONFIANCA_ETAPAS_FISICO = 3;
const CONFIANCA_PARCEIROS = 5;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function confianca(n, alvo) { return clamp(n / alvo, 0, 1); }

/** Puxa "valor" em direcao a 50 proporcionalmente a falta de confianca (amostra pequena). */
function suavizar(valor, conf) {
  return 50 + (valor - 50) * conf;
}

function desvioPadrao(valores) {
  if (valores.length < 2) return 0;
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const variancia = valores.reduce((a, b) => a + (b - media) ** 2, 0) / valores.length;
  return Math.sqrt(variancia);
}

/** Lista os jogadores que ja disputaram pelo menos uma partida com resultado (para o seletor). */
function listarJogadoresComPartidas() {
  return db
    .prepare(
      `SELECT DISTINCT j.id, j.nome
       FROM jogadores j
       WHERE EXISTS (
         SELECT 1 FROM partidas p
         WHERE p.games_equipe1 IS NOT NULL AND p.tipo = 'normal'
           AND (p.equipe1_j1 = j.id OR p.equipe1_j2 = j.id OR p.equipe2_j1 = j.id OR p.equipe2_j2 = j.id)
       )
       ORDER BY j.nome COLLATE NOCASE`
    )
    .all();
}

/**
 * Calcula o "radar de forcas" de um jogador, de forma consolidada (todas as
 * etapas, todo o periodo). Sao 6 indicadores de 0 a 100:
 *
 * - Ataque: media de games conquistados pela dupla do jogador por partida
 *   (de 0 a 3 games por partida), em escala de 0 a 100.
 * - Defesa: o inverso - quanto menos games a dupla cede ao adversario por
 *   partida, maior a nota.
 * - Consistencia: o quanto o saldo de games (games ganhos - games perdidos)
 *   varia de partida para partida. Pouca variacao = jogo mais regular = nota
 *   mais alta; muita oscilacao entre goleadas e derrotas apertadas = nota
 *   mais baixa.
 * - Fisico: compara o saldo de games do jogador na primeira metade das
 *   rodadas de uma etapa com a segunda metade. Quem mantem (ou melhora) o
 *   nivel de jogo nas rodadas finais - quando o desgaste fisico pesa mais -
 *   recebe nota mais alta; quem cai de rendimento no fim, nota mais baixa.
 * - Teamplay: calcula a taxa de vitoria do jogador com cada parceiro
 *   diferente que ja teve (o sorteio troca as duplas a cada etapa) e premia
 *   quem joga bem com qualquer parceiro - penaliza quem so rende bem ao
 *   lado de uma pessoa especifica.
 * - Geral: a media simples dos cinco indicadores acima.
 *
 * Como e um grupo de amigos e cada um disputa um numero bem diferente de
 * partidas, todo indicador e suavizado em direcao a uma nota neutra (50)
 * quando a amostra ainda e pequena (ver CONFIANCA_* acima), para evitar notas
 * extremas tiradas de 1 ou 2 jogos isolados.
 */
function calcularPerfil(jogadorIdParam) {
  // req.params chega como string - precisa virar numero aqui, ja que mais abaixo
  // comparamos com === contra colunas inteiras vindas do banco (equipe1_j1 etc).
  const jogadorId = Number(jogadorIdParam);
  const jogador = db.prepare('SELECT id, nome FROM jogadores WHERE id = ?').get(jogadorId);
  if (!jogador) {
    const erro = new Error('Jogador nao encontrado.');
    erro.status = 404;
    throw erro;
  }

  // Jogos do Hall da Fama (Finalissima/Ultimalissima) ficam de fora do radar -
  // as duplas sao montadas artificialmente a partir do ranking final da etapa,
  // entao contar esses jogos distorceria as estatisticas (ataque/defesa/etc.).
  const partidas = db
    .prepare(
      `SELECT etapa_id, rodada, equipe1_j1, equipe1_j2, equipe2_j1, equipe2_j2, games_equipe1, games_equipe2
       FROM partidas
       WHERE games_equipe1 IS NOT NULL AND games_equipe2 IS NOT NULL AND tipo = 'normal'
         AND (equipe1_j1 = ? OR equipe1_j2 = ? OR equipe2_j1 = ? OR equipe2_j2 = ?)
       ORDER BY etapa_id, rodada`
    )
    .all(jogadorId, jogadorId, jogadorId, jogadorId);

  const N = partidas.length;

  if (N === 0) {
    return {
      jogador,
      partidasConsideradas: 0,
      radar: { geral: 50, ataque: 50, consistencia: 50, fisico: 50, defesa: 50, teamplay: 50 },
      amostraInsuficiente: true,
    };
  }

  let somaFavor = 0;
  let somaContra = 0;
  const saldos = [];
  const porEtapa = new Map(); // etapaId -> [{rodada, saldo}]
  const porParceiro = new Map(); // parceiroId -> {vitorias, jogos}

  for (const p of partidas) {
    const naEquipe1 = p.equipe1_j1 === jogadorId || p.equipe1_j2 === jogadorId;
    const favor = naEquipe1 ? p.games_equipe1 : p.games_equipe2;
    const contra = naEquipe1 ? p.games_equipe2 : p.games_equipe1;
    const venceu = favor > contra;
    const parceiroId = naEquipe1
      ? (p.equipe1_j1 === jogadorId ? p.equipe1_j2 : p.equipe1_j1)
      : (p.equipe2_j1 === jogadorId ? p.equipe2_j2 : p.equipe2_j1);

    somaFavor += favor;
    somaContra += contra;
    saldos.push(favor - contra);

    if (!porEtapa.has(p.etapa_id)) porEtapa.set(p.etapa_id, []);
    porEtapa.get(p.etapa_id).push({ rodada: p.rodada, saldo: favor - contra });

    if (!porParceiro.has(parceiroId)) porParceiro.set(parceiroId, { vitorias: 0, jogos: 0 });
    const reg = porParceiro.get(parceiroId);
    reg.jogos += 1;
    if (venceu) reg.vitorias += 1;
  }

  // --- Ataque / Defesa ---
  const mediaFavor = somaFavor / N;
  const mediaContra = somaContra / N;
  const ataque = suavizar(clamp((mediaFavor / 3) * 100, 0, 100), confianca(N, CONFIANCA_PARTIDAS));
  const defesa = suavizar(clamp(100 - (mediaContra / 3) * 100, 0, 100), confianca(N, CONFIANCA_PARTIDAS));

  // --- Consistencia (desvio padrao do saldo por partida, invertido) ---
  const stdevSaldo = desvioPadrao(saldos);
  const consistenciaBruta = clamp(100 - (stdevSaldo / 3) * 100, 0, 100);
  const consistencia = suavizar(consistenciaBruta, confianca(N, CONFIANCA_PARTIDAS));

  // --- Fisico (1a metade das rodadas da etapa vs 2a metade, por etapa) ---
  const diferencasPorEtapa = [];
  for (const jogos of porEtapa.values()) {
    const rodadasDistintas = Array.from(new Set(jogos.map((j) => j.rodada))).sort((a, b) => a - b);
    if (rodadasDistintas.length < 2) continue; // etapa com rodada unica nao da pra comparar metades
    const meio = rodadasDistintas[Math.floor(rodadasDistintas.length / 2)];
    const primeira = jogos.filter((j) => j.rodada < meio).map((j) => j.saldo);
    const segunda = jogos.filter((j) => j.rodada >= meio).map((j) => j.saldo);
    if (!primeira.length || !segunda.length) continue;
    const mediaPrimeira = primeira.reduce((a, b) => a + b, 0) / primeira.length;
    const mediaSegunda = segunda.reduce((a, b) => a + b, 0) / segunda.length;
    diferencasPorEtapa.push(mediaSegunda - mediaPrimeira);
  }
  let fisico;
  if (diferencasPorEtapa.length === 0) {
    fisico = 50;
  } else {
    const diffMedia = diferencasPorEtapa.reduce((a, b) => a + b, 0) / diferencasPorEtapa.length;
    const fisicoBruto = clamp(50 + diffMedia * (100 / 6), 0, 100);
    fisico = suavizar(fisicoBruto, confianca(diferencasPorEtapa.length, CONFIANCA_ETAPAS_FISICO));
  }

  // --- Teamplay (taxa de vitoria por parceiro distinto, penalizando variacao) ---
  const parceiros = Array.from(porParceiro.values());
  const taxasPorParceiro = parceiros.map((r) => r.vitorias / r.jogos);
  let teamplay;
  if (taxasPorParceiro.length === 0) {
    teamplay = 50;
  } else {
    const mediaTaxas = taxasPorParceiro.reduce((a, b) => a + b, 0) / taxasPorParceiro.length;
    const stdevTaxas = desvioPadrao(taxasPorParceiro);
    const teamplayBruto = clamp(mediaTaxas * 100 - stdevTaxas * 100 * 0.5, 0, 100);
    teamplay = suavizar(teamplayBruto, confianca(parceiros.length, CONFIANCA_PARCEIROS));
  }

  const geral = (ataque + consistencia + fisico + defesa + teamplay) / 5;

  const arred = (v) => Math.round(v);

  return {
    jogador,
    partidasConsideradas: N,
    etapasConsideradas: porEtapa.size,
    radar: {
      geral: arred(geral),
      ataque: arred(ataque),
      consistencia: arred(consistencia),
      fisico: arred(fisico),
      defesa: arred(defesa),
      teamplay: arred(teamplay),
    },
  };
}

module.exports = { calcularPerfil, listarJogadoresComPartidas };
