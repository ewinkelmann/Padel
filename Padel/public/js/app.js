(function () {
  'use strict';

  const viewEl = document.getElementById('view');
  const topbarEl = document.getElementById('topbar');
  const navLinksEl = document.getElementById('nav-links');
  const userBoxEl = document.getElementById('user-box');
  const menuToggleEl = document.getElementById('menu-toggle');
  const toastEl = document.getElementById('toast');

  let usuarioAtual = null;
  let toastTimer = null;

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  function h(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function mostrarToast(msg, tipo) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (tipo === 'erro' ? ' error' : '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4200);
  }

  async function api(caminho, opcoes) {
    const res = await fetch('/api' + caminho, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    }, opcoes, {
      headers: Object.assign({ 'Content-Type': 'application/json' }, (opcoes && opcoes.headers) || {}),
    }));
    let corpo = null;
    try { corpo = await res.json(); } catch (e) { /* sem corpo JSON */ }
    if (!res.ok) {
      const msg = (corpo && corpo.erro) || 'Ocorreu um erro inesperado.';
      throw new Error(msg);
    }
    return corpo;
  }

  function formatarData(iso) {
    if (!iso) return '';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  function nomeCurto(nome) {
    return nome;
  }

  const ROTULOS_STATUS = {
    inscricoes: { texto: 'Inscrições abertas', classe: 'badge-inscricoes' },
    sorteada: { texto: 'Em andamento', classe: 'badge-sorteada' },
    finalizada: { texto: 'Finalizada', classe: 'badge-finalizada' },
  };

  function badgeStatus(status) {
    const r = ROTULOS_STATUS[status] || { texto: status, classe: '' };
    return `<span class="badge ${r.classe}">${esc(r.texto)}</span>`;
  }

  // Monta uma folha simples (uma tabela por rodada/quadra) para imprimir os jogos
  // sorteados, com caixinhas em branco para anotar o placar a mão na quadra -
  // se a partida ja tiver resultado lancado no site, ele aparece pre-preenchido.
  function imprimirTabelaEtapa(etapa, partidas) {
    const rodadas = {};
    partidas.forEach((p) => { (rodadas[p.rodada] = rodadas[p.rodada] || []).push(p); });

    const linhas = Object.keys(rodadas).sort((a, b) => a - b).map((r) => {
      const jogos = rodadas[r].slice().sort((a, b) => a.quadra - b.quadra);
      return jogos.map((p) => {
        const temResultado = p.games_equipe1 !== null && p.games_equipe2 !== null;
        const v1 = temResultado ? esc(p.games_equipe1) : '';
        const v2 = temResultado ? esc(p.games_equipe2) : '';
        return `
          <tr>
            <td>${r}</td>
            <td>Quadra ${String(p.quadra).padStart(2, '0')}</td>
            <td>${esc(p.equipe1_j1_nome)} / ${esc(p.equipe1_j2_nome)}</td>
            <td class="print-vs">×</td>
            <td>${esc(p.equipe2_j1_nome)} / ${esc(p.equipe2_j2_nome)}</td>
            <td class="print-placar">
              <span class="print-score-box">${v1}</span>
              <span class="print-vs">×</span>
              <span class="print-score-box">${v2}</span>
            </td>
          </tr>
        `;
      }).join('');
    }).join('');

    const html = `
      <div class="print-cabecalho">
        <h1>${esc(etapa.nome)}</h1>
        <p>${formatarData(etapa.data)} · Padel Ranking</p>
      </div>
      <table class="print-tabela">
        <thead>
          <tr><th>Rodada</th><th>Quadra</th><th>Dupla 1</th><th></th><th>Dupla 2</th><th>Placar</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    `;

    let folha = document.getElementById('folha-impressao');
    if (!folha) {
      folha = document.createElement('div');
      folha.id = 'folha-impressao';
      document.body.appendChild(folha);
    }
    folha.innerHTML = html;
    window.print();
  }

  // ---------------------------------------------------------------------
  // Autenticação / navegação
  // ---------------------------------------------------------------------

  async function carregarUsuario() {
    try {
      const { usuario } = await api('/auth/me');
      usuarioAtual = usuario;
    } catch (e) {
      usuarioAtual = null;
    }
  }

  function renderTopbar() {
    if (!usuarioAtual) {
      topbarEl.hidden = true;
      return;
    }
    topbarEl.hidden = false;
    const rotaAtual = location.hash.replace('#', '') || '/etapas';
    const links = [
      ['/etapas', 'Etapas'],
      ['/ranking', 'Ranking'],
      ['/perfis', 'Perfis'],
    ];
    if (usuarioAtual.role === 'admin') links.push(['/usuarios', 'Usuários']);
    navLinksEl.innerHTML = links.map(([rota, label]) => {
      const ativo = rotaAtual.startsWith(rota) ? ' class="active"' : '';
      return `<a href="#${rota}"${ativo}>${esc(label)}</a>`;
    }).join('');

    userBoxEl.innerHTML = `
      ${usuarioAtual.role === 'admin' ? '<span class="badge-admin">Admin</span>' : ''}
      <a href="#/conta" class="small" style="color:#fff; text-decoration:underline;">${esc(usuarioAtual.nome.split(' ')[0])}</a>
      <button id="btn-sair">Sair</button>
    `;
    userBoxEl.querySelector('#btn-sair').addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST' });
      usuarioAtual = null;
      location.hash = '#/login';
    });
  }

  menuToggleEl.addEventListener('click', () => navLinksEl.classList.toggle('open'));

  // ---------------------------------------------------------------------
  // Roteador simples baseado em hash
  // ---------------------------------------------------------------------

  const rotasPublicas = ['/login', '/registro', '/esqueci-senha', '/redefinir-senha'];

  async function rotear() {
    let rota = location.hash.replace('#', '') || '/etapas';
    navLinksEl.classList.remove('open');

    if (!usuarioAtual) await carregarUsuario();

    const publica = rotasPublicas.some((r) => rota.startsWith(r));
    if (!usuarioAtual && !publica) {
      location.hash = '#/login';
      return;
    }
    if (usuarioAtual && publica) {
      location.hash = '#/etapas';
      return;
    }

    renderTopbar();

    try {
      if (rota.startsWith('/login')) return viewLogin();
      if (rota.startsWith('/registro')) return viewRegistro();
      if (rota.startsWith('/esqueci-senha')) return viewEsqueciSenha();
      if (rota.startsWith('/redefinir-senha')) return viewRedefinirSenha(rota);
      if (rota.startsWith('/etapas/')) return viewEtapaDetalhe(rota.split('/')[2]);
      if (rota.startsWith('/etapas')) return viewEtapas();
      if (rota.startsWith('/ranking')) return viewRanking();
      if (rota.startsWith('/perfis')) return viewPerfis();
      if (rota.startsWith('/usuarios')) return viewUsuarios();
      if (rota.startsWith('/conta')) return viewConta();
      location.hash = '#/etapas';
    } catch (e) {
      viewEl.innerHTML = `<div class="card"><p class="form-error">${esc(e.message)}</p></div>`;
    }
  }

  window.addEventListener('hashchange', rotear);
  window.addEventListener('DOMContentLoaded', rotear);

  // ---------------------------------------------------------------------
  // View: Login
  // ---------------------------------------------------------------------

  function viewLogin() {
    viewEl.innerHTML = '';
    const el = h(`
      <div class="center-hero">
        <div class="card">
          <h1>Entrar</h1>
          <p class="muted small">Acesse sua conta para inscrever jogadores, lançar resultados e ver o ranking.</p>
          <div id="erro-area"></div>
          <form id="form-login" class="stack">
            <div class="field">
              <label>E-mail</label>
              <input type="email" name="email" required autocomplete="email" />
            </div>
            <div class="field">
              <label>Senha</label>
              <input type="password" name="senha" required autocomplete="current-password" />
            </div>
            <button class="btn btn-block" type="submit">Entrar</button>
          </form>
          <p class="small muted" style="margin-top:14px; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <a class="link-btn" href="#/registro">Criar conta</a>
            <a class="link-btn" href="#/esqueci-senha">Esqueci minha senha</a>
          </p>
        </div>
      </div>
    `);
    viewEl.appendChild(el);
    el.querySelector('#form-login').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const btn = ev.target.querySelector('button');
      btn.disabled = true;
      try {
        await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: fd.get('email'), senha: fd.get('senha') }),
        });
        await carregarUsuario();
        location.hash = '#/etapas';
      } catch (e) {
        el.querySelector('#erro-area').innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
        btn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------
  // View: Esqueci minha senha / Redefinir senha
  // ---------------------------------------------------------------------

  function viewEsqueciSenha() {
    viewEl.innerHTML = '';
    const el = h(`
      <div class="center-hero">
        <div class="card">
          <h1>Esqueci minha senha</h1>
          <p class="muted small">Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link para você escolher uma nova senha.</p>
          <div id="erro-area"></div>
          <div id="sucesso-area"></div>
          <form id="form-esqueci" class="stack">
            <div class="field">
              <label>E-mail</label>
              <input type="email" name="email" required autocomplete="email" />
            </div>
            <button class="btn btn-block" type="submit">Enviar link</button>
          </form>
          <p class="small muted" style="margin-top:14px;">
            <a class="link-btn" href="#/login">← Voltar para o login</a>
          </p>
        </div>
      </div>
    `);
    viewEl.appendChild(el);
    el.querySelector('#form-esqueci').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const btn = ev.target.querySelector('button');
      btn.disabled = true;
      try {
        const resp = await api('/auth/esqueci-senha', {
          method: 'POST',
          body: JSON.stringify({ email: fd.get('email') }),
        });
        ev.target.hidden = true;
        el.querySelector('#sucesso-area').innerHTML = `<div class="help-box">${esc(resp.mensagem)}</div>`;
      } catch (e) {
        el.querySelector('#erro-area').innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
        btn.disabled = false;
      }
    });
  }

  function viewRedefinirSenha(rota) {
    const queryString = rota.includes('?') ? rota.split('?')[1] : '';
    const params = new URLSearchParams(queryString);
    const token = params.get('token');

    viewEl.innerHTML = '';

    if (!token) {
      viewEl.appendChild(h(`
        <div class="center-hero">
          <div class="card">
            <h1>Link inválido</h1>
            <p class="muted small">Este link de redefinição de senha está incompleto. Solicite um novo.</p>
            <a class="btn btn-block" href="#/esqueci-senha">Solicitar novo link</a>
          </div>
        </div>
      `));
      return;
    }

    const el = h(`
      <div class="center-hero">
        <div class="card">
          <h1>Definir nova senha</h1>
          <div id="erro-area"></div>
          <div id="sucesso-area"></div>
          <form id="form-redefinir" class="stack">
            <div class="field">
              <label>Nova senha</label>
              <input type="password" name="novaSenha" required minlength="6" autocomplete="new-password" />
              <div class="form-hint">Mínimo de 6 caracteres.</div>
            </div>
            <div class="field">
              <label>Confirmar nova senha</label>
              <input type="password" name="confirmarSenha" required minlength="6" autocomplete="new-password" />
            </div>
            <button class="btn btn-block" type="submit">Salvar nova senha</button>
          </form>
        </div>
      </div>
    `);
    viewEl.appendChild(el);
    el.querySelector('#form-redefinir').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const novaSenha = fd.get('novaSenha');
      const confirmarSenha = fd.get('confirmarSenha');
      const btn = ev.target.querySelector('button');
      if (novaSenha !== confirmarSenha) {
        el.querySelector('#erro-area').innerHTML = '<div class="form-error">As senhas não coincidem.</div>';
        return;
      }
      btn.disabled = true;
      try {
        await api('/auth/redefinir-senha', {
          method: 'POST',
          body: JSON.stringify({ token, novaSenha }),
        });
        ev.target.hidden = true;
        el.querySelector('#sucesso-area').innerHTML = `
          <div class="help-box">Senha redefinida com sucesso! <a class="link-btn" href="#/login">Entrar agora</a></div>
        `;
      } catch (e) {
        el.querySelector('#erro-area').innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
        btn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------
  // View: Registro
  // ---------------------------------------------------------------------

  function viewRegistro() {
    viewEl.innerHTML = '';
    const el = h(`
      <div class="center-hero">
        <div class="card">
          <h1>Criar conta</h1>
          <p class="muted small">Cadastre-se para participar dos torneios e acompanhar o ranking.</p>
          <div id="erro-area"></div>
          <form id="form-registro" class="stack">
            <div class="field">
              <label>Nome completo</label>
              <input type="text" name="nome" required autocomplete="name" />
              <div class="form-hint">Este será o nome usado no ranking.</div>
            </div>
            <div class="field">
              <label>E-mail</label>
              <input type="email" name="email" required autocomplete="email" />
            </div>
            <div class="field">
              <label>Senha</label>
              <input type="password" name="senha" required minlength="6" autocomplete="new-password" />
              <div class="form-hint">Mínimo de 6 caracteres.</div>
            </div>
            <button class="btn btn-block" type="submit">Criar conta</button>
          </form>
          <p class="small muted" style="margin-top:14px;">
            Já tem conta? <a class="link-btn" href="#/login">Entrar</a>
          </p>
        </div>
      </div>
    `);
    viewEl.appendChild(el);
    el.querySelector('#form-registro').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const btn = ev.target.querySelector('button');
      btn.disabled = true;
      try {
        await api('/auth/registrar', {
          method: 'POST',
          body: JSON.stringify({ nome: fd.get('nome'), email: fd.get('email'), senha: fd.get('senha') }),
        });
        await carregarUsuario();
        location.hash = '#/etapas';
      } catch (e) {
        el.querySelector('#erro-area').innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
        btn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------
  // View: Lista de etapas
  // ---------------------------------------------------------------------

  async function viewEtapas() {
    viewEl.innerHTML = '<div class="card"><p class="muted">Carregando etapas…</p></div>';
    const { etapas } = await api('/etapas');

    const podeOrganizar = usuarioAtual.role === 'admin' || usuarioAtual.role === 'organizador';
    const formNovaEtapa = podeOrganizar ? `
      <div class="card">
        <div class="card-title-row"><h2>Nova etapa</h2></div>
        <div id="erro-nova-etapa"></div>
        <form id="form-nova-etapa" class="row">
          <div class="field" style="flex:2; min-width:180px;">
            <label>Nome da etapa</label>
            <input type="text" name="nome" placeholder="Ex.: Etapa 3 - Setembro" required />
          </div>
          <div class="field" style="min-width:160px;">
            <label>Data</label>
            <input type="date" name="data" required />
          </div>
          <button class="btn" type="submit" style="align-self:flex-end; margin-bottom:14px;">Criar etapa</button>
        </form>
      </div>
    ` : '';

    const listaHtml = etapas.length ? etapas.map((e) => `
      <a class="card" href="#/etapas/${e.id}" style="display:block; text-decoration:none; color:inherit;">
        <div class="row-between">
          <div>
            <h3 style="margin-bottom:2px;">${esc(e.nome)}</h3>
            <span class="muted small">${formatarData(e.data)} · ${e.total_participantes} jogador(es)</span>
          </div>
          ${badgeStatus(e.status)}
        </div>
      </a>
    `).join('') : '<div class="empty-state">Nenhuma etapa cadastrada ainda.</div>';

    viewEl.innerHTML = '';
    viewEl.appendChild(h(`<div>${formNovaEtapa}<div>${listaHtml}</div></div>`));

    const form = viewEl.querySelector('#form-nova-etapa');
    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          const { id } = await api('/etapas', {
            method: 'POST',
            body: JSON.stringify({ nome: fd.get('nome'), data: fd.get('data') }),
          });
          location.hash = `#/etapas/${id}`;
        } catch (e) {
          viewEl.querySelector('#erro-nova-etapa').innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
        }
      });
    }
  }

  // ---------------------------------------------------------------------
  // View: Detalhe da etapa (participantes, sorteio, partidas/resultados)
  // ---------------------------------------------------------------------

  async function viewEtapaDetalhe(id) {
    viewEl.innerHTML = '<div class="card"><p class="muted">Carregando etapa…</p></div>';
    const dados = await api(`/etapas/${id}`);
    renderEtapaDetalhe(id, dados);
  }

  function renderEtapaDetalhe(id, dados) {
    const { etapa, participantes, partidas } = dados;
    const isAdmin = usuarioAtual.role === 'admin';
    const podeOrganizar = isAdmin || usuarioAtual.role === 'organizador';
    const podeInscrever = etapa.status === 'inscricoes';
    const ehManual = etapa.modo === 'manual';
    const travada = !!etapa.travada;

    const chipsParticipantes = participantes.length ? participantes.map((p) => `
      <span class="player-chip">
        ${esc(p.nome)}
        ${podeOrganizar ? `<button data-editar-nome-jogador="${p.id}" data-nome-atual="${esc(p.nome)}" title="Editar nome">✏️</button>` : ''}
        ${isAdmin && podeInscrever ? `<button data-remover-participante="${p.id}" title="Remover">✕</button>` : ''}
      </span>
    `).join('') : '<span class="muted small">Nenhum jogador inscrito ainda.</span>';

    const painelInscricao = podeInscrever ? `
      <div id="erro-participante"></div>
      <form id="form-participante" class="row" style="margin-top:10px;">
        <div class="field" style="flex:1; min-width:180px; margin-bottom:0;">
          <input type="text" name="nome" placeholder="Nome do jogador" required list="lista-jogadores" />
        </div>
        <button class="btn btn-sm" type="submit">Adicionar</button>
      </form>
      <datalist id="lista-jogadores"></datalist>
      <p class="form-hint">${participantes.length}/8 jogadores inscritos. Mínimo de 4 para sortear.</p>
    ` : '';

    const painelSorteio = podeOrganizar && podeInscrever ? `
      <button class="btn btn-accent" id="btn-sortear" ${participantes.length < 4 ? 'disabled' : ''}>
        🎾 Realizar sorteio
      </button>
      ${participantes.length < 4 ? '<p class="form-hint">Inscreva pelo menos 4 jogadores para liberar o sorteio.</p>' : ''}
    ` : '';

    const painelAdminEtapa = isAdmin ? `
      <div class="row" style="margin-top:12px;">
        ${etapa.status !== 'inscricoes' && !travada ? '<button class="btn btn-ghost btn-sm" id="btn-resortear">🔁 Refazer sorteio</button>' : ''}
        ${etapa.status !== 'inscricoes' ? (
          travada
            ? '<button class="btn btn-ghost btn-sm" id="btn-destravar-etapa">🔓 Ajustar</button>'
            : '<button class="btn btn-ghost btn-sm" id="btn-travar-etapa">🔒 Finalizar etapa</button>'
        ) : ''}
        <button class="btn btn-danger btn-sm" id="btn-excluir-etapa">Excluir etapa</button>
      </div>
    ` : '';

    const rodadas = {};
    partidas.forEach((p) => { (rodadas[p.rodada] = rodadas[p.rodada] || []).push(p); });

    const partidasHtml = Object.keys(rodadas).length ? Object.keys(rodadas).sort((a, b) => a - b).map((r) => {
      const jogosDaRodada = rodadas[r].slice().sort((a, b) => a.quadra - b.quadra);
      const cards = jogosDaRodada.map((p) => renderMatchCard(p, isAdmin, travada)).join('');
      const duasQuadras = jogosDaRodada.length > 1;
      return `
        ${ehManual ? '' : `<div class="rodada-titulo">Rodada ${r}</div>`}
        <div class="${duasQuadras ? 'grid-cols' : ''}">${cards}</div>
      `;
    }).join('') : `<div class="empty-state">${podeInscrever ? 'O sorteio ainda não foi realizado.' : 'Nenhuma partida.'}</div>`;

    const painelPartidaManual = isAdmin ? `
      <div class="divider"></div>
      <button class="link-btn small" id="btn-mostrar-form-manual">+ Adicionar partida retroativa (sem sorteio)</button>
      <form id="form-partida-manual" class="stack" hidden style="margin-top:12px;">
        <div id="erro-partida-manual"></div>
        <p class="form-hint">Use isto para lançar jogos que já aconteceram (antes do site, ou fora do sorteio automático). Os jogadores informados são criados/reaproveitados e entram automaticamente na lista de inscritos desta etapa.</p>
        <div class="grid-cols">
          <div class="field" style="margin-bottom:0;">
            <label>Dupla 1 - jogador 1</label>
            <input type="text" name="e1j1" required list="lista-jogadores" />
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Dupla 1 - jogador 2</label>
            <input type="text" name="e1j2" required list="lista-jogadores" />
          </div>
        </div>
        <div class="grid-cols">
          <div class="field" style="margin-bottom:0;">
            <label>Dupla 2 - jogador 1</label>
            <input type="text" name="e2j1" required list="lista-jogadores" />
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Dupla 2 - jogador 2</label>
            <input type="text" name="e2j2" required list="lista-jogadores" />
          </div>
        </div>
        <div class="row">
          <div class="field" style="margin-bottom:0;">
            <label>Games dupla 1</label>
            <input type="number" name="games1" min="0" max="3" required style="width:80px;" />
          </div>
          <span class="vs" style="align-self:flex-end; padding-bottom:11px;">×</span>
          <div class="field" style="margin-bottom:0;">
            <label>Games dupla 2</label>
            <input type="number" name="games2" min="0" max="3" required style="width:80px;" />
          </div>
        </div>
        <button class="btn btn-accent" type="submit" style="align-self:flex-start;">Adicionar partida</button>
      </form>
    ` : '';

    viewEl.innerHTML = '';
    viewEl.appendChild(h(`
      <div>
        <a href="#/etapas" class="small link-btn" style="display:inline-block; margin-bottom:14px;">← Voltar para etapas</a>
        <div class="card">
          <div class="row-between">
            <div>
              <div id="titulo-etapa" style="display:flex; align-items:center; gap:8px;">
                <h1>${esc(etapa.nome)}</h1>
                ${isAdmin ? '<button class="link-btn small" id="btn-editar-nome-etapa" title="Editar nome da etapa">✏️</button>' : ''}
              </div>
              <form id="form-editar-nome-etapa" class="row" hidden style="margin-top:6px;">
                <div class="field" style="flex:1; min-width:180px; margin-bottom:0;">
                  <input type="text" name="nome" value="${esc(etapa.nome)}" required />
                </div>
                <button class="btn btn-sm" type="submit">Salvar</button>
                <button class="btn btn-ghost btn-sm" type="button" id="btn-cancelar-nome-etapa">Cancelar</button>
              </form>
              <span class="muted small">${formatarData(etapa.data)}</span>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              ${travada ? '<span class="badge badge-travada">🔒 Finalizada</span>' : ''}
              ${badgeStatus(etapa.status)}
            </div>
          </div>
          ${ehManual ? '<p class="small muted" style="margin-top:8px;">Etapa retroativa - partidas lançadas manualmente pelo administrador.</p>' : ''}
          ${painelAdminEtapa}
        </div>

        <div class="card">
          <div class="card-title-row"><h2>Jogadores inscritos</h2></div>
          <div class="tag-select" style="gap:8px;">${chipsParticipantes}</div>
          ${painelInscricao}
          ${painelSorteio ? `<div style="margin-top:14px;">${painelSorteio}</div>` : ''}
        </div>

        <div class="card">
          <div class="card-title-row">
            <h2>Partidas</h2>
            ${partidas.length ? '<button class="btn btn-ghost btn-sm" id="btn-imprimir-tabela">🖨️ Imprimir tabela</button>' : ''}
          </div>
          ${partidasHtml}
          ${painelPartidaManual}
        </div>
        <datalist id="lista-jogadores"></datalist>
      </div>
    `));

    // datalist com jogadores existentes (autocomplete)
    api('/jogadores').then(({ jogadores }) => {
      const dl = viewEl.querySelector('#lista-jogadores');
      if (dl) dl.innerHTML = jogadores.map((j) => `<option value="${esc(j.nome)}"></option>`).join('');
    }).catch(() => {});

    ligarEventosEtapaDetalhe(id, etapa, partidas);
  }

  function renderMatchCard(p, isAdmin, travada) {
    const temResultado = p.games_equipe1 !== null && p.games_equipe2 !== null;
    const time1Venceu = temResultado && p.games_equipe1 > p.games_equipe2;
    const time2Venceu = temResultado && p.games_equipe2 > p.games_equipe1;
    const podeEditar = isAdmin || (!temResultado && !travada);
    const btnExcluir = isAdmin ? `<button class="link-btn small" data-excluir-partida="${p.id}" style="margin-top:8px; margin-left:14px; color:var(--danger);">Excluir partida</button>` : '';
    const avisoTravada = !isAdmin && travada
      ? '<p class="form-hint">🔒 Etapa finalizada - só o administrador pode lançar ou corrigir resultados agora.</p>' : '';

    const corpo = temResultado ? `
      <div class="match-teams">
        <span class="team ${time1Venceu ? 'venceu' : ''}">${esc(p.equipe1_j1_nome)} / ${esc(p.equipe1_j2_nome)}</span>
        <span class="score-display">${p.games_equipe1} × ${p.games_equipe2}</span>
        <span class="team ${time2Venceu ? 'venceu' : ''}">${esc(p.equipe2_j1_nome)} / ${esc(p.equipe2_j2_nome)}</span>
      </div>
      ${podeEditar ? `<button class="link-btn small" data-editar-resultado="${p.id}" style="margin-top:8px;">Corrigir resultado</button>` : ''}${btnExcluir}
      ${avisoTravada}
      <form class="score-form" data-form-resultado="${p.id}" hidden>
        <input type="number" min="0" max="3" name="games1" required value="${p.games_equipe1}" />
        <span class="vs">×</span>
        <input type="number" min="0" max="3" name="games2" required value="${p.games_equipe2}" />
        <button class="btn btn-sm" type="submit">Salvar</button>
      </form>
    ` : `
      <div class="match-teams">
        <span class="team">${esc(p.equipe1_j1_nome)} / ${esc(p.equipe1_j2_nome)}</span>
        <span class="vs">vs</span>
        <span class="team">${esc(p.equipe2_j1_nome)} / ${esc(p.equipe2_j2_nome)}</span>
      </div>
      ${podeEditar ? `
        <form class="score-form" data-form-resultado="${p.id}">
          <input type="number" min="0" max="3" name="games1" placeholder="0" required />
          <span class="vs">×</span>
          <input type="number" min="0" max="3" name="games2" placeholder="0" required />
          <button class="btn btn-sm" type="submit">Salvar placar</button>
        </form>
      ` : avisoTravada}
      ${btnExcluir}
    `;

    const nomeQuadra = `Quadra ${String(p.quadra).padStart(2, '0')}`;
    return `
      <div class="match-card">
        <div class="match-court quadra-${p.quadra}">${nomeQuadra}</div>
        ${corpo}
      </div>
    `;
  }

  function ligarEventosEtapaDetalhe(etapaId, etapa, partidas) {
    const btnImprimir = viewEl.querySelector('#btn-imprimir-tabela');
    if (btnImprimir) {
      btnImprimir.addEventListener('click', () => imprimirTabelaEtapa(etapa, partidas));
    }

    const formParticipante = viewEl.querySelector('#form-participante');
    if (formParticipante) {
      formParticipante.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          await api(`/etapas/${etapaId}/participantes`, {
            method: 'POST',
            body: JSON.stringify({ nome: fd.get('nome') }),
          });
          viewEtapaDetalhe(etapaId);
        } catch (e) {
          viewEl.querySelector('#erro-participante').innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
        }
      });
    }

    viewEl.querySelectorAll('[data-remover-participante]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const jogadorId = btn.getAttribute('data-remover-participante');
        try {
          await api(`/etapas/${etapaId}/participantes/${jogadorId}`, { method: 'DELETE' });
          viewEtapaDetalhe(etapaId);
        } catch (e) { mostrarToast(e.message, 'erro'); }
      });
    });

    // Renomear jogador (corrige o cadastro em todo o site, nao so nesta etapa) -
    // disponivel para admin/organizador mesmo em etapas ja encerradas.
    viewEl.querySelectorAll('[data-editar-nome-jogador]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const jogadorId = btn.getAttribute('data-editar-nome-jogador');
        const nomeAtual = btn.getAttribute('data-nome-atual');
        const novoNome = prompt('Novo nome do jogador:', nomeAtual);
        if (!novoNome || !novoNome.trim() || novoNome.trim() === nomeAtual) return;
        try {
          await api(`/jogadores/${jogadorId}`, {
            method: 'PUT',
            body: JSON.stringify({ nome: novoNome.trim() }),
          });
          mostrarToast('Nome do jogador atualizado.');
          viewEtapaDetalhe(etapaId);
        } catch (e) { mostrarToast(e.message, 'erro'); }
      });
    });

    const btnTravarEtapa = viewEl.querySelector('#btn-travar-etapa');
    if (btnTravarEtapa) {
      btnTravarEtapa.addEventListener('click', async () => {
        if (!confirm('Finalizar esta etapa? Jogadores e organizadores não vão mais poder lançar ou corrigir resultados - só você.')) return;
        try {
          await api(`/etapas/${etapaId}/travar`, { method: 'POST' });
          mostrarToast('Etapa finalizada.');
          viewEtapaDetalhe(etapaId);
        } catch (e) { mostrarToast(e.message, 'erro'); }
      });
    }
    const btnDestravarEtapa = viewEl.querySelector('#btn-destravar-etapa');
    if (btnDestravarEtapa) {
      btnDestravarEtapa.addEventListener('click', async () => {
        try {
          await api(`/etapas/${etapaId}/destravar`, { method: 'POST' });
          mostrarToast('Etapa reaberta para ajustes.');
          viewEtapaDetalhe(etapaId);
        } catch (e) { mostrarToast(e.message, 'erro'); }
      });
    }

    const btnEditarNomeEtapa = viewEl.querySelector('#btn-editar-nome-etapa');
    const formEditarNomeEtapa = viewEl.querySelector('#form-editar-nome-etapa');
    const btnCancelarNomeEtapa = viewEl.querySelector('#btn-cancelar-nome-etapa');
    if (btnEditarNomeEtapa && formEditarNomeEtapa) {
      btnEditarNomeEtapa.addEventListener('click', () => {
        viewEl.querySelector('#titulo-etapa').hidden = true;
        formEditarNomeEtapa.hidden = false;
        formEditarNomeEtapa.querySelector('input[name="nome"]').focus();
      });
    }
    if (btnCancelarNomeEtapa) {
      btnCancelarNomeEtapa.addEventListener('click', () => {
        formEditarNomeEtapa.hidden = true;
        viewEl.querySelector('#titulo-etapa').hidden = false;
      });
    }
    if (formEditarNomeEtapa) {
      formEditarNomeEtapa.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          await api(`/etapas/${etapaId}`, {
            method: 'PUT',
            body: JSON.stringify({ nome: fd.get('nome') }),
          });
          mostrarToast('Nome da etapa atualizado.');
          viewEtapaDetalhe(etapaId);
        } catch (e) { mostrarToast(e.message, 'erro'); }
      });
    }

    const btnSortear = viewEl.querySelector('#btn-sortear');
    if (btnSortear) {
      btnSortear.addEventListener('click', async () => {
        btnSortear.disabled = true;
        btnSortear.innerHTML = '<span class="spinner"></span> Sorteando…';
        try {
          await api(`/etapas/${etapaId}/sortear`, { method: 'POST' });
          mostrarToast('Sorteio realizado com sucesso!');
          viewEtapaDetalhe(etapaId);
        } catch (e) {
          mostrarToast(e.message, 'erro');
          btnSortear.disabled = false;
          btnSortear.textContent = '🎾 Realizar sorteio';
        }
      });
    }

    const btnResortear = viewEl.querySelector('#btn-resortear');
    if (btnResortear) {
      btnResortear.addEventListener('click', async () => {
        if (!confirm('Isso vai apagar as partidas atuais (sem resultados lançados) e gerar um novo sorteio. Continuar?')) return;
        try {
          await api(`/etapas/${etapaId}/sortear`, { method: 'POST' });
          mostrarToast('Novo sorteio gerado.');
          viewEtapaDetalhe(etapaId);
        } catch (e) { mostrarToast(e.message, 'erro'); }
      });
    }

    const btnExcluir = viewEl.querySelector('#btn-excluir-etapa');
    if (btnExcluir) {
      btnExcluir.addEventListener('click', async () => {
        if (!confirm('Excluir esta etapa e todas as suas partidas? Esta ação não pode ser desfeita.')) return;
        try {
          await api(`/etapas/${etapaId}`, { method: 'DELETE' });
          location.hash = '#/etapas';
        } catch (e) { mostrarToast(e.message, 'erro'); }
      });
    }

    viewEl.querySelectorAll('[data-editar-resultado]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-editar-resultado');
        const form = viewEl.querySelector(`[data-form-resultado="${id}"]`);
        if (form) { form.hidden = false; btn.hidden = true; }
      });
    });

    viewEl.querySelectorAll('[data-form-resultado]').forEach((form) => {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const partidaId = form.getAttribute('data-form-resultado');
        const fd = new FormData(form);
        try {
          await api(`/partidas/${partidaId}/resultado`, {
            method: 'PUT',
            body: JSON.stringify({ games1: fd.get('games1'), games2: fd.get('games2') }),
          });
          mostrarToast('Resultado salvo.');
          viewEtapaDetalhe(etapaId);
        } catch (e) { mostrarToast(e.message, 'erro'); }
      });
    });

    viewEl.querySelectorAll('[data-excluir-partida]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir esta partida?')) return;
        try {
          await api(`/partidas/${btn.getAttribute('data-excluir-partida')}`, { method: 'DELETE' });
          mostrarToast('Partida excluída.');
          viewEtapaDetalhe(etapaId);
        } catch (e) { mostrarToast(e.message, 'erro'); }
      });
    });

    const btnMostrarFormManual = viewEl.querySelector('#btn-mostrar-form-manual');
    const formManual = viewEl.querySelector('#form-partida-manual');
    if (btnMostrarFormManual && formManual) {
      btnMostrarFormManual.addEventListener('click', () => {
        formManual.hidden = !formManual.hidden;
        btnMostrarFormManual.hidden = !formManual.hidden;
      });
      formManual.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(formManual);
        const btnSalvar = formManual.querySelector('button[type="submit"]');
        btnSalvar.disabled = true;
        try {
          await api(`/etapas/${etapaId}/partidas`, {
            method: 'POST',
            body: JSON.stringify({
              equipe1: [fd.get('e1j1'), fd.get('e1j2')],
              equipe2: [fd.get('e2j1'), fd.get('e2j2')],
              games1: fd.get('games1'),
              games2: fd.get('games2'),
            }),
          });
          mostrarToast('Partida adicionada.');
          viewEtapaDetalhe(etapaId);
        } catch (e) {
          viewEl.querySelector('#erro-partida-manual').innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
          btnSalvar.disabled = false;
        }
      });
    }
  }

  // ---------------------------------------------------------------------
  // View: Usuários (somente admin)
  // ---------------------------------------------------------------------

  async function viewUsuarios() {
    viewEl.innerHTML = '<div class="card"><p class="muted">Carregando usuários…</p></div>';
    let dados;
    try {
      dados = await api('/usuarios');
    } catch (e) {
      viewEl.innerHTML = `<div class="card"><p class="form-error">${esc(e.message)}</p></div>`;
      return;
    }

    const linhas = dados.usuarios.map((u) => `
      <tr>
        <td class="player-name">${esc(u.nome)} ${u.role === 'admin' ? '<span class="badge-admin" style="background:var(--ball); color:var(--court-dark);">Admin</span>' : ''}</td>
        <td>${esc(u.email)}</td>
        <td class="muted small">${formatarData((u.criado_em || '').split(' ')[0])}</td>
        <td>${u.role === 'admin' ? '<span class="muted small">—</span>' : `
          <select data-papel-usuario="${u.id}" data-papel-atual="${u.role}" class="select-sm">
            <option value="jogador" ${u.role === 'jogador' ? 'selected' : ''}>Jogador</option>
            <option value="organizador" ${u.role === 'organizador' ? 'selected' : ''}>Organizador</option>
          </select>
        `}</td>
      </tr>
    `).join('');

    viewEl.innerHTML = '';
    viewEl.appendChild(h(`
      <div>
        <div class="card">
          <div class="card-title-row"><h1>Usuários cadastrados</h1></div>
          <p class="help-box">Por segurança, as senhas ficam guardadas de forma criptografada (hash) e não podem ser exibidas por ninguém, nem pelo administrador. Se algum jogador esquecer a senha, oriente-o a usar o link "Esqueci minha senha" na tela de login.</p>
          <p class="help-box">Um usuário com o papel <strong>Organizador</strong> pode, além de inscrever jogadores e lançar resultados, criar novas etapas e realizar o sorteio inicial delas. Só o administrador pode refazer um sorteio já realizado, editar o ranking ou as regras.</p>
        </div>
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Cadastrado em</th><th>Papel</th></tr></thead>
              <tbody>${linhas}</tbody>
            </table>
          </div>
        </div>
      </div>
    `));

    viewEl.querySelectorAll('[data-papel-usuario]').forEach((select) => {
      select.addEventListener('change', async () => {
        const usuarioId = select.getAttribute('data-papel-usuario');
        const valorAnterior = select.getAttribute('data-papel-atual');
        select.disabled = true;
        try {
          await api(`/usuarios/${usuarioId}/papel`, {
            method: 'PUT',
            body: JSON.stringify({ role: select.value }),
          });
          select.setAttribute('data-papel-atual', select.value);
          mostrarToast('Papel atualizado com sucesso!');
        } catch (e) {
          mostrarToast(e.message, 'erro');
          select.value = valorAnterior;
        } finally {
          select.disabled = false;
        }
      });
    });
  }

  // ---------------------------------------------------------------------
  // View: Minha conta (trocar senha)
  // ---------------------------------------------------------------------

  function viewConta() {
    viewEl.innerHTML = '';
    const el = h(`
      <div class="center-hero">
        <div class="card">
          <h1>Minha conta</h1>
          <p class="muted small">${esc(usuarioAtual.nome)} · ${esc(usuarioAtual.email)}</p>
          <div class="divider"></div>
          <h2 style="font-size:16px;">Trocar senha</h2>
          <div id="erro-area"></div>
          <div id="sucesso-area"></div>
          <form id="form-trocar-senha" class="stack">
            <div class="field">
              <label>Senha atual</label>
              <input type="password" name="senhaAtual" required autocomplete="current-password" />
            </div>
            <div class="field">
              <label>Nova senha</label>
              <input type="password" name="novaSenha" required minlength="6" autocomplete="new-password" />
              <div class="form-hint">Mínimo de 6 caracteres.</div>
            </div>
            <div class="field">
              <label>Confirmar nova senha</label>
              <input type="password" name="confirmarSenha" required minlength="6" autocomplete="new-password" />
            </div>
            <button class="btn btn-block" type="submit">Salvar nova senha</button>
          </form>
        </div>
      </div>
    `);
    viewEl.appendChild(el);
    el.querySelector('#form-trocar-senha').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const novaSenha = fd.get('novaSenha');
      const confirmarSenha = fd.get('confirmarSenha');
      const btn = ev.target.querySelector('button');
      el.querySelector('#erro-area').innerHTML = '';
      if (novaSenha !== confirmarSenha) {
        el.querySelector('#erro-area').innerHTML = '<div class="form-error">As senhas não coincidem.</div>';
        return;
      }
      btn.disabled = true;
      try {
        await api('/auth/senha', {
          method: 'PUT',
          body: JSON.stringify({ senhaAtual: fd.get('senhaAtual'), novaSenha }),
        });
        ev.target.reset();
        el.querySelector('#sucesso-area').innerHTML = '<div class="help-box">Senha atualizada com sucesso.</div>';
      } catch (e) {
        el.querySelector('#erro-area').innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
      }
      btn.disabled = false;
    });
  }

  // ---------------------------------------------------------------------
  // View: Ranking
  // ---------------------------------------------------------------------

  async function viewRanking() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const semestreAtual = agora.getMonth() < 6 ? 1 : 2;

    if (!window.__rankingEstado) {
      window.__rankingEstado = { tipo: 'semestral', ano, semestre: semestreAtual, etapaId: null };
    }
    await renderRanking();
  }

  const MEDALHAS = { 1: '🥇', 2: '🥈', 3: '🥉' };

  function tabelaRankingHtml(linhas, mensagemVazia) {
    const corpoTabela = linhas.length ? linhas.map((l) => `
      <tr>
        <td class="pos">${l.posicao}º ${MEDALHAS[l.posicao] || ''}</td>
        <td class="player-name">${esc(l.nome)}</td>
        <td>${l.vitorias}</td>
        <td>${l.derrotas}</td>
        <td>${l.saldoGames > 0 ? '+' : ''}${l.saldoGames}</td>
        <td>${l.gamesGanhos}</td>
        <td>${l.partidasJogadas}</td>
      </tr>
    `).join('') : `<tr><td colspan="7" class="muted" style="white-space:normal;">${esc(mensagemVazia)}</td></tr>`;

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Jogador</th><th>V</th><th>D</th><th>Saldo</th><th>Games</th><th>Jogos</th></tr>
          </thead>
          <tbody>${corpoTabela}</tbody>
        </table>
      </div>
      <p class="form-hint" style="margin-top:12px;">Critérios de desempate, nesta ordem: número de vitórias, saldo de games, games ganhos e confronto direto.</p>
    `;
  }

  async function renderRanking() {
    const estado = window.__rankingEstado;
    viewEl.innerHTML = '<div class="card"><p class="muted">Carregando ranking…</p></div>';

    const cabecalhoTipos = `
      <div class="card-title-row"><h1>Ranking</h1></div>
      <div class="tag-select" style="margin-bottom:12px;">
        <button data-tipo="semestral" class="${estado.tipo === 'semestral' ? 'active' : ''}">Semestral</button>
        <button data-tipo="anual" class="${estado.tipo === 'anual' ? 'active' : ''}">Anual</button>
        <button data-tipo="etapa" class="${estado.tipo === 'etapa' ? 'active' : ''}">Por etapa</button>
      </div>
    `;

    if (estado.tipo === 'etapa') {
      let etapas;
      try {
        ({ etapas } = await api('/etapas'));
      } catch (e) {
        viewEl.innerHTML = `<div class="card"><p class="form-error">${esc(e.message)}</p></div>`;
        return;
      }
      // so etapas que ja tiveram sorteio/partidas lancadas fazem sentido aqui
      etapas = etapas.filter((e) => e.status !== 'inscricoes');

      if (!estado.etapaId || !etapas.some((e) => e.id === estado.etapaId)) {
        estado.etapaId = etapas.length ? etapas[0].id : null;
      }

      const opcoesEtapas = etapas.map((e) => `
        <option value="${e.id}" ${e.id === estado.etapaId ? 'selected' : ''}>${esc(e.nome)} · ${formatarData(e.data)}</option>
      `).join('');

      let corpoRanking = '<p class="empty-state">Nenhuma etapa com sorteio ou partidas lançadas ainda.</p>';
      if (estado.etapaId) {
        let dadosEtapa;
        try {
          dadosEtapa = await api(`/ranking/etapa/${estado.etapaId}`);
        } catch (e) {
          corpoRanking = `<p class="form-error">${esc(e.message)}</p>`;
        }
        if (dadosEtapa) {
          corpoRanking = tabelaRankingHtml(dadosEtapa.ranking, 'Nenhum jogador inscrito nesta etapa.');
        }
      }

      viewEl.innerHTML = '';
      viewEl.appendChild(h(`
        <div>
          <div class="card">
            ${cabecalhoTipos}
            <div class="field" style="margin-bottom:0;">
              <label>Etapa</label>
              <select id="select-etapa-ranking" ${etapas.length ? '' : 'disabled'}>${opcoesEtapas}</select>
            </div>
          </div>
          <div class="card">${corpoRanking}</div>
        </div>
      `));

      viewEl.querySelectorAll('[data-tipo]').forEach((btn) => {
        btn.addEventListener('click', () => { estado.tipo = btn.getAttribute('data-tipo'); renderRanking(); });
      });
      const selectEtapa = viewEl.querySelector('#select-etapa-ranking');
      if (selectEtapa) {
        selectEtapa.addEventListener('change', () => {
          estado.etapaId = Number(selectEtapa.value);
          renderRanking();
        });
      }
      return;
    }

    const periodo = estado.tipo === 'anual' ? String(estado.ano) : `${estado.ano}-${estado.semestre}`;
    let dados;
    try {
      dados = await api(`/ranking?tipo=${estado.tipo}&periodo=${periodo}`);
    } catch (e) {
      viewEl.innerHTML = `<div class="card"><p class="form-error">${esc(e.message)}</p></div>`;
      return;
    }

    viewEl.innerHTML = '';
    viewEl.appendChild(h(`
      <div>
        <div class="card">
          ${cabecalhoTipos}
          <div class="row-between" style="margin-bottom:6px;">
            <button class="btn btn-ghost btn-sm" id="btn-periodo-anterior">← Anterior</button>
            <strong>${esc(dados.rotulo)}</strong>
            <button class="btn btn-ghost btn-sm" id="btn-periodo-seguinte">Seguinte →</button>
          </div>
        </div>
        <div class="card">${tabelaRankingHtml(dados.ranking, 'Nenhum jogador inscrito neste período ainda.')}</div>
      </div>
    `));

    viewEl.querySelectorAll('[data-tipo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        estado.tipo = btn.getAttribute('data-tipo');
        renderRanking();
      });
    });
    viewEl.querySelector('#btn-periodo-anterior').addEventListener('click', () => {
      moverPeriodo(-1);
      renderRanking();
    });
    viewEl.querySelector('#btn-periodo-seguinte').addEventListener('click', () => {
      moverPeriodo(1);
      renderRanking();
    });
  }

  function moverPeriodo(direcao) {
    const estado = window.__rankingEstado;
    if (estado.tipo === 'anual') {
      estado.ano += direcao;
      return;
    }
    estado.semestre += direcao;
    if (estado.semestre > 2) { estado.semestre = 1; estado.ano += 1; }
    if (estado.semestre < 1) { estado.semestre = 2; estado.ano -= 1; }
  }

  // ---------------------------------------------------------------------
  // View: Perfis dos jogadores (radar de forças)
  // ---------------------------------------------------------------------

  const EIXOS_RADAR = [
    { chave: 'geral', rotulo: 'Geral' },
    { chave: 'ataque', rotulo: 'Ataque' },
    { chave: 'consistencia', rotulo: 'Consistência' },
    { chave: 'fisico', rotulo: 'Físico' },
    { chave: 'defesa', rotulo: 'Defesa' },
    { chave: 'teamplay', rotulo: 'Teamplay' },
  ];

  /** Desenha o hexagono SVG do radar a partir de um objeto {geral, ataque, ...} (valores 0-100). */
  function desenharRadarSvg(radar) {
    const tamanho = 280;
    const centro = tamanho / 2;
    const raioMax = tamanho / 2 - 46;
    const n = EIXOS_RADAR.length;

    function ponto(i, fracao) {
      const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return {
        x: centro + Math.cos(angulo) * raioMax * fracao,
        y: centro + Math.sin(angulo) * raioMax * fracao,
      };
    }

    const aneis = [0.2, 0.4, 0.6, 0.8, 1].map((f) => {
      const pts = EIXOS_RADAR.map((_, i) => ponto(i, f));
      return `<polygon points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" class="radar-anel" />`;
    }).join('');

    const eixosSvg = EIXOS_RADAR.map((_, i) => {
      const p = ponto(i, 1);
      return `<line x1="${centro}" y1="${centro}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="radar-eixo" />`;
    }).join('');

    const pontosValor = EIXOS_RADAR.map((eixo, i) => ponto(i, clampPct(radar[eixo.chave]) / 100));
    const poligono = `<polygon points="${pontosValor.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" class="radar-poligono" />`;
    const bolinhas = pontosValor.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" class="radar-ponto" />`).join('');

    const rotulos = EIXOS_RADAR.map((eixo, i) => {
      const p = ponto(i, 1.22);
      const valorP = ponto(i, clampPct(radar[eixo.chave]) / 100 + (radar[eixo.chave] >= 85 ? 0.1 : -0.12));
      return `
        <text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" class="radar-rotulo" text-anchor="middle">${esc(eixo.rotulo)}</text>
        <text x="${valorP.x.toFixed(1)}" y="${valorP.y.toFixed(1)}" class="radar-valor" text-anchor="middle">${radar[eixo.chave]}</text>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 ${tamanho} ${tamanho}" class="radar-svg" role="img" aria-label="Radar de forças">
        ${aneis}
        ${eixosSvg}
        ${poligono}
        ${bolinhas}
        ${rotulos}
      </svg>
    `;
  }

  function clampPct(v) { return Math.max(0, Math.min(100, Number(v) || 0)); }

  async function viewPerfis() {
    viewEl.innerHTML = '<div class="card"><p class="muted">Carregando jogadores…</p></div>';
    let jogadores;
    try {
      ({ jogadores } = await api('/perfis'));
    } catch (e) {
      viewEl.innerHTML = `<div class="card"><p class="form-error">${esc(e.message)}</p></div>`;
      return;
    }

    if (!window.__perfilEstado) window.__perfilEstado = { jogadorId: jogadores.length ? jogadores[0].id : null };
    const estado = window.__perfilEstado;
    if (!jogadores.some((j) => j.id === estado.jogadorId)) {
      estado.jogadorId = jogadores.length ? jogadores[0].id : null;
    }

    await renderPerfil(jogadores);
  }

  async function renderPerfil(jogadores) {
    const estado = window.__perfilEstado;

    const opcoes = jogadores.map((j) => `
      <option value="${j.id}" ${j.id === estado.jogadorId ? 'selected' : ''}>${esc(j.nome)}</option>
    `).join('');

    let conteudo = '<p class="empty-state">Nenhum jogador com partidas disputadas ainda.</p>';
    if (estado.jogadorId) {
      let perfil;
      try {
        perfil = await api(`/perfis/${estado.jogadorId}`);
      } catch (e) {
        conteudo = `<p class="form-error">${esc(e.message)}</p>`;
      }
      if (perfil) {
        conteudo = perfil.amostraInsuficiente ? `
          <p class="empty-state">Este jogador ainda não tem partidas com resultado suficientes para calcular o radar.</p>
        ` : `
          <div class="radar-wrap">
            ${desenharRadarSvg(perfil.radar)}
          </div>
          <p class="muted small" style="text-align:center;">
            Calculado com base em ${perfil.partidasConsideradas} partida(s) em ${perfil.etapasConsideradas} etapa(s).
          </p>
        `;
      }
    }

    viewEl.innerHTML = '';
    viewEl.appendChild(h(`
      <div>
        <div class="card">
          <div class="card-title-row"><h1>Perfis dos jogadores</h1></div>
          <div class="field" style="margin-bottom:0;">
            <label>Jogador</label>
            <select id="select-jogador-perfil" ${jogadores.length ? '' : 'disabled'}>${opcoes}</select>
          </div>
        </div>
        <div class="card">${conteudo}</div>
        <div class="card">
          <div class="card-title-row"><h2>Como calculamos cada força</h2></div>
          <p class="help-box">Todos os indicadores vão de 0 a 100 e são calculados de forma consolidada, somando os jogos de todas as etapas já disputadas (não é um valor por período).</p>
          <p class="help-box"><strong>Ataque</strong> - média de games conquistados pela dupla do jogador por partida (de 0 a 3 por jogo).</p>
          <p class="help-box"><strong>Defesa</strong> - o inverso: quanto menos games a dupla cede ao adversário por partida, maior a nota.</p>
          <p class="help-box"><strong>Consistência</strong> - o quanto o saldo de games varia de partida para partida. Pouca oscilação entre goleadas e derrotas apertadas resulta em nota mais alta.</p>
          <p class="help-box"><strong>Físico</strong> - compara o desempenho do jogador na primeira metade das rodadas de uma etapa com a segunda metade. Quem mantém (ou melhora) o nível de jogo nas rodadas finais - quando o desgaste físico mais pesa - recebe nota mais alta.</p>
          <p class="help-box"><strong>Teamplay</strong> - taxa de vitória do jogador considerando cada parceiro diferente que já teve (o sorteio troca as duplas a cada etapa); joga bem com qualquer parceiro, nota mais alta - só rende bem ao lado de uma pessoa específica, nota mais baixa.</p>
          <p class="help-box"><strong>Geral</strong> - a média simples dos cinco indicadores acima.</p>
          <p class="help-box">Jogadores com poucas partidas disputadas têm os indicadores suavizados em direção a uma nota neutra (50), para 1 ou 2 jogos isolados não gerarem notas extremas pouco confiáveis. A nota passa a valer integralmente conforme mais partidas (ou etapas, ou parceiros diferentes) vão sendo disputadas.</p>
        </div>
      </div>
    `));

    const select = viewEl.querySelector('#select-jogador-perfil');
    if (select) {
      select.addEventListener('change', () => {
        estado.jogadorId = Number(select.value);
        renderPerfil(jogadores);
      });
    }
  }
})();
