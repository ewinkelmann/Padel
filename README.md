# Padel Ranking

Site mobile-friendly para organizar as etapas do seu torneio de padel Americano:
inscricao de jogadores, sorteio automatico de parceiros/adversarios, lancamento
de resultados e ranking semestral/anual com criterios de desempate.

## O que o site faz

- **Login com e-mail e senha.** Qualquer jogador pode criar sua propria conta
  (nao e possivel cadastrar duas contas com o mesmo e-mail). Existe apenas
  **um usuario administrador** (definido nas variaveis de ambiente antes de
  publicar o site - veja abaixo). O administrador pode alterar qualquer dado
  (etapas, jogadores, resultados, regras). Os demais usuarios logados so
  podem **incluir nomes de jogadores** em uma etapa e **lancar o resultado**
  das partidas - eles nao conseguem editar ranking, excluir etapas, remover
  participantes ou corrigir um resultado que ja tenha sido lancado por outra
  pessoa (so o admin corrige).
- **Papel "Organizador".** Na pagina "Usuários", o administrador pode promover
  qualquer jogador a **organizador** (e rebaixa-lo de volta quando quiser).
  Um organizador, alem do que qualquer jogador ja pode fazer, tambem pode
  **criar novas etapas**, **realizar o sorteio inicial** delas, **corrigir o
  nome de uma etapa**, **gerar os jogos do Hall da Fama** de uma etapa e
  **gerenciar a secao Inscritos** (cadastrar atletas, marcar quem esta apto a
  jogar e quem e mensalista). Refazer um sorteio ja existente, mudar a data ou
  o status de uma etapa, excluir etapas/partidas e qualquer outra acao
  administrativa continuam exclusivas do administrador. A mudanca de papel
  vale na hora, mesmo que a pessoa ja esteja logada (nao precisa sair e
  entrar de novo).
- **Lista de usuários (só o admin ve).** Uma pagina "Usuários", visivel so
  para o administrador, mostra nome, e-mail, data de cadastro e o papel
  (jogador/organizador) de todo mundo que ja criou conta - com um menu para
  trocar o papel na hora. As senhas nunca aparecem ali (nem em nenhum outro
  lugar) - elas ficam guardadas apenas como hash, um formato que nem o
  proprio sistema consegue reverter para o texto original. Se um jogador
  esquecer a senha, a solucao e sempre pelo "Esqueci minha senha".
- **Editar nome da etapa.** Na pagina de uma etapa, administrador e
  organizador tem um botao de lapis (✏️) ao lado do titulo para corrigir o
  nome a qualquer momento, sem precisar recriar a etapa (data e status
  continuam exclusivos do administrador).
- **Esqueci minha senha.** Na tela de login, qualquer pessoa pode clicar em
  "Esqueci minha senha", informar o e-mail e recebe uma mensagem por e-mail
  com um link (valido por 1 hora) para escolher uma senha nova, sem precisar
  do administrador. Isso exige configurar o envio de e-mails (veja a secao
  "Configurar o envio de e-mail" abaixo) - sem essa configuracao, o link
  ainda e gerado mas so aparece no log do servidor, nao chega por e-mail de
  verdade.
- **Inscritos (cadastro dos atletas aptos a jogar).** Uma secao "Inscritos",
  visivel so para administrador e organizador, lista os atletas aptos a jogar
  as etapas. Cada atleta tem duas marcacoes independentes: **Inscrito** (apto
  a jogar etapas - so quem estiver marcado aqui aparece na lista suspensa de
  inclusao de jogadores numa etapa) e **Mensalista** (conta para o ranking
  geral - veja abaixo). E possivel cadastrar um atleta novo direto nesta
  secao (antes mesmo de ele jogar a primeira etapa) ou ligar/desligar as duas
  marcacoes de qualquer jogador a qualquer momento - desmarcar "Inscrito" nao
  apaga o historico do jogador, so tira ele da lista de inclusao em novas
  etapas.
- **Etapas do torneio.** O admin ou organizador cria uma etapa (nome + data).
  Enquanto as inscricoes estiverem abertas, qualquer jogador logado pode
  adicionar participantes (de 4 a 8 por etapa) escolhendo o nome numa lista
  suspensa, que so oferece quem estiver marcado como "Inscrito" na secao
  Inscritos (se o nome nao aparecer, e preciso cadastra-lo la primeiro). O
  admin ou organizador entao realiza o sorteio.
