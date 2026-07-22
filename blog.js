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

  function isImage(c) { return typeof c === 'string' && /[\/.]/.test(c) && !THEMES[c]; }
  function coverClass(c) { return 'cover--' + (THEMES[c] ? c : 'clean'); }
  function postUrl(p) { return p.url || ('post.html?slug=' + encodeURIComponent(p.slug)); }

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
    meta.textContent = (p.date || '') + (p.read ? ' · ' + p.read : '');
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
  // inline **bold** -> <strong>, everything else plain text
  function inline(target, text) {
    var parts = String(text).split('**');
    parts.forEach(function (seg, i) {
      if (!seg) return;
      if (i % 2) { var s = document.createElement('strong'); s.textContent = seg; target.appendChild(s); }
      else target.appendChild(document.createTextNode(seg));
    });
  }
  // plain text with light markers -> block nodes
  //   blank line = new block · "## " = heading · "- " lines = list · "> " = quote · "1. " lines = numbered
  function parseBody(text) {
    var nodes = [];
    String(text).replace(/\r/g, '').split(/\n{2,}/).forEach(function (block) {
      block = block.replace(/^\n+|\n+$/g, '');
      if (!block) return;
      var lines = block.split('\n');
      var im = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/); // ![alt](image-url) on its own line
      if (im) {
        var fig = document.createElement('figure'); fig.className = 'post-fig';
        var img = document.createElement('img'); img.src = im[2].trim(); img.alt = im[1]; img.loading = 'lazy'; img.decoding = 'async';
        img.addEventListener('error', function () { fig.style.display = 'none'; });
        fig.appendChild(img);
        if (im[1]) { var cap = document.createElement('figcaption'); cap.textContent = im[1]; fig.appendChild(cap); }
        nodes.push(fig); return;
      }
      if (/^##\s+/.test(block)) {
        var h = document.createElement('h2'); inline(h, block.replace(/^##\s+/, '')); nodes.push(h);
      } else if (lines.every(function (l) { return /^-\s+/.test(l); })) {
        var ul = document.createElement('ul');
        lines.forEach(function (l) { var li = document.createElement('li'); inline(li, l.replace(/^-\s+/, '')); ul.appendChild(li); });
        nodes.push(ul);
      } else if (lines.every(function (l) { return /^\d+\.\s+/.test(l); })) {
        var ol = document.createElement('ol');
        lines.forEach(function (l) { var li = document.createElement('li'); inline(li, l.replace(/^\d+\.\s+/, '')); ol.appendChild(li); });
        nodes.push(ol);
      } else if (/^>\s+/.test(block)) {
        var bq = document.createElement('blockquote'); inline(bq, block.replace(/^>\s+/gm, '').replace(/\n/g, ' ')); nodes.push(bq);
      } else {
        var p = document.createElement('p'); inline(p, block.replace(/\n/g, ' ')); nodes.push(p);
      }
    });
    return nodes;
  }

  function shareRow(p, url) {
    var enc = encodeURIComponent(p.title || 'the nude');
    var u = encodeURIComponent(url);
    var wrap = document.createElement('div'); wrap.className = 'article-share';
    var label = document.createElement('span'); label.textContent = 'share'; wrap.appendChild(label);
    [['twitter', 'https://twitter.com/intent/tweet?text=' + enc + '&url=' + u],
     ['facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + u],
     ['email', 'mailto:?subject=' + enc + '&body=' + u]].forEach(function (s) {
      var a = document.createElement('a'); a.href = s[1]; a.textContent = s[0];
      if (s[0] !== 'email') { a.target = '_blank'; a.rel = 'noopener'; }
      wrap.appendChild(a);
    });
    return wrap;
  }

  function endCta() {
    var d = document.createElement('div'); d.className = 'endcta';
    var h = document.createElement('h3'); h.textContent = 'opening soon in los angeles';
    var p = document.createElement('p'); p.textContent = 'Be first in line when the doors open at 165 S Crescent Heights Blvd.';
    var a = document.createElement('a'); a.className = 'btn'; a.href = '/'; a.textContent = 'join the list →';
    d.appendChild(h); d.appendChild(p); d.appendChild(a);
    return d;
  }

  function upsertMeta(attr, key, val) {
    var m = document.head.querySelector('meta[' + attr + '="' + key + '"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute(attr, key); document.head.appendChild(m); }
    m.setAttribute('content', val);
  }
  function setSEO(p, url) {
    var desc = p.excerpt || 'Notes from nudes, Mediterranean frozen yogurt in Los Angeles.';
    document.title = p.title + ' | The Nude by nudes';
    upsertMeta('name', 'description', desc);
    upsertMeta('property', 'og:title', p.title);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', 'article');
    var ogImg = isImage(p.cover) ? p.cover : 'https://nudesyogurt.com/assets/og.png';
    upsertMeta('property', 'og:image', ogImg);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', p.title);
    upsertMeta('name', 'twitter:description', desc);
    upsertMeta('name', 'twitter:image', ogImg);
    var c = document.head.querySelector('link[rel="canonical"]');
    if (!c) { c = document.createElement('link'); c.setAttribute('rel', 'canonical'); document.head.appendChild(c); }
    c.setAttribute('href', url);
    var ld = document.getElementById('post-jsonld');
    if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'post-jsonld'; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: desc,
      author: { '@type': 'Organization', name: 'nudes' },
      publisher: { '@type': 'Organization', name: 'nudes', url: 'https://nudesyogurt.com/' },
      mainEntityOfPage: url
    });
  }

  function buildArticle(root, p) {
    var pageUrl = 'https://nudesyogurt.com/post.html?slug=' + encodeURIComponent(p.slug);
    setSEO(p, pageUrl);

    var hero = cover(p, 'article-hero');
    var inner = document.createElement('div'); inner.className = 'article-hero__inner';
    var crumbs = document.createElement('nav'); crumbs.className = 'crumbs';
    var back = document.createElement('a'); back.href = 'the-nude.html'; back.textContent = 'the nude';
    crumbs.appendChild(back); crumbs.appendChild(document.createTextNode(' · ' + (p.category || '')));
    var title = document.createElement('h1'); title.className = 'article-hero__title'; title.textContent = p.title;
    var meta = document.createElement('p'); meta.className = 'article-hero__meta';
    meta.textContent = 'nudes' + (p.date ? ' · ' + p.date : '') + (p.read ? ' · ' + p.read : '');
    inner.appendChild(crumbs); inner.appendChild(title); inner.appendChild(meta);
    hero.appendChild(inner);

    var wrap = document.createElement('div'); wrap.className = 'wrap article-body';
    var post = document.createElement('div'); post.className = 'post';
    parseBody(p.body || '').forEach(function (n) { post.appendChild(n); });
    wrap.appendChild(post);
    wrap.appendChild(endCta());
    wrap.appendChild(shareRow(p, pageUrl));

    root.textContent = '';
    root.appendChild(hero);
    root.appendChild(wrap);
  }

  function renderArticle(root) {
    var slug = new URLSearchParams(location.search).get('slug') || '';
    getPosts().then(function (posts) {
      var p = posts.filter(function (x) { return x.slug === slug; })[0];
      if (!p) {
        var miss = document.createElement('div'); miss.className = 'wrap';
        var box = document.createElement('div'); box.className = 'post-missing';
        var h = document.createElement('p'); h.textContent = 'that post isn’t here.';
        var a = document.createElement('a'); a.href = 'the-nude.html'; a.textContent = '← back to the nude';
        box.appendChild(h); box.appendChild(a); miss.appendChild(box); root.appendChild(miss);
        return;
      }
      if (p.url) { location.replace(p.url); return; } // static post has its own page
      buildArticle(root, p);
    });
  }

  var idx = document.querySelector('[data-posts]');
  if (idx) renderIndex(idx);
  var art = document.querySelector('[data-post]');
  if (art) renderArticle(art);
})();
