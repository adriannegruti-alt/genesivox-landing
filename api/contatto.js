// Riceve il modulo della landing e lo inoltra via email con Resend.
// Variabili su Vercel (progetto genesivox-landing): RESEND_API_KEY, CONTACT_TO
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const limiti = new Map();

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
    if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || b.privacy !== true) return res.status(400).json({ ok: false });
    const azienda = String(b.azienda || '').trim().slice(0, 120);
    const telefono = String(b.telefono || '').trim().slice(0, 40);
    const messaggio = String(b.messaggio || '').trim().slice(0, 1500);

    const html = `<h2>Nuova richiesta di prova gratuita</h2>
<p><b>Nome:</b> ${esc(nome)}<br><b>Azienda:</b> ${esc(azienda) || '-'}<br><b>Email:</b> ${esc(email)}<br><b>Telefono:</b> ${esc(telefono) || '-'}</p>
<p><b>Messaggio:</b><br>${esc(messaggio).replace(/\n/g, '<br>') || '-'}</p>
<p style="color:#666;font-size:12px">Consenso privacy dato dall'utente. Inviato dal modulo di genesivox.com.</p>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'GENESIVOX <notifiche@genesivox.com>',
        to: [process.env.CONTACT_TO || 'info@genesivox.com'],
        reply_to: email,
        subject: 'Richiesta prova gratuita – ' + nome.replace(/[\r\n]/g, ' '),
        html,
      }),
    });
    if (!r.ok) return res.status(502).json({ ok: false });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false });
  }
};
