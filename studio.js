// nudes — /studio
// The team's no-code room: upload a photo or video from your phone, drop it into
// a post, write the post, schedule it. Nothing here touches code or the sheet
// directly — everything goes through /api/studio, which holds the secrets.
//
// Uploads go straight from the browser to Cloudinary using an *unsigned* upload
// preset (that's what makes it work with no login), and Cloudinary hands back a
// permanent link. We then record that link in the sheet's "Media" tab so it shows
// up in the library for everyone else.

(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var state = {
    pass: '',
    cloud: '', preset: '', uploads: false,
    posts: [], media: [],
    mode: 'new',        // 'new' | 'edit'
    coverUrl: '',
    pickFor: 'body'     // 'body' | 'cover'
  };

  var MAX_MB = { image: 10, video: 100 };
  var VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

  function api(action, payload) {
    return fetch('/api/studio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action, passcode: state.pass }, payload || {}))
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Something went wrong.' }; });
    });
  }

  function say(el, msg, kind) {
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'note' + (kind ? ' note--' + kind : '');
  }

  // ======================= 1. passcode =======================
  var lock = $('[data-lock]'), app = $('[data-app]');
  var lockForm = $('[data-lock-form]'), lockMsg = $('[data-lock-msg]');

  lockForm.addEventListener('submit', function (e) {
    e.preventDefault();
    unlock(lockForm.passcode.value, true);
  });

  function unlock(code, interactive) {
    state.pass = code;
    say(lockMsg, 'opening…');
    return api('unlock').then(function (d) {
      if (!d.ok) {
        state.pass = '';
        try { sessionStorage.removeItem('nudes.studio'); } catch (e) {}
        if (interactive) say(lockMsg, d.error || 'That passcode is not right.', 'bad');
        else say(lockMsg, '');
        return false;
      }
      try { sessionStorage.setItem('nudes.studio', code); } catch (e) {}
      state.cloud = d.cloud; state.preset = d.preset; state.uploads = !!d.uploads;
      lock.hidden = true; app.hidden = false;
      say(lockMsg, '');
      if (!state.uploads) {
        say($('[data-editor-msg]'), 'Uploads are off until Cloudinary is set up — see docs/media-and-studio.md.', 'bad');
      }
      loadPosts();
      loadMedia();
      newPost();
      return true;
    });
  }

  $('[data-lock-out]').addEventListener('click', function () {
    try { sessionStorage.removeItem('nudes.studio'); } catch (e) {}
    location.reload();
  });

  // ======================= 2. tabs =======================
  var tabs = $('[data-tabs]');
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b) return;
    Array.prototype.forEach.call(tabs.querySelectorAll('.tab'), function (t) {
      var on = t === b;
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
      $('[data-pane="' + t.dataset.tab + '"]').hidden = !on;
    });
  });

  // ======================= 3. posts =======================
  var editor = $('[data-editor]');
  var listEl = $('[data-post-list]');
  var bodyEl = $('[data-body]');
  var editorMsg = $('[data-editor-msg]');
  var savedEl = $('[data-saved]');
  var viewLive = $('[data-view-live]');
  var coverTheme = $('[data-cover-theme]');
  var coverBtn = $('[data-pick-cover]');
  var coverThumb = $('[data-cover-thumb]');

  function loadPosts() {
    return api('posts').then(function (d) {
      if (!d.ok) {
        // Don't fail silently — an empty list looks identical to a broken one.
        listEl.textContent = '';
        var p = document.createElement('p');
        p.className = 'list__error';
        p.textContent = d.error || 'Could not load your posts.';
        listEl.appendChild(p);
        return;
      }
      state.posts = d.posts || [];
      renderList();
    });
  }

  function renderList() {
    listEl.textContent = '';
    state.posts.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pitem';
      b.dataset.slug = p.slug;
      if (state.mode === 'edit' && editor.slug.value === p.slug) b.setAttribute('aria-current', 'true');
      var t = document.createElement('span'); t.className = 'pitem__title'; t.textContent = p.title || p.slug;
      var m = document.createElement('span'); m.className = 'pitem__meta';
      var dot = document.createElement('span'); dot.className = 'dot' + (p.live ? '' : ' dot--soon');
      var lbl = document.createElement('span');
      lbl.textContent = (p.live ? 'live' : 'scheduled') + (p.publish ? ' · ' + p.publish : '');
      m.appendChild(dot); m.appendChild(lbl);
      b.appendChild(t); b.appendChild(m);
      b.addEventListener('click', function () { loadPost(p); });
      listEl.appendChild(b);
    });
  }

  function setCover(value) {
    var isPhoto = /[\/.]/.test(value) && ['clean', 'culture', 'build', 'wellness', 'menu'].indexOf(value) < 0;
    state.coverUrl = isPhoto ? value : '';
    coverTheme.value = isPhoto ? '__photo' : (value || 'clean');
    syncCover();
  }
  function syncCover() {
    var photo = coverTheme.value === '__photo';
    coverBtn.hidden = !photo;
    coverThumb.hidden = !(photo && state.coverUrl);
    if (photo && state.coverUrl) coverThumb.style.backgroundImage = 'url("' + state.coverUrl + '")';
  }
  function coverValue() {
    return coverTheme.value === '__photo' ? state.coverUrl : coverTheme.value;
  }
  coverTheme.addEventListener('change', function () {
    syncCover();
    if (coverTheme.value === '__photo' && !state.coverUrl) openPicker('cover');
  });
  coverBtn.addEventListener('click', function () { openPicker('cover'); });

  function newPost() {
    state.mode = 'new';
    editor.reset();
    state.coverUrl = '';
    setCover('clean');
    editor.read.value = '3 min read';
    editor.slug.readOnly = false;
    viewLive.hidden = true;
    say(editorMsg, '');
    savedEl.textContent = '';
    renderList();
    preview();
    editor.title.focus();
  }
  $('[data-new-post]').addEventListener('click', newPost);

  function loadPost(p) {
    state.mode = 'edit';
    editor.title.value = p.title || '';
    editor.slug.value = p.slug || '';
    editor.category.value = p.category || '';
    editor.read.value = p.read || '';
    editor.excerpt.value = p.excerpt || '';
    editor.body.value = p.body || '';
    editor.publish.value = /^\d{4}-\d{2}-\d{2}$/.test(p.publish) ? p.publish : '';
    editor.slug.readOnly = true;   // the slug is the url + the row key; renaming would orphan it
    setCover(p.cover || 'clean');
    viewLive.hidden = !p.live;
    viewLive.href = '/the-nude/' + encodeURIComponent(p.slug);
    say(editorMsg, '');
    savedEl.textContent = '';
    renderList();
    preview();
  }

  // title -> url id, only while writing a new post
  editor.title.addEventListener('input', function () {
    if (state.mode !== 'new' || editor.slug.dataset.touched) return;
    editor.slug.value = editor.title.value.toLowerCase().trim()
      .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  });
  editor.slug.addEventListener('input', function () { editor.slug.dataset.touched = '1'; });

  editor.publish.addEventListener('change', function () {
    var hint = $('[data-publish-hint]');
    var v = editor.publish.value;
    if (!v) return (hint.textContent = 'blank = live as soon as you save');
    var future = new Date(v + 'T23:59:59') > new Date();
    hint.textContent = future ? 'scheduled — it appears on its own that day' : 'live as soon as you save';
  });

  editor.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('[data-save]');
    btn.disabled = true;
    say(editorMsg, 'saving…');
    api('save', {
      mode: state.mode,
      post: {
        slug: editor.slug.value.trim().toLowerCase(),
        title: editor.title.value.trim(),
        category: editor.category.value.trim(),
        cover: coverValue(),
        date: '',
        read: editor.read.value.trim(),
        excerpt: editor.excerpt.value.trim(),
        body: editor.body.value,
        publish: editor.publish.value
      }
    }).then(function (d) {
      btn.disabled = false;
      if (!d.ok) return say(editorMsg, d.error || 'Could not save.', 'bad');
      say(editorMsg, '');
      savedEl.textContent = d.edited ? 'saved · the live post updates within a minute' : 'published';
      state.mode = 'edit';
      editor.slug.readOnly = true;
      loadPosts();
    });
  });

  // ---- preview: rendered by the same code the real article uses ----
  var previewEl = $('[data-preview]'), pvTimer = null;
  function preview() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(function () {
      api('preview', { body: bodyEl.value }).then(function (d) {
        if (d.ok) previewEl.innerHTML = d.html;
      });
    }, 450);
  }
  bodyEl.addEventListener('input', preview);

  // ---- writing helpers ----
  function insert(before, after, placeholder) {
    var s = bodyEl.selectionStart, e = bodyEl.selectionEnd, v = bodyEl.value;
    var chosen = v.slice(s, e) || placeholder || '';
    bodyEl.value = v.slice(0, s) + before + chosen + after + v.slice(e);
    bodyEl.focus();
    bodyEl.selectionStart = s + before.length;
    bodyEl.selectionEnd = s + before.length + chosen.length;
    preview();
  }
  // media goes on its own line, always — that's what turns it into a figure.
  // `from`/`to` are offsets inside `text`: they leave the caret (or a selection,
  // e.g. over the caption) somewhere useful instead of at the end of the line.
  function insertBlock(text, from, to) {
    var s = bodyEl.selectionStart, v = bodyEl.value;
    var pre = v.slice(0, s).replace(/\s+$/, '');
    var post = v.slice(s).replace(/^\s+/, '');
    var lead = pre ? pre + '\n\n' : '';
    bodyEl.value = lead + text + (post ? '\n\n' + post : '\n');
    bodyEl.focus();
    bodyEl.selectionStart = lead.length + (from == null ? text.length : from);
    bodyEl.selectionEnd = lead.length + (to == null ? (from == null ? text.length : from) : to);
    preview();
  }

  $('[data-toolbar]').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-ins]');
    if (!b) return;
    switch (b.dataset.ins) {
      case 'media': return openPicker('body');
      case 'h2': return insertBlock('## ', 3);
      case 'bold': return insert('**', '**', 'bold');
      case 'list': return insertBlock('- ', 2);
      case 'quote': return insertBlock('> ', 2);
      case 'link': return insert('[', '](https://)', 'link text');
    }
  });

  // ======================= 4. photos & videos =======================
  var libEl = $('[data-library]'), libEl2 = $('[data-library2]');
  var picker = $('[data-picker]');

  function loadMedia() {
    return api('media').then(function (d) {
      if (!d.ok) { say(editorMsg, d.error || 'Could not load the media library.', 'bad'); return; }
      state.media = d.media || [];
      renderLibrary();
    });
  }

  function isVideo(m) { return m.type === 'video' || VIDEO_EXT.test(m.url); }

  // Cloudinary can hand back a small, cheap version of anything — use it for tiles.
  function thumb(url) {
    if (!/res\.cloudinary\.com\//.test(url)) return url;
    var t = url.replace('/upload/', '/upload/f_auto,q_auto,c_fill,w_300,h_300/');
    return VIDEO_EXT.test(t) ? t.replace(VIDEO_EXT, '.jpg') : t;
  }

  function tile(m, onPick, label) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mtile'; b.title = m.label || m.url;
    var img = document.createElement('img');
    img.src = thumb(m.url); img.alt = m.label || ''; img.loading = 'lazy';
    b.appendChild(img);
    if (isVideo(m)) {
      var tag = document.createElement('span'); tag.className = 'mtile__tag'; tag.textContent = 'video';
      b.appendChild(tag);
    }
    var doo = document.createElement('span'); doo.className = 'mtile__do'; doo.textContent = label;
    b.appendChild(doo);
    b.addEventListener('click', function () { onPick(m); });
    return b;
  }

  function renderLibrary() {
    libEl.textContent = '';
    state.media.forEach(function (m) {
      libEl.appendChild(tile(m, copyLine, 'copy the line'));
    });
    renderPickerLibrary();
  }

  function renderPickerLibrary() {
    libEl2.textContent = '';
    state.media
      .filter(function (m) { return state.pickFor === 'cover' ? !isVideo(m) : true; })
      .forEach(function (m) { libEl2.appendChild(tile(m, choose, 'use this')); });
  }

  // On the media tab, a tile copies the exact line to paste into the sheet —
  // for anyone who'd rather write posts in the spreadsheet than in here.
  function copyLine(m) {
    var line = snippet(m, true);
    var done = function () { flash('copied — paste it into the post'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(line).then(done, function () { prompt('Copy this line:', line); });
    } else {
      prompt('Copy this line:', line);
    }
  }
  function flash(msg) {
    savedEl.textContent = msg;
    setTimeout(function () { if (savedEl.textContent === msg) savedEl.textContent = ''; }, 3000);
  }

  function snippet(m, loopOk) {
    var loop = loopOk && isVideo(m) && $('[data-loop]') && $('[data-loop]').checked;
    return '![' + (m.label || '') + '](' + m.url + (loop ? ' "loop"' : '') + ')';
  }

  function choose(m) {
    if (state.pickFor === 'cover') {
      state.coverUrl = m.url;
      coverTheme.value = '__photo';
      syncCover();
    } else {
      var line = snippet(m, true);
      // select the caption between the [ ] so typing replaces it right away
      insertBlock(line, 2, 2 + (m.label || '').length);
    }
    closePicker();
  }

  function openPicker(what) {
    state.pickFor = what;
    $('[data-picker-title]').textContent = what === 'cover' ? 'choose a cover photo' : 'choose a photo or video';
    renderPickerLibrary();
    picker.hidden = false;
  }
  function closePicker() { picker.hidden = true; }
  $('[data-picker-close]').addEventListener('click', closePicker);
  picker.addEventListener('click', function (e) { if (e.target === picker) closePicker(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !picker.hidden) closePicker(); });

  // ---- uploading ----
  function wireDrop(dropSel, inputSel, listSel) {
    var drop = $(dropSel), input = $(inputSel), list = $(listSel);
    input.addEventListener('change', function () { handleFiles(input.files, list); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drop--over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drop--over'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files, list);
    });
  }
  wireDrop('[data-drop]', '[data-file]', '[data-uploads]');
  wireDrop('[data-drop2]', '[data-file2]', '[data-uploads2]');

  function handleFiles(files, list) {
    Array.prototype.forEach.call(files, function (f) { upload(f, list); });
  }

  function upload(file, list) {
    var kind = /^video\//.test(file.type) ? 'video' : 'image';
    var row = document.createElement('div');
    row.className = 'up';
    var name = document.createElement('span'); name.className = 'up__name'; name.textContent = file.name;
    var bar = document.createElement('span'); bar.className = 'up__bar';
    var fill = document.createElement('i'); bar.appendChild(fill);
    row.appendChild(name); row.appendChild(bar);
    list.insertBefore(row, list.firstChild);

    function fail(msg) {
      row.classList.add('up--bad');
      bar.remove();
      name.textContent = file.name + ' — ' + msg;
    }

    if (!state.uploads) return fail('uploads are not switched on yet');
    if (file.size > MAX_MB[kind] * 1024 * 1024) {
      return fail(kind === 'video'
        ? 'too big (' + Math.round(file.size / 1048576) + ' MB). trim it, or post it to instagram and paste the link instead.'
        : 'too big (' + Math.round(file.size / 1048576) + ' MB). max ' + MAX_MB.image + ' MB.');
    }

    var form = new FormData();
    form.append('file', file);
    form.append('upload_preset', state.preset);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + state.cloud + '/auto/upload');
    xhr.upload.addEventListener('progress', function (e) {
      if (e.lengthComputable) fill.style.width = Math.round((e.loaded / e.total) * 100) + '%';
    });
    xhr.addEventListener('load', function () {
      var d = {};
      try { d = JSON.parse(xhr.responseText); } catch (err) {}
      if (xhr.status < 200 || xhr.status >= 300 || !d.secure_url) {
        return fail((d.error && d.error.message) || 'upload failed');
      }
      var label = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 80);
      var item = { url: d.secure_url, type: d.resource_type === 'video' ? 'video' : 'image', label: label };
      // Remember it so it's in the library for everyone, then show it right away.
      api('addMedia', item).then(function () {
        state.media.unshift(item);
        renderLibrary();
        row.remove();
        if (!picker.hidden) renderPickerLibrary();
      });
    });
    xhr.addEventListener('error', function () { fail('upload failed — check the connection'); });
    xhr.send(form);
  }

  // ======================= boot =======================
  var saved = '';
  try { saved = sessionStorage.getItem('nudes.studio') || ''; } catch (e) {}
  if (saved) unlock(saved, false);
})();
