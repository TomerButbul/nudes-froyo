// nudes — server-rendered single blog article at /the-nude/<slug>
// (vercel.json rewrites /the-nude/:slug -> /api/post?slug=:slug).
// Returns full crawlable HTML so Google indexes the real content, not a JS shell.

const { fetchPosts, renderArticle, STATIC_PAGES, SITE } = require('./_blog');

module.exports = async function handler(req, res) {
  const slug = (req.query && req.query.slug ? String(req.query.slug) : '').trim();

  // Posts with a dedicated static file own the canonical URL — send crawlers there.
  if (STATIC_PAGES[slug]) {
    res.statusCode = 301;
    res.setHeader('Location', '/' + STATIC_PAGES[slug]);
    return res.end();
  }

  const posts = await fetchPosts();
  const post = posts.filter(function (p) { return p && p.slug === slug; })[0];

  if (!post) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.end('<!DOCTYPE html><meta charset="utf-8"><title>not found · nudes</title>' +
      '<meta name="robots" content="noindex">' +
      '<link rel="stylesheet" href="/site.css"><div class="wrap" style="padding:4rem 0;text-align:center">' +
      '<p>that post isn’t here.</p><a href="/the-nude.html">← back to the nude</a></div>');
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.end(renderArticle(post));
};
