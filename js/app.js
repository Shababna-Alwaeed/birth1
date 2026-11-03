/* ==========================================================================
   For Marwa · 03.11 — vanilla js, no build step, no dependencies
   ========================================================================== */
(() => {
  "use strict";

  /* ---------- tiny helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  /* phones / weak machines get fewer particles, lower dpr, shorter effects */
  const light = coarse || (navigator.hardwareConcurrency || 8) <= 4;
  const FX_MAX = light ? 420 : 1000;
  const nf = new Intl.NumberFormat("en-US");
  const vibrate = (n) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };

  /* ---------- dom ---------- */
  const gate      = $("#gate");
  const countdown = $("#countdown");
  const reveal    = $("#reveal");
  const main      = $("#main");
  const flash     = $("#flash");
  const cdNum     = $("#cdNum");
  const cdLabel   = $("#cdLabel");
  const skipBtn   = $("#skipBtn");
  const player    = $("#player");
  const playBtn   = $("#playBtn");
  const balloons  = $("#balloons");
  const cake      = $("#cake");
  const wishHint  = $("#wishHint");
  const wishDone  = $("#wishDone");
  const polaroid  = $("#polaroid");
  const photo     = $("#photo");
  const glow      = $("#cursorGlow");
  const scrollBar = $("#scrollBar");
  const songEl    = $("#song");

  /* =======================================================================
     ambient field — stars · shooting stars · bokeh
     ======================================================================= */
  (function buildSky() {
    const stars = $("#stars");
    if (!stars) return;
    const frag = document.createDocumentFragment();
    const count = window.innerWidth < 700 ? 45 : 90;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      const size = rand(0.7, 2.3);
      s.className = "star";
      s.style.cssText =
        `left:${rand(0, 100).toFixed(2)}%;top:${rand(0, 100).toFixed(2)}%;` +
        `width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;` +
        `--t:${rand(2.6, 7.5).toFixed(2)}s;--d:${rand(0, 7).toFixed(2)}s;--o:${rand(0.3, 0.95).toFixed(2)}`;
      frag.appendChild(s);
    }
    stars.appendChild(frag);

    // bokeh orbs
    const bokeh = $("#bokeh");
    if (bokeh) {
      for (let i = 0; i < 5; i++) {
        const o = document.createElement("span");
        const size = rand(60, 200);
        o.className = "orb";
        o.style.cssText =
          `left:${rand(0, 92).toFixed(1)}%;top:${rand(0, 85).toFixed(1)}%;` +
          `width:${size}px;height:${size}px;--t:${rand(9, 18).toFixed(1)}s;--d:${rand(0, 6).toFixed(1)}s`;
        bokeh.appendChild(o);
      }
    }

    if (reduced) return;
    // shooting stars
    const shoot = () => {
      const el = document.createElement("span");
      el.className = "shooting";
      el.style.setProperty("--top", rand(-4, 52).toFixed(1) + "%");
      el.style.setProperty("--left", rand(-6, 44).toFixed(1) + "%");
      stars.appendChild(el);
      setTimeout(() => el.remove(), 3800);
      setTimeout(shoot, rand(4800, 11000));
    };
    setTimeout(shoot, 3500);
  })();

  /* =======================================================================
     particle engine — confetti, fireworks, sparkle trail
     ======================================================================= */
  const FX = (() => {
    const canvas = $("#fx");
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, DPR = 1;
    let parts = [];
    let raf = null;
    let rainTimer = null;

    const PARTY = ["#ffd9a0", "#f4c78a", "#ff8fb1", "#ff5c8a", "#b79cff", "#fff7ee", "#8fe3d0", "#ffb26b"];
    const FIRE  = ["#ffe9c9", "#f4c78a", "#ff8fb1", "#b79cff", "#fff7ee", "#ff5c8a"];

    /* pre-rendered glow sprites: same soft sparks, a fraction of ctx.shadowBlur's cost */
    const glowCache = new Map();
    const hexA = (hex, a) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };
    function glowSprite(color) {
      let c = glowCache.get(color);
      if (c) return c;
      const size = 64, half = size / 2;
      c = document.createElement("canvas");
      c.width = size; c.height = size;
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0, "rgba(255,255,255,.95)");
      grad.addColorStop(0.2, color);
      grad.addColorStop(0.5, hexA(color, 0.4));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      glowCache.set(color, c);
      return c;
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    addEventListener("resize", resize, { passive: true });

    function ensureLoop() {
      if (raf) return;
      raf = requestAnimationFrame(loop);
    }

    function add(p) {
      if (parts.length > FX_MAX) parts.splice(0, 140);
      parts.push(p);
      ensureLoop();
    }

    function confetti(x, y, opts = {}) {
      if (reduced) return;
      const {
        count = 40,
        angle = -Math.PI / 2,
        spread = Math.PI * 2,
        power = 12,
        gravity = 0.24,
        drag = 0.985,
        colors = PARTY,
        z = 1
      } = opts;
      for (let i = 0; i < count; i++) {
        const a = angle + rand(-spread / 2, spread / 2);
        const speed = power * rand(0.35, 1.15);
        const ribbon = Math.random() < 0.28;
        add({
          kind: ribbon ? "ribbon" : "rect",
          x, y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          g: gravity * rand(0.75, 1.3),
          drag,
          w: ribbon ? rand(3, 5) : rand(5, 11),
          h: ribbon ? rand(12, 22) : rand(7, 14),
          rot: rand(0, Math.PI * 2),
          vr: rand(-0.28, 0.28),
          color: pick(colors),
          life: 1,
          decay: rand(0.0032, 0.0072),
          alpha: rand(0.75, 1),
          z,
          wob: rand(0, 6.28),
          wobSpeed: rand(0.05, 0.13)
        });
      }
    }

    function firework(x, y, opts = {}) {
      if (reduced) return;
      const { count = 64, hue = FIRE, power = 7 } = opts;
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2);
        const s = power * rand(0.25, 1);
        add({
          kind: "spark",
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          g: 0.075,
          drag: 0.965,
          r: rand(1.1, 2.6),
          color: pick(hue),
          life: 1,
          decay: rand(0.008, 0.017),
          alpha: 1,
          z: 0
        });
      }
      // bright core
      add({
        kind: "spark", x, y, vx: 0, vy: 0, g: 0, drag: 1,
        r: 26, color: "#fff6e8", life: 1, decay: 0.09, alpha: 0.55, z: 0
      });
    }

    function sparkle(x, y) {
      if (reduced) return;
      for (let i = 0; i < 2; i++) {
        add({
          kind: "spark",
          x: x + rand(-4, 4),
          y: y + rand(-4, 4),
          vx: rand(-0.7, 0.7),
          vy: rand(-0.9, 0.2),
          g: 0.01,
          drag: 0.97,
          r: rand(0.8, 2),
          color: Math.random() < 0.5 ? "#ffd9a0" : "#ffb3c8",
          life: 1,
          decay: rand(0.03, 0.055),
          alpha: 0.9,
          z: 0
        });
      }
    }

    function rain(ms = 3000) {
      if (reduced) return;
      clearInterval(rainTimer);
      const t0 = performance.now();
      rainTimer = setInterval(() => {
        if (performance.now() - t0 > ms) { clearInterval(rainTimer); return; }
        if (document.hidden) return;
        confetti(rand(0, W), -20, {
          count: 3,
          angle: Math.PI / 2,
          spread: 1.4,
          power: rand(1, 3),
          gravity: rand(0.06, 0.12),
          drag: 0.999,
          colors: PARTY
        });
      }, 70);
    }

    function loop() {
      raf = null;
      if (document.hidden) return; // resumed by the visibility handler
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];

        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.vr) p.rot += p.vr;
        if (p.wob !== undefined) p.wob += p.wobSpeed;

        if (p.life <= 0 || p.y > H + 80 || p.x < -120 || p.x > W + 120) {
          parts.splice(i, 1);
          continue;
        }

        const drift = p.wob !== undefined ? Math.sin(p.wob) * 0.5 : 0;
        ctx.save();
        ctx.globalAlpha = clamp(p.life, 0, 1) * (p.alpha ?? 1);
        ctx.translate(p.x + drift, p.y);

        if (p.kind === "spark") {
          const s = p.r * 5;
          ctx.drawImage(glowSprite(p.color), -s / 2, -s / 2, s, s);
        } else {
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          if (p.kind === "ribbon") {
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.7 + Math.abs(Math.cos(p.wob || 0)) * 0.3));
          } else {
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          }
        }
        ctx.restore();
      }

      if (parts.length) {
        raf = requestAnimationFrame(loop);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    }

    return {
      confetti,
      firework,
      sparkle,
      rain,
      resume() { if (parts.length) ensureLoop(); },
      party() {
        const k = light ? 0.62 : 1;
        confetti(W * 0.5, H * 0.62, { count: Math.round(70 * k), angle: -Math.PI / 2, spread: 2.4, power: 18, gravity: 0.26 });
        confetti(W * 0.08, H + 10, { count: Math.round(60 * k), angle: -Math.PI / 3.1, spread: 0.75, power: 24 });
        confetti(W * 0.92, H + 10, { count: Math.round(60 * k), angle: -Math.PI + Math.PI / 3.1, spread: 0.75, power: 24 });
      },
      celebrate() {
        const k = light ? 0.6 : 1;
        const y = H * 0.4;
        firework(W * 0.22, y, { count: Math.round(70 * k) });
        firework(W * 0.5, y * 0.75, { count: Math.round(80 * k), power: 8 });
        firework(W * 0.78, y, { count: Math.round(70 * k) });
      },
      burstAt(el) {
        const r = el.getBoundingClientRect();
        confetti(r.left + r.width / 2, r.top + r.height / 2, {
          count: light ? 36 : 60, angle: -Math.PI / 2, spread: 2.2, power: 15
        });
      }
    };
  })();

  /* =======================================================================
     audio — song + soft synthesised ticks (no extra files)
     ======================================================================= */
  const AudioKit = (() => {
    let ctx = null;
    let master = null;
    let started = false;
    let fadeTimer = null;
    let unlocked = false;

    function init() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
      return ctx;
    }

    function tone(freq, dur = 0.2, type = "sine", vol = 0.06, delay = 0) {
      if (!ctx || !master) return;
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    function unlock() {
      init();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      if (unlocked) return;
      unlocked = true;
      // start buffering the song now (preload is off until the visitor asks for it)
      try { songEl.preload = "auto"; } catch (e) {}
      // prime the media element inside the user gesture so later playback is allowed
      try {
        const prev = songEl.volume;
        songEl.volume = 0;
        const p = songEl.play();
        const pause = () => { try { songEl.pause(); songEl.currentTime = 0; songEl.volume = prev || 0.62; } catch (e) {} };
        if (p && p.then) p.then(pause).catch(() => { songEl.volume = prev || 0.62; });
        else pause();
      } catch (e) {}
    }

    function tick(step) {
      const f = 440 + step * 46;
      tone(f, 0.16, "sine", 0.05);
      tone(f * 2, 0.09, "triangle", 0.012);
    }

    function chime() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => tone(f, 1.4, "sine", 0.055 - i * 0.006, i * 0.085));
    }

    function fadeTo(target, ms) {
      clearInterval(fadeTimer);
      const start = songEl.volume;
      const t0 = performance.now();
      fadeTimer = setInterval(() => {
        const k = clamp((performance.now() - t0) / ms, 0, 1);
        songEl.volume = start + (target - start) * k;
        if (k >= 1) clearInterval(fadeTimer);
      }, 50);
    }

    function start() {
      init();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      if (started) return;
      started = true;
      try {
        songEl.currentTime = 0;
        songEl.volume = 0;
        const p = songEl.play();
        if (p && p.catch) p.catch(() => { started = false; });
        fadeTo(0.62, 2600);
      } catch (e) { started = false; }
    }

    function reset() {
      started = false;
      try { songEl.pause(); songEl.currentTime = 0; songEl.volume = 0; } catch (e) {}
    }

    function toggle() {
      if (songEl.paused) {
        const p = songEl.play();
        if (p && p.catch) p.catch(() => {});
        if (songEl.volume < 0.05) fadeTo(0.62, 900);
      } else {
        songEl.pause();
      }
      return !songEl.paused;
    }

    return { unlock, tick, chime, start, reset, toggle };
  })();

  /* =======================================================================
     balloons
     ======================================================================= */
  const PALETTE = [
    ["#ffc2d8", "#ff5f8a"],
    ["#ffe0b0", "#f0a04b"],
    ["#d3c4ff", "#8a6bf0"],
    ["#b0f0e2", "#3fbfa8"],
    ["#fff0f4", "#ff9fbd"],
    ["#ffcfc2", "#e8664f"]
  ];
  let balloonTimer = null;

  function spawnBalloon(prewarm) {
    if (document.hidden || reduced) return;
    const narrow = window.innerWidth < 700;
    if (balloons.children.length > (narrow ? 5 : 8)) return;
    const [c1, c2] = pick(PALETTE);
    const el = document.createElement("div");
    el.className = "balloon";
    el.style.left = rand(1, 95).toFixed(1) + "vw";
    el.style.setProperty("--w", rand(narrow ? 32 : 44, narrow ? 58 : 84).toFixed(0) + "px");
    el.style.setProperty("--c1", c1);
    el.style.setProperty("--c2", c2);
    const dur = rand(15, 26);
    el.style.setProperty("--dur", dur.toFixed(1) + "s");
    el.style.setProperty("--sway", rand(3.2, 6.4).toFixed(1) + "s");
    el.style.setProperty("--str", rand(40, 110).toFixed(0) + "px");
    el.style.opacity = rand(0.34, 0.58).toFixed(2);
    if (prewarm) el.style.animationDelay = "-" + rand(3, dur * 0.65).toFixed(1) + "s";
    el.innerHTML =
      '<span class="balloon-inner"><span class="balloon-body"></span><span class="balloon-string"></span></span>';
    balloons.appendChild(el);
    setTimeout(() => el.remove(), (prewarm ? dur * 0.7 + 6 : dur + 2) * 1000);
  }

  function startBalloons() {
    if (balloonTimer) return;
    const narrow = window.innerWidth < 700;
    for (let i = 0; i < 4; i++) setTimeout(() => spawnBalloon(i < (narrow ? 2 : 3)), i * 220);
    balloonTimer = setInterval(() => spawnBalloon(false), narrow ? 3400 : 2400);
  }
  function stopBalloons() {
    clearInterval(balloonTimer);
    balloonTimer = null;
    balloons.innerHTML = "";
  }

  /* =======================================================================
     the intro sequence
     ======================================================================= */
  const intro = { token: 0, running: false };
  const rvPre     = $("#rvPre");
  const rvName    = $("#rvName");
  const rvOops    = $("#rvOops");
  const rvCorrect = $("#rvCorrect");
  const rvSub     = $("#rvSub");

  function showNumber(n) {
    cdNum.textContent = String(n);
    cdNum.classList.remove("tick");
    void cdNum.offsetWidth; // restart the animation
    cdNum.classList.add("tick");
    cdLabel.textContent = n === 0 ? "look up." : "something is happening";
  }

  function flashScreen() {
    flash.classList.remove("on");
    void flash.offsetWidth;
    flash.classList.add("on");
  }

  async function runIntro() {
    if (intro.running) return;
    intro.running = true;
    const token = ++intro.token;
    const alive = () => token === intro.token;

    document.body.classList.add("locked");
    gate.classList.add("leaving");
    await wait(650);
    if (!alive()) return;
    gate.hidden = true;

    countdown.hidden = false;
    await wait(120);
    if (!alive()) return;
    skipBtn.hidden = false;

    for (let n = 5; n >= 0; n--) {
      if (!alive()) return;
      showNumber(n);
      AudioKit.tick(5 - n);
      vibrate(n === 0 ? [40, 60, 90] : 18);
      if (n === 0) {
        FX.firework(window.innerWidth / 2, window.innerHeight / 2, { count: 70, power: 9 });
      }
      await wait(n === 0 ? 900 : 850);
    }

    if (!alive()) return;
    flashScreen();
    AudioKit.chime();
    FX.rain(2600);
    await wait(240);
    if (!alive()) return;
    countdown.hidden = true;

    reveal.hidden = false;
    await wait(140);
    if (!alive()) return;

    rvPre.classList.add("in");
    await wait(340);
    if (!alive()) return;

    rvName.classList.add("in");
    FX.confetti(window.innerWidth / 2, window.innerHeight * 0.55, {
      count: 50, angle: -Math.PI / 2, spread: 2.2, power: 14
    });
    await wait(2900); // ← the joke lands here
    if (!alive()) return;

    reveal.classList.add("oops");
    rvOops.classList.add("in");
    AudioKit.start(); // music right on the correction
    await wait(780);
    if (!alive()) return;

    rvCorrect.classList.add("in");
    FX.celebrate();
    FX.party();
    await wait(520);
    if (!alive()) return;

    rvSub.classList.add("in");
    await wait(2900);
    if (!alive()) return;

    goMain();
  }

  function goMain() {
    reveal.classList.add("leaving");
    setTimeout(() => {
      reveal.hidden = true;
      reveal.classList.remove("leaving");
    }, 750);

    main.hidden = false;
    document.body.classList.remove("locked");
    requestAnimationFrame(() => {
      main.classList.add("in");
      window.scrollTo(0, 0);
    });

    player.hidden = false;
    updateStats();
    startBalloons();
    FX.party();
    setTimeout(() => FX.rain(2400), 500);
    setTimeout(() => FX.celebrate(), 900);
    intro.running = false;
  }

  function skipIntro() {
    intro.token++;
    intro.running = false;
    countdown.hidden = true;
    reveal.hidden = true;
    gate.hidden = true;
    AudioKit.unlock();
    AudioKit.start();
    goMain();
  }

  $("#startBtn").addEventListener("click", () => {
    AudioKit.unlock();
    runIntro();
  });
  skipBtn.addEventListener("click", skipIntro);

  /* =======================================================================
     main scene
     ======================================================================= */
  const BIRTH = new Date(2008, 10, 3, 0, 0, 0).getTime(); // 3 Nov 2008
  const statYears = $("#statYears");
  const statDays = $("#statDays");
  const statSeconds = $("#statSeconds");

  function updateStats() {
    if (main.hidden || document.hidden) return;
    const now = Date.now();
    const ms = Math.max(0, now - BIRTH);
    const d = new Date(now);
    let years = d.getFullYear() - 2008;
    if (d.getMonth() < 10 || (d.getMonth() === 10 && d.getDate() < 3)) years--;
    statYears.textContent = String(Math.max(0, years));
    statDays.textContent = nf.format(Math.floor(ms / 86400000));
    statSeconds.textContent = nf.format(Math.floor(ms / 1000));
  }
  updateStats();
  setInterval(updateStats, 1000);

  /* ---------- photo ---------- */
  (function wirePhoto() {
    const frame = photo.parentElement;
    const settle = (ok) => {
      if (ok) {
        photo.classList.add("loaded");
        frame.classList.remove("is-missing");
      } else {
        frame.classList.add("is-missing");
      }
    };
    if (photo.complete) settle(photo.naturalWidth > 0);
    photo.addEventListener("load", () => settle(true));
    photo.addEventListener("error", () => settle(false));
  })();

  /* ---------- 3d tilt ---------- */
  if (!coarse && !reduced) {
    let raf = null;
    let target = { x: 0, y: 0 };
    polaroid.addEventListener("pointermove", (e) => {
      const r = polaroid.getBoundingClientRect();
      target.x = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
      target.y = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        polaroid.style.transform =
          `rotate(-3.5deg) rotateX(${(-target.y * 9).toFixed(2)}deg) rotateY(${(target.x * 11).toFixed(2)}deg) translateZ(10px) scale(1.015)`;
      });
    });
    polaroid.addEventListener("pointerleave", () => {
      polaroid.style.transform = "";
    });
  }

  /* ---------- cursor glow + sparkle trail ---------- */
  if (!coarse && !reduced) {
    let gx = window.innerWidth / 2, gy = window.innerHeight / 2;
    let cx = gx, cy = gy, lastSpark = 0, shown = false, running = false, idleUntil = 0;

    function follow() {
      cx += (gx - cx) * 0.12;
      cy += (gy - cy) * 0.12;
      glow.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      // settled + idle → park the animation frame until the next move
      if (performance.now() > idleUntil && Math.abs(gx - cx) < 0.4 && Math.abs(gy - cy) < 0.4) {
        running = false;
        return;
      }
      requestAnimationFrame(follow);
    }

    addEventListener("pointermove", (e) => {
      gx = e.clientX; gy = e.clientY;
      idleUntil = performance.now() + 700;
      if (!shown) { glow.style.opacity = "1"; shown = true; }
      const now = performance.now();
      if (!light && now - lastSpark > 80) {
        lastSpark = now;
        FX.sparkle(e.clientX, e.clientY);
      }
      if (!running) { running = true; requestAnimationFrame(follow); }
    }, { passive: true });
  }

  /* ---------- cake ---------- */
  function blowCandles() {
    if (cake.classList.contains("blown")) return;
    cake.classList.add("blown");
    AudioKit.chime();
    vibrate([30, 70, 40, 90]);
    const r = cake.getBoundingClientRect();
    FX.confetti(r.left + r.width * 0.16, r.top + r.height * 0.34, {
      count: 55, angle: -Math.PI / 2.7, spread: 0.85, power: 18
    });
    FX.confetti(r.left + r.width * 0.84, r.top + r.height * 0.34, {
      count: 55, angle: -Math.PI + Math.PI / 2.7, spread: 0.85, power: 18
    });
    wishHint.textContent = "that's the one. hold on to it.";
    wishDone.classList.add("in");
    setTimeout(() => {
      FX.firework(window.innerWidth * 0.5, window.innerHeight * 0.34, { count: 90, power: 8 });
      FX.rain(1800);
    }, 420);
  }
  cake.addEventListener("click", blowCandles);

  /* ---------- scroll reveals ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal-up").forEach((el, i) => {
    el.style.transitionDelay = ((i % 4) * 90) + "ms";
    io.observe(el);
  });

  /* ---------- scroll progress ---------- */
  let scrollTick = false;
  addEventListener("scroll", () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      scrollTick = false;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      scrollBar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0).toFixed(2) + "%";
    });
  }, { passive: true });

  /* ---------- stop the world when the tab is in the background ---------- */
  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("tab-hidden", document.hidden);
    if (!document.hidden) FX.resume();
  });

  /* ---------- player ---------- */
  playBtn.addEventListener("click", () => {
    const playing = AudioKit.toggle();
    player.classList.toggle("paused", !playing);
    playBtn.setAttribute("aria-label", playing ? "Pause music" : "Play music");
  });
  songEl.addEventListener("play", () => {
    player.classList.remove("paused");
    playBtn.setAttribute("aria-label", "Pause music");
  });
  songEl.addEventListener("pause", () => {
    player.classList.add("paused");
    playBtn.setAttribute("aria-label", "Play music");
  });

  /* ---------- replay ---------- */
  $("#replayBtn").addEventListener("click", () => {
    intro.token++;
    intro.running = false;
    AudioKit.reset();
    stopBalloons();
    clearInterval(balloonTimer);
    balloonTimer = null;

    player.hidden = true;
    player.classList.remove("paused");
    main.classList.remove("in");
    main.hidden = true;

    reveal.hidden = true;
    reveal.classList.remove("oops", "leaving");
    countdown.hidden = true;
    gate.hidden = false;
    gate.classList.remove("leaving");

    [rvPre, rvName, rvOops, rvCorrect, rvSub].forEach((el) => el.classList.remove("in"));
    cake.classList.remove("blown");
    wishHint.textContent = "Tap the cake when you're ready — I'll handle the confetti.";
    wishDone.classList.remove("in");
    skipBtn.hidden = true;

    window.scrollTo(0, 0);
    document.body.classList.add("locked");
    runIntro();
  });

  /* ---------- keyboard easter eggs ---------- */
  addEventListener("keydown", (e) => {
    if (main.hidden) return;
    if (e.code === "Space") {
      e.preventDefault();
      FX.confetti(rand(window.innerWidth * 0.2, window.innerWidth * 0.8), window.innerHeight * 0.75, {
        count: 45, angle: -Math.PI / 2, spread: 1.6, power: 16
      });
    }
    if (e.key.toLowerCase() === "m") playBtn.click();
    if (e.key.toLowerCase() === "f") FX.celebrate();
  });

  /* ---------- dev: static poses for previews/screenshots ---------- */
  const pose = new URLSearchParams(location.search).get("pose");
  if (pose) {
    gate.hidden = true;
    countdown.hidden = true;
    reveal.hidden = true;
    intro.token++;
    if (pose === "countdown") {
      countdown.hidden = false;
      cdNum.classList.remove("tick");
      cdNum.textContent = "3";
      cdLabel.textContent = "something is happening";
    } else if (pose === "nada" || pose === "oops" || pose === "marwa") {
      reveal.hidden = false;
      rvPre.classList.add("in");
      rvName.classList.add("in");
      if (pose !== "nada") {
        reveal.classList.add("oops");
        rvOops.classList.add("in");
        rvSub.classList.add("in");
        if (pose === "marwa") rvCorrect.classList.add("in");
      }
    } else if (pose === "main") {
      goMain();
    }
  }

  /* ---------- dev: auto-start the intro (no click available in headless) ---------- */
  if (new URLSearchParams(location.search).get("auto") === "1") {
    setTimeout(runIntro, 120);
  }

  /* ---------- deep link / dev skip ---------- */
  if (location.hash === "#main" || location.search.includes("skip=1")) {
    gate.hidden = true;
    countdown.hidden = true;
    reveal.hidden = true;
    intro.token++;
    goMain();
    const target = new URLSearchParams(location.search).get("scroll");
    if (target) setTimeout(() => {
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    }, 800);
  }
})();
