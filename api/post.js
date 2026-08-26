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

  // Deleted, hidden, not published yet, or simply mistyped — all land here. Send
  // people to the blog rather than a dead end. A 302 (not 301) because a hidden
  // post can be put back at any moment, and no-store so this redirect is never
  // cached in front of a post that returns.
  if (!post) {
    res.statusCode = 302;
    res.setHeader('Location', '/the-nude.html?gone=' + encodeURIComponent(slug));
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short, and no serving stale: hiding or deleting a post should take it down
  // in about a minute, not the five it used to.
  res.setHeader('Cache-Control', 's-maxage=60');
  res.end(renderArticle(post));
};
