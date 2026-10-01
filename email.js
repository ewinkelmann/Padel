const nodemailer = require('nodemailer');

let transportador = null;
let avisoJaMostrado = false;

function obterTransportador() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (!avisoJaMostrado) {
      console.warn(
        '\n[padel-ranking] SMTP nao configurado (SMTP_HOST/SMTP_USER/SMTP_PASS ausentes). ' +
        'O envio de e-mail de redefinicao de senha nao vai funcionar ate essas variaveis serem ' +
        'definidas - veja o README.md. Por enquanto, o link de redefinicao sera apenas exibido ' +
        'no log do servidor, para facilitar testes locais.\n'
      );
      avisoJaMostrado = true;
    }
    return null;
  }
  if (!transportador) {
    transportador = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transportador;
}

/** Envia o e-mail com o link de redefinicao de senha. Nunca lanca erro para quem chamou
 * (falha de envio e so registrada no log), para nao vazar informacao sobre quais e-mails
 * existem no sistema atraves de respostas diferentes na API. */
async function enviarEmailRedefinicaoSenha({ destinatario, nome, link }) {
  const remetente = process.env.SMTP_FROM || process.env.SMTP_USER || 'nao-responda@padel-ranking.local';
  const assunto = 'Redefinir sua senha - Padel Ranking';
  const texto = `Ola, ${nome}!\n\nRecebemos um pedido para redefinir sua senha no Padel Ranking.\n\nClique no link abaixo (valido por 1 hora) para escolher uma nova senha:\n${link}\n\nSe voce nao pediu isso, pode ignorar este e-mail com seguranca - sua senha atual continua valendo.`;
  const html = `
    <p>Ola, ${escaparHtml(nome)}!</p>
    <p>Recebemos um pedido para redefinir sua senha no <strong>Padel Ranking</strong>.</p>
    <p><a href="${link}" style="background:#1b5a96;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;display:inline-block;">Redefinir minha senha</a></p>
    <p>Ou copie e cole este link no navegador (valido por 1 hora):<br>${link}</p>
    <p style="color:#666;font-size:13px;">Se voce nao pediu isso, pode ignorar este e-mail com seguranca - sua senha atual continua valendo.</p>
  `;

  const transp = obterTransportador();
  if (!transp) {
    console.log(`[padel-ranking] (SMTP nao configurado) Link de redefinicao para ${destinatario}: ${link}`);
    return;
  }

  try {
    await transp.sendMail({ from: remetente, to: destinatario, subject: assunto, text: texto, html });
  } catch (e) {
    console.error('[padel-ranking] Falha ao enviar e-mail de redefinicao de senha:', e.message);
  }
}

function escaparHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

module.exports = { enviarEmailRedefinicaoSenha };
