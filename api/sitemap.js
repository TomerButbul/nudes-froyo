// nudes — dynamic sitemap at /sitemap.xml (vercel.json rewrites it here).
// Lists the core pages plus every PUBLISHED blog post (the Apps Script doGet
// already hides future-scheduled rows), so Google can discover new articles the
// moment they go live — no manual sitemap edits, no redeploy.
//
// Each post also declares its images (and video, if it has one) via the Google
// image/video sitemap extensions, which is how photos from the sheet get picked
// up by Google Images and video results instead of being ignored.

const { fetchAllPosts, postPath, postImages, videoInfo, videoThumb, isoDate, abs, SITE } = require('./_blog');

const STATIC_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/the-nude.html', changefreq: 'weekly', priority: '0.8' },
  { loc: '/events.html', changefreq: 'monthly', priority: '0.7' }
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

module.exports = async function handler(req, res) {
  let posts = [];
  try { posts = await fetchAllPosts(); } catch (e) { posts = []; }

  const urls = STATIC_URLS.map(function (u) {
    return '<url><loc>' + SITE + u.loc + '</loc><changefreq>' + u.changefreq +
      '</changefreq><priority>' + u.priority + '</priority></url>';
  });

  posts.forEach(function (p) {
    if (!p || !p.slug) return;
    const loc = SITE + postPath(p);
    const lastmod = isoDate(p.updated) || isoDate(p.published) || isoDate(p.publish);
    let entry = '<url><loc>' + loc + '</loc>';
    if (lastmod) entry += '<lastmod>' + lastmod.slice(0, 10) + '</lastmod>';
    entry += '<changefreq>monthly</changefreq><priority>0.6</priority>';

    postImages(p).forEach(function (img) {
      entry += '<image:image><image:loc>' + esc(img.url) + '</image:loc>' +
        (img.title ? '<image:title>' + esc(img.title) + '</image:title>' : '') + '</image:image>';
    });

    const info = videoInfo(p.video);
    if (info) {
      const thumb = videoThumb(info, p.video_thumb);
      entry += '<video:video>' +
        '<video:thumbnail_loc>' + esc(thumb || SITE + '/assets/og.png') + '</video:thumbnail_loc>' +
        '<video:title>' + esc(p.title) + '</video:title>' +
        '<video:description>' + esc((p.excerpt || p.title).slice(0, 2000)) + '</video:description>' +
        (info.kind === 'file'
          ? '<video:content_loc>' + esc(abs(info.embed)) + '</video:content_loc>'
          : '<video:player_loc>' + esc(info.embed) + '</video:player_loc>') +
        '</video:video>';
    }

    urls.push(entry + '</url>');
  });

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
    ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' +
    ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n' +
    urls.join('\n') + '\n</urlset>';

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.end(xml);
};
