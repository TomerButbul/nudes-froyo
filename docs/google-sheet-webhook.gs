/**
 * nudes — Google Sheet form webhook (Google Apps Script Web App)
 * ------------------------------------------------------------------
 * This receives form submissions from the website and appends each one
 * to the right tab of your Google Sheet. No API keys, no credentials.
 *
 * ONE-TIME SETUP
 * 1. Create a new Google Sheet (this becomes your submissions database).
 * 2. In the sheet: Extensions → Apps Script.
 * 3. Delete the sample code, paste ALL of this file, and Save.
 * 4. Deploy → New deployment → gear icon → "Web app".
 *      • Description:  nudes forms
 *      • Execute as:   Me
 *      • Who has access: Anyone
 *    Click Deploy, authorize when prompted, then COPY the Web app URL
 *    (it ends in /exec).
 * 5. In Vercel → Project → Settings → Environment Variables, add:
 *      SHEETS_WEBHOOK_URL = <the /exec URL you copied>
 *    Then redeploy the site (Deployments → ⋯ → Redeploy).
 *
 * That's it. The tabs below are created automatically on the first
 * submission of each type:
 *   • "Waitlist"      ← join-the-list signups
 *   • "Partnerships"  ← partnerships & press form
 *   • "Events"        ← events / collab inquiries (events page)
 *
 * To change what lands where, edit the TABS map below.
 *
 * BLOG (optional): make ONE more tab named exactly "Posts" with these column
 * headers in row 1 — slug · title · category · cover · date · read · excerpt · body · publish
 * Add a row per post and it appears on The Nude automatically. The `publish`
 * column is a date: future date = scheduled (auto-appears later). Full guide:
 * docs/adding-a-blog-post.md.
 */

var TABS = {
  waitlist: {
    name: 'Waitlist',
    headers: ['Submitted', 'Email', 'Name'],
    row: function (d) { return [new Date(d.submittedAt), d.email, d.name]; }
  },
  partnership: {
    name: 'Partnerships',
    headers: ['Submitted', 'Name', 'Email', 'Company', 'Reason', 'Message'],
    row: function (d) { return [new Date(d.submittedAt), d.name, d.email, d.company, d.reason, d.message]; }
  },
  event: {
    name: 'Events',
    headers: ['Submitted', 'Name', 'Email', 'Phone', 'Type', 'Preferred Date', 'Guests', 'Message'],
    row: function (d) { return [new Date(d.submittedAt), d.name, d.email, d.phone, d.event_type, d.preferred_date, d.guests, d.message]; }
  }
};

var POST_COLUMNS = ['slug', 'title', 'category', 'cover', 'date', 'read', 'excerpt', 'body', 'publish', 'status'];
var MEDIA_COLUMNS = ['added', 'type', 'url', 'label', 'by'];

// Every write/read below this line is gated on the same shared secret (Project
// Settings → Script Properties → POST_SECRET). The studio page at
// nudesyogurt.com/studio talks to these through /api/studio, which holds the
// secret server-side — it is never in a browser.
function authorized(data) {
  var secret = PropertiesService.getScriptProperties().getProperty('POST_SECRET');
  return !!secret && String(data.secret) === secret;
}

function sheetFor(name, columns) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); sheet.appendRow(columns); sheet.setFrozenRows(1); }
  else if (sheet.getLastRow() === 0) { sheet.appendRow(columns); sheet.setFrozenRows(1); }
  return sheet;
}

function headersOf(sheet, fallback) {
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (x) { return String(x).trim().toLowerCase(); });
  return h.length < 2 ? fallback : h;
}

// Adds a header to a tab that predates it, so an existing Posts sheet gains the
// `status` column on its own instead of needing anyone to edit the spreadsheet.
function ensureColumn(sheet, name) {
  var headers = headersOf(sheet, POST_COLUMNS);
  if (headers.indexOf(name) >= 0) return headers;
  sheet.getRange(1, headers.length + 1).setValue(name);
  sheet.setFrozenRows(1);
  return headers.concat([name]);
}

// A post is hidden if it has been marked draft/archived. Blank or "live" shows.
// Kept as one function so doGet and listPosts can never disagree about it.
function isHiddenStatus(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return !!s && s !== 'live' && s !== 'published' && s !== 'yes' && s !== 'true';
}

