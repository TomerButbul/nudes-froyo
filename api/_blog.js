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

// **bold** -> <strong>, everything else escaped text
function bold(text) {
  return String(text).split('**').map(function (seg, i) {
    if (!seg) return '';
    return i % 2 ? '<strong>' + esc(seg) + '</strong>' : esc(seg);
  }).join('');
}

// Placeholder marker. Built at runtime rather than typed as a literal control
// character, and stripped from the input first, so nothing in the sheet can forge one.
const TOK = String.fromCharCode(1);
const TOK_RE = new RegExp(TOK + '(\\d+)' + TOK, 'g');

// Inline formatting: **bold** and [label](url). Links are swapped out for
// placeholders first, so a url never gets chewed up by the bold splitter and
// bold can still wrap a link (**[menu](/menu.html)**). A leading "!" means it's
// an image, which is handled as a block below.
function inline(text) {
  const links = [];
  const s = String(text).split(TOK).join('')
    .replace(/(!?)\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, function (all, bang, label, url) {
      if (bang) return all;
      links.push({ label: label, url: url });
      return TOK + (links.length - 1) + TOK;
    });
  return bold(s).replace(TOK_RE, function (_, i) {
    const l = links[Number(i)];
    const ext = /^https?:/i.test(l.url);
    return '<a href="' + esc(l.url) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + bold(l.label) + '</a>';
  });
}

// ---------------------------------------------------------------------------
// MEDIA
// Photos and videos are uploaded in /studio and pasted into the sheet's `body`
// cell as a single line:   ![caption](url)
// Optional keywords go in quotes after the url:  ![caption](url "wide loop")
//   wide · full  -> break out of the 680px text column
//   loop         -> a video plays silently on repeat instead of showing controls
// Two or three media lines with no blank line between them become a side-by-side
// grid. A bare youtube / vimeo / instagram / tiktok link on its own line becomes
// a responsive embed (see docs/adding-a-blog-post.md).
// ---------------------------------------------------------------------------

const MEDIA_LINE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const IMG_WIDTHS = [640, 960, 1400, 1920];