- **Sorteio automatico.** Garante matematicamente que, na etapa, cada jogador
  joga pelo menos uma vez ao lado de (como parceiro) e pelo menos uma vez
  contra (como adversario) todos os outros participantes, usando o menor
  numero de rodadas possivel:
  - ate 7 jogadores: 1 quadra (3, 5, 8 ou 11 rodadas, dependendo do numero de
    inscritos - 4, 5, 6 ou 7 jogadores respectivamente);
  - 8 jogadores: 2 quadras simultaneas, 7 rodadas (14 partidas).
    Nesse caso, o sorteio tambem **alterna as quadras** de cada jogador: nas 7
    rodadas, cada um joga 3 ou 4 jogos na quadra 01 e os demais na quadra 02, e
    evita ao maximo ficar muitas rodadas seguidas na mesma quadra.
  Os modelos de rodada foram gerados e verificados por simulacao (veja
  `server/lib/schedules.js`); a cada sorteio, os jogadores reais sao
  embaralhados aleatoriamente dentro desse modelo.
- **Resultados.** Cada partida termina em 3x0, 3x1 ou 3x2 (a dupla que
  chega a 3 games primeiro vence) - o site so aceita esses placares.
- **Etapas retroativas (partidas ja disputadas antes do site existir).**
  Na pagina de uma etapa, o administrador tem o link **"+ Adicionar partida
  retroativa"**, que abre um formulario para informar as duas duplas e o
  placar diretamente - sem passar por inscricao de jogadores nem sorteio.
  Os jogadores informados sao criados automaticamente (se ainda nao
  existirem) e entram na etapa, contando para o ranking normalmente. So o
  administrador ve e usa essa opcao. Uma etapa criada assim fica marcada
  como "retroativa" e nao usa mais o sorteio automatico (o botao de sorteio
  fica indisponivel para ela, ja que os jogos ja foram todos definidos
  manualmente) - mas continua podendo receber mais partidas retroativas a
  qualquer momento. O administrador tambem pode excluir uma partida
  lancada por engano (botao "Excluir partida").
- **Imprimir tabela de jogos.** Na pagina de uma etapa com sorteio (ou partidas)
  ja lancadas, o botao **"🖨️ Imprimir tabela"** gera uma folha simples para
  levar a quadra: rodada, dupla 1 x dupla 2, com caixinhas em branco para
  anotar o placar a mao. Se uma partida ja tiver resultado lancado no site,
  o placar aparece pre-preenchido na folha.
- **Ranking individual semestral e anual**, calculado automaticamente a
  partir dos resultados de todas as etapas do periodo, nesta ordem de
  desempate: (1) numero de vitorias, (2) saldo de games, (3) games ganhos,
  (4) confronto direto entre os jogadores empatados. O 1º, 2º e 3º colocados
  aparecem com medalha (🥇🥈🥉) ao lado da posicao. Esta lista (semestral e
  anual) so mostra quem estiver marcado como **Inscrito e Mensalista** na
  secao Inscritos - os jogos de todo mundo continuam entrando no calculo
  normalmente (saldo de games, confronto direto etc.), so a listagem final e
  filtrada.
- **Ranking por etapa (historico).** Na pagina de Ranking, a aba "Por etapa"
  mostra um seletor com todas as etapas ja sorteadas/lancadas; ao escolher
  uma, aparece a classificacao estatica so daquela etapa (mesmos criterios de
  desempate do ranking semestral/anual), com todos os participantes daquela
  etapa (sem o filtro de mensalista - e um retrato fixo de como ficou cada
  etapa especifica, sem somar com as demais).
