// nudes — progressive form enhancement.
// (1) <form data-contact-form> submits to /api/contact via fetch with an inline status.
// (2) Every <select> in those forms is upgraded to an on-brand custom dropdown, while the
//     native <select> stays underneath (hidden) so the form still submits and works without JS.
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';

  function showStatus(form, msg, ok) {
    var el = form.querySelector('.form-status');
    if (!el) {
      el = document.createElement('p');
      el.className = 'form-status';
      el.setAttribute('role', 'status');
      el.style.marginTop = '.9rem';
      el.style.fontSize = '.9rem';
      el.style.fontFamily = "'Fredoka', system-ui, sans-serif";
      form.appendChild(el);
    }
    el.textContent = msg;
    el.style.color = ok ? '#442917' : '#7a4a34';
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
            showStatus(form, form.getAttribute('data-success') || 'got it — talk soon x', true);
            form.reset();
            if (btn) btn.textContent = 'sent ✓';
          } else {
            showStatus(form, (res.j && res.j.error) || 'something went wrong — try again or email us.', false);
            if (btn) { btn.disabled = false; btn.textContent = label; }
          }
        })
        .catch(function () {
          showStatus(form, 'network error — try again or email us.', false);
          if (btn) { btn.disabled = false; btn.textContent = label; }
        });
    });
  }

  // ---- on-brand custom dropdown ----
  var uid = 0;

  function makeChevron() {
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'csel__chev');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', 'M6 9l6 6 6-6');
    svg.appendChild(p);
    return svg;
  }

  function buildSelect(sel) {
    if (sel.dataset.cselDone) return;
    sel.dataset.cselDone = '1';
    var id = 'csel' + (++uid);
    var opts = Array.prototype.slice.call(sel.options);
    var labelEl = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
    var labelText = labelEl ? labelEl.textContent.trim() : (sel.getAttribute('aria-label') || 'choose');

    var wrap = document.createElement('div');
    wrap.className = 'csel';
    wrap.setAttribute('aria-expanded', 'false');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'csel__btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', labelText);
    var valEl = document.createElement('span');
    valEl.className = 'csel__val';
    btn.appendChild(valEl);
    btn.appendChild(makeChevron());

    var list = document.createElement('ul');
    list.className = 'csel__list';
    list.id = id + '-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', labelText);
    list.hidden = true;
    btn.setAttribute('aria-controls', list.id);

    var active = Math.max(0, sel.selectedIndex);
    var items = opts.map(function (o, i) {
      var li = document.createElement('li');
      li.className = 'csel__opt';
      li.id = id + '-opt' + i;
      li.setAttribute('role', 'option');
      li.textContent = o.textContent;
      li.setAttribute('aria-selected', o.selected ? 'true' : 'false');
      li.addEventListener('click', function () { choose(i); });
      list.appendChild(li);
      return li;
    });

    function sync() { valEl.textContent = opts[sel.selectedIndex] ? opts[sel.selectedIndex].textContent : ''; }
    function setActive(i) {
      active = (i + items.length) % items.length;
      items.forEach(function (it, j) { it.classList.toggle('is-active', j === active); });
      btn.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    }
    function open() {
      list.hidden = false;
      wrap.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-expanded', 'true');
      setActive(Math.max(0, sel.selectedIndex));
      document.addEventListener('click', outside, true);
    }
    function close() {
      list.hidden = true;
      wrap.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-expanded', 'false');
      btn.removeAttribute('aria-activedescendant');
      document.removeEventListener('click', outside, true);
    }
    function outside(e) { if (!wrap.contains(e.target)) close(); }
    function choose(i) {
      sel.selectedIndex = i;
      items.forEach(function (it, j) { it.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      sync();
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      close();
      btn.focus();
    }

    btn.addEventListener('click', function () { list.hidden ? open() : close(); });
    btn.addEventListener('keydown', function (e) {
      if (list.hidden) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      } else {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
        else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
        else if (e.key === 'End') { e.preventDefault(); setActive(items.length - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'Tab') { close(); }
      }
    });

    sel.style.display = 'none';
    sel.setAttribute('tabindex', '-1');
    sel.setAttribute('aria-hidden', 'true');
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(btn);
    wrap.appendChild(list);
    wrap.appendChild(sel); // keep native select inside for form submission
    sync();
  }

  document.querySelectorAll('form[data-contact-form]').forEach(enhance);
  document.querySelectorAll('form[data-contact-form] select').forEach(buildSelect);
})();
