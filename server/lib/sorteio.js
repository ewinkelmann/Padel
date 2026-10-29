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
 * Com 2 quadras simultaneas (8 jogadores), define em cada rodada se os dois
 * jogos ficam como no modelo ou trocam de quadra entre si, de forma que cada
 * jogador alterne o maximo possivel entre as quadras 01 e 02 (idealmente 3 ou 4
 * jogos em cada uma, nas 7 rodadas) e evite jogar muitas vezes seguidas na mesma.
 * Testa todas as combinacoes (2^rodadas, so 128 para 7 rodadas), escolhe a de
 * menor custo e sorteia entre as empatadas. As duplas e adversarios nao mudam -
 * so a quadra de cada jogo.
 */
function escolherTrocasDeQuadra(modelo) {
  const n = modelo.length;
  if (!modelo.every((r) => r.matches.length === 2)) return new Array(n).fill(false);

  let melhorCusto = Infinity;
  let melhores = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const hist = {}; // indice do jogador -> quadras por rodada
    for (let r = 0; r < n; r++) {
      const troca = !!(mask & (1 << r));
      modelo[r].matches.forEach((match, mi) => {
        const quadra = troca ? 2 - mi : mi + 1;
        [...match[0], ...match[1]].forEach((j) => { (hist[j] = hist[j] || []).push(quadra); });
      });
    }
    let custo = 0;
    for (const seq of Object.values(hist)) {
      const q1 = seq.filter((q) => q === 1).length;
      const desbalanco = Math.abs(q1 - (seq.length - q1));
      custo += Math.max(0, desbalanco - 1) * 100; // 3x4 e aceitavel, alem disso pesa muito
      let seguidas = 0;
      for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) seguidas++;
      custo += seguidas;
    }
    if (custo < melhorCusto) { melhorCusto = custo; melhores = [mask]; }
    else if (custo === melhorCusto) melhores.push(mask);
  }
  const mask = melhores[Math.floor(Math.random() * melhores.length)];
  return Array.from({ length: n }, (_, r) => !!(mask & (1 << r)));
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
  const trocas = escolherTrocasDeQuadra(modelo);

  modelo.forEach((rodadaModelo, idx) => {
    const rodada = idx + 1;
    const matches = rodadaModelo.matches;
    rodadaModelo.matches.forEach((match, matchIdx) => {
      // com 2 quadras, "trocas[idx]" inverte qual jogo acontece em qual quadra
      const quadra = matches.length === 2 && trocas[idx] ? 2 - matchIdx : matchIdx + 1;
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
