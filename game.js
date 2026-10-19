'use strict';
/* گربه دونده | Cat Runner — بدون وابستگی به کتابخانه یا تصویر */
(() => {
  const $ = id => document.getElementById(id);
  const W = 800, H = 360, GROUND_H = 60, GY = H - GROUND_H;
  const GRAV = 2200, JUMP = 760;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  const fa = n => Math.floor(n).toLocaleString('fa-IR', { useGrouping: false });
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (c1, c2, t) => `rgb(${lerp(c1[0], c2[0], t) | 0},${lerp(c1[1], c2[1], t) | 0},${lerp(c1[2], c2[2], t) | 0})`;

  /* ---------- داده‌ها ---------- */
  const CHARACTERS = [
    { id: 'cat',     name: 'گربه',    emoji: '🐱', price: 0 },
    { id: 'dog',     name: 'سگ',      emoji: '🐶', price: 30 },
    { id: 'rabbit',  name: 'خرگوش',   emoji: '🐰', price: 50 },
    { id: 'fox',     name: 'روباه',   emoji: '🦊', price: 80 },
    { id: 'panda',   name: 'پاندا',   emoji: '🐼', price: 120 },
    { id: 'tiger',   name: 'ببر',     emoji: '🐯', price: 160 },
    { id: 'unicorn', name: 'اسب تک‌شاخ', emoji: '🦄', price: 250 },
  ];
  const DIFFS = {
    easy:   { base: 300, accel: 5, max: 700 },
    normal: { base: 380, accel: 7, max: 850 },
    hard:   { base: 460, accel: 9, max: 1000 },
  };

  /* ---------- ذخیره‌سازی ---------- */
  const DEFAULT_SAVE = { coins: 0, best: 0, owned: ['cat'], selected: 'cat', muted: false, difficulty: 'normal', scores: [] };
  function loadSave() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('catRunnerSave') || '{}') || {}; } catch (e) {}
    const d = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SAVE)), s);
    if (!Array.isArray(d.owned) || !d.owned.includes('cat')) d.owned = ['cat'];
    if (!d.owned.includes(d.selected)) d.selected = 'cat';
    if (!DIFFS[d.difficulty]) d.difficulty = 'normal';
    if (!Array.isArray(d.scores)) d.scores = [];
    return d;
  }
  function persist() { try { localStorage.setItem('catRunnerSave', JSON.stringify(save)); } catch (e) {} }
  const save = loadSave();

  /* ---------- صدا ---------- */
  let actx = null, music = null;
  function ensureAudio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function beep(f, d = 0.1, type = 'square', v = 0.07, slide = 0) {
    if (save.muted || !actx) return;
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + d);
  }
  const sfx = {
    jump:  () => beep(380, 0.15, 'square', 0.06, 300),
    jump2: () => beep(520, 0.15, 'square', 0.06, 300),
    land:  () => beep(120, 0.06, 'triangle', 0.08),
    coin:  () => { beep(880, 0.07, 'square', 0.05); setTimeout(() => beep(1320, 0.1, 'square', 0.05), 60); },
    power: () => { beep(500, 0.1, 'triangle', 0.08, 500); },
    shield:() => beep(200, 0.2, 'sawtooth', 0.08, -100),
    die:   () => beep(300, 0.5, 'sawtooth', 0.1, -250),
    mile:  () => { beep(660, 0.1, 'triangle', 0.08); setTimeout(() => beep(990, 0.15, 'triangle', 0.08), 100); },
    buy:   () => { beep(600, 0.1, 'triangle', 0.08); setTimeout(() => beep(900, 0.15, 'triangle', 0.08), 90); },
    error: () => beep(150, 0.2, 'square', 0.06),
  };
  function startMusic() {
    if (save.muted) return;
    try {
      if (!music) { music = new Audio('background.mp3'); music.loop = true; music.volume = 0.3; }
      const p = music.play(); if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  function stopMusic() { if (music) music.pause(); }

  /* ---------- وضعیت بازی ---------- */
  let state = 'menu'; // menu | playing | paused | over
  let g = null;
  const input = { duck: false };
  const stars = Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(0, GY - 60), r: rand(0.6, 1.8) }));
  const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 180 + rand(0, 80), y: rand(25, 120), s: rand(0.7, 1.4) }));

  function newGame() {
    const d = DIFFS[save.difficulty];
    g = {
      d, t: 0, score: 0, coins: 0, speed: d.base,
      obstacles: [], items: [], particles: [],
      spawnIn: 700, shake: 0, flash: 0,
      shield: false, inv: 0, magnet: 0, milestone: 0, bgx: 0, groundX: 0,
      player: { x: 100, y: GY, vy: 0, jumps: 0, grounded: true, ducking: false, run: 0 },
    };
  }

  function burst(x, y, color, n = 10, spd = 200) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(spd * 0.3, spd);
      g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.3, 0.7), max: 0.7, color, size: rand(2, 5) });
    }
  }
  function dust(x, y) {
    for (let i = 0; i < 6; i++) g.particles.push({ x, y, vx: rand(-80, 40), vy: rand(-60, -10), life: 0.35, max: 0.35, color: '#d7c9a7', size: rand(2, 4) });
  }

  /* ---------- پرش ---------- */
  function jump() {
    if (state !== 'playing') return;
    const p = g.player;
    if (p.jumps >= 2) return;
    p.vy = p.jumps === 0 ? -JUMP : -JUMP * 0.9;
    (p.jumps === 0 ? sfx.jump : sfx.jump2)();
    if (p.jumps === 0) dust(p.x + 20, GY);
    p.jumps++;
    p.grounded = false;
  }

  /* ---------- ساخت مانع و سکه ---------- */
  function spawn() {
    const x = W + 40;
    const birdChance = g.score > 150 ? 0.25 : g.score > 60 ? 0.12 : 0;
    const r = Math.random();
    let o;
    if (r < birdChance) {
      o = { type: 'bird', x, w: 40, h: 28, y: Math.random() < 0.5 ? GY - 58 : GY - 36 };
    } else if (r < birdChance + (1 - birdChance) * 0.6) {
      const h = rand(38, 64), single = rand(22, 32);
      const dbl = g.score > 40 && Math.random() < 0.3;
      o = { type: 'cactus', x, w: dbl ? single * 2 + 6 : single, h, y: GY - h, dbl, single };
    } else {
      o = { type: 'rock', x, w: 40, h: 28, y: GY - 28 };
    }
    g.obstacles.push(o);

    // سکه‌ها به صورت قوس بالای مانع
    if (Math.random() < 0.65) {
      for (let i = 0; i < 5; i++) {
        g.items.push({ type: 'coin', x: x + o.w / 2 - 80 + i * 40, y: GY - 45 - Math.sin((i / 4) * Math.PI) * 75, r: 11 });
      }
    }
    // پاورآپ
    if (Math.random() < 0.09) {
      g.items.push({ type: Math.random() < 0.5 ? 'shield' : 'magnet', x: x + o.w + 90, y: GY - 80, r: 16 });
    }
    g.spawnIn = g.speed * rand(0.95, 1.7);
  }

  /* ---------- برخورد ---------- */
  function playerBox() {
    const p = g.player, h = p.ducking ? 24 : 44;
    return { l: p.x + 8, r: p.x + 36, t: p.y - h + 6, b: p.y - 4 };
  }
  const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

  function die() {
    state = 'over';
    sfx.die();
    stopMusic();
    g.shake = 0.6; g.flash = 0.8;
    const p = g.player;
    burst(p.x + 22, p.y - 22, '#ff5252', 24, 320);
    const finalScore = Math.floor(g.score);
    const isRecord = finalScore > save.best;
    if (isRecord) save.best = finalScore;
    save.coins += g.coins;
    save.scores.push(finalScore);
    save.scores.sort((a, b) => b - a);
    save.scores = save.scores.slice(0, 5);
    persist();
    $('hud').hidden = true;
    setTimeout(() => {
      if (state !== 'over') return;
      $('goScore').textContent = fa(finalScore);
      $('goCoins').textContent = fa(g.coins);
      $('goBest').textContent = fa(save.best);
      $('goRecord').hidden = !isRecord;
      $('goScores').innerHTML = save.scores.map(s => `<li>${fa(s)}</li>`).join('');
      show('gameover');
    }, 650);
  }

  /* ---------- به‌روزرسانی ---------- */
  function updateParticles(dt) {
    for (const q of g.particles) {
      q.life -= dt; q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    }
    g.particles = g.particles.filter(q => q.life > 0);
    g.shake = Math.max(0, g.shake - dt);
    g.flash = Math.max(0, g.flash - dt * 2);
  }

  function update(dt) {
    g.t += dt;
    const progress = 1 - Math.exp(-g.t / 45);
    g.speed = g.d.base + (g.d.max - g.d.base) * progress;
    g.score += (g.speed * dt) / 18;
    g.bgx += g.speed * 0.15 * dt;
    g.groundX = (g.groundX + g.speed * dt) % 40;
    if (g.inv > 0) g.inv -= dt;
    if (g.magnet > 0) g.magnet -= dt;

    // جایزهٔ هر ۱۰۰ امتیاز
    const m = Math.floor(g.score / 100);
    if (m > g.milestone) {
      g.milestone = m; sfx.mile(); g.flash = 0.35;
      const el = $('hudScore'); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    }

    // بازیکن
    const p = g.player;
    p.ducking = input.duck && p.grounded;
    p.vy += GRAV * dt * (input.duck && !p.grounded ? 2.2 : 1);
    p.y += p.vy * dt;
    if (p.y >= GY) {
      if (!p.grounded) { sfx.land(); dust(p.x + 20, GY); }
      p.y = GY; p.vy = 0; p.grounded = true; p.jumps = 0;
    }
    p.run += dt * g.speed / 400;

    // ساخت مانع
    g.spawnIn -= g.speed * dt;
    if (g.spawnIn <= 0) spawn();

    // حرکت
    for (const o of g.obstacles) o.x -= g.speed * dt;
    g.obstacles = g.obstacles.filter(o => o.x + o.w > -60);

    const pb = playerBox();
    const pcx = p.x + 22, pcy = p.y - (p.ducking ? 12 : 22);
    for (const it of g.items) {
      it.x -= g.speed * dt;
      if (it.type === 'coin' && g.magnet > 0) {
        const dx = pcx - it.x, dy = pcy - it.y, dist = Math.hypot(dx, dy);
        if (dist < 240 && dist > 1) { it.x += (dx / dist) * 600 * dt; it.y += (dy / dist) * 600 * dt; }
      }
      if (!it.done && Math.hypot(pcx - it.x, pcy - it.y) < it.r + 22) {
        it.done = true;
        if (it.type === 'coin') {
          const coinMultiplier = { easy: 0.5, normal: 1, hard: 1.5 }[save.difficulty] ?? 1;
          g.coinFraction = (g.coinFraction || 0) + coinMultiplier;
          const earned = Math.floor(g.coinFraction);
          g.coinFraction -= earned;
          g.coins += earned;
          sfx.coin();
          burst(it.x, it.y, '#ffd600', 5, 120);
        }
        else if (it.type === 'shield') { g.shield = true; sfx.power(); burst(it.x, it.y, '#40c4ff', 10); }
        else if (it.type === 'magnet') { g.magnet = 8; sfx.power(); burst(it.x, it.y, '#e040fb', 10); }
      }
    }
    g.items = g.items.filter(it => !it.done && it.x > -40);

    // برخورد با مانع
    if (g.inv <= 0) {
      for (const o of g.obstacles) {
        const ob = { l: o.x + 5, r: o.x + o.w - 5, t: o.y + 5, b: o.y + o.h - 3 };
        if (overlap(pb, ob)) {
          if (g.shield) {
            g.shield = false; g.inv = 1.2; sfx.shield();
            burst(o.x + o.w / 2, o.y + o.h / 2, '#40c4ff', 16, 250);
            g.obstacles = g.obstacles.filter(x => x !== o);
            g.shake = 0.2;
          } else { die(); return; }
          break;
        }
      }
    }
    updateParticles(dt);
    updateHud();
  }

  function updateHud() {
    $('hudScore').textContent = fa(g.score);
    $('hudBest').textContent = fa(Math.max(save.best, g.score));
    $('hudCoins').textContent = fa(g.coins);
    $('hudShield').hidden = !g.shield;
    $('hudMagnet').hidden = g.magnet <= 0;
    if (g.magnet > 0) $('hudMagnetTime').textContent = fa(Math.ceil(g.magnet));
  }

  /* ---------- رسم ---------- */
  const SKY_TOP = [[110, 190, 250], [12, 18, 55]];
  const SKY_BOT = [[210, 240, 255], [48, 58, 105]];

  function nightFactor() {
    if (state === 'menu') return 0;
    return 0.5 - 0.5 * Math.cos(g.score / 70);
  }

  function drawBackground(n) {
    const grad = ctx.createLinearGradient(0, 0, 0, GY);
    grad.addColorStop(0, mix(SKY_TOP[0], SKY_TOP[1], n));
    grad.addColorStop(1, mix(SKY_BOT[0], SKY_BOT[1], n));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ستاره‌ها
    if (n > 0.25) {
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        ctx.globalAlpha = (n - 0.25) * 1.3 * (0.6 + 0.4 * Math.sin(g.t * 3 + s.x));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // خورشید/ماه
    ctx.fillStyle = mix([255, 214, 64], [235, 240, 255], n);
    ctx.beginPath(); ctx.arc(W - 110, 70 + n * 10, 26, 0, 7); ctx.fill();

    // ابرها
    ctx.fillStyle = `rgba(255,255,255,${0.85 - n * 0.55})`;
    for (const c of clouds) {
      const x = ((c.x - g.bgx * 0.3) % (W + 160) + (W + 160)) % (W + 160) - 80;
      ctx.beginPath();
      ctx.arc(x, c.y, 18 * c.s, 0, 7); ctx.arc(x + 20 * c.s, c.y - 8 * c.s, 22 * c.s, 0, 7); ctx.arc(x + 44 * c.s, c.y, 18 * c.s, 0, 7);
      ctx.fill();
    }
    // تپه‌ها (دو لایه)
    const layers = [
      { k: 0.5, amp: 28, base: GY - 45, wave: 130, col: [140, 200, 150], colN: [30, 55, 70] },
      { k: 1.0, amp: 18, base: GY - 18, wave: 90, col: [96, 175, 110], colN: [22, 45, 55] },
    ];
    for (const L of layers) {
      ctx.fillStyle = mix(L.col, L.colN, n);
      ctx.beginPath(); ctx.moveTo(0, GY);
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, L.base - L.amp * Math.sin((x + g.bgx * L.k * 3) / L.wave));
      ctx.lineTo(W, GY); ctx.closePath(); ctx.fill();
    }
    // زمین
    ctx.fillStyle = mix([196, 164, 110], [70, 60, 55], n);
    ctx.fillRect(0, GY, W, GROUND_H);
    ctx.fillStyle = mix([110, 180, 90], [30, 70, 50], n);
    ctx.fillRect(0, GY, W, 6);
    ctx.fillStyle = mix([170, 140, 90], [55, 48, 45], n);
    for (let x = -g.groundX; x < W; x += 40) ctx.fillRect(x, GY + 22, 18, 3);
  }

  function drawObstacle(o) {
    if (o.type === 'cactus') {
      ctx.font = `${o.h * 1.05}px ${EMOJI_FONT}`;
      ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
      if (o.dbl) {
        ctx.fillText('🌵', o.x + o.single / 2, o.y + o.h + 3);
        ctx.fillText('🌵', o.x + o.single * 1.5 + 6, o.y + o.h + 3);
      } else ctx.fillText('🌵', o.x + o.w / 2, o.y + o.h + 3);
    } else if (o.type === 'rock') {
      ctx.fillStyle = '#7d8590';
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + o.h); ctx.lineTo(o.x + 6, o.y + 8); ctx.lineTo(o.x + 18, o.y);
      ctx.lineTo(o.x + 32, o.y + 6); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.beginPath(); ctx.moveTo(o.x + 10, o.y + 10); ctx.lineTo(o.x + 18, o.y + 3); ctx.lineTo(o.x + 24, o.y + 10); ctx.fill();
    } else {
      ctx.save();
      ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
      ctx.scale(-1, 1);
      ctx.translate(0, Math.sin(g.t * 14) * 3);
      ctx.font = `34px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐦', 0, 0);
      ctx.restore();
    }
  }

  function drawItem(it) {
    if (it.type === 'coin') {
      const sx = Math.max(0.25, Math.abs(Math.cos(g.t * 2.5 + it.x * 0.02)));
      ctx.save(); ctx.translate(it.x, it.y); ctx.scale(sx, 1);
      ctx.fillStyle = '#ffd600'; ctx.strokeStyle = '#e6a100'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, it.r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-3, -3, 3.5, 0, 7); ctx.fill();
      ctx.restore();
    } else {
      const bob = Math.sin(g.t * 4) * 4;
      ctx.font = `28px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(it.type === 'shield' ? '🛡️' : '🧲', it.x, it.y + bob);
    }
  }

  function drawPlayer() {
    const p = g.player;
    if (g.inv > 0 && Math.floor(g.t * 15) % 2 === 0) return;
    const air = Math.max(0, (GY - p.y) / 150);
    ctx.fillStyle = `rgba(0,0,0,${0.22 * (1 - Math.min(air, 0.8))})`;
    ctx.beginPath(); ctx.ellipse(p.x + 22, GY + 3, 20 * (1 - air * 0.4), 5, 0, 0, 7); ctx.fill();

    const char = CHARACTERS.find(c => c.id === save.selected) || CHARACTERS[0];
    const bob = p.grounded && state !== 'over' ? -Math.abs(Math.sin(p.run * 10)) * 4 : 0;

    ctx.save();
    ctx.translate(p.x + 22, p.y + bob);
    if (!p.grounded) ctx.rotate(Math.max(-0.3, Math.min(0.4, p.vy / 2500)));
    if (p.ducking) ctx.scale(1.2, 0.62);
    if (char.id === 'unicorn') ctx.scale(-1, 1);
    ctx.font = `44px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(char.emoji, 0, 4);
    ctx.restore();

    if (g.shield) {
      ctx.strokeStyle = `rgba(64,196,255,${0.6 + 0.3 * Math.sin(g.t * 8)})`;
      ctx.fillStyle = 'rgba(64,196,255,.18)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x + 22, p.y - 22, 32, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  function render() {
    const n = nightFactor();
    ctx.save();
    if (g.shake > 0) ctx.translate(rand(-1, 1) * g.shake * 14, rand(-1, 1) * g.shake * 14);
    drawBackground(n);
    g.items.forEach(drawItem);
    g.obstacles.forEach(drawObstacle);
    drawPlayer();
    for (const q of g.particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x, q.y, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  }

  /* ---------- حلقهٔ اصلی ---------- */
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    if (state === 'playing') update(dt);
    else if (state === 'over') updateParticles(dt);
    else if (state === 'menu') { g.t += dt; g.bgx += 25 * dt; g.groundX = (g.groundX + 120 * dt) % 40; g.player.run += dt; }
    render();
    requestAnimationFrame(frame);
  }

  /* ---------- صفحه‌ها ---------- */
  function show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === name));
  }
  function refreshMenu() {
    document.querySelectorAll('[data-bind="best"]').forEach(e => e.textContent = fa(save.best));
    document.querySelectorAll('[data-bind="coins"]').forEach(e => e.textContent = fa(save.coins));
    $('difficulty').value = save.difficulty;
    document.querySelectorAll('[data-action="mute"]').forEach(b => {
      b.textContent = (save.muted ? '🔇' : '🔊') + (b.id === 'menuMute' ? ' صدا' : '');
    });
  }
  function renderShop() {
    const cur = CHARACTERS.find(c => c.id === save.selected);
    $('shopCoins').textContent = fa(save.coins);
    $('selectedCharacterName').textContent = cur.name;
    $('selectedCharacterPreview').textContent = cur.emoji;
    const box = $('shopCharacters');
    box.innerHTML = '';
    CHARACTERS.forEach(c => {
      const owned = save.owned.includes(c.id);
      const b = document.createElement('button');
      b.className = 'card' + (c.id === save.selected ? ' selected' : '');
      b.dataset.action = 'shopItem';
      b.dataset.id = c.id;
      const label = owned ? (c.id === save.selected ? '✔ انتخاب‌شده' : 'انتخاب') : '🪙 ' + fa(c.price);
      b.innerHTML = `<span class="emoji">${c.emoji}</span><span>${c.name}</span><small>${label}</small>`;
      box.appendChild(b);
    });
  }

  function backToMenu() {
    state = 'menu'; stopMusic(); newGame();
    $('hud').hidden = true;
    refreshMenu(); show('menu');
  }
  function startGame() {
    ensureAudio();
    if (document.activeElement) document.activeElement.blur();
    newGame();
    state = 'playing';
    show(null);
    $('hud').hidden = false;
    updateHud();
    startMusic();
  }
  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused'; stopMusic(); show('pause');
  }
  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing'; show(null); startMusic();
  }
  function toggleMute() {
    ensureAudio();
    save.muted = !save.muted;
    persist(); refreshMenu();
    if (save.muted) stopMusic(); else if (state === 'playing') startMusic();
  }
  function shopItem(id) {
    const c = CHARACTERS.find(x => x.id === id);
    if (!c) return;
    const msg = $('shopMsg');
    ensureAudio();
    if (save.owned.includes(id)) {
      save.selected = id; msg.textContent = `${c.name} انتخاب شد.`;
    } else if (save.coins >= c.price) {
      save.coins -= c.price; save.owned.push(id); save.selected = id; sfx.buy();
      msg.textContent = `${c.name} خریداری شد! 🎉`;
    } else {
      sfx.error(); msg.textContent = `سکه کافی نیست! ${fa(c.price - save.coins)} سکهٔ دیگر لازم است.`;
      return;
    }
    persist(); renderShop();
  }

  const actions = {
    start: startGame,
    menu: backToMenu,
    tutorial: () => show('tutorial'),
    shop: () => { $('shopMsg').innerHTML = '&nbsp;'; renderShop(); show('shop'); },
    pause: pauseGame,
    resume: resumeGame,
    mute: toggleMute,
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'shopItem') return shopItem(b.dataset.id);
    const fn = actions[b.dataset.action];
    if (fn) fn();
  });

  $('difficulty').addEventListener('change', e => { save.difficulty = e.target.value; persist(); });

  /* ---------- ورودی‌ها ---------- */
  document.addEventListener('keydown', e => {
    switch (e.code) {
      case 'Space': case 'ArrowUp': case 'KeyW':
        if (state === 'playing') { e.preventDefault(); if (!e.repeat) { ensureAudio(); jump(); } }
        break;
      case 'ArrowDown': case 'KeyS':
        if (state === 'playing') { e.preventDefault(); input.duck = true; }
        break;
      case 'KeyP': case 'Escape':
        if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame();
        break;
      case 'KeyM': toggleMute(); break;
    }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') input.duck = false;
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code) && g && state === 'playing' && g.player.vy < -250) g.player.vy *= 0.55; // پرش کوتاه
  });

  // لمس/کلیک روی صفحه = پرش
  document.addEventListener('pointerdown', e => {
    if (state !== 'playing' || e.target.closest('button')) return;
    ensureAudio(); jump();
  });
  $('jumpBtn').addEventListener('pointerdown', e => { e.preventDefault(); ensureAudio(); jump(); });
  const duckOn = e => { e.preventDefault(); input.duck = true; };
  const duckOff = () => { input.duck = false; };
  const duckBtn = $('duckBtn');
  duckBtn.addEventListener('pointerdown', duckOn);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => duckBtn.addEventListener(ev, duckOff));
  window.addEventListener('blur', () => { input.duck = false; pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  /* ---------- شروع ---------- */
  newGame();
  refreshMenu();
  requestAnimationFrame(frame);
})();