// Adds a blog post to the "Posts" tab. Protected by a secret (Project Settings →
// Script Properties → POST_SECRET) so only trusted callers can publish to the site.
// Creates the Posts tab + headers automatically if it doesn't exist yet.
function addPost(data) {
  if (!authorized(data)) return json({ ok: false, error: 'unauthorized' });
  var sheet = sheetFor('Posts', POST_COLUMNS);
  var headers = headersOf(sheet, POST_COLUMNS);
  var row = headers.map(function (h) {
    if (h === 'publish' && data.publish) { var d = new Date(data.publish); return isNaN(d.getTime()) ? data.publish : d; }
    return data[h] != null ? data[h] : '';
  });
  sheet.appendRow(row);
  return json({ ok: true, slug: data.slug || '' });
}

// Edits a post that already exists, matched on `slug`. Only the fields actually
// sent are touched, so the studio can save just the body without wiping the rest.
// This is what lets you add photos to a post that is already live.
function updatePost(data) {
  if (!authorized(data)) return json({ ok: false, error: 'unauthorized' });
  var slug = String(data.slug || '').trim();
  if (!slug) return json({ ok: false, error: 'missing slug' });
  var sheet = sheetFor('Posts', POST_COLUMNS);
  // hiding a post writes `status`, which older sheets don't have yet
  var headers = data.hasOwnProperty('status') ? ensureColumn(sheet, 'status') : headersOf(sheet, POST_COLUMNS);
  var slugCol = headers.indexOf('slug');
  if (slugCol < 0) return json({ ok: false, error: 'no slug column' });

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][slugCol]).trim() !== slug) continue;
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c];
      if (!data.hasOwnProperty(key)) continue;      // field not sent -> leave the cell alone
      var v = data[key];
      if (key === 'publish' && v) { var d = new Date(v); if (!isNaN(d.getTime())) v = d; }
      sheet.getRange(i + 1, c + 1).setValue(v == null ? '' : v);
    }
    return json({ ok: true, slug: slug, updated: true });
  }
  return json({ ok: false, error: 'no post with slug ' + slug });
}

// Removes a post from the Posts tab — but copies the whole row to a "Deleted"
// tab first. A mis-click in the studio should be undoable by anyone, without
// having to dig through the spreadsheet's version history.
function deletePost(data) {
  if (!authorized(data)) return json({ ok: false, error: 'unauthorized' });
  var slug = String(data.slug || '').trim();
  if (!slug) return json({ ok: false, error: 'missing slug' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Posts');
  if (!sheet) return json({ ok: false, error: 'no Posts tab' });
  var headers = headersOf(sheet, POST_COLUMNS);
  var slugCol = headers.indexOf('slug');
  if (slugCol < 0) return json({ ok: false, error: 'no slug column' });

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][slugCol]).trim() !== slug) continue;
    var bin = sheetFor('Deleted', ['deleted'].concat(headers));
    bin.appendRow([new Date()].concat(values[i]));
    sheet.deleteRow(i + 1);
    return json({ ok: true, slug: slug, deleted: true });
  }
  return json({ ok: false, error: 'no post with slug ' + slug });
}

