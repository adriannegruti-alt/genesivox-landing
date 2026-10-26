// Modulo "Checklist dei 30 documenti": invia il link al PDF a chi la richiede
// e una notifica del nuovo contatto a GENESIVOX.
// Usa le stesse variabili del modulo contatti (progetto Vercel genesivox-landing):
// RESEND_API_KEY, CONTACT_TO
const SITO = 'https://www.genesivox.com';
const PDF = SITO + '/checklist-30-documenti-cantiere.pdf';
const RUOLI = ['Impresa edile', 'Coordinatore CSE/CSP', 'RSPP o consulente sicurezza', 'Committente', 'Altro'];
const CANTIERI = ['', '1', '2-5', '6-20', 'Più di 20'];

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const limiti = new Map();

const invia = (dati) =>
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(dati),
  });

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ora = Date.now();
    const recenti = (limiti.get(ip) || []).filter((t) => ora - t < 600000);
    if (recenti.length >= 5) return res.status(429).json({ ok: false });
    recenti.push(ora);
    limiti.set(ip, recenti);

    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (b.sito) return res.status(200).json({ ok: true }); // honeypot: finto successo ai bot
    const nome = String(b.nome || '').trim().slice(0, 100);
    const email = String(b.email || '').trim().slice(0, 150);
    const ruolo = String(b.ruolo || '');
    const cantieri = String(b.cantieri || '');
    if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !RUOLI.includes(ruolo) || !CANTIERI.includes(cantieri) || b.privacy !== true) {
      return res.status(400).json({ ok: false });
    }
    const azienda = String(b.azienda || '').trim().slice(0, 120);
    const marketing = b.marketing === true;
    const quando = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

    // 1) email a chi ha richiesto la checklist
    const perUtente = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#0B1B33;max-width:560px">
<p>Ciao ${esc(nome.split(' ')[0])},</p>
<p>grazie per aver richiesto la <b>Checklist dei 30 documenti di cantiere</b>. Puoi scaricarla da qui:</p>
<p><a href="${PDF}" style="display:inline-block;background:#19D3F0;color:#0B1B33;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:4px">Scarica la checklist (PDF)</a></p>
<p>Usala prima dell'avvio dei lavori, all'ingresso di ogni nuova impresa e prima di un sopralluogo.</p>
<p>Se vuoi smettere di rincorrere questi documenti a mano, GENESIVOX li raccoglie in un unico QR-code del cantiere e avvisa prima delle scadenze. Per i primi 20 iscritti la prova è gratuita per 30 giorni e configuriamo insieme il primo cantiere: <a href="${SITO}/#prova">${SITO.replace('https://', '')}</a>, oppure rispondi a questa email.</p>
<p>Buon lavoro,<br>GENESIVOX</p>
<p style="color:#6B7785;font-size:12px;margin-top:24px">Ricevi questa email perché hai richiesto la checklist su genesivox.com. GENESIVOX S.r.l. · info@genesivox.com</p>
</div>`;

    const r1 = await invia({
      from: 'GENESIVOX <notifiche@genesivox.com>',
      to: [email],
      reply_to: process.env.CONTACT_TO || 'info@genesivox.com',
      subject: 'La tua checklist dei 30 documenti di cantiere',
      html: perUtente,
    });
    if (!r1.ok) return res.status(502).json({ ok: false });

    // 2) notifica del nuovo contatto a GENESIVOX (fa anche da registro dei consensi)
    const perNoi = `<h2>Nuovo download della checklist</h2>
<p><b>Nome:</b> ${esc(nome)}<br><b>Email:</b> ${esc(email)}<br><b>Azienda:</b> ${esc(azienda) || '-'}<br>
<b>Ruolo:</b> ${esc(ruolo)}<br><b>Cantieri attivi:</b> ${esc(cantieri) || '-'}</p>
<p><b>Consenso privacy:</b> sì<br><b>Consenso comunicazioni commerciali:</b> ${marketing ? 'SÌ' : 'NO – non inviare email promozionali'}<br>
<b>Data e ora:</b> ${esc(quando)}</p>
<p style="color:#666;font-size:12px">Inviato dal modulo checklist di genesivox.com.</p>`;

    await invia({
      from: 'GENESIVOX <notifiche@genesivox.com>',
      to: [process.env.CONTACT_TO || 'info@genesivox.com'],
      reply_to: email,
      subject: 'Checklist scaricata – ' + nome.replace(/[\r\n]/g, ' ') + ' (' + ruolo + ')',
      html: perNoi,
    }).catch(() => {});

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false });
  }
};
