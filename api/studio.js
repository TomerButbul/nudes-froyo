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
        const d = await toSheet('listPosts', {});
        return res.status(200).json({ ok: true, posts: (d && d.posts) || [] });
      }

      case 'media': {
        const d = await toSheet('listMedia', {});
        return res.status(200).json({ ok: true, media: (d && d.media) || [] });
      }

      // Record an upload in the Media tab so it shows up in the library later.
      case 'addMedia': {
        const url = String(body.url || '').trim();
        if (!/^https:\/\//.test(url)) return res.status(400).json({ ok: false, error: 'Bad media url.' });
        await toSheet('addMedia', {
          url: url,
          type: String(body.type || 'image').trim(),
          label: String(body.label || '').trim(),
          by: String(body.by || '').trim(),
        });
        return res.status(200).json({ ok: true });
      }

      // Create a new post, or edit one that already exists (including live ones).
      case 'save': {
        const c = cleanPost(body.post || {});
        if (c.error) return res.status(400).json({ ok: false, error: c.error });
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
    return res.status(502).json({ ok: false, error: 'Could not reach the sheet — try again.' });
  }
};
