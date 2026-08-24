# Photos & video on The Nude

Where to put them, what to name them, and what to paste into the sheet.

---

## The short version

| You have | Put it | In the sheet write |
|---|---|---|
| A photo | `images/` in this repo | `/images/pistachio-cup.jpg` |
| A short silent clip (< ~5 MB) | `videos/` in this repo | `/videos/pour.mp4` |
| A longer video | Upload to YouTube | the YouTube link |
| An Instagram post | Re-upload the file to `images/` | `/images/…` |

Anything starting with `/` is served from this site. That's the goal — same-origin
images are fast, cached forever, and count as *your* images in Google Images.

---

## Photos → the `images/` folder

1. Drop the file into the `images/` folder in this repo.
2. Name it what it is, lowercase with hyphens: `pistachio-cup-marble.jpg`, not
   `IMG_4821.jpg`. The filename is a real (small) ranking signal, and it's the only
   label you'll have when you're looking for the photo in six months.
3. Commit it. Vercel serves it at `/images/pistachio-cup-marble.jpg` with a
   one-year immutable cache (already configured in `vercel.json`).
4. Paste that path into the sheet.

**Before you commit, resize.** A 4000px phone photo is ~8 MB and will tank your
Core Web Vitals, which *is* a ranking factor. Export at:

- **cover images:** 1600px wide, JPEG quality ~72 → aim for under 300 KB
- **in-article images:** 1200px wide → under 200 KB
- **format:** `.jpg` for photos, `.webp` if you can export it (30–40% smaller),
  `.png` only for graphics with flat color or transparency

macOS Preview: *Tools → Adjust Size*, then *File → Export* with the quality slider
around 70%. That's the whole workflow.

### Don't hotlink from these
- **Google Drive / Dropbox share links** — they aren't real image URLs, they rate-limit,
  and they break the moment sharing settings change.
- **Instagram / Facebook CDN URLs** — signed and expiring. They *will* go dead.
- **Someone else's website** — that's hotlinking, and it's their bandwidth and their
  image in Google's index, not yours.

An external `https://…` URL does work in every image column if you need it (a real
CDN like Cloudinary is fine) — it just doesn't get the caching or the ownership.

---

## Video → `videos/`, or YouTube

**Short, silent, looping b-roll** (a pour, a swirl, a topping drop): keep it on the
site. Make a `videos/` folder, drop in an `.mp4`, reference `/videos/pour.mp4`.
Keep it **under ~5 MB** — export 1080p, 24–30 fps, H.264, and trim to a few seconds.
Git and Vercel both get unhappy with large binaries, and a heavy video is the fastest
way to wreck your mobile page speed.

**Anything with sound, or longer than ~15 seconds:** upload it to YouTube and paste
the watch link into the `video` column. You get YouTube's player and bandwidth for
free, the post gets `VideoObject` structured data and a video sitemap entry either
way, and the video becomes findable on YouTube too — which is its own search engine
and, increasingly, its own answer engine.

The `video` column accepts all of these:

```
/videos/pour.mp4
https://www.youtube.com/watch?v=XXXXXXXXXXX
https://youtu.be/XXXXXXXXXXX
https://vimeo.com/123456789
```

YouTube embeds use `youtube-nocookie.com` and lazy-load, so they don't slow the page
down or drop tracking cookies on a first-time reader.

`video_thumb` is optional — YouTube thumbnails are detected automatically. For a
self-hosted `.mp4`, set it to a still frame (`/images/pour-still.jpg`) so the post
still has a share image and a video thumbnail in search results.

---

## Alt text: the part everyone skips

Every image column takes alt text, and it's worth 30 seconds:

- `alt` describes the **cover** photo.
- In `images`, alt goes after a pipe: `/images/fig-cup.jpg | Fig froyo with fresh figs`
- Inline in `body`: `![Date caramel poured over frozen yogurt](/images/date-caramel.jpg)`

Write what's actually in the frame, in a sentence a person would say out loud. It's
how the image gets into Google Images, it's what a screen reader announces, and it's
how an AI assistant knows what your photo shows.

Don't stuff keywords. "Frozen yogurt Los Angeles best froyo near me mediterranean"
is worse than useless — Google discounts it and a blind reader gets nothing.

---

## Where images show up on the page

| Column | Renders as |
|---|---|
| `cover` | the full-bleed banner behind the article title, and the card on `/the-nude.html` |
| `images` | a gallery after the body, each with its caption |
| `![alt](url)` in `body` | exactly where you put it, mid-article |
| a bare image URL on its own line in `body` | same thing, no caption |
| `video` | a player at the top of the article, under the short answer |

All of them are also listed in `/sitemap.xml` with their alt text, so Google Images
can find them without crawling the page first.
