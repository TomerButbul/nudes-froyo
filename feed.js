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

  function chevron(dir) {
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', dir === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6');
    svg.appendChild(p); return svg;
  }

  function setupNav(track) {
    // vertical wheel -> horizontal scroll while hovering the strip
    track.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { track.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });

    var feed = track.closest('.feed');
    if (!feed) return;
    var nav = document.createElement('div'); nav.className = 'feed__nav';
    var prev = document.createElement('button'); prev.type = 'button'; prev.className = 'feed__arrow feed__arrow--prev'; prev.setAttribute('aria-label', 'previous posts'); prev.appendChild(chevron('prev'));
    var next = document.createElement('button'); next.type = 'button'; next.className = 'feed__arrow feed__arrow--next'; next.setAttribute('aria-label', 'more posts'); next.appendChild(chevron('next'));
    nav.appendChild(prev); nav.appendChild(next); feed.appendChild(nav);

    function step(dir) { track.scrollBy({ left: dir * Math.round(track.clientWidth * 0.85), behavior: 'smooth' }); }
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });

    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      var atStart = track.scrollLeft <= 2, atEnd = track.scrollLeft >= max;
      prev.classList.toggle('is-hidden', atStart);
      next.classList.toggle('is-hidden', atEnd);
      // directional edge fade: fade only the side(s) with hidden content
      track.dataset.edge = atStart ? 'start' : (atEnd ? 'end' : 'mid');
    }
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function monogram() {
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'mono'); svg.setAttribute('viewBox', '289.23 392.4 370.35 221.32');
    svg.setAttribute('fill', 'currentColor'); svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', 'M 592.859375 397.042969 L 592.007812 515.667969 C 592.007812 541.304688 578.988281 557.175781 549.671875 557.175781 C 520.386719 557.175781 507.367188 541.304688 507.367188 515.667969 L 507.304688 515.523438 L 507.304688 490.457031 C 507.304688 421.285156 465.796875 392.402344 398.25 392.402344 C 330.738281 392.402344 289.230469 421.285156 289.230469 490.457031 L 289.230469 608.023438 L 355.949219 608.023438 L 355.949219 490.457031 C 355.949219 464.816406 368.964844 448.949219 398.25 448.949219 C 427.570312 448.949219 440.585938 464.816406 440.585938 490.457031 L 440.648438 490.566406 L 440.648438 515.667969 C 440.648438 584.835938 482.15625 613.722656 549.671875 613.722656 C 617.214844 613.722656 658.722656 584.835938 658.722656 515.667969 L 659.578125 397.042969 Z');
    svg.appendChild(p); return svg;
  }
  function ctaTile() {
    var a = document.createElement('a');
    a.className = 'tile tile--cta'; a.href = 'https://instagram.com/nudesyogurt';
    a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('role', 'listitem'); a.setAttribute('aria-label', 'see the full feed on Instagram');
    a.appendChild(monogram());
    var b = document.createElement('b'); b.textContent = 'see the feed';
    var sub = document.createElement('span'); sub.className = 'tile__cta-sub'; sub.textContent = '@nudesyogurt →';
    a.appendChild(b); a.appendChild(sub);
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
      setupNav(track);
    })
    .catch(function () { /* leave the static fallback tiles in place */ });
})();
