# Photos, videos and the studio

Two things live in here:

1. **[nudesyogurt.com/studio](https://nudesyogurt.com/studio)** — where the team
   uploads photos and videos and writes posts. No code, no spreadsheet, works on
   a phone.
2. **The media syntax** — the one line that puts a photo or a video into a post.

---

# Part 1 — one-time setup (Tomer, ~10 minutes)

You only do this once. After that nobody else touches any of it.

## 1. Make a free Cloudinary account

Cloudinary is where the photos and videos actually live. It's free, no card, and
it matters because it **shrinks everything automatically** — someone uploads a
12&nbsp;MP photo straight off their phone and visitors get a small, fast web version.
Without that, the blog gets slow the first time a coworker uploads something big.

1. Sign up at [cloudinary.com](https://cloudinary.com) (free "Programmable Media" plan).
2. On the dashboard, note your **Cloud name**.
   **Ours is `gtbw0szr`** — that's the value for `CLOUDINARY_CLOUD_NAME` below. It's
   public by design: it appears in the URL of every image the site serves.

> **The cloud name and the preset name are the only two Cloudinary values this
> setup uses.** Your **API key** and **API secret** (Settings → Access Keys) are
> master credentials that can delete the whole media library — they are never
> needed here and must never go into an environment variable, a browser, or a doc.

## 2. Create an unsigned upload preset

This is what lets the studio upload without anyone logging into Cloudinary.

1. Cloudinary → **Settings** (gear) → **Upload** → **Upload presets** → **Add upload preset**.
2. Set **Signing mode** to **Unsigned**. This is the one setting that matters — leave
   it on Signed and every upload fails.
3. Give it a name. **Ours is `nudes-studio`** — that's the value for
   `CLOUDINARY_UPLOAD_PRESET` below.
4. Set **Asset folder** to `nudes` so everything lands in one place.
5. Leave **Generated public ID** on *Auto-generate an unguessable public ID* —
   media URLs then can't be guessed by trying filenames, and the studio stores the
   full URL Cloudinary returns, so it never needs a readable ID.
6. Save.

> The cloud name and the preset name are meant to be public — they're how an
> unsigned upload works. The studio still only hands them out after the passcode,
> and the preset can be deleted or rotated from Cloudinary at any time.

## 3. Add four environment variables in Vercel

Vercel → the nudes project → **Settings** → **Environment Variables**:

| Name | Value |
|---|---|
| `STUDIO_PASSCODE` | what the team types to get in. Make it long — e.g. four random words. |
| `SHEETS_POST_SECRET` | the **same string** as Script Property `POST_SECRET` in the Apps Script |
| `CLOUDINARY_CLOUD_NAME` | `gtbw0szr` |
| `CLOUDINARY_UPLOAD_PRESET` | `nudes-studio` |

`SHEETS_WEBHOOK_URL` is already set — that's the one the forms use.

## 4. Re-deploy the Apps Script

The script gained a few actions (editing a post, the media library). In the
Google Sheet → **Extensions → Apps Script**, paste the current
`docs/google-sheet-webhook.gs` over what's there, Save, then
**Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.**

Nothing else changes — the forms, the existing posts and the scheduling all keep
working exactly as they did. Two new tabs appear on their own the first time
they're used: **Media** (the library) and, if it doesn't exist yet, **Posts**.

## 5. Redeploy the site

Vercel → **Deployments** → ⋯ → **Redeploy**, so it picks up the new variables.

Then open [nudesyogurt.com/studio](https://nudesyogurt.com/studio), type the
passcode, and give the passcode to whoever should have it.

---

# Part 2 — using the studio (everyone)

Go to **nudesyogurt.com/studio** and enter the passcode. It works on a phone.

## Adding a photo or a video

**photos & videos** tab → drop files in, or tap to pick from the device.
They upload, and land in the library for everyone.

- Photos: up to 10&nbsp;MB. Straight off a phone is fine.
- Videos: up to 100&nbsp;MB — that's roughly a minute of phone video. For anything
  longer, post it to Instagram or YouTube and paste that link into the post instead
  (see below); it looks the same and costs nothing.
- Tapping any photo in the library **copies the line** for it, if you'd rather
  paste it into the Google Sheet by hand.

## Writing a post

**posts** tab → **+ new post**, or click an existing post to edit it —
including posts that are already live.

Fill in the title (the url id fills itself in), the category, an excerpt, and
write the post on the right. The **preview** on the far right is rendered by the
exact same code as the real article, so what you see is what gets published.

- **＋ photo / video** drops a photo or video in wherever your cursor is, and
  opens the library so you can pick one or upload a new one.
- **publish date** — leave it blank or set today to go live now. Set a future
  date and the post appears on its own that day.
- **save post** publishes. The live site picks it up within a minute.

Adding photos to a post that's already published is the same thing: click it in
the list, put the cursor where you want the photo, hit **＋ photo / video**, save.

---

# Part 3 — the media syntax

This is what the studio writes for you. You only need it if you're typing into
the Google Sheet directly.

| What you want | What you write |
|---|---|
| A photo | `![a caption](https://…jpg)` |
| A video | `![a caption](https://…mp4)` |
| A video that loops silently | `![a caption](https://…mp4 "loop")` |
| Two or three side by side | two or three `![…](…)` lines with **no blank line between them** |
| Wider than the text | `![a caption](https://…jpg "wide")` |
| Edge to edge | `![a caption](https://…jpg "full")` |
| A YouTube / Instagram / TikTok / Vimeo video | paste the link **on its own line** |
| A link in a sentence | `[the menu](/menu.html)` |

Rules that matter:

- A photo or video has to be **on its own line**, with a blank line above and
  below it — that's what turns it into a proper figure rather than text.
- The words inside `[ ]` are the caption **and** the alt text Google reads.
  Worth writing.
- Side-by-side photos don't show captions — there's no room for two.
- `wide` and `full` are for one strong shot. Most photos look better at the
  default width, matching the text column.

Example:

```
We opened on a Tuesday and the line went around the block.

![the first cup of the day](https://res.cloudinary.com/nudes-la/image/upload/v1/nudes/first-cup.jpg)

Two things we learned fast: people want **more pistachio**, and nobody reads
the topping list before they get to the counter.

![morning prep](https://…/prep.jpg)
![the counter at noon](https://…/counter.jpg)

![the swirl](https://…/swirl.mp4 "loop")

https://www.instagram.com/reel/CxYzAbCdEfG/
```

---

## If something goes wrong

| What you see | What it means |
|---|---|
| "The studio is not set up yet" | one of the four environment variables is missing in Vercel, or the site hasn't been redeployed since they were added |
| "uploads are not switched on yet" | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` are missing |
| An upload fails immediately | the preset is probably still set to **Signed** — it has to be **Unsigned** |
| "no post with slug …" when saving an edit | the row's `slug` cell was changed in the sheet after the post was loaded |
| A saved change isn't on the live post | the page is cached for a minute — wait, then hard-refresh |