// Everything in the Posts tab, drafts and scheduled posts included, for the
// studio's editor. Secret-protected — the public /api/posts feed (doGet) still
// hides drafts and anything with a future publish date.
function listPosts(data) {
  if (!authorized(data)) return json({ ok: false, error: 'unauthorized' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Posts');
  if (!sheet || sheet.getLastRow() < 2) return json({ ok: true, posts: [] });
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var now = Date.now(), out = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[i][c];
    if (!obj.slug && !obj.title) continue;
    var when = (obj.publish instanceof Date) ? obj.publish : (obj.publish ? new Date(obj.publish) : null);
    var valid = when && !isNaN(when.getTime());
    var hidden = isHiddenStatus(obj.status);
    out.push({
      slug: String(obj.slug || '').trim(),
      title: String(obj.title || '').trim(),
      category: String(obj.category || '').trim(),
      cover: String(obj.cover || '').trim(),
      date: (obj.date instanceof Date) ? Utilities.formatDate(obj.date, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(obj.date || '').trim(),
      read: String(obj.read || '').trim(),
      excerpt: String(obj.excerpt || '').trim(),
      body: String(obj.body || ''),
      publish: valid ? Utilities.formatDate(when, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '',
      hidden: hidden,
      // draft beats the calendar: a hidden post stays hidden whatever its date
      live: !hidden && (!valid || when.getTime() <= now)
    });
  }
  out.reverse(); // newest rows first, matching how people add them
  return json({ ok: true, posts: out });
}

// The media library: every photo/video uploaded from the studio, so anyone can
// re-use a shot from a month ago without hunting for the link.
function addMedia(data) {
  if (!authorized(data)) return json({ ok: false, error: 'unauthorized' });
  if (!data.url) return json({ ok: false, error: 'missing url' });
  var sheet = sheetFor('Media', MEDIA_COLUMNS);
  var headers = headersOf(sheet, MEDIA_COLUMNS);
  sheet.appendRow(headers.map(function (h) {
    if (h === 'added') return new Date();
    return data[h] != null ? data[h] : '';
  }));
  return json({ ok: true, url: data.url });
}

function listMedia(data) {
  if (!authorized(data)) return json({ ok: false, error: 'unauthorized' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Media');
  if (!sheet || sheet.getLastRow() < 2) return json({ ok: true, media: [] });
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var out = [];
  for (var i = values.length - 1; i > 0 && out.length < 120; i--) { // newest first
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[i][c];
    if (!obj.url) continue;
    out.push({
      url: String(obj.url).trim(),
      type: String(obj.type || 'image').trim(),
      label: String(obj.label || '').trim()
    });
  }
  return json({ ok: true, media: out });
}

// Bumped whenever the actions below change. The website reads this from doGet
// BEFORE sending any studio action, so that if this script is still on an older
// deployment the site refuses to talk to it instead of falling through to the
// form handler and appending junk rows to Partnerships.
var SCRIPT_VERSION = 3;

var STUDIO_ACTIONS = {
  addPost: addPost, updatePost: updatePost, deletePost: deletePost, listPosts: listPosts,
  addMedia: addMedia, listMedia: listMedia
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // avoid two submissions writing the same row
  try {
    var data = JSON.parse(e.postData.contents);
    // Studio + Claude actions, all secret-protected (see authorized()).
    if (data.action) {
      var fn = STUDIO_ACTIONS[data.action];
      // An unknown action is a bug or a stale caller — never let it fall through
      // to the form handler, which would append a meaningless row.
      return fn ? fn(data) : json({ ok: false, error: 'unknown action: ' + data.action });
    }
    var cfg = TABS[data.formType] || TABS.partnership; // unknown types go to Partnerships
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.name);
      sheet.appendRow(cfg.headers);
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(cfg.headers);
      sheet.setFrozenRows(1);
    }
    sheet.appendRow(cfg.row(data));
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Serves the blog: reads the "Posts" tab and returns it as JSON for the website.
// (The website fetches this via /api/posts, so the sheet itself stays private —
//  only the Posts tab is ever exposed; your captured emails are not.)
// Posts tab columns (row 1 headers, any order):
//   slug · title · category · cover · date · read · excerpt · body · publish
// SCHEDULING: `publish` is a real DATE.
//   • blank or a past date  -> the post is live now
//   • a future date         -> scheduled: hidden until that day, then auto-appears
// `date` is the label shown on the post; leave it blank to auto-use the publish month/year.
function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Posts');
  if (!sheet || sheet.getLastRow() < 2) return json({ v: SCRIPT_VERSION, posts: [] });
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var tz = ss.getSpreadsheetTimeZone();
  var now = Date.now();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[i][c];
    if (!obj.slug && !obj.title) continue;
    if (isHiddenStatus(obj.status)) continue;   // marked draft in the studio -> off the site

    // scheduling by the publish date
    var raw = obj.publish;
    var when = (raw instanceof Date) ? raw : (raw ? new Date(raw) : null);
    var valid = when && !isNaN(when.getTime());
    if (valid && when.getTime() > now) continue;   // future -> not published yet
    var ts = valid ? when.getTime() : now;          // used for ordering

    // display label: a real date cell -> format it; else the free-text `date`; else the publish date
    var display;
    if (obj.date instanceof Date) display = Utilities.formatDate(obj.date, tz, 'MMMM yyyy').toLowerCase();
    else display = String(obj.date || '').trim();
    if (!display && valid) display = Utilities.formatDate(when, tz, 'MMMM yyyy').toLowerCase();

    rows.push({
      _ts: ts,
      slug: String(obj.slug || '').trim(),
      title: String(obj.title || '').trim(),
      category: String(obj.category || '').trim(),
      cover: String(obj.cover || '').trim(),
      date: display,
      read: String(obj.read || '').trim(),
      excerpt: String(obj.excerpt || '').trim(),
      body: String(obj.body || '')
    });
  }
  rows.sort(function (a, b) { return b._ts - a._ts; }); // newest publish date first
  return json({ v: SCRIPT_VERSION, posts: rows.map(function (r) { delete r._ts; return r; }) });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
