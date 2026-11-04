# birth

A small, slightly over-engineered birthday site — built for **abdo**, 03.11.

No frameworks. No build step. No dependencies. Just HTML, CSS, a canvas and a lot of
hand-written vanilla JavaScript.

---

## Add her photo

1. Open the `img/` folder.
2. Drop a photo in and name it exactly **`img.jpg`**.
3. Refresh. The placeholder disappears on its own.

The frame is **4:5** (portrait) and centre-cropped, so a vertical photo looks best.

---

## Run it

Double-click `index.html` — it works straight from the file system.

Or serve it properly (recommended, so audio + fonts behave everywhere):

```bash
npx serve .
# or
python -m http.server 5173
```

---

## What happens

1. **A gate** — one tap, because browsers refuse to play music without one.
2. **5 → 0** — big cinematic countdown with a soft tick per number.
3. **"Happy Birthday, Nada"** — …then a pause, a strikethrough, *"…wait."*
4. **"I mean — Marwa"** — and the song starts exactly on the correction.
5. **The site** — confetti cannons, fireworks, balloons, a polaroid that tilts with
   the cursor, a cake with **18** candles you can blow out, a letter, a multilingual
   marquee, and a live counter of every second she has existed.

Everything animates: starfield, shooting stars, aurora washes, film grain,
sparkle trail, floating hearts, a music equaliser.

---

## Handy bits

| thing | where |
| --- | --- |
| photo | `img/img.jpg` |
| song | `audio/song.mp3` |
| colours / type | `:root` at the top of `css/style.css` |
| timings of the intro | `runIntro()` in `js/app.js` |
| particle engine | `FX` in `js/app.js` |

**Jump straight to a moment** (handy for previews):

```
index.html?pose=countdown
index.html?pose=nada
index.html?pose=oops
index.html?pose=marwa
index.html?pose=main
```

**Keys:** `space` = confetti · `m` = mute · `f` = fireworks.

---

Made at an unreasonable hour. No frameworks were harmed.
