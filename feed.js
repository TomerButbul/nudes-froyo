// nudes — live Instagram feed, our own cards.
// Fetches the Behold JSON feed (auto-updating, CORS-enabled) and renders each
// post into an on-brand tall reel tile that links to the actual reel. If the
// fetch fails, the static fallback tiles already in the markup stay put.
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var track = document.querySelector('[data-feed]');
  if (!track) return;
  var id = track.getAttribute('data-feed-id');
  if (!id) return;

  function playBadge() {
    var span = document.createElement('span');
    span.className = 'tile__play';
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'currentColor'); svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M8 5v14l11-7z');
    svg.appendChild(p); span.appendChild(svg);
    return span;
  }

  function tile(post) {
    var sizes = post.sizes || {};
    var src = (sizes.medium && sizes.medium.mediaUrl) || (sizes.large && sizes.large.mediaUrl) || post.thumbnailUrl;
    if (!src) return null;
    var a = document.createElement('a');
    a.className = 'tile tile--live';
    a.href = post.permalink || 'https://instagram.com/nudesyogurt';
    a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('role', 'listitem');
    a.setAttribute('aria-label', (post.prunedCaption || 'nudes on Instagram').slice(0, 90));
    var img = document.createElement('img');
    img.className = 'tile__img'; img.src = src; img.loading = 'lazy'; img.decoding = 'async';
    img.alt = post.prunedCaption || 'nudes on Instagram';
    a.appendChild(img);
    if (post.mediaType === 'VIDEO' || post.isReel) a.appendChild(playBadge());
    return a;
  }

  function ctaTile() {
    var a = document.createElement('a');
    a.className = 'tile tile--cta'; a.href = 'https://instagram.com/nudesyogurt';
    a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('role', 'listitem');
    var b = document.createElement('b'); b.textContent = 'see the feed →';
    a.appendChild(b);
    return a;
  }

  fetch('https://feeds.behold.so/' + id, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (data) {
      var posts = (data && data.posts) || [];
      if (!posts.length) return; // keep the static fallback
      var frag = document.createDocumentFragment();
      posts.slice(0, 12).forEach(function (p) { var t = tile(p); if (t) frag.appendChild(t); });
      frag.appendChild(ctaTile());
      track.textContent = '';        // clear fallback tiles
      track.appendChild(frag);
      track.setAttribute('data-feed-ready', '1');
    })
    .catch(function () { /* leave the static fallback tiles in place */ });
})();
