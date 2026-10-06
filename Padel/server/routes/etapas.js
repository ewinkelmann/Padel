const express = require('express');
const db = require('../db');
const { autenticar, exigirAdmin, permitirPapeis } = require('../lib/auth');
const { gerarSorteio } = require('../lib/sorteio');
const { validarPlacar } = require('../lib/placares');
const { situacaoNormais, criarJogos, sincronizarAutomatico } = require('../lib/hallDaFama');

const router = express.Router();

function buscarEtapaOu404(id, res) {
  const etapa = db.prepare('SELECT * FROM etapas WHERE id = ?').get(id);
  if (!etapa) {
    res.status(404).json({ erro: 'Etapa nao encontrada.' });
    return null;
  }
  return etapa;
}

/** Busca um jogador existente (por nome, sem diferenciar maiusculas/minusculas) ou cria um novo. */
function resolverOuCriarJogador(nome) {
  const nomeLimpo = nome.trim();
  const existente = db.prepare('SELECT id FROM jogadores WHERE nome = ? COLLATE NOCASE').get(nomeLimpo);
  if (existente) return existente.id;
  const info = db.prepare('INSERT INTO jogadores (nome) VALUES (?)').run(nomeLimpo);
  return info.lastInsertRowid;
}

router.get('/', autenticar, (req, res) => {
  const etapas = db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM etapa_participantes ep WHERE ep.etapa_id = e.id) AS total_participantes,
              (SELECT COUNT(*) FROM partidas p WHERE p.etapa_id = e.id AND p.tipo = 'normal') AS total_partidas,
              (SELECT COUNT(*) FROM partidas p WHERE p.etapa_id = e.id AND p.tipo = 'normal' AND p.games_equipe1 IS NOT NULL) AS partidas_com_resultado
       FROM etapas e ORDER BY e.data DESC, e.id DESC`
    )
    .all();
  res.json({ etapas });
});

// Criar etapa: liberado para o administrador e para usuarios com papel "organizador"
// (jogadores de confianca autorizados pelo admin a abrir etapas e realizar sorteios).
router.post('/', autenticar, permitirPapeis('admin', 'organizador'), (req, res) => {
  const { nome, data } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome da etapa.' });
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ erro: 'Informe a data da etapa no formato AAAA-MM-DD.' });
  }
  const info = db
    .prepare(`INSERT INTO etapas (nome, data, status, criado_por) VALUES (?, ?, 'inscricoes', ?)`)
    .run(nome.trim(), data, req.usuario.id);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/:id', autenticar, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;

  const participantes = db
    .prepare(
      `SELECT j.id, j.nome FROM etapa_participantes ep
       JOIN jogadores j ON j.id = ep.jogador_id
       WHERE ep.etapa_id = ? ORDER BY j.nome COLLATE NOCASE`
    )
    .all(etapa.id);

  const partidas = db
    .prepare(
      `SELECT p.*, j1.nome AS equipe1_j1_nome, j2.nome AS equipe1_j2_nome,
              j3.nome AS equipe2_j1_nome, j4.nome AS equipe2_j2_nome
       FROM partidas p
       JOIN jogadores j1 ON j1.id = p.equipe1_j1
       JOIN jogadores j2 ON j2.id = p.equipe1_j2
       JOIN jogadores j3 ON j3.id = p.equipe2_j1
       JOIN jogadores j4 ON j4.id = p.equipe2_j2
       WHERE p.etapa_id = ?
       ORDER BY p.rodada ASC, p.quadra ASC`
    )
    .all(etapa.id);

  res.json({ etapa, participantes, partidas });
});

// Editar etapa: o administrador pode alterar nome, data e status; um
// organizador so pode corrigir o nome (data/status continuam exclusivos do
// admin, ja que mexem no fluxo da etapa, nao so no cadastro).
router.put('/:id', autenticar, permitirPapeis('admin', 'organizador'), (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  const ehAdmin = req.usuario.role === 'admin';
  const { nome, data, status } = req.body || {};
  const novoNome = nome && nome.trim() ? nome.trim() : etapa.nome;
  const novaData = ehAdmin && data ? data : etapa.data;
  const novoStatus = ehAdmin && status ? status : etapa.status;
  db.prepare('UPDATE etapas SET nome = ?, data = ?, status = ? WHERE id = ?').run(
    novoNome, novaData, novoStatus, etapa.id
  );
  res.json({ ok: true });
});

router.delete('/:id', autenticar, exigirAdmin, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  db.prepare('DELETE FROM partidas WHERE etapa_id = ?').run(etapa.id);
  db.prepare('DELETE FROM etapa_participantes WHERE etapa_id = ?').run(etapa.id);
  db.prepare('DELETE FROM etapas WHERE id = ?').run(etapa.id);
  res.json({ ok: true });
});

// Qualquer usuario autenticado pode incluir, numa etapa, um jogador que ja
// esteja cadastrado na secao "Inscritos" (marcado como "inscrito" = apto a
// jogar etapas). Nao cria mais jogadores novos por aqui - um atleta precisa
// ser cadastrado antes na secao "Inscritos" (admin/organizador).
router.post('/:id/participantes', autenticar, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  if (etapa.status !== 'inscricoes') {
    return res.status(409).json({ erro: 'As inscricoes desta etapa ja foram encerradas (sorteio ja realizado).' });
  }
  const { nome } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe o nome do jogador.' });

  const totalAtual = db
    .prepare('SELECT COUNT(*) AS n FROM etapa_participantes WHERE etapa_id = ?')
    .get(etapa.id);
  if (totalAtual.n >= 8) {
    return res.status(409).json({ erro: 'Esta etapa ja atingiu o maximo de 8 jogadores.' });
  }

  const nomeLimpo = nome.trim();
  const jogadorInscrito = db
    .prepare('SELECT id FROM jogadores WHERE nome = ? COLLATE NOCASE AND inscrito = 1')
    .get(nomeLimpo);
  if (!jogadorInscrito) {
    return res.status(400).json({
      erro: 'Este atleta nao esta na lista de Inscritos. Cadastre-o la antes de inclui-lo na etapa.',
    });
  }
  const jogadorId = jogadorInscrito.id;

  const jaInscrito = db
    .prepare('SELECT 1 FROM etapa_participantes WHERE etapa_id = ? AND jogador_id = ?')
    .get(etapa.id, jogadorId);
  if (jaInscrito) return res.status(409).json({ erro: 'Este jogador ja esta inscrito nesta etapa.' });

  db.prepare('INSERT INTO etapa_participantes (etapa_id, jogador_id, adicionado_por) VALUES (?, ?, ?)').run(
    etapa.id, jogadorId, req.usuario.id
  );
  res.status(201).json({ jogadorId, nome: nomeLimpo });
});

router.delete('/:id/participantes/:jogadorId', autenticar, exigirAdmin, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  if (etapa.status !== 'inscricoes') {
    return res.status(409).json({ erro: 'Nao e possivel remover participantes depois do sorteio.' });
  }
  db.prepare('DELETE FROM etapa_participantes WHERE etapa_id = ? AND jogador_id = ?').run(
    etapa.id, req.params.jogadorId
  );
  res.json({ ok: true });
});

// Gera (ou regenera) o sorteio de partidas da etapa.
// - O administrador pode sempre gerar ou refazer o sorteio.
// - Um usuario "organizador" so pode gerar o sorteio inicial (etapa ainda em
//   "inscricoes"); refazer um sorteio ja existente fica restrito ao admin.
router.post('/:id/sortear', autenticar, (req, res) => {
  const ehAdmin = req.usuario.role === 'admin';
  const ehOrganizador = req.usuario.role === 'organizador';
  if (!ehAdmin && !ehOrganizador) {
    return res.status(403).json({ erro: 'Voce nao tem permissao para realizar o sorteio.' });
  }

  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;

  if (!ehAdmin && etapa.status !== 'inscricoes') {
    return res.status(403).json({ erro: 'Apenas o administrador pode refazer um sorteio ja realizado.' });
  }

  if (etapa.modo === 'manual') {
    return res.status(409).json({
      erro: 'Esta etapa usa lancamento manual de partidas (retroativa) e nao pode ser sorteada automaticamente.',
    });
  }

  const participantes = db
    .prepare('SELECT jogador_id FROM etapa_participantes WHERE etapa_id = ?')
    .all(etapa.id);
  const ids = participantes.map((p) => p.jogador_id);

  if (ids.length < 4) {
    return res.status(409).json({ erro: 'E preciso pelo menos 4 jogadores inscritos para sortear.' });
  }
  if (ids.length > 8) {
    return res.status(409).json({ erro: 'No maximo 8 jogadores por etapa.' });
  }

  const algumaComResultado = db
    .prepare('SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND games_equipe1 IS NOT NULL')
    .get(etapa.id);
  if (algumaComResultado.n > 0) {
    return res.status(409).json({
      erro: 'Ja existem resultados lancados nesta etapa. Remova os resultados antes de gerar um novo sorteio.',
    });
  }

  let partidasGeradas;
  try {
    partidasGeradas = gerarSorteio(ids);
  } catch (e) {
    return res.status(400).json({ erro: e.message });
  }

  const transacao = db.transaction(() => {
    db.prepare('DELETE FROM partidas WHERE etapa_id = ?').run(etapa.id);
    const inserir = db.prepare(
      `INSERT INTO partidas (etapa_id, rodada, quadra, equipe1_j1, equipe1_j2, equipe2_j1, equipe2_j2)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of partidasGeradas) {
      inserir.run(etapa.id, p.rodada, p.quadra, p.equipe1[0], p.equipe1[1], p.equipe2[0], p.equipe2[1]);
    }
    db.prepare("UPDATE etapas SET status = 'sorteada' WHERE id = ?").run(etapa.id);
  });
  transacao();

  res.json({ ok: true, totalPartidas: partidasGeradas.length });
});

