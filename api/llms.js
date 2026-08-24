// nudes — /llms.txt (vercel.json rewrites it here).
//
// The emerging convention for answer engines: a short, plain-text map of the site
// that an LLM can read in one request instead of crawling and guessing. Generated
// from the same Google Sheet as everything else, so it never goes stale.
//
// Each post is listed with its one-line answer where the sheet has one — that
// `answer` column is the sentence an AI assistant is most likely to quote.

const { fetchAllPosts, postPath, SITE } = require('./_blog');

const HEADER = [
  '# nudes',
  '',
  '> nudes is a Mediterranean frozen yogurt shop opening at 165 S Crescent Heights Blvd,',
  '> Los Angeles, CA 90048. Strained, protein-rich yogurt, clean ingredients and real',
  '> toppings — Mediterranean-style froyo rather than the American soft-serve kind.',
  '',
  'Contact: info@nudesyogurt.com · Instagram: @nudesyogurt',
  '',
  '## Key facts',
  '',
  '- Category: frozen yogurt shop / dessert (Mediterranean)',
  '- Location: Beverly Grove, Los Angeles, California',
  '- Address: 165 S Crescent Heights Blvd, Los Angeles, CA 90048',
  '- Status: opening soon — waitlist open at https://nudesyogurt.com/',
  '- What makes it different: strained (Mediterranean-style) yogurt — thicker, tangier',
  '  and higher in protein than standard American frozen yogurt.',
  '',
  '## Pages',
  '',
  '- [Home](' + SITE + '/): the brand, the flavors and the waitlist.',
  '- [The Nude](' + SITE + '/the-nude.html): the journal — articles on Mediterranean',
  '  frozen yogurt, clean ingredients and LA food culture.',
  '- [Events](' + SITE + '/events.html): private events, collabs and bookings.',
  ''
].join('\n');

module.exports = async function handler(req, res) {
  let posts = [];
  try { posts = await fetchAllPosts(); } catch (e) { posts = []; }

  const lines = ['## Articles', ''];
  posts.forEach(function (p) {
    if (!p || !p.slug || !p.title) return;
    const summary = String(p.answer || p.excerpt || '').replace(/\s+/g, ' ').trim();
    lines.push('- [' + p.title + '](' + SITE + postPath(p) + ')' + (summary ? ': ' + summary : ''));
  });
  if (posts.length === 0) lines.push('- (none published yet)');

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.end(HEADER + '\n' + lines.join('\n') + '\n');
};
