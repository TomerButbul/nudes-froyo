// nudes — The Nude blog engine.
// Reads posts from the Google Sheet "Posts" tab (via /api/posts, which proxies the
// Apps Script so the sheet stays private) and merges them with the built-in static
// post(s) below. Powers BOTH pages:
//   • the-nude.html  (has <div data-posts>)  -> renders the card grid
//   • post.html      (has <div data-post>)   -> renders one article by ?slug=
//
// To add a post with NO code: add a row to the "Posts" tab (see docs/adding-a-blog-post.md).

(function () {
  var THEMES = { clean: 1, culture: 1, build: 1, wellness: 1, menu: 1 };

  // Built-in static posts = hand-crafted .html files. Sheet posts render via post.html.
  var STATIC = [
    {
      slug: 'what-is-mediterranean-frozen-yogurt',
      title: 'what is mediterranean frozen yogurt?',
      category: 'clean ingredients',
      cover: 'clean',
      date: 'jul 2026',
      read: '4 min read',
      excerpt: "Thicker, tangier, higher in protein and rooted in the Levant. here's what sets Mediterranean-style frozen yogurt apart, and why we built nudes around it.",
      url: 'the-nude-what-is-mediterranean-frozen-yogurt.html'
    }
  ];

  // Posts that have their own static .html file (matches api/_blog.js STATIC_PAGES).
  var STATIC_PAGES = { 'what-is-mediterranean-frozen-yogurt': 'the-nude-what-is-mediterranean-frozen-yogurt.html' };

  function isImage(c) { return typeof c === 'string' && /[\/.]/.test(c) && !THEMES[c]; }
  function coverClass(c) { return 'cover--' + (THEMES[c] ? c : 'clean'); }
  // Clean, server-rendered URL so links match what Google indexes.
  function postUrl(p) {
    if (p.url) return p.url;
    if (STATIC_PAGES[p.slug]) return '/' + STATIC_PAGES[p.slug];
    return '/the-nude/' + encodeURIComponent(p.slug);
  }
  // Normalise a raw sheet Date string ("Wed Jul 01 2026 …") to "jul 2026".
  function fmtDate(v) {
    if (!v) return '';
    var s = String(v), d = new Date(s);
    if (!isNaN(d.getTime()) && /\d{4}/.test(s) && /[A-Za-z]{3}|\d{4}-\d{2}/.test(s)) {
      var m = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][d.getMonth()];
      return m + ' ' + d.getFullYear();
    }
    return s;
  }

  function getPosts() {
    return fetch('/api/posts', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : { posts: [] }; })
      .then(function (d) { return merge((d && d.posts) || []); })
      .catch(function () { return STATIC.slice(); });
  }
  function merge(sheet) {
    var seen = {}, out = [];
    sheet.forEach(function (p) { if (p && p.slug) { seen[p.slug] = 1; out.push(p); } });
    STATIC.forEach(function (s) { if (!seen[s.slug]) out.push(s); });
    return out;
  }

  // ---- shared cover builder ----
  function cover(p, className) {
    var d = document.createElement('div');
    d.className = (className || '') + ' cover ' + coverClass(p.cover);
    if (isImage(p.cover)) {
      var im = document.createElement('img');
      im.className = 'cover__img'; im.src = p.cover; im.alt = ''; im.loading = 'lazy';
      im.addEventListener('error', function () { im.style.display = 'none'; }); // fall back to branded gradient
      d.appendChild(im);
    }
    return d;
  }

  // ================= index cards =================
  function card(p, featured) {
    var a = document.createElement('a');
    a.className = 'pcard' + (featured ? ' pcard--feature' : '');
    a.href = postUrl(p);
    var cov = cover(p, 'pcard__cover');
    var chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = p.category;
    cov.appendChild(chip);
    a.appendChild(cov);

    var body = document.createElement('div'); body.className = 'pcard__body';
    var meta = document.createElement('span'); meta.className = 'pcard__meta';
    meta.textContent = (fmtDate(p.date) || '') + (p.read ? ' · ' + p.read : '');
    var h = document.createElement('h2'); h.className = 'pcard__title'; h.textContent = p.title;
    var ex = document.createElement('p'); ex.className = 'pcard__excerpt'; ex.textContent = p.excerpt || '';
    var more = document.createElement('span'); more.className = 'pcard__more'; more.textContent = 'read →';
    body.appendChild(meta); body.appendChild(h); body.appendChild(ex); body.appendChild(more);
    a.appendChild(body);
    return a;
  }
  function renderIndex(container) {
    getPosts().then(function (posts) {
      var frag = document.createDocumentFragment();
      posts.forEach(function (p, i) { frag.appendChild(card(p, i === 0)); });
      container.textContent = '';
      container.appendChild(frag);
    });
  }

  // ================= single article =================
  // Articles are now server-rendered at /the-nude/<slug> (crawlable HTML). This page
  // only exists to redirect any old ?slug= links to that canonical URL.
  function renderArticle(root) {
    var slug = new URLSearchParams(location.search).get('slug') || '';
    location.replace(slug ? postUrl({ slug: slug }) : '/the-nude.html');
  }

  // Arriving from a post that is gone (deleted, hidden, or a mistyped url):
  // /the-nude/<slug> redirects here with ?gone=, so say what happened instead of
  // dropping people on the index with no explanation.
  function noticeIfGone() {
    var params = new URLSearchParams(location.search);
    if (!params.has('gone')) return;
    var host = document.querySelector('[data-posts]');
    if (!host || !host.parentNode) return;
    var p = document.createElement('p');
    p.className = 'gone-note';
    p.setAttribute('role', 'status');
    p.textContent = 'that post isn’t up any more. here’s everything else.';
    host.parentNode.insertBefore(p, host);
    // Tidy the url so a refresh or a share doesn't carry the notice along.
    history.replaceState(null, '', '/the-nude.html');
  }

  var idx = document.querySelector('[data-posts]');
  if (idx) { noticeIfGone(); renderIndex(idx); }
  var art = document.querySelector('[data-post]');
  if (art) renderArticle(art);
})();
