# Adding a post to The Nude

Two ways. Pick whichever you like.

---

## Method 1 — No code (Google Sheet)  ◀ easiest

Posts live in the **same Google Sheet** as your form submissions, on a tab named
**`Posts`**. Add a row, and it shows up on The Nude automatically.

### One-time setup
1. Make sure the Apps Script from `docs/google-sheet-webhook.gs` is deployed and
   `SHEETS_WEBHOOK_URL` is set in Vercel (this is the same setup as the forms).
2. In the Sheet, add a tab named exactly **`Posts`**.
3. In row 1, add these column headers (any order):

   `slug` · `title` · `category` · `cover` · `date` · `read` · `excerpt` · `body` · `publish`

### To publish a post — add a row
| Column | What to put | Example |
|---|---|---|
| `slug` | url id, lowercase-with-hyphens | `best-toppings-in-la` |
| `title` | the headline (lowercase reads best) | `our five favorite toppings` |
| `category` | short tag shown on the cover | `menu` |
| `cover` | a color theme **or** an image link | `menu` (or `https://…/photo.jpg`) |
| `date` | label shown under the title (optional — blank = auto month/year) | `august 2026` |
| `read` | reading time | `3 min read` |
| `excerpt` | one line that makes people click | `The five we can’t stop putting on everything.` |
| `body` | the post itself (see formatting below) | … |
| `publish` | a **date** — see scheduling below | `8/14/2026` |

That's it. Posts show newest-first by publish date.

### Scheduling (the `publish` column)
`publish` is a real date, and it controls when a post goes live:
- **Blank or a past date** → the post is **live now**.
- **A future date** → the post is **scheduled** — hidden until that day, then it
  appears on its own. No deploy, no touching anything.

So you can write a whole batch of posts now, give each a future `publish` date,
and they roll out on their own schedule. To pull a live post back to draft, set
its `publish` date to the future again.

### Writing the `body`
Plain text. Inside the cell, start a new line with **Ctrl+Enter** (Mac: **Cmd+Enter**).
- Leave a **blank line** between paragraphs.
- `## a heading` → section heading
- `- item` on their own lines → bullet list
- `1. item` on their own lines → numbered list
- `> a line` → pull quote
- `**word**` → **bold**

The first letter of the first paragraph automatically becomes a big drop cap.

### Cover options
- **Color themes** (no image needed): `clean` · `culture` · `build` · `wellness` · `menu`
- **A real photo:** paste a public image link in `cover` (landscape ~16:10 works best).

---

## Method 2 — Static page (hand-built)

For a flagship post you want fully hand-crafted (and maximally SEO-friendly),
copy `docs/article-template.html`, fill in the `{{PLACEHOLDERS}}`, save it as
`the-nude-<slug>.html`, then add one entry to the `STATIC` array in `blog.js`
so it appears on the index. (The current “what is mediterranean frozen yogurt?”
post is built this way.)

---

Either way, the index page rebuilds itself — you never lay out a card by hand.