// Cadastra manualmente uma partida ja disputada (etapas retroativas, anteriores
// ao site, ou qualquer partida que precise ser lancada fora do fluxo de sorteio).
// Somente o administrador pode fazer isso. Nao exige sorteio nem limite de 8
// jogadores - os 4 nomes informados sao criados/reaproveitados e automaticamente
// inscritos na etapa, para constarem no ranking do periodo.
router.post('/:id/partidas', autenticar, exigirAdmin, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;

  const { equipe1, equipe2, games1, games2, rodada, quadra } = req.body || {};
  if (!Array.isArray(equipe1) || equipe1.length !== 2 || !Array.isArray(equipe2) || equipe2.length !== 2) {
    return res.status(400).json({ erro: 'Informe os dois jogadores de cada dupla.' });
  }
  const nomes = [...equipe1, ...equipe2].map((n) => (n || '').toString().trim());
  if (nomes.some((n) => !n)) {
    return res.status(400).json({ erro: 'Preencha o nome dos 4 jogadores.' });
  }
  const nomesNormalizados = nomes.map((n) => n.toLowerCase());
  if (new Set(nomesNormalizados).size !== 4) {
    return res.status(400).json({ erro: 'Os 4 jogadores da partida devem ser diferentes entre si.' });
  }

  const erroPlacar = validarPlacar(games1, games2);
  if (erroPlacar) return res.status(400).json({ erro: erroPlacar });

  const transacao = db.transaction(() => {
    const jogadorIds = nomes.map((nome) => resolverOuCriarJogador(nome));

    for (const jogadorId of jogadorIds) {
      const jaInscrito = db
        .prepare('SELECT 1 FROM etapa_participantes WHERE etapa_id = ? AND jogador_id = ?')
        .get(etapa.id, jogadorId);
      if (!jaInscrito) {
        db.prepare('INSERT INTO etapa_participantes (etapa_id, jogador_id, adicionado_por) VALUES (?, ?, ?)').run(
          etapa.id, jogadorId, req.usuario.id
        );
      }
    }

    const rodadaFinal = rodada
      ? Number(rodada)
      : db.prepare('SELECT COALESCE(MAX(rodada), 0) AS r FROM partidas WHERE etapa_id = ?').get(etapa.id).r + 1;
    const quadraFinal = quadra ? Number(quadra) : 1;

    const info = db
      .prepare(
        `INSERT INTO partidas
           (etapa_id, rodada, quadra, equipe1_j1, equipe1_j2, equipe2_j1, equipe2_j2,
            games_equipe1, games_equipe2, resultado_lancado_por, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        etapa.id, rodadaFinal, quadraFinal,
        jogadorIds[0], jogadorIds[1], jogadorIds[2], jogadorIds[3],
        Number(games1), Number(games2), req.usuario.id
      );

    // uma etapa que ainda estava em "inscricoes" passa a ser tratada como manual
    const novoModo = etapa.status === 'inscricoes' ? 'manual' : etapa.modo;
    const total = db.prepare("SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND tipo = 'normal'").get(etapa.id).n;
    const comResultado = db
      .prepare("SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND tipo = 'normal' AND games_equipe1 IS NOT NULL")
      .get(etapa.id).n;
    const novoStatus = total > 0 && total === comResultado ? 'finalizada' : 'sorteada';
    db.prepare('UPDATE etapas SET modo = ?, status = ? WHERE id = ?').run(novoModo, novoStatus, etapa.id);

    return info.lastInsertRowid;
  });

  const partidaId = transacao();
  sincronizarAutomatico(etapa.id);
  res.status(201).json({ ok: true, partidaId });
});

// Finaliza/trava a etapa: a partir daqui, somente o administrador pode lancar
// ou corrigir resultados das partidas (jogadores e organizadores ficam
// bloqueados). Pensado para ser usado depois que todos os resultados da
// etapa ja foram preenchidos, evitando alteracoes indevidas depois.
router.post('/:id/travar', autenticar, exigirAdmin, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  db.prepare('UPDATE etapas SET travada = 1 WHERE id = ?').run(etapa.id);
  res.json({ ok: true });
});

// Reabre uma etapa travada, para o administrador poder fazer algum ajuste.
router.post('/:id/destravar', autenticar, exigirAdmin, (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;
  db.prepare('UPDATE etapas SET travada = 0 WHERE id = ?').run(etapa.id);
  res.json({ ok: true });
});

// Gera os jogos do Hall da Fama desta etapa (Finalissima entre os 4 primeiros
// do ranking do dia - 1º e 4º contra 2º e 3º - e, se forem 8 jogadores,
// tambem a Ultimalissima entre os 4 ultimos - 5º e 8º contra 6º e 7º). Liberado
// para admin e organizador, assim como o sorteio. So pode ser feito uma vez por
// etapa e so depois que todas as partidas normais ja tiverem placar lancado,
// para o ranking usado na hora de montar as duplas ser definitivo.
router.post('/:id/hall-da-fama', autenticar, permitirPapeis('admin', 'organizador'), (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;

  const jaGerado = db
    .prepare(`SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND tipo != 'normal'`)
    .get(etapa.id);
  if (jaGerado.n > 0) {
    return res.status(409).json({ erro: 'Os jogos do Hall da Fama desta etapa ja foram gerados.' });
  }

  const { completas } = situacaoNormais(etapa.id);
  if (!completas) {
    return res.status(409).json({
      erro: 'Lance o resultado de todas as partidas normais da etapa antes de gerar os jogos do Hall da Fama.',
    });
  }

  const resultado = criarJogos(etapa.id);
  if (!resultado) {
    return res.status(409).json({ erro: 'E preciso pelo menos 4 jogadores com partidas disputadas para gerar a Finalissima.' });
  }
  res.status(201).json({ ok: true, ultimalissimaGerada: resultado.ultimalissimaGerada });
});

// Substitui um jogador por outro numa etapa ja sorteada, desde que nenhum
// resultado tenha sido lancado ainda (caso de quem nao pode comparecer de ultima
// hora). O substituto assume exatamente o lugar de quem saiu em todas as partidas
// do sorteio - duplas, adversarios e quadras continuam os mesmos. Liberado para
// admin e organizador. O substituto precisa estar marcado como "Inscrito".
router.post('/:id/substituir', autenticar, permitirPapeis('admin', 'organizador'), (req, res) => {
  const etapa = buscarEtapaOu404(req.params.id, res);
  if (!etapa) return;

  const saidaId = Number((req.body || {}).saidaId);
  const entradaId = Number((req.body || {}).entradaId);
  if (!Number.isInteger(saidaId) || !Number.isInteger(entradaId)) {
    return res.status(400).json({ erro: 'Informe quem sai e quem entra na etapa.' });
  }
  if (saidaId === entradaId) {
    return res.status(400).json({ erro: 'Escolha um jogador diferente para substituir.' });
  }
  if (etapa.status === 'inscricoes') {
    return res.status(409).json({
      erro: 'Esta etapa ainda nao foi sorteada. Enquanto as inscricoes estao abertas, o administrador pode remover o jogador e incluir outro.',
    });
  }
  const comResultado = db
    .prepare('SELECT COUNT(*) AS n FROM partidas WHERE etapa_id = ? AND games_equipe1 IS NOT NULL')
    .get(etapa.id).n;
  if (comResultado > 0) {
    return res.status(409).json({
      erro: 'Esta etapa ja tem resultados salvos, entao nao e mais possivel substituir jogadores.',
    });
  }

  const saiu = db
    .prepare('SELECT 1 FROM etapa_participantes WHERE etapa_id = ? AND jogador_id = ?')
    .get(etapa.id, saidaId);
  if (!saiu) return res.status(404).json({ erro: 'O jogador que sai nao esta nesta etapa.' });

  const entrada = db.prepare('SELECT id, inscrito FROM jogadores WHERE id = ?').get(entradaId);
  if (!entrada || !entrada.inscrito) {
    return res.status(400).json({ erro: 'O substituto precisa estar cadastrado e marcado como Inscrito na secao Inscritos.' });
  }
  const jaNaEtapa = db
    .prepare('SELECT 1 FROM etapa_participantes WHERE etapa_id = ? AND jogador_id = ?')
    .get(etapa.id, entradaId);
  if (jaNaEtapa) return res.status(409).json({ erro: 'O substituto ja esta nesta etapa.' });

  db.transaction(() => {
    db.prepare('UPDATE etapa_participantes SET jogador_id = ?, adicionado_por = ? WHERE etapa_id = ? AND jogador_id = ?')
      .run(entradaId, req.usuario.id, etapa.id, saidaId);
    for (const col of ['equipe1_j1', 'equipe1_j2', 'equipe2_j1', 'equipe2_j2']) {
      db.prepare(`UPDATE partidas SET ${col} = ? WHERE etapa_id = ? AND ${col} = ?`).run(entradaId, etapa.id, saidaId);
    }
  })();
  res.json({ ok: true });
});

module.exports = router;
