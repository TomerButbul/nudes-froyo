// nudes — progressive form enhancement + small delights.
// (1) <form data-contact-form> submits to /api/contact via fetch with an inline status.
// (2) Every <select> in those forms becomes an on-brand custom dropdown (native kept underneath).
// (3) A gentle "magnetic" pull on primary buttons (desktop pointers only).
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';

  function showStatus(form, msg, ok) {
    var el = form.querySelector('.form-status');
    if (!el) {
      el = document.createElement('p');
      el.setAttribute('role', 'status');
      form.appendChild(el);
    }
    el.className = 'form-status ' + (ok ? 'form-status--ok' : 'form-status--err');
    el.textContent = (ok ? '✦ ' : '') + msg;
    // retrigger the entrance animation
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }

  function enhance(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'sending…'; }

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      data.formType = form.getAttribute('data-form-type') || 'general';

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j && res.j.ok) {
            showStatus(form, form.getAttribute('data-success') || 'got it. talk soon x', true);
            form.reset();
            if (btn) btn.textContent = 'sent ✓';
          } else {
            showStatus(form, (res.j && res.j.error) || 'something went wrong. try again or email us.', false);
            if (btn) { btn.disabled = false; btn.textContent = label; }
          }
        })
        .catch(function () {
          showStatus(form, 'network error. try again or email us.', false);
          if (btn) { btn.disabled = false; btn.textContent = label; }
        });
    });
  }

  // ---- custom dropdown ----
  var uid = 0;
  function makeChevron() {
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'csel__chev'); svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M6 9l6 6 6-6'); svg.appendChild(p);
    return svg;
  }
  function buildSelect(sel) {
    if (sel.dataset.cselDone) return; sel.dataset.cselDone = '1';
    var id = 'csel' + (++uid);
    var opts = Array.prototype.slice.call(sel.options);
    var labelEl = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
    var labelText = labelEl ? labelEl.textContent.trim() : (sel.getAttribute('aria-label') || 'choose');
    var wrap = document.createElement('div'); wrap.className = 'csel'; wrap.setAttribute('aria-expanded', 'false');
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'csel__btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', labelText);
    var valEl = document.createElement('span'); valEl.className = 'csel__val'; btn.appendChild(valEl); btn.appendChild(makeChevron());
    var list = document.createElement('ul'); list.className = 'csel__list'; list.id = id + '-list';
    list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', labelText); list.hidden = true; btn.setAttribute('aria-controls', list.id);
    var active = Math.max(0, sel.selectedIndex);
    var items = opts.map(function (o, i) {
      var li = document.createElement('li'); li.className = 'csel__opt'; li.id = id + '-opt' + i; li.setAttribute('role', 'option');
      li.textContent = o.textContent; li.setAttribute('aria-selected', o.selected ? 'true' : 'false');
      li.addEventListener('click', function () { choose(i); }); list.appendChild(li); return li;
    });
    function sync() { valEl.textContent = opts[sel.selectedIndex] ? opts[sel.selectedIndex].textContent : ''; }
    function setActive(i) { active = (i + items.length) % items.length; items.forEach(function (it, j) { it.classList.toggle('is-active', j === active); }); btn.setAttribute('aria-activedescendant', items[active].id); items[active].scrollIntoView({ block: 'nearest' }); }
    function open() { list.hidden = false; wrap.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-expanded', 'true'); setActive(Math.max(0, sel.selectedIndex)); document.addEventListener('click', outside, true); }
    function close() { list.hidden = true; wrap.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-expanded', 'false'); btn.removeAttribute('aria-activedescendant'); document.removeEventListener('click', outside, true); }
    function outside(e) { if (!wrap.contains(e.target)) close(); }
    function choose(i) { sel.selectedIndex = i; items.forEach(function (it, j) { it.setAttribute('aria-selected', j === i ? 'true' : 'false'); }); sync(); sel.dispatchEvent(new Event('change', { bubbles: true })); close(); btn.focus(); }
    btn.addEventListener('click', function () { list.hidden ? open() : close(); });
    btn.addEventListener('keydown', function (e) {
      if (list.hidden) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); setActive(items.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { close(); }
    });
    sel.style.display = 'none'; sel.setAttribute('tabindex', '-1'); sel.setAttribute('aria-hidden', 'true');
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(btn); wrap.appendChild(list); wrap.appendChild(sel); sync();
  }

  // ---- subtle magnetic pull on primary buttons (desktop only) ----
  function magnetize() {
    if (!window.matchMedia || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    document.querySelectorAll('.field button, .cform .btn, .form .submit .btn, [data-magnetic]').forEach(function (el) {
      el.style.willChange = 'transform';
      el.style.transition = 'transform .3s cubic-bezier(.2,.7,.2,1), background .3s ease, filter .3s ease';
      var R = 5;
      el.addEventListener('mousemove', function (e) {
        var b = el.getBoundingClientRect();
        var x = (e.clientX - (b.left + b.width / 2)) / (b.width / 2);
        var y = (e.clientY - (b.top + b.height / 2)) / (b.height / 2);
        el.style.transform = 'translate(' + (x * R).toFixed(1) + 'px,' + (y * R).toFixed(1) + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  document.querySelectorAll('form[data-contact-form]').forEach(enhance);
  document.querySelectorAll('form[data-contact-form] select').forEach(buildSelect);
  magnetize();
})();
