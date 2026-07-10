// nudes — live Instagram feed, our own cards.
// Fetches the Behold JSON feed (auto-updating, CORS-enabled) and renders each
// post into an on-brand tall reel tile:
//   • poster = the reel's native 9:16 thumbnail (matches the tile — no crop),
//     falling back to Behold's permanent square crop only if it fails to load;
//   • on desktop hover, a muted looping <video> lazy-loads and plays;
//   • the whole tile links to the actual reel.
// If the fetch fails, the static fallback tiles already in the markup stay put.
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var track = document.querySelector('[data-feed]');
  if (!track) return;
  var id = track.getAttribute('data-feed-id');
  if (!id) return;
  var canHover = !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);

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
    var square = (sizes.large && sizes.large.mediaUrl) || (sizes.medium && sizes.medium.mediaUrl) || '';
    var poster = post.thumbnailUrl || square;           // 9:16 native frame, no crop
    if (!poster) return null;
    var isVideo = post.mediaType === 'VIDEO' || post.isReel;

    var a = document.createElement('a');
    a.className = 'tile tile--live';
    a.href = post.permalink || 'https://instagram.com/nudesyogurt';
    a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('role', 'listitem');
    a.setAttribute('aria-label', (post.prunedCaption || 'nudes on Instagram').slice(0, 90));

    var img = document.createElement('img');
    img.className = 'tile__img'; img.src = poster; img.loading = 'lazy'; img.decoding = 'async';
    img.alt = post.prunedCaption || 'nudes on Instagram';
    // if the (temporary) Instagram thumbnail 404s, fall back to Behold's permanent square
    img.addEventListener('error', function () {
      if (square && img.src !== square) img.src = square;
    });
    a.appendChild(img);

    if (isVideo) a.appendChild(playBadge());

    // desktop hover -> lazy-load + play the muted reel
    if (canHover && isVideo && post.mediaUrl) {
      var vid = null;
      a.addEventListener('mouseenter', function () {
        if (!vid) {
          vid = document.createElement('video');
          vid.className = 'tile__vid';
          vid.muted = true; vid.loop = true; vid.playsInline = true;
          vid.setAttribute('muted', ''); vid.setAttribute('playsinline', '');
          vid.preload = 'auto'; vid.src = post.mediaUrl;
          a.insertBefore(vid, a.querySelector('.tile__play') || null);
        }
        try { vid.currentTime = 0; } catch (e) {}
        var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {});
        a.classList.add('is-playing');
      });
      a.addEventListener('mouseleave', function () {
        if (vid) vid.pause();
        a.classList.remove('is-playing');
      });
    }
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
