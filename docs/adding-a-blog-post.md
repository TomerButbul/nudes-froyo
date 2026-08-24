# Adding a post to The Nude

Three ways. Pick whichever you like.

---

## Method 0 — Just ask Claude  ◀ zero effort

Tell Claude the topic ("write a post about our toppings") and it writes the post
and pushes it straight into the `Posts` tab via the webhook (using the secret in
Script Property `POST_SECRET`). Nothing to copy-paste. Works because the Apps
Script `addPost` action appends a row for authorized callers.

---

## Method 1 — No code (Google Sheet)

Posts live in the **same Google Sheet** as your form submissions, on a tab named
**`Posts`**. Add a row, and it shows up on The Nude automatically.

### One-time setup
1. Make sure the Apps Script from `docs/google-sheet-webhook.gs` is deployed and
   `SHEETS_WEBHOOK_URL` is set in Vercel (this is the same setup as the forms).
2. In the Sheet, add a tab named exactly **`Posts`**.
3. In row 1, add the column headers below (any order — the script matches by name,
   and every column outside the first group is optional).

### The columns

**The post** — the only ones you really need.

| Column | What to put | Example |
|---|---|---|
| `slug` | url id, lowercase-with-hyphens | `best-toppings-in-la` |
| `title` | the headline (lowercase reads best) | `our five favorite toppings` |
| `category` | short tag shown on the cover | `menu` |
| `excerpt` | one line that makes people click | `The five we can't stop putting on everything.` |
| `body` | the post itself (see formatting below) | … |
| `publish` | a **date** — see scheduling below | `8/14/2026` |

**Media** — full guide in [`media-guide.md`](media-guide.md).

| Column | What to put | Example |
|---|---|---|
| `cover` | a color theme **or** an image path | `menu` or `/images/toppings.jpg` |
| `alt` | what the cover photo shows | `A spread of pistachios and figs on marble` |
| `images` | extra photos, one per line, `path \| caption` | `/images/fig-cup.jpg \| Fig froyo with fresh figs` |
| `video` | a video file, YouTube or Vimeo link | `/videos/pour.mp4` |
| `video_thumb` | still frame for a self-hosted video | `/images/pour-still.jpg` |

**Answers** — the two columns that get you quoted by AI. Details below.

| Column | What to put | Example |
|---|---|---|
| `answer` | 2–3 sentences answering the title, directly | `Our five favorite toppings are…` |
| `faq` | real questions people ask, with answers | `Q: Are the toppings vegan?` / `A: The nuts…` |

**Extras** — nice to have.

| Column | What to put | Example |
|---|---|---|
| `date` | label under the title (blank = auto month/year) | `august 2026` |
| `read` | reading time | `3 min read` |
| `keywords` | comma-separated topics | `froyo toppings, los angeles dessert` |
| `author` | byline (blank = "nudes") | `Tomer Butbul` |
| `updated` | date you last edited it | `9/2/2026` |

Posts show newest-first by publish date.

> **Changed the columns?** Re-paste `docs/google-sheet-webhook.gs` into
> *Extensions → Apps Script*, Save, then **Deploy → Manage deployments → edit →
> New version**. Old sheets keep working — every new column is optional.

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
- `### a smaller heading` → subheading
- `- item` on their own lines → bullet list
- `1. item` on their own lines → numbered list
- `> a line` → pull quote
- `**word**` → **bold**
- `[text](/menu.html)` → a link
- `![what the photo shows](/images/cup.jpg)` → an image, right where you put it
- a bare image or video URL on its own line → embedded automatically

The first letter of the first paragraph automatically becomes a big drop cap.

### Cover options
- **Color themes** (no image needed): `clean` · `culture` · `build` · `wellness` · `menu`
- **A real photo:** a path from `images/` (landscape ~16:10 works best).

---

## Writing so AI assistants quote you (AEO)

Google's AI Overviews, ChatGPT and Perplexity don't rank pages — they lift
*passages*. Two columns are built for that, and filling them in is the single
highest-leverage thing you can do per post.

**`answer` — the passage that gets quoted.**
Write 2–3 sentences (roughly 40–60 words) that answer the headline completely, on
their own, with no setup. It renders as "the short answer" at the top of the post
and is tagged as the speakable passage in structured data.

- Lead with the answer, not a windup. "Our five favorite toppings are…", never
  "There are a lot of great toppings out there, but…"
- Name the brand once, naturally. That's how you get the citation, not just the fact.
- It has to stand alone. If it only makes sense after the paragraph above it, an AI
  can't lift it.

**`faq` — the questions people actually type.**
One Q&A per pair of lines, or one per line with a pipe:

```
Q: Are the toppings vegan?
A: The nuts, figs, dates and tahini are. The halva crumble contains dairy.
Do you charge extra for toppings? | The first two are included with every cup.
```

These render as a "questions, answered" section *and* become `FAQPage` structured
data. Use the phrasing a customer would use out loud — "is frozen yogurt actually
healthy?" beats "the nutritional profile of frozen yogurt."

**The rest of the post.** Make every `## heading` a question or a claim, keep the
paragraph under it self-contained, and put a specific number or fact in it wherever
you honestly can. Concrete beats fluffy: "strained twice, 12g of protein per cup"
is quotable, "incredibly high quality ingredients" is not.

---

## Method 2 — Static page (hand-built)

For a flagship post you want fully hand-crafted, copy `docs/article-template.html`,
fill in the `{{PLACEHOLDERS}}`, save it as `the-nude-<slug>.html`, then add one entry
to `STATIC_POSTS` **and** `STATIC_PAGES` in `api/_blog.js` so it appears on the index
and owns its canonical URL. (The current "what is mediterranean frozen yogurt?" post
is built this way.)

---

## How the pages are built

Both the index and the articles are **server-rendered** from the sheet:

| URL | Served by |
|---|---|
| `/the-nude.html` | `api/nude.js` — the card grid |
| `/the-nude/<slug>` | `api/post.js` — one article |
| `/sitemap.xml` | `api/sitemap.js` — pages, posts, images, video |
| `/llms.txt` | `api/llms.js` — a plain-text site map for AI assistants |

That matters: search crawlers and AI assistants get the real text, media and
structured data in the page source rather than an empty shell they'd have to run
JavaScript to fill in. You never lay out a card or a `<meta>` tag by hand.
