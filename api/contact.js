// nudes — in-house form handler (Vercel Serverless Function)
// Receives waitlist / partnerships / events submissions and writes them to a
// Google Sheet (via a Google Apps Script Web App webhook). Optionally also
// emails them via Resend if a key is set. Zero npm deps (built-in fetch).
//
// Set in Vercel → Project → Settings → Environment Variables:
//   SHEETS_WEBHOOK_URL   the Google Apps Script Web App URL (see docs/google-sheet-webhook.gs)
// Optional:
//   RESEND_API_KEY            if set, also emails the submission
//   CONTACT_FROM              default "nudes <onboarding@resend.dev>"
//   CONTACT_TO                default "info@nudesyogurt.com"
//   CONTACT_TO_PARTNERSHIPS   default "partnerships@nudesyogurt.com"

const SHEETS_URL = process.env.SHEETS_WEBHOOK_URL || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.CONTACT_FROM || 'nudes <onboarding@resend.dev>';
const TO_INFO = process.env.CONTACT_TO || 'info@nudesyogurt.com';
const TO_PARTNERSHIPS = process.env.CONTACT_TO_PARTNERSHIPS || 'partnerships@nudesyogurt.com';

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

async function toSheet(record) {
  const r = await fetch(SHEETS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
    redirect: 'follow', // Apps Script Web Apps 302 to script.googleusercontent.com
  });
  if (!r.ok) throw new Error('sheet ' + r.status);
}

async function toEmail(body, formType, email) {
  const to = (formType === 'partnership' || formType === 'event') ? TO_PARTNERSHIPS : TO_INFO;
  const subjectMap = {
    waitlist: 'New waitlist signup', partnership: 'New partnerships / press inquiry',
    event: 'New event / collab inquiry', general: 'New message',
  };
  const subject = (subjectMap[formType] || subjectMap.general) + ' — nudes';
  const fields = ['name', 'email', 'phone', 'company', 'reason', 'event_type', 'preferred_date', 'guests', 'message'];
  const rows = fields.filter(function (f) { return body[f]; }).map(function (f) {
    return '<tr><td style="padding:4px 14px 4px 0;color:#8a7a6a;font-family:sans-serif;font-size:12px;text-transform:capitalize;vertical-align:top">'
      + f.replace('_', ' ') + '</td><td style="padding:4px 0;font-family:sans-serif;font-size:14px;color:#2A1810">'
      + escapeHtml(body[f]).replace(/\n/g, '<br>') + '</td></tr>';
  }).join('');
  const html = '<div style="max-width:560px"><h2 style="font-family:sans-serif;color:#442917;font-size:18px">'
    + escapeHtml(subject) + '</h2><table style="border-collapse:collapse">' + rows + '</table></div>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: email, subject: subject, html: html }),
  });
  if (!r.ok) throw new Error('email ' + r.status);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!SHEETS_URL && !RESEND_KEY) {
    return res.status(500).json({ ok: false, error: 'Form delivery is not configured yet.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // Honeypot: real people leave this empty; bots fill it. Pretend success and drop it.
  if (body.website) return res.status(200).json({ ok: true });

  const email = String(body.email || '').trim();
  const formType = String(body.formType || 'general').trim();
  const name = String(body.name || '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'A valid email is required.' });
  }
  if (formType !== 'waitlist' && !name) {
    return res.status(400).json({ ok: false, error: 'Please add your name.' });
  }

  const record = {
    formType: formType,
    submittedAt: new Date().toISOString(),
    name: name,
    email: email,
    phone: String(body.phone || '').trim(),
    company: String(body.company || '').trim(),
    reason: String(body.reason || '').trim(),
    event_type: String(body.event_type || '').trim(),
    preferred_date: String(body.preferred_date || '').trim(),
    guests: String(body.guests || '').trim(),
    message: String(body.message || '').trim(),
  };

  try {
    // Sheet is the source of truth; email is best-effort if configured.
    if (SHEETS_URL) await toSheet(record);
    if (RESEND_KEY) { try { await toEmail(body, formType, email); } catch (e) { /* non-fatal */ } }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'Could not submit right now — try again or email us.' });
  }
};
