# nudes — website designs

Five luxury, editorial, Instagram-native pages for **nudes** — Mediterranean frozen
yogurt. Built straight from your brand guidelines: warm espresso + oat palette,
geometric display type and the `nu` monogram mark.

> *Wellness, indulged. Still doing the most, with less.*

---

## What's inside

| File | Page | Personality |
|------|------|-------------|
| `index.html` | **Home** | Cinematic hero, morphing blobs, grain, signature flavors, the philosophy, the @nudes feed |
| `menu.html` | **Flavors** | Numbered flavor index, nutrition transparency, the toppings bar, "build your cup" |
| `about.html` | **Story** | Manifesto, alternating editorial blocks, the two-dots philosophy, brand values |
| `visit.html` | **Visit** | Full-bleed boutique hero, locations, "the space" gallery, hours |
| `lookbook.html` | **Lookbook** | Masonry feed + lightbox, press, creator collabs, `#nudesmoment` |
| `events.html` | **Events** | "The day club" — sun-soaked LA/Malibu/Greek vibe, event calendar, the guest list, VIP bookings |
| `nudes.css` | — | Shared design system: **every brand decision lives here as a token** |
| `nudes.js` | — | Shared interactions: scroll reveals, mobile menu, lightbox, cursor |

All six pages share one stylesheet and one script, so the site is perfectly
consistent and easy to evolve. **Keep every file in this one folder.**

**Voice:** short, lowercase, influencer/it-girl (Alix Earle meets Kim K) — confident,
a little slangy, never advertisy. Edit any line; just keep it brief and human.

---

## How to view

- **Easiest:** double-click `index.html` — it opens in your browser and everything
  works (fonts, photos, animations, the lightbox).
- **Best (recommended for real previewing / before hosting):** run a tiny local
  server from this folder, then open the address it prints:
  ```bash
  cd "/Users/tomerbutbul/Desktop/Nuudes"
  python3 -m http.server 8137
  # then visit http://127.0.0.1:8137/index.html
  ```

To put it online, drag this folder onto **Netlify Drop** (netlify.com/drop),
**Vercel**, or **Cloudflare Pages** — it's plain HTML, so it hosts anywhere, free.

---

## The brand system, in code

Open `nudes.css` and you'll find your guidelines translated to tokens at the top:

```css
--espresso:#442917;   /* primary brown            */
--espresso-800:#331E13;/* darkest brown            */
--oat:#DCCCBB;        /* light neutral            */
--taupe:#B5937F;      /* mauve                    */
--blush:#CCADA0;      /* dusty rose               */
--paper:#EBE4D8;      /* warm page background     */
--display:'Fredoka';  /* bold rounded display (≈ BC Novatica logo) */
--body:'Switzer';     /* your exact body typeface */
```

- **Type:** the PDF specifies **BC Novatica CYR** (logo + headline) — a paid ParaType
  font, so it can't be hotlinked. It's wired up via `@font-face`: drop your licensed
  `BCNovaticaCYR-Bold.woff2` and `-Light.woff2` into a `fonts/` folder here (or just have
  the font installed on your Mac) and the whole site uses the real thing automatically.
  Until then it falls back to **Fredoka** (free, bold, rounded — very close to the logo).
  Body is **Switzer**, your actual font (free from Fontshare).
- **Flavors are illustrated, not stock:** every froyo cup is ONE hand-built SVG, recolored
  per flavor with CSS variables (`--swirl`, `--topping`, `--bg`) — see the 8 menu cards.
  Edit a colour to retint, or drop in real product photos when your shoot is ready.
- **Motifs:** the `nu` monogram is hand-drawn as an SVG and now anchors the favicon.
- **Photography:** the remaining lifestyle/editorial photos get a warm "wash"
  (`sepia + espresso veil`) so any imagery unifies to the palette — the trick that
  makes a shoot feel *yours*.

---

## How to customize

- **Change a color everywhere:** edit one token in `:root` (`nudes.css`). Done.
- **Swap the photos:** the images are Unsplash placeholders (`images.unsplash.com/...`).
  Replace each `src` with your own product/boutique/creator shots. Layouts and the
  warm wash stay intact, so your photos instantly look art-directed.
- **Edit words:** all copy is plain text in the HTML — flavors, prices, locations,
  creator names, captions. Change freely.
- **Reorder / remove sections:** each section is a clearly commented `<!-- ===== ... -->`
  block. Cut or move whole blocks safely.

---

## How to use Claude for design (going forward)

You don't need to touch code to keep iterating — just describe what you want.

**1. In Claude Code (this tool).** Point me at a file and ask in plain language:
> "On `menu.html`, make the flavor cards taller and add a 'new' badge to Matcha."
> "Add a press/PR page that matches the others."
> "Make the whole site feel warmer and more maximalist."
I'll edit the real files and can screenshot the result to confirm before you even open it.

**2. On claude.ai (Artifacts).** Paste a brand color or screenshot and say "build me a
landing page in this style." Claude renders a live, editable preview in the chat — great
for fast exploration and one-off pages.

**3. Built-in design skills** (type the slash command):
- `/frontend-design` — generate distinctive, production-grade UI (what built this site).
- `/design-critique` — paste a screenshot for structured feedback.
- `/accessibility-review` — check color contrast & tap targets before launch.
- `/design-handoff` — generate a developer spec sheet from a design.

**4. The workflow that works best:**
1. Give Claude the brand guide (you did — that's why this is on-brand).
2. Ask for a bold direction, not a safe one ("editorial luxury," "maximalist," etc.).
3. Iterate in small, specific asks and look at screenshots together.
4. Swap in real photography last — it's the single biggest upgrade.

**Prompts to try next:**
- "Design a cup/packaging mockup page using the nu mark."
- "Create an email signup popup and an Instagram story template set."
- "Build a one-page version for a pop-up launch on the Riviera."

---

*Fonts: BC Novatica CYR (your licensed font → drop into `fonts/`) with a free Fredoka
fallback, plus Switzer (Fontshare, free). Froyo cups are original SVG illustrations.
Lifestyle photos are Unsplash placeholders, free to use, meant to be replaced with your
shoot. Everything else is yours.*
