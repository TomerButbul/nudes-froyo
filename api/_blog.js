// nudes — shared server-side blog rendering (NOT a route; leading underscore).
// Used by api/post.js (single article), api/nude.js (index) and api/sitemap.js.
//
// WHY THIS EXISTS: the blog posts live in a Google Sheet and were previously
// rendered only in the browser with JavaScript. Googlebot on a brand-new domain
// rarely runs that JS, so it saw empty "loading…" shells and never indexed the
// articles. Rendering the same posts to real HTML on the server fixes that:
// the full text, headings, media, meta tags and JSON-LD are in the page source.
//
// SHEET COLUMNS (all optional except slug/title/body — see docs/adding-a-blog-post.md):
//   slug title category excerpt body publish   — the post itself
//   cover alt images video video_thumb          — media (docs/media-guide.md)
//   answer faq                                  — the AEO pair: direct answer + Q&A
//   date read keywords author updated           — metadata

const SHEETS_URL = process.env.SHEETS_WEBHOOK_URL || '';
const SITE = 'https://nudesyogurt.com';
const BRAND = 'nudes';
const THEMES = { clean: 1, culture: 1, build: 1, wellness: 1, menu: 1 };
const OG_FALLBACK = SITE + '/assets/og.png';

// Posts that have their own hand-crafted static .html file. For these we point
// every link/canonical at the static file (one canonical URL, no duplicate content)
// instead of the server-rendered /the-nude/<slug> route.
const STATIC_PAGES = {
  'what-is-mediterranean-frozen-yogurt': 'the-nude-what-is-mediterranean-frozen-yogurt.html'
};

// Hand-built posts that aren't in the sheet, so the index still lists them.
// Mirrors the STATIC array in blog.js.
const STATIC_POSTS = [
  {
    slug: 'what-is-mediterranean-frozen-yogurt',
    title: 'what is mediterranean frozen yogurt?',
    category: 'clean ingredients',
    cover: 'clean',
    date: 'jul 2026',
    read: '4 min read',
    excerpt: "Thicker, tangier, higher in protein and rooted in the Levant. here's what sets Mediterranean-style frozen yogurt apart, and why we built nudes around it."
  }
];

async function fetchPosts() {
  if (!SHEETS_URL) return [];
  try {
    const r = await fetch(SHEETS_URL, { redirect: 'follow' });
    if (!r.ok) return [];
    const data = await r.json();
    return (data && data.posts) || [];
  } catch (e) {
    return [];
  }
}

// Sheet posts first (newest-first, already sorted by the Apps Script), then any
// hand-built post the sheet doesn't already own.
async function fetchAllPosts() {
  const sheet = await fetchPosts();
  const seen = {};
  const out = [];
  sheet.forEach(function (p) { if (p && p.slug) { seen[p.slug] = 1; out.push(p); } });
  STATIC_POSTS.forEach(function (p) { if (!seen[p.slug]) out.push(p); });
  return out;
}

function isImage(c) { return typeof c === 'string' && /[\/.]/.test(c) && !THEMES[c]; }
function coverClass(c) { return 'cover--' + (THEMES[c] ? c : 'clean'); }

// Relative paths ("/images/cup.jpg") are fine in HTML but Open Graph, JSON-LD and
// sitemaps all need absolute URLs, so everything machine-readable goes through this.
function abs(u) {
  const s = String(u == null ? '' : u).trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return SITE + (s.charAt(0) === '/' ? '' : '/') + s;
}

// Where a given post lives: its static file if it has one, else the SSR route.
function postPath(p) {
  if (STATIC_PAGES[p.slug]) return '/' + STATIC_PAGES[p.slug];
  return '/the-nude/' + encodeURIComponent(p.slug);
}

