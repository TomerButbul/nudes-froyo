// nudes — shared server-side blog rendering (NOT a route; leading underscore).
// Used by api/post.js (single article) and api/sitemap.js (dynamic sitemap).
//
// WHY THIS EXISTS: the blog posts live in a Google Sheet and were previously
// rendered only in the browser with JavaScript. Googlebot on a brand-new domain
// rarely runs that JS, so it saw empty "loading…" shells and never indexed the
// articles. Rendering the same posts to real HTML on the server fixes that:
// the full text, headings, meta tags and Article JSON-LD are in the page source.

const SHEETS_URL = process.env.SHEETS_WEBHOOK_URL || '';
const SITE = 'https://nudesyogurt.com';
const THEMES = { clean: 1, culture: 1, build: 1, wellness: 1, menu: 1 };

// Posts that have their own hand-crafted static .html file. For these we point
// every link/canonical at the static file (one canonical URL, no duplicate content)
// instead of the server-rendered /the-nude/<slug> route.
const STATIC_PAGES = {
  'what-is-mediterranean-frozen-yogurt': 'the-nude-what-is-mediterranean-frozen-yogurt.html'
};

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

function isImage(c) { return typeof c === 'string' && /[\/.]/.test(c) && !THEMES[c]; }
function coverClass(c) { return 'cover--' + (THEMES[c] ? c : 'clean'); }

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

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// inline **bold** -> <strong>, everything else escaped text
function inline(text) {
  return String(text).split('**').map(function (seg, i) {
    if (!seg) return '';
    return i % 2 ? '<strong>' + esc(seg) + '</strong>' : esc(seg);
  }).join('');
}

// Plain sheet text -> HTML blocks. Mirrors blog.js parseBody so server and client
// render identically:  blank line = block · "## " heading · "- " list · "1. "
// numbered · "> " quote · "![alt](url)" image · everything else a paragraph.
function parseBody(text) {
  const out = [];
  String(text || '').replace(/\r/g, '').split(/\n{2,}/).forEach(function (block) {
    block = block.replace(/^\n+|\n+$/g, '');
    if (!block) return;
    const lines = block.split('\n');
    const im = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (im) {
      out.push('<figure class="post-fig"><img src="' + esc(im[2].trim()) + '" alt="' + esc(im[1]) +
        '" loading="lazy" decoding="async">' + (im[1] ? '<figcaption>' + esc(im[1]) + '</figcaption>' : '') + '</figure>');
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

// Full HTML document for a single article, everything crawlable in the source.
function renderArticle(p) {
  const date = fmtDate(p.date);
  const url = SITE + postPath(p);
  const desc = (p.excerpt || 'Notes from nudes, Mediterranean frozen yogurt in Los Angeles.').replace(/\s+/g, ' ').trim();
  const ogImg = isImage(p.cover) ? p.cover : SITE + '/assets/og.png';
  const coverImg = isImage(p.cover)
    ? '<img class="cover__img" src="' + esc(p.cover) + '" alt="" loading="eager">' : '';

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article',
    headline: p.title, description: desc,
    image: ogImg,
    author: { '@type': 'Organization', name: 'nudes' },
    publisher: { '@type': 'Organization', name: 'nudes', url: SITE + '/' },
    mainEntityOfPage: url
  });

  return '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    HEAD_ICONS +
    '<title>' + esc(p.title) + ' | The Nude by nudes</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta name="robots" content="index, follow">' +
    '<meta name="theme-color" content="#442917">' +
    '<link rel="canonical" href="' + esc(url) + '">' +
    '<meta property="og:type" content="article">' +
    '<meta property="og:site_name" content="nudes">' +
    '<meta property="og:title" content="' + esc(p.title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + esc(url) + '">' +
    '<meta property="og:image" content="' + esc(ogImg) + '">' +
    '<meta property="og:locale" content="en_US">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + esc(p.title) + '">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta name="twitter:image" content="' + esc(ogImg) + '">' +
    HEAD_FONTS +
    '<link rel="stylesheet" href="/site.css">' +
    '<script type="application/ld+json">' + jsonld + '</script>' +
    '</head><body>' +
    chrome('nude') +
    '<main><article>' +
    '<header class="article-hero cover ' + coverClass(p.cover) + '">' + coverImg +
    '<div class="article-hero__inner">' +
    '<nav class="crumbs"><a href="/the-nude.html">the nude</a> · ' + esc(p.category || '') + '</nav>' +
    '<h1 class="article-hero__title">' + esc(p.title) + '</h1>' +
    '<p class="article-hero__meta">nudes' + (date ? ' · ' + esc(date) : '') + (p.read ? ' · ' + esc(p.read) : '') + '</p>' +
    '</div></header>' +
    '<div class="wrap article-body"><div class="post">' + parseBody(p.body) + '</div>' +
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

module.exports = { fetchPosts, renderArticle, postPath, fmtDate, STATIC_PAGES, SITE };
