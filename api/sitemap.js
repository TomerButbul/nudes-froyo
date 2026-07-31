// nudes — dynamic sitemap at /sitemap.xml (vercel.json rewrites it here).
// Lists the core pages plus every PUBLISHED blog post (the Apps Script doGet
// already hides future-scheduled rows), so Google can discover new articles the
// moment they go live — no manual sitemap edits, no redeploy.

const { fetchPosts, postPath, SITE } = require('./_blog');

const STATIC_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/the-nude.html', changefreq: 'weekly', priority: '0.8' },
  { loc: '/events.html', changefreq: 'monthly', priority: '0.7' }
];

module.exports = async function handler(req, res) {
  let posts = [];
  try { posts = await fetchPosts(); } catch (e) { posts = []; }

  const urls = STATIC_URLS.map(function (u) {
    return '<url><loc>' + SITE + u.loc + '</loc><changefreq>' + u.changefreq +
      '</changefreq><priority>' + u.priority + '</priority></url>';
  });

  posts.forEach(function (p) {
    if (!p || !p.slug) return;
    urls.push('<url><loc>' + SITE + postPath(p) +
      '</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>');
  });

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + '\n</urlset>';

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.end(xml);
};
