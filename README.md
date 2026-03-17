# Mappr — Landing Page

Static landing page for [Mappr](https://mappr.app).
No build tools. No dependencies. Vanilla HTML / CSS / JS.

## Structure

```
mappr-landing/
├── index.html          — full page markup (6 Acts)
├── style.css           — design tokens + all styles
├── main.js             — scroll triggers, navbar, Act 2 & 4 animations
└── loop-animation.js   — SVG causal loop, 3-phase animation
```

## Acts

| Act | Status | Notes |
|-----|--------|-------|
| 1 — Hero | ✅ v1 | Grid overlay, radial glow, dual CTAs |
| 2 — Problem | ✅ v1 | Staggered fade-in on scroll |
| 3 — Paradigm Shift | ✅ v1 | Sticky SVG loop, 3-phase scroll animation |
| 4 — How It Works | ✅ v1 | 3-column cards, staggered scroll-in |
| 5 — Proof / Before–After | ⏳ v2 | Reserved — awaiting case study |
| 6 — CTA Closing | ✅ v1 | Dark section, warm-white button |

## Running locally

Open `index.html` directly in a browser, or serve with any static server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## v2 notes

- Act 5 placeholder is commented out in `index.html`
- The `loop-animation.js` exposes `window.loopPhase(n)` — `main.js` calls it based on scroll position; Act 5 animation hook can be wired the same way
