/* nudes — shared interactions
   Lightweight, dependency-free. Each page opts in via markup.
   v2.1 — adds cinematic intro, scroll-driven hero, magnetic + tilt,
   refined cursor, elevated reveals, mobile flavor strip + progress.   */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer:fine)').matches && !reduce;
  var doc = document.documentElement;
  if (fine) doc.classList.add('has-fine');

  /* tiny rAF helper: coalesce many events into one frame ------- */
  function rafThrottle(fn) {
    var queued = false, lastArgs;
    return function () {
      lastArgs = arguments;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; fn.apply(null, lastArgs); });
    };
  }

  /* ============================================================
     0. Cinematic intro loader (first load only, session-gated)
     ============================================================ */
  (function intro() {
    // only where opted-in, and only once per session
    if (!document.body.hasAttribute('data-intro')) return;
    var seen = false;
    try { seen = sessionStorage.getItem('nudes-intro') === '1'; } catch (e) {}
    if (seen) return;
    try { sessionStorage.setItem('nudes-intro', '1'); } catch (e) {}

    var word = 'nudes';
    var letters = word.split('').map(function (c) { return '<span>' + c + '</span>'; }).join('');
    var el = document.createElement('div');
    el.className = 'intro';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="intro__panel intro__panel--t"></div>' +
      '<div class="intro__panel intro__panel--b"></div>' +
      '<div class="intro__seam"></div>' +
      '<div class="intro__core">' +
        '<span class="intro__mark"><svg viewBox="0 0 120 90" fill="none" stroke="currentColor" ' +
          'stroke-width="21" stroke-linecap="round"><path d="M24 72 V44 a20 20 0 0 1 40 0 a20 20 0 0 0 40 0 V14"/></svg></span>' +
        '<span class="intro__word">' + letters + '</span>' +
        '<span class="intro__tag">a little treat</span>' +
      '</div>' +
      '<button class="intro__skip" type="button">skip</button>';
    document.body.appendChild(el);
    doc.classList.add('intro-lock');

    // measure the path so the draw-on is exact regardless of scale
    var path = el.querySelector('.intro__mark path');
    if (path && path.getTotalLength) {
      try {
        var len = Math.ceil(path.getTotalLength());
        path.style.setProperty('--len', len);
      } catch (e) {}
    }

    var done = false;
    function finish() {
      if (done) return; done = true;
      el.classList.add('is-exiting');
      doc.classList.remove('intro-lock');
      var remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };
      if (reduce) { remove(); return; }       // reduced motion: gone immediately
      el.addEventListener('transitionend', function te(ev) {
        if (ev.target === el.querySelector('.intro__panel--b')) { el.removeEventListener('transitionend', te); remove(); }
      });
      setTimeout(remove, 1400); // hard fallback
    }

    el.querySelector('.intro__skip').addEventListener('click', finish);
    el.addEventListener('click', function (e) { if (e.target === el) finish(); });

    if (reduce) {
      // instant: no theatrics
      setTimeout(finish, 60);
    } else {
      setTimeout(finish, 1650); // ~1.65s of show, then lift
    }
  })();

  /* ---- Nav: solid on scroll -------------------------------- */
  var nav = document.querySelector('.nav');
  function onNav() { if (nav) nav.classList.toggle('nav--solid', window.scrollY > 24); }
  onNav();

  /* ---- Mobile menu ----------------------------------------- */
  var burger = document.querySelector('.nav__burger');
  var menu = document.querySelector('.menu');
  var closeBtn = document.querySelector('.menu__close');
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (burger) burger.setAttribute('aria-expanded', String(open));
  }
  if (burger) burger.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setMenu(false); });
  if (menu) menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ============================================================
     Elevated scroll reveals (extends the base .reveal system)
     - base .reveal / .reveal-clip keep working exactly as before
     - [data-rv] adds directional / clip / scale variants
     - [data-rv-stagger] auto-assigns --d to its reveal children
     - .rv-words does a word-by-word headline rise
     ============================================================ */
  // auto-stagger: give each reveal child of a [data-rv-stagger] a delay
  document.querySelectorAll('[data-rv-stagger]').forEach(function (group) {
    var step = parseInt(group.getAttribute('data-rv-stagger'), 10) || 90;
    var kids = group.querySelectorAll('.reveal, .reveal-clip, [data-rv]');
    kids.forEach(function (k, i) {
      if (!k.style.getPropertyValue('--d')) k.style.setProperty('--d', (i * step) + 'ms');
    });
  });
  // word-by-word headlines
  document.querySelectorAll('.rv-words').forEach(function (h) {
    if (h.dataset.rvDone) return; h.dataset.rvDone = '1';
    var words = h.textContent.trim().split(/\s+/);
    h.textContent = '';
    words.forEach(function (w, i) {
      var wrap = document.createElement('span'); wrap.className = 'rv-w';
      var inner = document.createElement('span'); inner.textContent = w;
      inner.style.setProperty('--wd', (i * 80) + 'ms');
      wrap.appendChild(inner); h.appendChild(wrap);
      if (i < words.length - 1) h.appendChild(document.createTextNode(' '));
    });
  });

  var revealEls = document.querySelectorAll('.reveal, .reveal-clip, [data-rv], .rv-words');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ============================================================
     Scroll-driven hero (home) — parallax-zoom + corner drift
     transform-only, single rAF, passive scroll
     ============================================================ */
  (function heroParallax() {
    var hero = document.querySelector('.p-home .hero');
    if (!hero || reduce) return;
    var bg = hero.querySelector('.hero__bg');
    var tl = hero.querySelector('.hero__tl');     // "a little"
    var br = hero.querySelector('.hero__br');      // "treat."
    var foot = hero.querySelector('.hero__foot');
    var phone = window.matchMedia('(max-width:780px)').matches;
    if (phone) return; // hero restacks on phones; keep it calm there

    var update = rafThrottle(function () {
      var y = window.scrollY;
      var h = window.innerHeight || 1;
      if (y > h * 1.15) return; // only while hero is in view
      var p = Math.min(y / h, 1.2);             // 0..~1 progress
      if (bg)   bg.style.transform   = 'scale(' + (1 + p * 0.14).toFixed(4) + ') translate3d(0,' + (p * 26).toFixed(2) + 'px,0)';
      if (tl)   tl.style.transform   = 'translate3d(0,' + (p * -64).toFixed(2) + 'px,0)';
      if (br)   br.style.transform   = 'translate3d(0,' + (p * -120).toFixed(2) + 'px,0)';
      if (foot) foot.style.transform = 'translate3d(0,' + (p * 38).toFixed(2) + 'px,0)';
    });
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', function () { phone = window.matchMedia('(max-width:780px)').matches; });
  })();

  /* combined scroll handler for nav + progress bar ----------- */
  var prog = null;
  if (!reduce && window.matchMedia('(max-width:600px)').matches) {
    prog = document.createElement('div');
    prog.className = 'scrollprog';
    document.body.appendChild(prog);
  }
  var onScrollAll = rafThrottle(function () {
    onNav();
    if (prog) {
      var st = window.scrollY;
      var max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      prog.style.width = Math.max(0, Math.min(1, st / max)) * 100 + '%';
    }
  });
  window.addEventListener('scroll', onScrollAll, { passive: true });

  /* ============================================================
     Magnetic buttons + 3D tilt cards (desktop fine-pointer)
     ============================================================ */
  if (fine) {
    // -- magnetic .btn (skip tiny nav/mbar buttons handled by their own ease)
    document.querySelectorAll('.btn').forEach(function (btn) {
      var strength = 0.32, rect = null;
      var reset = function () { btn.style.transform = ''; };
      btn.addEventListener('mouseenter', function () { rect = btn.getBoundingClientRect(); });
      btn.addEventListener('mousemove', function (e) {
        if (!rect) rect = btn.getBoundingClientRect();
        var mx = e.clientX - (rect.left + rect.width / 2);
        var my = e.clientY - (rect.top + rect.height / 2);
        btn.style.transform = 'translate(' + (mx * strength).toFixed(2) + 'px,' + (my * strength).toFixed(2) + 'px)';
      });
      btn.addEventListener('mouseleave', reset);
      btn.addEventListener('blur', reset);
    });

    // -- 3D tilt on opted-in cards ([data-tilt]); add a pointer sheen
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      var max = parseFloat(card.getAttribute('data-tilt')) || 8; // deg
      var rect = null, raf = 0;
      // inject a sheen layer into the visual surface if present
      var surface = card.querySelector('.media, .froyo-wrap') || card;
      var sheen = document.createElement('span');
      sheen.className = 'tilt-sheen';
      surface.appendChild(sheen);

      function onMove(e) {
        if (!rect) rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width;   // 0..1
        var py = (e.clientY - rect.top) / rect.height;   // 0..1
        var rx = (0.5 - py) * max * 2;
        var ry = (px - 0.5) * max * 2;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          card.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
          var inner = card.querySelector('.froyo, img');
          if (inner) inner.style.transform = 'translateZ(26px) scale(1.05)';
          sheen.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
          sheen.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        });
      }
      card.addEventListener('mouseenter', function () { rect = card.getBoundingClientRect(); card.classList.add('is-tilting'); });
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', function () {
        card.classList.remove('is-tilting');
        card.style.transform = '';
        var inner = card.querySelector('.froyo, img');
        if (inner) inner.style.transform = '';
        rect = null;
      });
    });
  }

  /* ---- Footer year ----------------------------------------- */
  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  /* ---- Newsletter (demo only) ------------------------------ */
  document.querySelectorAll('.field').forEach(function (f) {
    var btn = f.querySelector('button'), input = f.querySelector('input');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (input && input.value.indexOf('@') > 0) { btn.textContent = 'Welcome ··'; input.value = ''; }
      else if (input) { input.focus(); }
    });
  });

  /* ---- Lightbox (opt-in: [data-lightbox]) ------------------ */
  var lbItems = document.querySelectorAll('[data-lightbox]');
  if (lbItems.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    var lbClose = document.createElement('button');
    lbClose.className = 'lightbox__x';
    lbClose.setAttribute('aria-label', 'Close');
    lbClose.textContent = 'close ✕';
    var lbImg = document.createElement('img');
    lbImg.alt = '';
    lb.appendChild(lbClose);
    lb.appendChild(lbImg);
    document.body.appendChild(lb);
    var close = function () { lb.classList.remove('open'); document.body.style.overflow = ''; };
    lbItems.forEach(function (it) {
      it.style.cursor = 'zoom-in';
      it.addEventListener('click', function () {
        var src = it.getAttribute('data-lightbox');
        var im = it.querySelector('img');
        lbImg.src = src || (im && im.src) || '';
        lb.classList.add('open'); document.body.style.overflow = 'hidden';
      });
    });
    lb.addEventListener('click', function (e) { if (e.target !== lbImg) close(); });
    lbClose.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* ============================================================
     Refined custom cursor — site-wide on fine pointers.
     Lerped dot + trailing ring that grows & morphs over
     interactive elements. Never hides the OS cursor on touch.
     Opt-out per page with body[data-no-cursor].
     ============================================================ */
  if (fine && !document.body.hasAttribute('data-no-cursor')) {
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    var ring = document.createElement('div');
    ring.className = 'cursor-ring';
    ring.innerHTML = '<span class="cursor-ring__txt"></span>';
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    document.body.classList.add('cursor-on');
    var ringTxt = ring.querySelector('.cursor-ring__txt');

    var dx = 0, dy = 0, rx2 = 0, ry2 = 0, tx = -100, ty = -100, started = false;
    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!started) { started = true; dx = rx2 = tx; dy = ry2 = ty; }
    });
    window.addEventListener('mousedown', function () { ring.classList.add('cursor-ring--press'); });
    window.addEventListener('mouseup', function () { ring.classList.remove('cursor-ring--press'); });
    document.addEventListener('mouseleave', function () { dot.style.opacity = '0'; ring.style.opacity = '0'; });
    document.addEventListener('mouseenter', function () { dot.style.opacity = ''; ring.style.opacity = ''; });

    (function loop() {
      dx += (tx - dx) * 0.85;            // dot: snappy
      dy += (ty - dy) * 0.85;
      rx2 += (tx - rx2) * 0.16;          // ring: lagging, liquid
      ry2 += (ty - ry2) * 0.16;
      dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      ring.style.transform = 'translate(' + rx2 + 'px,' + ry2 + 'px)';
      requestAnimationFrame(loop);
    })();

    // grow + morph over interactive things; label where it helps
    var interactive = 'a,button,[data-lightbox],.tag,.claim,.ucard,input,.ev';
    document.querySelectorAll(interactive).forEach(function (elx) {
      var label = elx.hasAttribute('data-lightbox') ? 'view'
                : (elx.matches('input') ? '' : '');
      elx.addEventListener('mouseenter', function () {
        ring.classList.add('cursor-ring--active');
        dot.classList.add('cursor-dot--min');
        if (label) { ringTxt.textContent = label; ring.classList.add('cursor-ring--label'); }
      });
      elx.addEventListener('mouseleave', function () {
        ring.classList.remove('cursor-ring--active', 'cursor-ring--label');
        dot.classList.remove('cursor-dot--min');
      });
    });
  }

  /* ============================================================
     Sticky mobile action bar (mobile only) — unchanged behavior
     ============================================================ */
  if (matchMedia('(max-width:600px)').matches) {
    var mbar = document.createElement('div');
    mbar.className = 'mbar';
    var mb1 = document.createElement('a'); mb1.href = 'menu.html'; mb1.className = 'btn'; mb1.textContent = 'order';
    var mb2 = document.createElement('a'); mb2.href = 'visit.html'; mb2.className = 'btn btn--ghost'; mb2.textContent = 'find us';
    mbar.appendChild(mb1); mbar.appendChild(mb2);
    document.body.appendChild(mbar);
    var mde = document.documentElement;
    var toggleBar = function () {
      var nearBottom = window.scrollY + window.innerHeight > mde.scrollHeight - 150;
      mbar.classList.toggle('mbar--show', window.scrollY > 480 && !nearBottom);
    };
    toggleBar();
    window.addEventListener('scroll', toggleBar, { passive: true });
  }

  /* ============================================================
     Mobile-native flavor strip — turn the home .flavors grid
     into a swipeable scroll-snap rail with progress dots + hint.
     ============================================================ */
  (function flavorStrip() {
    if (!matchMedia('(max-width:760px)').matches) return;
    var rail = document.querySelector('.p-home .flavors');
    if (!rail) return;
    rail.classList.add('fstrip');
    var cards = rail.querySelectorAll('.flavor');
    if (cards.length < 2) return;

    // dots
    var dots = document.createElement('div');
    dots.className = 'fstrip-dots';
    cards.forEach(function (_, i) {
      var d = document.createElement('i'); if (i === 0) d.className = 'on'; dots.appendChild(d);
    });
    // swipe hint
    var hint = document.createElement('div');
    hint.className = 'fstrip-hint';
    hint.innerHTML = 'swipe<svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M0 5h19M15 1l5 4-5 4"/></svg>';
    rail.parentNode.insertBefore(hint, rail);
    rail.parentNode.insertBefore(dots, rail.nextSibling);

    var dotEls = dots.querySelectorAll('i');
    var sync = rafThrottle(function () {
      var center = rail.scrollLeft + rail.clientWidth / 2;
      var best = 0, bestD = Infinity;
      cards.forEach(function (c, i) {
        var cc = c.offsetLeft + c.offsetWidth / 2;
        var d = Math.abs(cc - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      dotEls.forEach(function (d, i) { d.classList.toggle('on', i === best); });
      if (rail.scrollLeft > 8) hint.style.opacity = '0';
    });
    rail.addEventListener('scroll', sync, { passive: true });
  })();

})();