- **Hall da Fama.** Depois que todas as partidas normais de uma etapa ja
  tiverem placar lancado, administrador ou organizador podem clicar em
  **"🏆 Gerar jogos do Hall da Fama"**, na propria pagina da etapa. O sistema
  monta, com base no ranking daquela etapa: a **Finalissima**, entre o 1º e o
  4º colocados contra o 2º e o 3º; e, quando a etapa tiver 8 jogadores,
  tambem a **Ultimalissima**, entre o 5º e o 8º colocados contra o 6º e o 7º.
  Essas partidas aparecem na propria pagina da etapa (com o mesmo jeito de
  lancar/corrigir placar das partidas normais) e tambem ficam reunidas numa
  secao **"Hall da Fama"** propria, visivel para qualquer jogador logado, com
  o historico de todas as etapas. Esses jogos nao contam para o ranking geral
  nem para os perfis (radar) - ja que as duplas sao montadas artificialmente
  a partir do proprio resultado final, contar isso distorceria as
  estatisticas.
- **Finalizar etapa (travar resultados).** Depois que todos os resultados de
  uma etapa ja foram lancados, o administrador pode clicar em **"🔒 Finalizar
  etapa"**: a partir dai, jogadores e organizadores deixam de conseguir
  lancar ou corrigir qualquer resultado daquela etapa - so o proprio
  administrador. O botao vira **"🔓 Ajustar"** (visivel so para o admin) caso
  seja preciso reabrir para algum ajuste pontual depois.
- **Editar nome de jogador em qualquer etapa.** Ao lado do nome de cada
  jogador inscrito numa etapa (inclusive em etapas ja encerradas ou
  finalizadas), administrador e organizador tem um icone de lapis (✏️) para
  corrigir o nome. Como o nome pertence ao cadastro do jogador, a correcao
  vale para o site inteiro (ranking, outras etapas, perfis), nao so ali.
- **Perfis dos jogadores (radar de forcas).** Uma nova secao "Perfis" mostra,
  para cada jogador que ja disputou partidas, um radar com 6 indicadores de 0
  a 100 calculados de forma consolidada (somando todas as etapas ja
  disputadas): Geral, Ataque, Consistencia, Fisico, Defesa e Teamplay. A
  propria pagina explica o racional de cada um. Em resumo: Ataque e Defesa
  vem da media de games ganhos/cedidos por partida; Consistencia mede o
  quanto o saldo de games varia de jogo para jogo; Fisico compara o
  desempenho nas rodadas finais de uma etapa com as rodadas iniciais (queda
  ou manutencao de nivel); Teamplay mede a taxa de vitoria do jogador com
  cada parceiro diferente que ja teve (penalizando quem so rende bem com uma
  pessoa especifica); e Geral e a media dos outros cinco. Jogadores com poucas
  partidas tem os indicadores suavizados em direcao a uma nota neutra (50),
  para uma amostra pequena nao gerar notas extremas.

## Como publicar o site (~10-15 minutos)

O site precisa rodar em um servidor (nao funciona como um simples arquivo
HTML, porque guarda dados reais de jogadores e login). A forma mais simples
e usar o **Render**. Railway e Fly.io funcionam de forma muito parecida,
caso prefira.

**Importante sobre o plano Free do Render:** o plano gratuito **nao suporta
disco persistente** (isso nao fica claro na propria interface do Render).
Sem disco persistente, todo dado gravado localmente (jogadores, etapas,
usuarios, resultados) e apagado sempre que o servico "dorme" por inatividade
e depois "acorda" - ou seja, os dados nao ficam salvos de fato. Por isso,
para o site guardar os dados de verdade, e necessario o **plano pago minimo
do Render (Starter, ~US$7/mes) + um disco persistente (~US$0,25/GB/mes - 1 GB
ja e mais que suficiente)**, total em torno de **US$7,25/mes**.

### Opcao A - Render.com (recomendado)