// The sheet sometimes hands back a raw JS Date string ("Wed Jul 01 2026 …") or an
// ISO date. Normalise anything date-like to "jul 2026"; pass real labels through.
function fmtDate(v) {
  if (!v) return '';
  const s = String(v);
  const d = new Date(s);
  if (!isNaN(d.getTime()) && /\d{4}/.test(s) && /[A-Za-z]{3}|\d{4}-\d{2}/.test(s)) {
    const m = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][d.getMonth()];
    return m + ' ' + d.getFullYear();
  }
  return s;
}

// Anything date-like -> "2026-07-01T00:00:00.000Z" for datePublished/dateModified.
function isoDate(v) {
  if (!v) return '';
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A sheet cell holds multiple entries as separate lines (Ctrl+Enter inside the cell).
function cellLines(v) {
  return String(v == null ? '' : v).replace(/\r/g, '').split('\n')
    .map(function (l) { return l.trim(); })
    .filter(Boolean);
}

// inline **bold** -> <strong>, [text](url) -> <a>, everything else escaped text
function inline(text) {
  return String(text).split('**').map(function (seg, i) {
    if (!seg) return '';
    const html = i % 2 ? '<strong>' + esc(seg) + '</strong>' : esc(seg);
    // links are written after escaping so the URL can't inject markup
    return html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, function (m, label, href) {
      const ext = /^https?:/i.test(href);
      return '<a href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
    });
  }).join('');
}

// ---------------------------------------------------------------- media ----
// `video` accepts a self-hosted file (/videos/x.mp4), YouTube or Vimeo.
function videoInfo(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (m) return { kind: 'youtube', id: m[1], embed: 'https://www.youtube-nocookie.com/embed/' + m[1], page: u };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: 'vimeo', id: m[1], embed: 'https://player.vimeo.com/video/' + m[1], page: u };
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return { kind: 'file', embed: u, page: u };
  return null;
}

// YouTube/Vimeo thumbnails are predictable, so a post that embeds one still gets
// a real og:image and a VideoObject thumbnail without anyone filling in a column.
function videoThumb(info, explicit) {
  if (explicit) return abs(explicit);
  if (info && info.kind === 'youtube') return 'https://i.ytimg.com/vi/' + info.id + '/maxresdefault.jpg';
  return '';
}

function videoFigure(info, poster, caption) {
  if (!info) return '';
  const cap = caption ? '<figcaption>' + esc(caption) + '</figcaption>' : '';
  if (info.kind === 'file') {
    return '<figure class="post-fig post-fig--video"><video controls playsinline preload="metadata"' +
      (poster ? ' poster="' + esc(poster) + '"' : '') +
      '><source src="' + esc(info.embed) + '">' +
      'your browser can’t play this video. <a href="' + esc(info.embed) + '">download it</a> instead.' +
      '</video>' + cap + '</figure>';
  }
  return '<figure class="post-fig post-fig--video"><div class="embed"><iframe src="' + esc(info.embed) +
    '" title="' + esc(caption || 'nudes video') + '" loading="lazy" frameborder="0" ' +
    'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
    'allowfullscreen></iframe></div>' + cap + '</figure>';
}

// `images` column: one image per line, "url | alt text describing the photo".
function parseImages(v) {
  return cellLines(v).map(function (line) {
    const parts = line.split('|');
    const url = parts.shift().trim();
    if (!url) return null;
    return { url: url, alt: parts.join('|').trim() };
  }).filter(Boolean);
}

function imageFigure(img) {
  return '<figure class="post-fig"><img src="' + esc(img.url) + '" alt="' + esc(img.alt) +
    '" loading="lazy" decoding="async">' +
    (img.alt ? '<figcaption>' + esc(img.alt) + '</figcaption>' : '') + '</figure>';
}

// Every image a post references — absolute, deduped, each with its own caption —
// for the Article JSON-LD and the image sitemap. Returns [{ url, title }].
function postImages(p) {
  const out = [];
  const seen = {};
  const push = function (u, title) {
    const a = abs(u);
    if (!a || seen[a]) return;
    seen[a] = 1;
    out.push({ url: a, title: String(title || '').trim() });
  };
  if (isImage(p.cover)) push(p.cover, p.alt);
  parseImages(p.images).forEach(function (i) { push(i.url, i.alt); });
  // inline body images carry their alt text in the ![alt](url) syntax
  String(p.body || '').replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, u) { push(u, alt); return m; });
  const info = videoInfo(p.video);
  const thumb = videoThumb(info, p.video_thumb);
  if (thumb) push(thumb, p.title);
  return out;
}

