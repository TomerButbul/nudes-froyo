// nudes — blog posts feed (Vercel Serverless Function)
// Fetches the "Posts" tab from the Google Sheet via the same Apps Script Web App
// used for form submissions (SHEETS_WEBHOOK_URL). Server-side, so there's no CORS
// and the Sheet stays private — only the Posts tab is ever exposed.
// Returns { posts: [...] }. Cached at the edge for a minute.

const SHEETS_URL = process.env.SHEETS_WEBHOOK_URL || '';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  if (!SHEETS_URL) return res.status(200).json({ posts: [] });
  try {
    const r = await fetch(SHEETS_URL, { redirect: 'follow' });
    if (!r.ok) return res.status(200).json({ posts: [] });
    const data = await r.json();
    return res.status(200).json({ posts: (data && data.posts) || [] });
  } catch (e) {
    return res.status(200).json({ posts: [] });
  }
};
