// nudes — /studio back end (Vercel Serverless Function)
//
// The studio page lets the team upload photos/videos and write posts without
// touching code or the spreadsheet. Everything sensitive lives here, never in
// the browser:
//   • the Apps Script POST_SECRET (which can write to the Sheet)
//   • the shared studio passcode
//   • the Cloudinary cloud + unsigned upload preset (only handed out after unlock)
//
// Set in Vercel → Project → Settings → Environment Variables:
//   SHEETS_WEBHOOK_URL         the Apps Script /exec URL (already set — same as forms)
//   SHEETS_POST_SECRET         must equal Script Property POST_SECRET in Apps Script
//   STUDIO_PASSCODE            what the team types to get in (make it long)
//   CLOUDINARY_CLOUD_NAME      from the Cloudinary dashboard
//   CLOUDINARY_UPLOAD_PRESET   an *unsigned* upload preset (see docs/media-and-studio.md)

const { parseBody } = require('./_blog');

const SHEETS_URL = process.env.SHEETS_WEBHOOK_URL || '';
const POST_SECRET = process.env.SHEETS_POST_SECRET || '';
const PASSCODE = process.env.STUDIO_PASSCODE || '';
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME || '';
const PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || '';

// Length-independent compare so a wrong passcode can't be narrowed down by timing.
function sameSecret(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (!y) return false;
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= x.charCodeAt(i % (x.length || 1)) ^ y.charCodeAt(i % (y.length || 1));
  }
  return diff === 0;
}

// The Apps Script has to be redeployed by hand after it changes, which is easy
// to half-do. An older deployment does not know the studio actions and would
// fall through to its form handler, quietly appending junk rows to Partnerships.
// So: read the version marker from doGet (read-only, safe on any version) and
// refuse to POST anything at all until the deployment is current.
const NEEDS_VERSION = 3;
let versionCache = { v: 0, at: 0 };

async function sheetVersion() {
  if (versionCache.v >= NEEDS_VERSION && Date.now() - versionCache.at < 300000) return versionCache.v;
  try {
    const r = await fetch(SHEETS_URL, { redirect: 'follow' });
    const d = r.ok ? await r.json() : null;
    versionCache = { v: (d && Number(d.v)) || 0, at: Date.now() };
  } catch (e) {
    versionCache = { v: 0, at: Date.now() };
  }
  return versionCache.v;
}

async function assertCurrent() {
  if (await sheetVersion() >= NEEDS_VERSION) return;
  const err = new Error('stale-script');
  err.userMessage = 'The Google Apps Script is still on an older version, so the studio ' +
    'cannot read or write posts yet. In the Sheet: Extensions → Apps Script → paste the ' +
    'current docs/google-sheet-webhook.gs → save (⌘S) → Deploy → Manage deployments → ' +
    'pencil → Version: New version → Deploy.';
  throw err;
}

// Talk to the Apps Script Web App with the secret attached.
async function toSheet(action, payload) {
  const r = await fetch(SHEETS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ action: action, secret: POST_SECRET }, payload)),
    redirect: 'follow', // Apps Script 302s to script.googleusercontent.com
  });
  if (!r.ok) throw new Error('sheet ' + r.status);
  return r.json();
}

