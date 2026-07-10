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

// Lets you open the /exec URL in a browser to confirm it's live.
function doGet() {
  return json({ ok: true, service: 'nudes forms' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
