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
 * headers in row 1 — slug · title · category · cover · date · read · excerpt · body · published
 * Add a row per post and it appears on The Nude automatically. Full guide:
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

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // avoid two submissions writing the same row
  try {
    var data = JSON.parse(e.postData.contents);
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
//   slug · title · category · cover · date · read · excerpt · body · published
function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Posts');
  if (!sheet || sheet.getLastRow() < 2) return json({ posts: [] });
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[i][c];
    var published = String(obj.published == null || obj.published === '' ? 'yes' : obj.published).trim().toLowerCase();
    if (published === 'no' || published === 'false' || published === 'draft' || published === '0') continue;
    if (!obj.slug && !obj.title) continue;
    out.push({
      slug: String(obj.slug || '').trim(),
      title: String(obj.title || '').trim(),
      category: String(obj.category || '').trim(),
      cover: String(obj.cover || '').trim(),
      date: String(obj.date || '').trim(),
      read: String(obj.read || '').trim(),
      excerpt: String(obj.excerpt || '').trim(),
      body: String(obj.body || '')
    });
  }
  out.reverse(); // newest rows (added at the bottom) show first
  return json({ posts: out });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
