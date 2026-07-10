// nudes — progressive form enhancement.
// Any <form data-contact-form> submits to /api/contact via fetch and shows an inline status,
// instead of reloading the page. Falls back to a normal POST if JS is disabled.
(function () {
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
    el.style.color = ok ? '#442917' : '#a3432a';
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

  document.querySelectorAll('form[data-contact-form]').forEach(enhance);
})();
