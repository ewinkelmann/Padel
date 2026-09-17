# Padel Ranking

Site mobile-friendly para organizar as etapas do seu torneio de padel Americano:
inscricao de jogadores, sorteio automatico de parceiros/adversarios, lancamento
de resultados e ranking semestral/anual com criterios de desempate.

## O que o site faz

- **Login com e-mail e senha.** Qualquer jogador pode criar sua propria conta.
  Existe apenas **um usuario administrador** (definido nas variaveis de
  ambiente antes de publicar o site - veja abaixo). O administrador pode
  alterar qualquer dado (etapas, jogadores, resultados, regras). Os demais
  usuarios logados so podem **incluir nomes de jogadores** em uma etapa e
  **lancar o resultado** das partidas - eles nao conseguem editar ranking,
  excluir etapas, remover participantes ou corrigir um resultado que ja
  tenha sido lancado por outra pessoa (so o admin corrige).
- **Etapas do torneio.** O admin cria uma etapa (nome + data). Enquanto as
  inscricoes estiverem abertas, qualquer jogador logado pode adicionar nomes
  (de 4 a 8 jogadores por etapa). O admin entao realiza o sorteio.
- **Sorteio automatico.** Garante matematicamente que, na etapa, cada jogador
  joga pelo menos uma vez ao lado de (como parceiro) e pelo menos uma vez
  contra (como adversario) todos os outros participantes, usando o menor
  numero de rodadas possivel:
  - ate 7 jogadores: 1 quadra (3, 5, 8 ou 11 rodadas, dependendo do numero de
    inscritos - 4, 5, 6 ou 7 jogadores respectivamente);
  - 8 jogadores: 2 quadras simultaneas, 7 rodadas (14 partidas).
  Os modelos de rodada foram gerados e verificados por simulacao (veja
  `server/lib/schedules.js`); a cada sorteio, os jogadores reais sao
  embaralhados aleatoriamente dentro desse modelo.
- **Resultados.** Cada partida termina em 3x0, 3x1 ou 3x2 (a dupla que
  chega a 3 games primeiro vence) - o site so aceita esses placares.
- **Ranking individual semestral e anual**, calculado automaticamente a
  partir dos resultados de todas as etapas do periodo, nesta ordem de
  desempate: (1) numero de vitorias, (2) saldo de games, (3) games ganhos,
  (4) confronto direto entre os jogadores empatados.

## Como publicar o site (gratuito, ~10-15 minutos)

O site precisa rodar em um servidor (nao funciona como um simples arquivo
HTML, porque guarda dados reais de jogadores e login). A forma mais simples
e gratuita e usar o **Render**. Railway e Fly.io funcionam de forma muito
parecida, caso prefira.

### Opcao A - Render.com (recomendado)

