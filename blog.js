// nudes — The Nude blog manifest + index renderer.
//
// ►► TO ADD A POST: (1) create the article HTML from docs/adding-a-blog-post.md,
//    then (2) add one entry to the top of POSTS below. The index rebuilds itself.
//    Newest post first. `cover` is a theme key (clean · culture · build · wellness · menu)
//    OR a real image path like 'assets/my-photo.jpg' — a photo takes over the cover art.

var POSTS = [
  {
    slug: 'the-nude-what-is-mediterranean-frozen-yogurt',
    title: 'what is mediterranean frozen yogurt?',
    category: 'clean ingredients',
    cover: 'clean',
    date: 'jul 2026',
    read: '4 min read',
    excerpt: "Thicker, tangier, higher in protein and rooted in the Levant. here's what sets Mediterranean-style frozen yogurt apart, and why we built nudes around it."
  }
];

(function () {
  var THEMES = { clean: 1, culture: 1, build: 1, wellness: 1, menu: 1 };
  var container = document.querySelector('[data-posts]');
  if (!container) return;

  function isImage(c) { return typeof c === 'string' && /[\/.]/.test(c) && !THEMES[c]; }
  function coverClass(c) { return 'cover--' + (THEMES[c] ? c : 'clean'); }

  function card(p, featured) {
    var a = document.createElement('a');
    a.className = 'pcard' + (featured ? ' pcard--feature' : '');
    a.href = p.url || (p.slug + '.html');

    var cov = document.createElement('div');
    cov.className = 'pcard__cover cover ' + coverClass(p.cover);
    if (isImage(p.cover)) {
      var im = document.createElement('img');
      im.className = 'cover__img'; im.src = p.cover; im.alt = ''; im.loading = 'lazy';
      cov.appendChild(im);
    }
    var chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = p.category;
    cov.appendChild(chip);
    a.appendChild(cov);

    var body = document.createElement('div'); body.className = 'pcard__body';
    var meta = document.createElement('span'); meta.className = 'pcard__meta';
    meta.textContent = (p.date || '') + (p.read ? ' · ' + p.read : '');
    var h = document.createElement('h2'); h.className = 'pcard__title'; h.textContent = p.title;
    var ex = document.createElement('p'); ex.className = 'pcard__excerpt'; ex.textContent = p.excerpt;
    var more = document.createElement('span'); more.className = 'pcard__more'; more.textContent = 'read →';
    body.appendChild(meta); body.appendChild(h); body.appendChild(ex); body.appendChild(more);
    a.appendChild(body);
    return a;
  }

  var frag = document.createDocumentFragment();
  POSTS.forEach(function (p, i) { frag.appendChild(card(p, i === 0)); });
  container.textContent = '';
  container.appendChild(frag);
})();
