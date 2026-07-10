# Adding a post to The Nude

Two steps. ~5 minutes.

## 1. Create the article page

1. Copy `docs/article-template.html` into the site root.
2. Rename it `the-nude-<slug>.html` — e.g. `the-nude-best-toppings-in-la.html`.
   The slug is lowercase words joined by hyphens; keep the `the-nude-` prefix.
3. Open it and replace every `{{PLACEHOLDER}}`:

   | Placeholder | What to put |
   |---|---|
   | `{{TITLE}}` | Title in normal case, e.g. `Our 5 Favorite Toppings` |
   | `{{TITLE_LOWERCASE}}` | Same title, lowercase (the hero shows it lowercase) |
   | `{{TITLE_URLENCODED}}` | Title with spaces as `%20`, `?` as `%3F` (for share links) |
   | `{{SLUG}}` | The slug, e.g. `best-toppings-in-la` |
   | `{{META_DESCRIPTION}}` | One sentence for Google/social (no em dashes) |
   | `{{CATEGORY}}` | Short tag, e.g. `menu`, `culture`, `behind the scenes` |
   | `{{THEME}}` | Cover color theme: `clean` · `culture` · `build` · `wellness` · `menu` |
   | `{{DATE_ISO}}` | `2026-08-14` (for SEO) |
   | `{{DATE_HUMAN}}` | `august 2026` |
   | `{{READ}}` | e.g. `3 min read` |

4. Write the post inside `<div class="post"> … </div>` using `<p>`, `<h2>`,
   `<ul><li>`, `<ol><li>`, `<blockquote>`. The first letter of the first
   paragraph becomes a drop cap automatically.

## 2. Add it to the index

Open `blog.js` and add ONE entry to the **top** of the `POSTS` array (newest first):

```js
{
  slug: 'the-nude-best-toppings-in-la',   // filename without .html
  title: 'our 5 favorite toppings',
  category: 'menu',
  cover: 'menu',                          // a theme key OR 'assets/photo.jpg'
  date: 'aug 2026',
  read: '3 min read',
  excerpt: "A quick sentence that makes people want to click. No em dashes."
},
```

Save, commit, push. The blog index rebuilds itself — the newest post shows as the
big featured card, older ones tile below.

## Using a real photo instead of the branded cover

Everything defaults to designed cover art (gradient + nu monogram) so posts never
look empty. When you have a real photo:

- **On the index card:** set `cover: 'assets/my-photo.jpg'` in `blog.js`.
- **On the article hero:** add `<img class="cover__img" src="assets/my-photo.jpg" alt="">`
  as the first child of `<header class="article-hero …">`.

Put photos in an `assets/` folder at the site root. Landscape (roughly 16:10) works best.

## Cover themes at a glance

`clean` (deep espresso) · `culture` (taupe) · `build` (tan) · `wellness` (blush) · `menu` (caramel).
Pick whichever fits the vibe; they're just color moods, not strict categories.
