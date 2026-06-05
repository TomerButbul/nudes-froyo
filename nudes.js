/* nüdes — shared interactions
   Lightweight, dependency-free. Each page opts in via markup.        */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Nav: solid on scroll -------------------------------- */
  var nav = document.querySelector('.nav');
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('nav--solid', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

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

  /* ---- Reveal on scroll ------------------------------------ */
  var reveal = document.querySelectorAll('.reveal, .reveal-clip');
  if (reduce || !('IntersectionObserver' in window)) {
    reveal.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveal.forEach(function (el) { io.observe(el); });
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

  /* ---- Custom cursor (opt-in: body[data-cursor]) ----------- */
  if (document.body.hasAttribute('data-cursor') && !reduce && matchMedia('(pointer:fine)').matches) {
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    document.body.appendChild(dot);
    document.body.classList.add('cursor-on');
    var x = 0, y2 = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      x += (tx - x) * 0.18; y2 += (ty - y2) * 0.18;
      dot.style.transform = 'translate(' + x + 'px,' + y2 + 'px)';
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('a,button,[data-lightbox]').forEach(function (el) {
      el.addEventListener('mouseenter', function () { dot.classList.add('cursor-dot--lg'); });
      el.addEventListener('mouseleave', function () { dot.classList.remove('cursor-dot--lg'); });
    });
  }
})();
