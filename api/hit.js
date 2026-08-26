// nudes — read counter for The Nude (Vercel Serverless Function)
//
// Every article pings this once per browser session; it bumps that post's row in
// the "Views" tab of the Google Sheet, and the studio shows the number.
//
// Why not read Vercel Web Analytics instead: it has no documented API for
// pulling per-page numbers back out. Vercel still runs alongside this and is the
// better place to look for referrers, countries and trends — this exists purely
// so the studio's table can show a figure next to each post.
//
// Deliberately cheap and quiet: no body parsing, no JSON reply, 204 either way.
// A counter is not worth failing a page load over.

const SHEETS_URL = process.env.SHEETS_WEBHOOK_URL || '';
const POST_SECRET = process.env.SHEETS_POST_SECRET || '';

const SLUG_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Crawlers, previewers and uptime checks shouldn't read as people. This misses
// the ones that lie about who they are, but it catches the honest majority.
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegram|slackbot|discordbot|linkedinbot|pinterest|curl|wget|headless|lighthouse|preview|monitor|python-requests|axios|node-fetch|go-http|java\//i;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const slug = String((req.query && req.query.slug) || '').trim().toLowerCase();
  const ua = String(req.headers['user-agent'] || '');

  // Anything unexpected is dropped silently — the visitor never sees this.
  if (req.method !== 'POST' || !SLUG_OK.test(slug) || !SHEETS_URL || !POST_SECRET) {
    res.statusCode = 204;
    return res.end();
  }
  if (!ua || BOT.test(ua)) {
    res.statusCode = 204;
    return res.end();
  }

  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addView', secret: POST_SECRET, slug: slug }),
      redirect: 'follow',
    });
  } catch (e) {
    // A missed count is not worth reporting anywhere.
  }

  res.statusCode = 204;
  res.end();
};