const SLUG_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanPost(b) {
  const out = {
    slug: String(b.slug || '').trim().toLowerCase(),
    title: String(b.title || '').trim(),
    category: String(b.category || '').trim(),
    cover: String(b.cover || '').trim(),
    date: String(b.date || '').trim(),
    read: String(b.read || '').trim(),
    excerpt: String(b.excerpt || '').trim(),
    body: String(b.body || ''),
    publish: String(b.publish || '').trim(),
  };
  if (!out.slug || !SLUG_OK.test(out.slug)) return { error: 'The url id must be lowercase-words-with-hyphens.' };
  if (!out.title) return { error: 'Give the post a title.' };
  return { post: out };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!PASSCODE || !SHEETS_URL || !POST_SECRET) {
    return res.status(500).json({ ok: false, error: 'The studio is not set up yet — see docs/media-and-studio.md.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  if (!sameSecret(body.passcode, PASSCODE)) {
    return res.status(401).json({ ok: false, error: 'That passcode is not right.' });
  }

  const action = String(body.action || '').trim();

  try {
    switch (action) {
      // Hand over the Cloudinary upload details only once we know who's asking.
      case 'unlock':
        return res.status(200).json({
          ok: true,
          cloud: CLOUD,
          preset: PRESET,
          uploads: !!(CLOUD && PRESET),
        });

      case 'posts': {
        await assertCurrent();
        const d = await toSheet('listPosts', {});
        if (!d || !Array.isArray(d.posts)) throw new Error('bad listPosts reply');
        return res.status(200).json({ ok: true, posts: d.posts });
      }

      case 'media': {
        await assertCurrent();
        const d = await toSheet('listMedia', {});
        if (!d || !Array.isArray(d.media)) throw new Error('bad listMedia reply');
        return res.status(200).json({ ok: true, media: d.media });
      }

      // Record an upload in the Media tab so it shows up in the library later.
      case 'addMedia': {
        const url = String(body.url || '').trim();
        if (!/^https:\/\//.test(url)) return res.status(400).json({ ok: false, error: 'Bad media url.' });
        await assertCurrent();
        await toSheet('addMedia', {
          url: url,
          type: String(body.type || 'image').trim(),
          label: String(body.label || '').trim(),
          by: String(body.by || '').trim(),
        });
        return res.status(200).json({ ok: true });
      }

      // Change only when a post goes live, from the table — nothing else about
      // the post is sent, and updatePost only writes the fields it receives.
      case 'publish': {
        const slug = String(body.slug || '').trim().toLowerCase();
        const when = String(body.publish || '').trim();
        if (!SLUG_OK.test(slug)) return res.status(400).json({ ok: false, error: 'Bad post id.' });
        if (when && !/^\d{4}-\d{2}-\d{2}$/.test(when)) {
          return res.status(400).json({ ok: false, error: 'That date did not look right.' });
        }
        await assertCurrent();
        const d = await toSheet('updatePost', { slug: slug, publish: when });
        if (!d || d.ok === false) {
          return res.status(400).json({ ok: false, error: (d && d.error) || 'The sheet rejected that.' });
        }
        // Blank means live now; otherwise it is live once the day has arrived.
        const live = !when || new Date(when + 'T23:59:59') <= new Date();
        return res.status(200).json({ ok: true, live: live });
      }

      // Take a post off the site without losing it, or put it back. A draft stays
      // hidden whatever its publish date says.
      case 'status': {
        const slug = String(body.slug || '').trim().toLowerCase();
        if (!SLUG_OK.test(slug)) return res.status(400).json({ ok: false, error: 'Bad post id.' });
        const hide = !!body.hidden;
        await assertCurrent();
        const d = await toSheet('updatePost', { slug: slug, status: hide ? 'draft' : 'live' });
        if (!d || d.ok === false) {
          return res.status(400).json({ ok: false, error: (d && d.error) || 'The sheet rejected that.' });
        }
        return res.status(200).json({ ok: true, hidden: hide });
      }

      // Delete. The Apps Script copies the row to a "Deleted" tab before removing
      // it, so this is recoverable.
      case 'delete': {
        const slug = String(body.slug || '').trim().toLowerCase();
        if (!SLUG_OK.test(slug)) return res.status(400).json({ ok: false, error: 'Bad post id.' });
        await assertCurrent();
        const d = await toSheet('deletePost', { slug: slug });
        if (!d || d.ok === false) {
          return res.status(400).json({ ok: false, error: (d && d.error) || 'The sheet rejected that.' });
        }
        return res.status(200).json({ ok: true, slug: slug });
      }

      // Create a new post, or edit one that already exists (including live ones).
      case 'save': {
        const c = cleanPost(body.post || {});
        if (c.error) return res.status(400).json({ ok: false, error: c.error });
        await assertCurrent();
        const isEdit = body.mode === 'edit';
        const d = await toSheet(isEdit ? 'updatePost' : 'addPost', c.post);
        if (!d || d.ok === false) {
          return res.status(400).json({ ok: false, error: (d && d.error) || 'The sheet rejected that.' });
        }
        return res.status(200).json({ ok: true, slug: c.post.slug, edited: isEdit });
      }

      // Render the body exactly the way the live article will, for the preview
      // pane. Done here rather than in the browser so the preview can't drift
      // away from what actually gets published.
      case 'preview':
        return res.status(200).json({ ok: true, html: parseBody(String(body.body || '')) });

      default:
        return res.status(400).json({ ok: false, error: 'Unknown action.' });
    }
  } catch (e) {
    if (e && e.userMessage) return res.status(503).json({ ok: false, error: e.userMessage });
    return res.status(502).json({ ok: false, error: 'Could not reach the sheet — try again.' });
  }
};