1. Crie uma conta em https://render.com (pode entrar com GitHub).
2. Suba esta pasta para um repositorio no GitHub (no site do GitHub, crie um
   repositorio novo e vazio, depois siga as instrucoes dele para "push an
   existing repository" - ou peca para alguem te ajudar com isso na hora).
3. No painel do Render, clique em **New +** → **Web Service** e selecione
   o repositorio que voce criou.
4. Configure:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Instance Type**: **Starter** (plano pago, ~US$7/mes) - o plano Free
     nao permite disco persistente, entao os dados seriam perdidos.
5. Em **Environment**, adicione as variaveis (veja a secao abaixo para o que
   colocar em cada uma):
   - `ADMIN_NOME`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
   - `NODE_ENV` = `production`
   - `DATA_DIR` = `/var/data` (precisa ser **exatamente** o mesmo caminho
     usado no mount path do disco no passo 6 - e o que diz ao site onde
     gravar o banco de dados)
6. Em **Disks**, adicione um disco persistente (Add Disk) com pelo menos 1 GB,
   montado em `/var/data` (mesmo caminho da variavel `DATA_DIR` acima) - isso
   garante que os dados (jogadores, etapas, resultados, ranking) nao se
   percam quando o Render reiniciar o servidor.
7. Clique em **Create Web Service**. Em alguns minutos o Render vai te dar um
   link (algo como `https://padel-ranking.onrender.com`) - esse e o site para
   compartilhar com o grupo.

Se o servico ja existir configurado como Free, va em **Settings** para trocar
o **Instance Type** para Starter, depois em **Disks** para adicionar o disco,
e em **Environment** para adicionar a variavel `DATA_DIR` - o Render reinicia
o servico automaticamente apos essas mudancas. Como os dados atuais estao
gravados no lugar errado (efemero), essa troca nao preserva o que ja foi
cadastrado ate agora - sera preciso recadastrar jogadores/etapas depois, mas
dai em diante tudo fica salvo de verdade.

### Opcao B - Railway.app

Mesma ideia: crie conta, "New Project" → "Deploy from GitHub repo", defina
as mesmas variaveis de ambiente (incluindo `DATA_DIR`) na aba **Variables**,
e adicione um **Volume** apontando para o mesmo caminho para os dados nao se
perderem entre deploys. Railway tambem exige plano pago para volumes
persistentes.

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

## Configurar o envio de e-mail (para o "Esqueci minha senha" funcionar)

O site precisa de um servico de SMTP para conseguir enviar o e-mail com o
link de redefinicao de senha. Recomendamos o **Brevo** (antigo Sendinblue),
que tem plano gratuito de 300 e-mails/dia - mais que suficiente para o seu
grupo:

1. Crie uma conta gratuita em https://www.brevo.com.
2. No painel, va em **Settings (o ícone de engrenagem)** → **SMTP & API** →
   aba **SMTP**.
3. Voce vai ver algo como:
   - **SMTP Server**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Login**: seu e-mail cadastrado no Brevo
   - **Password / Master password**: clique em "Generate a new SMTP key" para
     criar uma senha especifica para isso (nao e a senha da sua conta Brevo).
4. No Render (ou Railway), adicione estas variaveis de ambiente com os
   valores acima:
   - `SMTP_HOST` = `smtp-relay.brevo.com`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = seu login do Brevo
   - `SMTP_PASS` = a chave SMTP gerada no passo 3
   - `SMTP_FROM` = por exemplo `Padel Ranking <seuemail@exemplo.com>` (use o
     mesmo e-mail da sua conta Brevo, senao alguns provedores marcam como
     spam)
5. Salve e reinicie o servico (Manual Deploy). Pronto - o "Esqueci minha
   senha" ja vai enviar e-mails de verdade.

Qualquer outro provedor de SMTP funciona do mesmo jeito (Gmail com "senha de
app", SendGrid, Mailgun, Amazon SES etc.) - so trocar os valores de
`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`.

Sem essas variaveis configuradas, o site continua funcionando normalmente -
o link de redefinicao so nao chega por e-mail (ele fica registrado no log do
servidor, o que serve para testar localmente).

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
    email.js       envio do e-mail de redefinicao de senha (SMTP)
  routes/          endpoints da API (auth, jogadores, etapas, partidas, ranking)
public/            front-end (HTML/CSS/JS puro, sem build step)
  img/
    favicon.svg    icone do site (bola de padel amarela)
    quadra-bg.jpg  foto de fundo do site
data/              banco de dados SQLite fica aqui (nao apagar ao fazer deploy!)
```

## Duvidas comuns

**Um jogador errou o nome ao se inscrever numa etapa - da pra corrigir?**
Sim: na pagina de qualquer etapa (mesmo ja encerrada), administrador e
organizador tem um icone de lapis (✏️) ao lado do nome de cada jogador
inscrito, que corrige o nome em todo o site (ranking, perfis, outras etapas).

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