// ------------------------------------------------------------ body text ----
// Plain sheet text -> HTML blocks. Mirrors blog.js parseBody so server and client
// render identically:  blank line = block · "## " heading · "### " subheading ·
// "- " list · "1. " numbered · "> " quote · "![alt](url)" image · a bare media URL
// on its own line = image or video · everything else a paragraph.
function parseBody(text) {
  const out = [];
  String(text || '').replace(/\r/g, '').split(/\n{2,}/).forEach(function (block) {
    block = block.replace(/^\n+|\n+$/g, '');
    if (!block) return;
    const lines = block.split('\n');
    const im = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    const bare = block.match(/^(https?:\/\/\S+|\/\S+)$/);
    if (im) {
      out.push(imageFigure({ url: im[2].trim(), alt: im[1] }));
    } else if (bare && videoInfo(bare[1])) {
      out.push(videoFigure(videoInfo(bare[1]), '', ''));
    } else if (bare && /\.(jpe?g|png|webp|avif|gif|svg)(\?|#|$)/i.test(bare[1])) {
      out.push(imageFigure({ url: bare[1], alt: '' }));
    } else if (/^###\s+/.test(block)) {
      out.push('<h3>' + inline(block.replace(/^###\s+/, '')) + '</h3>');
    } else if (/^##\s+/.test(block)) {
      out.push('<h2>' + inline(block.replace(/^##\s+/, '')) + '</h2>');
    } else if (lines.every(function (l) { return /^-\s+/.test(l); })) {
      out.push('<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^-\s+/, '')) + '</li>'; }).join('') + '</ul>');
    } else if (lines.every(function (l) { return /^\d+\.\s+/.test(l); })) {
      out.push('<ol>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\d+\.\s+/, '')) + '</li>'; }).join('') + '</ol>');
    } else if (/^>\s+/.test(block)) {
      out.push('<blockquote>' + inline(block.replace(/^>\s+/gm, '').replace(/\n/g, ' ')) + '</blockquote>');
    } else {
      out.push('<p>' + inline(block.replace(/\n/g, ' ')) + '</p>');
    }
  });
  return out.join('\n');
}

function wordCount(text) {
  const w = String(text || '').trim().match(/\S+/g);
  return w ? w.length : 0;
}

// "4 min read" -> "PT4M" (schema.org timeRequired)
function isoDuration(read) {
  const m = String(read || '').match(/(\d+)/);
  return m ? 'PT' + m[1] + 'M' : '';
}

// ------------------------------------------------------- answers (AEO) ----
// The `faq` column, one Q&A per pair of lines ("Q: …" / "A: …") or one per line
// ("question | answer"). These become both visible copy and FAQPage structured
// data, which is what AI answer engines and rich results actually read.
function parseFaq(v) {
  const out = [];
  let pending = null;
  cellLines(v).forEach(function (line) {
    if (line.indexOf('|') > -1 && !/^[QA]\s*[:.]/i.test(line)) {
      const parts = line.split('|');
      const q = parts.shift().trim();
      const a = parts.join('|').trim();
      if (q && a) out.push({ q: q, a: a });
      return;
    }
    const qm = line.match(/^Q\s*[:.]\s*(.+)$/i);
    const am = line.match(/^A\s*[:.]\s*(.+)$/i);
    if (qm) { pending = qm[1].trim(); return; }
    if (am && pending) { out.push({ q: pending, a: am[1].trim() }); pending = null; return; }
    if (am) return;
    if (pending) { out.push({ q: pending, a: line }); pending = null; }
    else pending = line;
  });
  return out;
}

function answerBlock(answer) {
  if (!answer) return '';
  return '<div class="answer"><p class="answer__label">the short answer</p>' +
    '<p class="answer__text">' + inline(answer) + '</p></div>';
}

function faqBlock(faqs) {
  if (!faqs.length) return '';
  return '<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">questions, answered</h2>' +
    faqs.map(function (f) {
      return '<div class="faq__item"><h3 class="faq__q">' + esc(f.q) + '</h3>' +
        '<p class="faq__a">' + inline(f.a) + '</p></div>';
    }).join('') + '</section>';
}

// Internal links: same category first, then anything else. Real SEO value, and it
// keeps a reader (or a crawler) moving through the site instead of bouncing.
function relatedBlock(post, all) {
  const others = (all || []).filter(function (p) { return p && p.slug && p.slug !== post.slug; });
  const same = others.filter(function (p) { return p.category && p.category === post.category; });
  const rest = others.filter(function (p) { return same.indexOf(p) === -1; });
  const picks = same.concat(rest).slice(0, 3);
  if (!picks.length) return '';
  return '<nav class="related" aria-labelledby="related-h"><h2 id="related-h">keep reading</h2><ul>' +
    picks.map(function (p) {
      return '<li><a href="' + esc(postPath(p)) + '">' + esc(p.title) + '</a>' +
        (p.excerpt ? '<span>' + esc(p.excerpt) + '</span>' : '') + '</li>';
    }).join('') + '</ul></nav>';
}

// ------------------------------------------------------------- chrome ------
const LOGO = '<svg viewBox="289.23 392.4 370.35 221.32" fill="currentColor" aria-hidden="true"><path d="M 592.859375 397.042969 L 592.007812 515.667969 C 592.007812 541.304688 578.988281 557.175781 549.671875 557.175781 C 520.386719 557.175781 507.367188 541.304688 507.367188 515.667969 L 507.304688 515.523438 L 507.304688 490.457031 C 507.304688 421.285156 465.796875 392.402344 398.25 392.402344 C 330.738281 392.402344 289.230469 421.285156 289.230469 490.457031 L 289.230469 608.023438 L 355.949219 608.023438 L 355.949219 490.457031 C 355.949219 464.816406 368.964844 448.949219 398.25 448.949219 C 427.570312 448.949219 440.585938 464.816406 440.585938 490.457031 L 440.648438 490.566406 L 440.648438 515.667969 C 440.648438 584.835938 482.15625 613.722656 549.671875 613.722656 C 617.214844 613.722656 658.722656 584.835938 658.722656 515.667969 L 659.578125 397.042969 Z"/></svg>';

function chrome(topActive) {
  return '<header class="topnav">' +
    '<a class="topnav__logo" href="/" aria-label="nudes home">' + LOGO + '</a>' +
    '<nav class="topnav__links">' +
    '<a href="/the-nude.html"' + (topActive === 'nude' ? ' aria-current="page"' : '') + '>the nude</a>' +
    '<a href="/events.html">events</a>' +
    '</nav></header>';
}

const FOOTER = '<footer class="site-footer"><div class="wrap">' +
  '<span>© 2026 nudes · los angeles</span>' +
  '<a href="mailto:info@nudesyogurt.com">info@nudesyogurt.com</a>' +
  '</div></footer>';

const HEAD_FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="preconnect" href="https://api.fontshare.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">' +
  '<link href="https://api.fontshare.com/v2/css?f%5B%5D=switzer@300,400,500,600&display=swap" rel="stylesheet">';

const HEAD_ICONS =
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' +
  '<link rel="icon" type="image/png" sizes="512x512" href="/assets/nudes-avatar.png">' +
  '<link rel="apple-touch-icon" href="/assets/nudes-avatar.png">';

// The publisher/site nodes every page's @graph points at, so Google resolves one
// consistent brand entity across the whole domain instead of a per-page guess.
const ORG_NODE = {
  '@type': 'Organization',
  '@id': SITE + '/#organization',
  name: BRAND,
  url: SITE + '/',
  email: 'info@nudesyogurt.com',
  logo: { '@type': 'ImageObject', url: SITE + '/assets/nudes-avatar.png', width: 512, height: 512 },
  sameAs: ['https://instagram.com/nudesyogurt']
};

const BLOG_NODE = {
  '@type': 'Blog',
  '@id': SITE + '/the-nude.html#blog',
  name: 'The Nude',
  description: 'The nudes journal. Mediterranean frozen yogurt, clean ingredients, and Los Angeles food culture.',
  url: SITE + '/the-nude.html',
  inLanguage: 'en-US',
  publisher: { '@id': SITE + '/#organization' }
};

function breadcrumbs(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(function (it, i) {
      return { '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.path };
    })
  };
}

function ldScript(graph) {
  // </script> can't appear inside a script block; escaping the slash is the standard fix.
  return '<script type="application/ld+json">' +
    JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/<\//g, '<\\/') +
    '</script>';
}

// ------------------------------------------------------------ article ------
// Full HTML document for a single article, everything crawlable in the source.
// `all` (optional) is every post, used only for the "keep reading" links.
function renderArticle(p, all) {
  const date = fmtDate(p.date);
  const url = SITE + postPath(p);
  const desc = (p.excerpt || p.answer || 'Notes from nudes, Mediterranean frozen yogurt in Los Angeles.')
    .replace(/\s+/g, ' ').trim();

  const info = videoInfo(p.video);
  const thumb = videoThumb(info, p.video_thumb);
  const gallery = parseImages(p.images);
  const faqs = parseFaq(p.faq);
  const coverAlt = String(p.alt || '').trim();

  // og:image: the cover if it's a real photo, else the video thumb, else the first
  // gallery image, else the brand card. Never let a post ship without a share image.
  const ogImg = isImage(p.cover) ? abs(p.cover)
    : (thumb || (gallery[0] ? abs(gallery[0].url) : OG_FALLBACK));
  const ogAlt = coverAlt || (gallery[0] && gallery[0].alt) || p.title;

  // A photo cover needs a scrim, or the white title lands on a bright highlight and
  // becomes unreadable. The gradient themes are already dark enough on their own.
  const coverImg = isImage(p.cover)
    ? '<img class="cover__img" src="' + esc(p.cover) + '" alt="' + esc(coverAlt) +
      '" fetchpriority="high" decoding="async"><div class="cover__scrim"></div>'
    : '';

  const published = isoDate(p.published) || isoDate(p.publish);
  const modified = isoDate(p.updated) || published;
  const keywords = String(p.keywords || '').split(',').map(function (k) { return k.trim(); }).filter(Boolean);
  const author = String(p.author || '').trim();
  const images = postImages(p).map(function (i) { return i.url; });

  const article = {
    '@type': 'BlogPosting',
    '@id': url + '#article',
    headline: p.title,
    name: p.title,
    description: desc,
    url: url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: images.length ? images : [ogImg],
    inLanguage: 'en-US',
    isPartOf: { '@id': SITE + '/the-nude.html#blog' },
    author: author
      ? { '@type': 'Person', name: author, worksFor: { '@id': SITE + '/#organization' } }
      : { '@id': SITE + '/#organization' },
    publisher: { '@id': SITE + '/#organization' },
    // Tells voice assistants and AI readers which sentences are the answer.
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.article-hero__title', '.answer__text'] }
  };
  if (p.answer) article.abstract = String(p.answer).replace(/\s+/g, ' ').trim();
  if (published) article.datePublished = published;
  if (modified) article.dateModified = modified;
  if (p.category) article.articleSection = p.category;
  if (keywords.length) article.keywords = keywords;
  if (isoDuration(p.read)) article.timeRequired = isoDuration(p.read);
  const words = wordCount(p.body);
  if (words) article.wordCount = words;

  const graph = [ORG_NODE, BLOG_NODE, article, breadcrumbs([
    { name: 'home', path: '/' },
    { name: 'the nude', path: '/the-nude.html' },
    { name: p.title, path: postPath(p) }
  ])];

  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': url + '#faq',
      isPartOf: { '@id': url },
      mainEntity: faqs.map(function (f) {
        return {
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        };
      })
    });
  }

  if (info) {
    const video = {
      '@type': 'VideoObject',
      '@id': url + '#video',
      name: p.title,
      description: desc,
      uploadDate: published || undefined,
      thumbnailUrl: thumb || ogImg
    };
    if (info.kind === 'file') video.contentUrl = abs(info.embed);
    else video.embedUrl = info.embed;
    graph.push(video);
  }

  const galleryHtml = gallery.length
    ? '<div class="post-gallery">' + gallery.map(imageFigure).join('') + '</div>' : '';

  return '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    HEAD_ICONS +
    '<title>' + esc(p.title) + ' | The Nude by nudes</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">' +
    '<meta name="theme-color" content="#442917">' +
    '<link rel="canonical" href="' + esc(url) + '">' +
    (isImage(p.cover) ? '<link rel="preload" as="image" href="' + esc(p.cover) + '" fetchpriority="high">' : '') +
    '<meta property="og:type" content="article">' +
    '<meta property="og:site_name" content="nudes">' +
    '<meta property="og:title" content="' + esc(p.title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + esc(url) + '">' +
    '<meta property="og:image" content="' + esc(ogImg) + '">' +
    '<meta property="og:image:alt" content="' + esc(ogAlt) + '">' +
    '<meta property="og:locale" content="en_US">' +
    (published ? '<meta property="article:published_time" content="' + esc(published) + '">' : '') +
    (modified ? '<meta property="article:modified_time" content="' + esc(modified) + '">' : '') +
    (p.category ? '<meta property="article:section" content="' + esc(p.category) + '">' : '') +
    keywords.map(function (k) { return '<meta property="article:tag" content="' + esc(k) + '">'; }).join('') +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + esc(p.title) + '">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta name="twitter:image" content="' + esc(ogImg) + '">' +
    '<meta name="twitter:image:alt" content="' + esc(ogAlt) + '">' +
    HEAD_FONTS +
    '<link rel="stylesheet" href="/site.css">' +
    ldScript(graph) +
    '</head><body>' +
    chrome('nude') +
    '<main><article>' +
    '<header class="article-hero cover ' + coverClass(p.cover) + '">' + coverImg +
    '<div class="article-hero__inner">' +
    '<nav class="crumbs" aria-label="breadcrumb"><a href="/the-nude.html">the nude</a> · ' + esc(p.category || '') + '</nav>' +
    '<h1 class="article-hero__title">' + esc(p.title) + '</h1>' +
    '<p class="article-hero__meta">' +
      [author || 'nudes', date, p.read].filter(Boolean).map(esc).join(' · ') + '</p>' +
    '</div></header>' +
    '<div class="wrap article-body"><div class="post">' +
    answerBlock(p.answer) +
    videoFigure(info, thumb, '') +
    parseBody(p.body) +
    galleryHtml +
    faqBlock(faqs) +
    '</div>' +
    relatedBlock(p, all) +
    '<div class="endcta"><h3>opening soon in los angeles</h3>' +
    '<p>Be first in line when the doors open at 165 S Crescent Heights Blvd.</p>' +
    '<a class="btn" href="/">join the list →</a></div>' +
    '<div class="article-share"><span>share</span>' +
    '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(p.title) + '&url=' + encodeURIComponent(url) + '" target="_blank" rel="noopener">twitter</a>' +
    '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '" target="_blank" rel="noopener">facebook</a>' +
    '<a href="mailto:?subject=' + encodeURIComponent(p.title) + '&body=' + encodeURIComponent(url) + '">email</a>' +
    '</div></div>' +
    '</article></main>' +
    FOOTER +
    '</body></html>';
}

// -------------------------------------------------------------- index ------
// The blog index, server-rendered for the same reason articles are: a crawler that
// doesn't run JS used to see an empty grid and never discover a single article.
function indexCard(p, featured) {
  const path = postPath(p);
  const alt = String(p.alt || '').trim();
  const cov = isImage(p.cover)
    ? '<img class="cover__img" src="' + esc(p.cover) + '" alt="' + esc(alt) + '" loading="' +
      (featured ? 'eager' : 'lazy') + '" decoding="async">'
    : '';
  return '<a class="pcard' + (featured ? ' pcard--feature' : '') + '" href="' + esc(path) + '">' +
    '<div class="pcard__cover cover ' + coverClass(p.cover) + '">' + cov +
    (p.category ? '<span class="chip">' + esc(p.category) + '</span>' : '') + '</div>' +
    '<div class="pcard__body">' +
    '<span class="pcard__meta">' +
      [fmtDate(p.date), p.read].filter(Boolean).map(esc).join(' · ') + '</span>' +
    '<h2 class="pcard__title">' + esc(p.title) + '</h2>' +
    '<p class="pcard__excerpt">' + esc(p.excerpt || '') + '</p>' +
    '<span class="pcard__more">read →</span>' +
    '</div></a>';
}

function renderIndex(posts) {
  const url = SITE + '/the-nude.html';
  const title = 'The Nude · the nudes journal | Mediterranean Frozen Yogurt in Los Angeles';
  const desc = 'The Nude is the nudes journal. Notes on Mediterranean frozen yogurt, clean ingredients, LA food culture, and building a froyo brand in Los Angeles.';

  const graph = [ORG_NODE, BLOG_NODE, breadcrumbs([
    { name: 'home', path: '/' },
    { name: 'the nude', path: '/the-nude.html' }
  ])];
  if (posts.length) {
    graph.push({
      '@type': 'ItemList',
      '@id': url + '#posts',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: posts.length,
      itemListElement: posts.map(function (p, i) {
        return {
          '@type': 'ListItem', position: i + 1, url: SITE + postPath(p), name: p.title
        };
      })
    });
  }

  return '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    HEAD_ICONS +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">' +
    '<meta name="theme-color" content="#442917">' +
    '<link rel="canonical" href="' + esc(url) + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:site_name" content="nudes">' +
    '<meta property="og:title" content="The Nude · the nudes journal">' +
    '<meta property="og:description" content="Notes on Mediterranean frozen yogurt, clean ingredients, and building nudes in Los Angeles.">' +
    '<meta property="og:url" content="' + esc(url) + '">' +
    '<meta property="og:image" content="' + OG_FALLBACK + '">' +
    '<meta property="og:locale" content="en_US">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="The Nude · the nudes journal">' +
    '<meta name="twitter:description" content="Notes on Mediterranean frozen yogurt, clean ingredients, and building nudes in Los Angeles.">' +
    '<meta name="twitter:image" content="' + OG_FALLBACK + '">' +
    HEAD_FONTS +
    '<link rel="stylesheet" href="/site.css">' +
    ldScript(graph) +
    '</head><body>' +
    chrome('nude') +
    '<main>' +
    '<section class="wrap journal-hero"><span class="eyebrow">the journal</span>' +
    '<h1 class="h1" style="margin-top:.5rem">the nude</h1></section>' +
    '<section class="wrap"><div class="posts">' +
    posts.map(function (p, i) { return indexCard(p, i === 0); }).join('') +
    '</div>' +
    '<p class="soon">more soon. follow <a href="https://instagram.com/nudesyogurt" target="_blank" rel="noopener">@nudesyogurt</a> for the latest.</p>' +
    '</section></main>' +
    FOOTER +
    '</body></html>';
}

module.exports = {
  fetchPosts, fetchAllPosts, renderArticle, renderIndex,
  postPath, postImages, videoInfo, videoThumb, fmtDate, isoDate, abs,
  STATIC_PAGES, STATIC_POSTS, SITE
};
