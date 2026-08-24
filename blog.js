// nudes — legacy redirect shim for post.html.
//
// Articles used to be rendered here in the browser from the Google Sheet. They are
// now server-rendered (api/_blog.js) at /the-nude/<slug>, and the index at
// /the-nude.html is server-rendered too — a crawler that doesn't run JS sees the
// real content instead of a "loading…" shell.
//
// All this file still does is bounce any old ?slug= link to its canonical URL, so
// links shared before the change keep working. Nothing else loads it.

(function () {
  var STATIC_PAGES = { 'what-is-mediterranean-frozen-yogurt': 'the-nude-what-is-mediterranean-frozen-yogurt.html' };

  var art = document.querySelector('[data-post]');
  if (!art) return;

  var slug = new URLSearchParams(location.search).get('slug') || '';
  if (!slug) return location.replace('/the-nude.html');
  location.replace(STATIC_PAGES[slug]
    ? '/' + STATIC_PAGES[slug]
    : '/the-nude/' + encodeURIComponent(slug));
})();