1. Crie uma conta gratuita em https://render.com (pode entrar com GitHub).
2. Suba esta pasta para um repositorio no GitHub (no site do GitHub, crie um
   repositorio novo e vazio, depois siga as instrucoes dele para "push an
   existing repository" - ou peca para alguem te ajudar com isso na hora).
3. No painel do Render, clique em **New +** → **Web Service** e selecione
   o repositorio que voce criou.
4. Configure:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Instance Type**: Free
5. Em **Environment**, adicione as variaveis (veja a secao abaixo para o que
   colocar em cada uma):
   - `ADMIN_NOME`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
   - `NODE_ENV` = `production`
6. Em **Disks**, adicione um disco persistente (Add Disk) montado em `/app/data`
   com pelo menos 1 GB - isso garante que os dados (jogadores, resultados,
   ranking) nao se percam quando o Render reiniciar o servidor. Sem isso, o
   banco de dados seria apagado a cada novo deploy.
7. Clique em **Create Web Service**. Em alguns minutos o Render vai te dar um
   link (algo como `https://padel-ranking.onrender.com`) - esse e o site para
   compartilhar com o grupo.

O plano gratuito do Render "dorme" depois de alguns minutos sem uso e demora
uns 30-50 segundos para acordar no proximo acesso - normal, so aguardar.

### Opcao B - Railway.app

Mesma ideia: crie conta, "New Project" → "Deploy from GitHub repo", defina
as mesmas variaveis de ambiente na aba **Variables**, e adicione um **Volume**
apontando para `/app/data` para os dados nao se perderem entre deploys.

### Opcao C - Docker (servidor proprio / VPS)

Se voce (ou alguem te ajudando) ja tem um servidor proprio:

```bash
docker build -t padel-ranking .
docker run -d -p 3000:3000 \
  -e ADMIN_NOME="Eduardo" \
  -e ADMIN_EMAIL="seuemail@exemplo.com" \
  -e ADMIN_PASSWORD="escolha-uma-senha-forte" \
  -e JWT_SECRET="gere-uma-string-aleatoria-longa" \
  -e NODE_ENV=production \
  -v padel_data:/app/data \
  --name padel-ranking \
  padel-ranking
```

## Variaveis de ambiente (a "conta admin fixa")

Estas sao as variaveis que voce define no painel do Render/Railway (ou no
arquivo `.env`, se for rodar localmente - copie `.env.example` para `.env`):

| Variavel        | O que e |
|-----------------|---------|
| `ADMIN_NOME`    | Seu nome, como vai aparecer no ranking |
| `ADMIN_EMAIL`   | O e-mail que voce vai usar para entrar como administrador |
| `ADMIN_PASSWORD`| A senha da conta administradora |
| `JWT_SECRET`    | Uma string aleatoria longa, usada so internamente para proteger os logins. Gere uma com: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV`      | Use `production` ao publicar o site |

Essas variaveis so sao usadas **uma vez**, na primeira vez que o servidor
sobe, para criar a conta administradora automaticamente. Depois disso, voce
pode trocar sua senha direto pelo site (nao precisa mexer nas variaveis de
novo). Ninguem mais pode virar administrador pelo site - so essa conta.

## Rodando localmente (para testar antes de publicar)

Requer Node.js 18 ou mais recente.

```bash
npm install
cp .env.example .env
# edite o .env com seu e-mail/senha de admin e um JWT_SECRET aleatorio
npm start
```

Depois acesse http://localhost:3000 no navegador.

## Estrutura do projeto

```
server/            back-end (Node.js + Express)
  index.js         ponto de entrada, carrega variaveis de ambiente e rotas
  db.js            banco de dados SQLite (schema + criacao do admin)
  lib/
    auth.js        login (JWT em cookie httpOnly) e permissoes
    sorteio.js      algoritmo de sorteio (usa os modelos de schedules.js)
    schedules.js    modelos de rodadas/partidas verificados por simulacao
    ranking.js      calculo do ranking e criterios de desempate
  routes/          endpoints da API (auth, jogadores, etapas, partidas, ranking)
public/            front-end (HTML/CSS/JS puro, sem build step)
data/              banco de dados SQLite fica aqui (nao apagar ao fazer deploy!)
```

## Duvidas comuns

**Um jogador errou o nome ao se inscrever numa etapa - da pra corrigir?**
Sim: o administrador pode renomear um jogador em qualquer tela de gestao
futura via API (`PUT /api/jogadores/:id`); uma tela dedicada para isso pode
ser adicionada depois, se for util no dia a dia.

**Da pra ter mais de 8 jogadores numa etapa?**
O sorteio automatico foi construido exatamente para a regra combinada (ate 7
jogadores em 1 quadra, 8 jogadores em 2 quadras). Se o grupo crescer bastante
e for preciso suportar 9+ jogadores ou mais quadras, e preciso ampliar o
gerador de sorteio (`server/lib/sorteio.js` e `schedules.js`).

**Por que uma etapa com 6 ou 7 jogadores gera tantas rodadas (8 ou 11)?**
Com apenas 1 quadra disponivel, e matematicamente o numero minimo de rodadas
necessario para garantir que todos joguem ao lado de e contra todos os
outros participantes pelo menos uma vez (regra 1.3). Quanto mais jogadores em
1 quadra so, mais rodadas sao necessarias.