function isVideoUrl(u) { return VIDEO_EXT.test(String(u)); }
// Several people can edit the Posts tab, so don't take a url on trust: only
// real http(s) links and site-relative paths become media.
function safeUrl(u) { return /^(https?:\/\/|\/)/i.test(String(u).trim()); }
function isCloudinary(u) { return /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\//.test(String(u)); }

// Cloudinary reads transformations from the path segment right after /upload/.
// Everything else (a plain https photo link someone pasted) is left alone.
function cld(u, tx) { return isCloudinary(u) ? String(u).replace('/upload/', '/upload/' + tx + '/') : String(u); }

// f_auto = serve WebP/AVIF to browsers that take it; q_auto = pick a sane quality.
// This is what stops a coworker's 12MP phone photo from being shipped at full size.
function imgSrc(u, w) { return cld(u, 'f_auto,q_auto,c_limit,w_' + w); }
function imgSrcset(u) {
  if (!isCloudinary(u)) return '';
  return ' srcset="' + IMG_WIDTHS.map(function (w) { return esc(imgSrc(u, w)) + ' ' + w + 'w'; }).join(', ') + '"';
}
// A still from the first frame, so a video shows something before it loads.
function videoPoster(u) {
  return isCloudinary(u) ? cld(u, 'so_0').replace(VIDEO_EXT, '.jpg') : '';
}

function sizesFor(mode, count) {
  const col = mode === 'full' ? '100vw' : (mode === 'wide' ? '960px' : '680px');
  return '(max-width: 760px) 100vw, ' + (count > 1 ? 'calc(' + col + ' / ' + count + ')' : col);
}

// One <img> or <video> — no <figure>, so it can sit alone or inside a grid.
function mediaEl(alt, url, opts, mode, count) {
  const loop = /\bloop\b/.test(opts);
  if (isVideoUrl(url)) {
    const poster = videoPoster(url);
    return '<video class="post-media" src="' + esc(cld(url, 'f_auto,q_auto')) + '"' +
      (poster ? ' poster="' + esc(poster) + '"' : '') +
      ' playsinline preload="metadata"' +
      (loop ? ' autoplay muted loop aria-label="' + esc(alt) + '"' : ' controls') +
      '></video>';
  }
  return '<img class="post-media" src="' + esc(imgSrc(url, 1400)) + '"' + imgSrcset(url) +
    ' sizes="' + esc(sizesFor(mode, count)) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async">';
}

// A block of one or more media lines -> a figure (or a 2-up / 3-up grid).
function mediaFigure(items) {
  const mode = /\bfull\b/.test(items[0].opts) ? 'full' : (/\bwide\b/.test(items[0].opts) ? 'wide' : '');
  // 3 or 6 photos fill a 3-wide row exactly; anything else looks better in 2s
  // than as a full row plus a lonely leftover.
  const n = items.length < 2 ? 1 : (items.length % 3 === 0 ? 3 : 2);
  const cls = 'post-fig' + (mode ? ' post-fig--' + mode : '') + (items.length > 1 ? ' post-fig--grid' : '');
  const inner = items.map(function (it) { return mediaEl(it.alt, it.url, it.opts, mode, n); }).join('');
  // With a grid the captions would fight each other, so only a single item gets one.
  const cap = (items.length === 1 && items[0].alt) ? '<figcaption>' + esc(items[0].alt) + '</figcaption>' : '';
  return '<figure class="' + cls + '"' + (items.length > 1 ? ' style="--cols:' + n + '"' : '') + '>' + inner + cap + '</figure>';
}

// A bare video link on its own line -> a real embed, so nobody has to touch iframes.
function embed(url) {
  let m;
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i)))
    return frame('https://www.youtube.com/embed/' + m[1], 'wide', 'YouTube video');
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i)))
    return frame('https://player.vimeo.com/video/' + m[1], 'wide', 'Vimeo video');
  if ((m = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([\w-]+)/i)))
    return frame('https://www.instagram.com/reel/' + m[1] + '/embed', 'ig', 'Instagram post');
  if ((m = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/i)))
    return frame('https://www.tiktok.com/embed/v2/' + m[1], 'tiktok', 'TikTok video');
  return '';
}
function frame(src, kind, title) {
  return '<div class="post-embed post-embed--' + kind + '"><iframe src="' + esc(src) + '" title="' + esc(title) +
    '" loading="lazy" frameborder="0" scrolling="no" allowfullscreen ' +
    'allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"></iframe></div>';
}

// Plain sheet text -> HTML blocks. Blank line = new block · "## " heading ·
// "- " list · "1. " numbered · "> " quote · "![alt](url)" photo or video ·
// a bare video link = embed · everything else a paragraph.
function parseBody(text) {
  const out = [];
  String(text || '').replace(/\r/g, '').split(/\n{2,}/).forEach(function (block) {
    block = block.replace(/^\n+|\n+$/g, '').trim();
    if (!block) return;
    const lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);

    // media: every line in the block is a ![..](..) — one figure, or a grid
    const media = lines.map(function (l) { return l.match(MEDIA_LINE); });
    if (media.length && media.every(function (m) { return m && safeUrl(m[2]); })) {
      return out.push(mediaFigure(media.map(function (m) {
        return { alt: m[1], url: m[2].trim(), opts: m[3] || '' };
      })));
    }

    // a lone youtube / vimeo / instagram / tiktok link
    if (lines.length === 1 && /^https?:\/\/\S+$/.test(lines[0])) {
      const e = embed(lines[0]);
      if (e) return out.push(e);
    }

    if (/^##\s+/.test(block)) {
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
  const ogImg = isImage(p.cover) ? imgSrc(p.cover, 1200) : SITE + '/assets/og.png';
  const coverImg = isImage(p.cover)
    ? '<img class="cover__img" src="' + esc(imgSrc(p.cover, 1920)) + '"' + imgSrcset(p.cover) +
      ' sizes="100vw" alt="" loading="eager">' : '';

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

module.exports = { fetchPosts, renderArticle, parseBody, postPath, fmtDate, STATIC_PAGES, SITE };
