'use strict';
/* گربه دونده | Cat Runner — بدون وابستگی به کتابخانه یا تصویر */
(() => {
  const $ = id => document.getElementById(id);
  const W = 800, H = 360, GROUND_H = 60, GY = H - GROUND_H;
  const GRAV = 2200, JUMP = 760;
  const VERSION = '2.1.0 Beta';
  const VERSION_FA = 'نسخه ۲.۱.۰ بتا';
  const POWER_DUR = { magnet: 8, x2: 10, boost: 5 };
  const BOOST_MUL = 1.6;
  const POWER_ICONS = { shield: '🛡️', magnet: '🧲', x2: '✨', boost: '🚀', revive: '💖' };
  const POWER_COLORS = { shield: '#40c4ff', magnet: '#e040fb', x2: '#ffd600', boost: '#ff7043', revive: '#ff4081' };
  const POWER_WEIGHTS = [['shield', 3], ['magnet', 3], ['x2', 2], ['boost', 2], ['revive', 1]];
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  function resizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  resizeCanvas();

  const fa = n => Math.floor(n).toLocaleString('fa-IR', { useGrouping: false });
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (c1, c2, t) => `rgb(${lerp(c1[0], c2[0], t) | 0},${lerp(c1[1], c2[1], t) | 0},${lerp(c1[2], c2[2], t) | 0})`;

  /* ---------- داده‌ها ---------- */
  // perk: اثر واقعی روی بازی (فقط برای شخصیت انتخاب‌شده)؛ meters: نمایش ۶ ویژگی (۱ تا ۵، ۳ = پایه)
  const RARITY = { common: 'معمولی', rare: 'کمیاب', epic: 'حماسی', legendary: 'افسانه‌ای' };
  const METER_LABELS = ['پرش', 'سکه', 'شانس', 'دوام', 'امتیاز', 'قدرت'];
  const CHARACTERS = [
    { id: 'cat',     name: 'گربه',    emoji: '🐱', price: 0,   rarity: 'common',    desc: 'قهرمان اصلی؛ چابک و قابل اعتماد.',        perkText: 'بدون ویژگی ویژه — متعادل',            perk: {},                 meters: [3, 3, 3, 3, 3, 3] },
    { id: 'dog',     name: 'سگ',      emoji: '🐶', price: 30,  rarity: 'common',    desc: 'با بوی سکه‌ها را از دور پیدا می‌کند.',     perkText: 'شعاع جمع‌کردن سکه +۱۰',               perk: { coinRange: 10 },  meters: [3, 5, 3, 3, 3, 3] },
    { id: 'rabbit',  name: 'خرگوش',   emoji: '🐰', price: 50,  rarity: 'rare',      desc: 'جهش‌های بلند و سبک.',                      perkText: 'پرش بلندتر (+۶٪)',                    perk: { jump: 1.06 },     meters: [5, 3, 3, 3, 3, 3] },
    { id: 'fox',     name: 'روباه',   emoji: '🦊', price: 80,  rarity: 'rare',      desc: 'زرنگ است و قدرت‌ها را زودتر پیدا می‌کند.', perkText: 'شانس ظاهر شدن قدرت‌ها +۳۰٪',          perk: { luck: 1.3 },      meters: [3, 3, 5, 3, 3, 3] },
    { id: 'panda',   name: 'پاندا',   emoji: '🐼', price: 120, rarity: 'epic',      desc: 'سخت‌جان و آرام.',                          perkText: 'مصونیت ۲ ثانیه‌ای پس از شکستن سپر',    perk: { hitInv: 2.0 },    meters: [3, 3, 3, 5, 3, 3] },
    { id: 'tiger',   name: 'ببر',     emoji: '🐯', price: 160, rarity: 'epic',      desc: 'سریع و پرانرژی؛ امتیاز بیشتر می‌گیرد.',    perkText: 'امتیاز +۸٪',                          perk: { score: 1.08 },    meters: [3, 3, 3, 3, 5, 3] },
    { id: 'unicorn', name: 'اسب تک‌شاخ', emoji: '🦄', price: 250, rarity: 'legendary', desc: 'جادویی؛ قدرت‌ها در دستانش بیشتر می‌ماند.',  perkText: 'مدت قدرت‌ها +۲۵٪',                    perk: { dur: 1.25 },      meters: [3, 3, 3, 3, 3, 5] },
  ];
  // base/accel/max: سرعت. gapMul/minGap: فاصلهٔ زمانی موانع (ثانیه). enemyMul: احتمال دشمن. phaseScale: زودتر/دیرتر رسیدن مراحل.
  // comboMul: ترکیب‌های فشرده. warnMul: مدت هشدار پیش از حملهٔ دشمن.
  const DIFFS = {
    easy:   { base: 300, accel: 5, max: 700,  gapMul: 1.2, minGap: 1.0,  enemyMul: 0.6, phaseScale: 1.35, comboMul: 0,   warnMul: 1.3 },
    normal: { base: 380, accel: 7, max: 850,  gapMul: 1.0, minGap: 0.88, enemyMul: 1.0, phaseScale: 1.0,  comboMul: 1,   warnMul: 1.0 },
    hard:   { base: 460, accel: 9, max: 1000, gapMul: 0.9, minGap: 0.8,  enemyMul: 1.3, phaseScale: 0.7,  comboMul: 1.5, warnMul: 0.8 },
  };

  // دشمن‌ها: vx = سرعت اضافه نسبت به زمین (بعد از هشدار). lane: ground = باید پرید، air = باید خم شد (یا پرید)
  const ENEMIES = {
    hedgehog: { icon: '🦔', size: 34, w: 34, h: 26, vx: 90,  warn: 0.55, lane: 'ground', name: 'خارپشت' },
    bat:      { icon: '🦇', size: 36, w: 36, h: 24, vx: 30,  warn: 0.65, lane: 'air',    name: 'خفاش' },
    boar:     { icon: '🐗', size: 44, w: 46, h: 34, vx: 300, warn: 0.95, lane: 'ground', name: 'گراز' },
    ghost:    { icon: '👻', size: 38, w: 34, h: 34, vx: 20,  warn: 0.7,  lane: 'air',    name: 'روح' },
  };
  // مراحل (بر اساس امتیاز). intro = دشمنی که اولین بار در همین مرحله معرفی می‌شود.
  const PHASES = [
    { name: 'دشت آرام',    icon: '🌿', from: 0,    enemy: 0,    combo: 0,    gap: [1.05, 1.8],  pool: [],                                    intro: null },
    { name: 'جادهٔ پرخطر', icon: '🦔', from: 250,  enemy: 0.22, combo: 0.12, gap: [1.0, 1.7],   pool: ['hedgehog'],                          intro: 'hedgehog' },
    { name: 'آسمان شلوغ',  icon: '🦇', from: 600,  enemy: 0.32, combo: 0.2,  gap: [0.95, 1.55], pool: ['hedgehog', 'bat'],                   intro: 'bat' },
    { name: 'شب وحشت',     icon: '🐗', from: 1000, enemy: 0.42, combo: 0.28, gap: [0.92, 1.45], pool: ['hedgehog', 'bat', 'boar'],           intro: 'boar' },
    { name: 'طوفان',       icon: '👻', from: 1500, enemy: 0.5,  combo: 0.35, gap: [0.9, 1.35],  pool: ['hedgehog', 'bat', 'boar', 'ghost'],  intro: 'ghost' },
  ];

  // مأموریت‌ها: stat = کلید آمار تجمعی (یا best = بهترین امتیاز، bestPhase = بهترین مرحله)
  const MISSIONS = [
    { id: 'coins50',   icon: '🪙', title: 'جمع‌آوری ۵۰ سکه',               stat: 'coins',       target: 50,   reward: 15 },
    { id: 'coins300',  icon: '💰', title: 'جمع‌آوری ۳۰۰ سکه',              stat: 'coins',       target: 300,  reward: 60 },
    { id: 'pass30',    icon: '🌵', title: 'عبور از ۳۰ مانع',               stat: 'passed',      target: 30,   reward: 15 },
    { id: 'pass200',   icon: '🏃', title: 'عبور از ۲۰۰ مانع',              stat: 'passed',      target: 200,  reward: 60 },
    { id: 'score200',  icon: '⭐', title: 'رسیدن به امتیاز ۲۰۰',            stat: 'best',        target: 200,  reward: 20 },
    { id: 'score600',  icon: '🌟', title: 'رسیدن به امتیاز ۶۰۰',            stat: 'best',        target: 600,  reward: 60 },
    { id: 'score1500', icon: '🏆', title: 'رسیدن به امتیاز ۱۵۰۰',           stat: 'best',        target: 1500, reward: 150 },
    { id: 'power10',   icon: '⚡', title: 'جمع‌آوری ۱۰ قدرت ویژه',          stat: 'powers',      target: 10,   reward: 25 },
    { id: 'double50',  icon: '🦘', title: '۵۰ بار پرش دوتایی',              stat: 'doubleJumps', target: 50,   reward: 15 },
    { id: 'smash10',   icon: '🚀', title: 'له کردن ۱۰ مانع با سرعت‌دهنده',  stat: 'smashed',     target: 10,   reward: 40 },
    { id: 'runs10',    icon: '🎮', title: 'انجام ۱۰ بازی',                  stat: 'runs',        target: 10,   reward: 20 },
    { id: 'revive1',   icon: '💖', title: 'استفاده از نجات یک‌باره',         stat: 'revives',     target: 1,    reward: 20 },
    { id: 'phase3',    icon: '🦇', title: 'رسیدن به مرحلهٔ ۳',               stat: 'bestPhase',   target: 3,    reward: 40 },
    { id: 'phase5',    icon: '⚡', title: 'رسیدن به مرحلهٔ ۵',               stat: 'bestPhase',   target: 5,    reward: 120 },
    { id: 'enemy25',   icon: '🐗', title: 'عبور از ۲۵ دشمن',                 stat: 'enemies',     target: 25,   reward: 40 },
  ];

  // دستاوردها: به‌صورت خودکار باز می‌شوند (بدون جایزهٔ سکه)
  const ACHIEVEMENTS = [
    { id: 'first',     icon: '🐾', title: 'اولین دو',      desc: 'یک بازی را تمام کن',              test: () => save.stats.runs >= 1 },
    { id: 'night',     icon: '🌙', title: 'شب‌پرواز',      desc: 'تا دل شب بدو',                    test: () => save.stats.nights > 0 || g.run.nights > 0 },
    { id: 'rich',      icon: '💎', title: 'ثروتمند',       desc: 'در مجموع ۵۰۰ سکه جمع کن',         test: () => save.stats.coins + (g.committed ? 0 : g.run.coins) >= 500 },
    { id: 'tough',     icon: '🛡️', title: 'جان‌سخت',       desc: 'از نجات یک‌باره استفاده کن',       test: () => save.stats.revives > 0 || g.run.revives > 0 },
    { id: 'smasher',   icon: '💥', title: 'بولدوزر',       desc: '۳ مانع را در یک بازی له کن',       test: () => g.run.smashed >= 3 },
    { id: 'allpower',  icon: '🎁', title: 'همه‌فن‌حریف',   desc: 'هر ۵ قدرت را در یک بازی بگیر',     test: () => g.run.types.size >= 5 },
    { id: 'hard800',   icon: '🔥', title: 'بی‌باک',        desc: 'در سطح سخت به ۸۰۰ برس',           test: () => g.d === DIFFS.hard && g.score >= 800 },
    { id: 'marathon',  icon: '🏅', title: 'ماراتن',        desc: 'به امتیاز ۱۵۰۰ برس',              test: () => Math.max(save.best, g.score) >= 1500 },
    { id: 'collector', icon: '🐱', title: 'کلکسیونر',      desc: 'همهٔ شخصیت‌ها را بخر',            test: () => save.owned.length >= CHARACTERS.length },
    { id: 'hunter',    icon: '🦔', title: 'شکارچی',        desc: '۱۰ دشمن را در یک بازی رد کن',     test: () => g.run.enemies >= 10 },
    { id: 'storm',     icon: '⚡', title: 'طوفان‌دیده',     desc: 'به مرحلهٔ ۵ برس',               test: () => save.stats.bestPhase >= 5 || g.phase >= 4 },
  ];

  /* ---------- ذخیره‌سازی ---------- */
  // کلید ذخیره همان نسخهٔ ۱ است؛ فیلدهای قدیمی حفظ و فیلدهای جدید با مقدار پیش‌فرض اضافه می‌شوند.
  const SAVE_KEY = 'catRunnerSave';
  const STAT_KEYS = ['coins', 'passed', 'powers', 'doubleJumps', 'smashed', 'revives', 'nights', 'runs', 'enemies', 'bestPhase'];
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clampInt = (v, def, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : def);
  const clamp01 = (v, def) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : def);
  const bool = (v, def) => (typeof v === 'boolean' ? v : def);

  function defaultSave() {
    const stats = {};
    STAT_KEYS.forEach(k => { stats[k] = 0; });
    return {
      ver: 3, coins: 0, best: 0, owned: ['cat'], selected: 'cat', difficulty: 'normal', scores: [],
      muted: false, music: true, sfx: true, musicVol: 0.6, sfxVol: 0.8, vibrate: true,
      stats, claimed: {}, achievements: {},
    };
  }

  // هر ورودی (حافظهٔ مرورگر یا فایل واردشده) از این تابع می‌گذرد و به شکل امن و معتبر در می‌آید.
  function normalizeSave(raw) {
    const d = defaultSave();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
    d.coins = clampInt(raw.coins, 0);
    d.best = clampInt(raw.best, 0);
    const known = new Set(CHARACTERS.map(c => c.id));
    const owned = Array.isArray(raw.owned) ? raw.owned.filter(id => typeof id === 'string' && known.has(id)) : [];
    d.owned = Array.from(new Set(['cat', ...owned]));
    d.selected = d.owned.includes(raw.selected) ? raw.selected : 'cat';
    d.difficulty = typeof raw.difficulty === 'string' && has(DIFFS, raw.difficulty) ? raw.difficulty : 'normal';
    d.scores = Array.isArray(raw.scores)
      ? raw.scores.filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)
        .map(v => clampInt(v, 0)).sort((a, b) => b - a).slice(0, 5) : [];
    d.muted = bool(raw.muted, false);
    d.music = bool(raw.music, true);
    d.sfx = bool(raw.sfx, true);
    d.vibrate = bool(raw.vibrate, true);
    d.musicVol = clamp01(raw.musicVol, 0.6);
    d.sfxVol = clamp01(raw.sfxVol, 0.8);
    const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    STAT_KEYS.forEach(k => { d.stats[k] = clampInt(st[k], 0); });
    const cl = raw.claimed && typeof raw.claimed === 'object' ? raw.claimed : {};
    MISSIONS.forEach(m => { if (cl[m.id] === true) d.claimed[m.id] = true; });
    const ac = raw.achievements && typeof raw.achievements === 'object' ? raw.achievements : {};
    ACHIEVEMENTS.forEach(a => { if (ac[a.id] === true) d.achievements[a.id] = true; });
    return d;
  }

  function loadSave() {
    let text = null, raw = null;
    try { text = localStorage.getItem(SAVE_KEY); raw = JSON.parse(text || '{}'); } catch (e) { raw = null; }
    // پیش از اولین ذخیرهٔ نسخهٔ ۳، از ذخیرهٔ قبلی (۱ یا ۲) یک نسخهٔ پشتیبان نگه می‌داریم.
    try {
      if (text && raw && raw.ver !== 3) {
        const key = SAVE_KEY + (raw.ver === 2 ? '_v2_backup' : '_v1_backup');
        if (!localStorage.getItem(key)) localStorage.setItem(key, text);
      }
    } catch (e) {}
    return normalizeSave(raw);
  }
  function persist() { try { save.ver = 3; localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  const save = loadSave();

  function replaceSave(clean) {
    Object.keys(save).forEach(k => { delete save[k]; });
    Object.assign(save, clean);
  }

  // چک‌سام ساده (FNV-1a) فقط برای تشخیص فایل خراب؛ ضد تقلب نیست.
  function checksum(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  function serializeSave() {
    const data = JSON.parse(JSON.stringify(save));
    return JSON.stringify({ app: 'cat-runner', version: 3, gameVersion: VERSION, exported: new Date().toISOString(), sum: checksum(JSON.stringify(data)), data }, null, 2);
  }
  const MAX_IMPORT_BYTES = 200000;
  function parseImport(text) {
    if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES) return { error: 'حجم فایل نامعتبر است.' };
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { error: 'فایل JSON معتبر نیست.' }; }
    if (!obj || typeof obj !== 'object' || obj.app !== 'cat-runner') return { error: 'این فایل مربوط به Cat Runner نیست.' };
    if (!Number.isInteger(obj.version) || obj.version < 1 || obj.version > 3) return { error: 'نسخهٔ فایل پشتیبانی نمی‌شود.' };
    const d = obj.data;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { error: 'داده‌های ذخیره در فایل پیدا نشد.' };
    if (obj.sum !== undefined && obj.sum !== checksum(JSON.stringify(d))) return { error: 'فایل خراب یا ویرایش‌شده است.' };
    for (const k of ['coins', 'best']) {
      if (typeof d[k] !== 'number' || !Number.isFinite(d[k]) || d[k] < 0 || d[k] > 1e9) return { error: `مقدار «${k}» نامعتبر است.` };
    }
    if (!Array.isArray(d.owned) || d.owned.length > 50) return { error: 'فهرست شخصیت‌ها نامعتبر است.' };
    if (!d.owned.every(id => typeof id === 'string' && CHARACTERS.some(c => c.id === id))) return { error: 'شخصیت ناشناخته در فایل وجود دارد.' };
    if (d.difficulty !== undefined && !(typeof d.difficulty === 'string' && has(DIFFS, d.difficulty))) return { error: 'درجه سختی نامعتبر است.' };
    if (d.scores !== undefined && (!Array.isArray(d.scores) || d.scores.length > 50)) return { error: 'فهرست امتیازها نامعتبر است.' };
    return { data: normalizeSave(d) };
  }

  /* ---------- صدا ---------- */
  let actx = null, music = null;
  const sfxOn = () => !save.muted && save.sfx && save.sfxVol > 0.01;
  const musicOn = () => !save.muted && save.music && save.musicVol > 0.01;
  function ensureAudio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function beep(f, d = 0.1, type = 'square', v = 0.07, slide = 0) {
    if (!actx || !sfxOn()) return;
    const t = actx.currentTime, o = actx.createOscillator(), gn = actx.createGain();
    const vol = Math.max(0.002, v * save.sfxVol * 1.25);
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(gn); gn.connect(actx.destination);
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
    boost: () => { beep(300, 0.35, 'sawtooth', 0.07, 900); },
    warn:  () => { beep(220, 0.12, 'square', 0.05); setTimeout(() => beep(220, 0.12, 'square', 0.05), 150); },
    phase: () => { [392, 523, 659].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'triangle', 0.08), i * 110)); },
    tick:  () => beep(740, 0.04, 'triangle', 0.05),
    smash: () => beep(180, 0.12, 'sawtooth', 0.08, -90),
    revive:() => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'triangle', 0.08), i * 80)); },
    mission:() => { beep(784, 0.1, 'triangle', 0.07); setTimeout(() => beep(1175, 0.18, 'triangle', 0.07), 110); },
  };
  function vibrate(pattern) {
    if (save.vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
  }
  function startMusic() {
    if (!musicOn()) return;
    try {
      if (!music) { music = new Audio('background.mp3'); music.loop = true; }
      music.volume = save.musicVol * 0.5;
      const p = music.play(); if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  function stopMusic() { if (music) music.pause(); }
  // موسیقی و افکت‌ها جدا از هم قابل تنظیم‌اند؛ muted همان قطع کلی (کلید M) است.
  function applyAudio() {
    if (music) music.volume = save.musicVol * 0.5;
    if (!musicOn()) stopMusic(); else if (state === 'playing') startMusic();
  }

  /* ---------- وضعیت بازی ---------- */
  let state = 'menu'; // menu | playing | paused | over
  let g = null;
  const input = { duck: false };
  const stars = Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(0, GY - 60), r: rand(0.6, 1.8) }));
  const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 180 + rand(0, 80), y: rand(25, 120), s: rand(0.7, 1.4) }));

  const currentChar = () => CHARACTERS.find(c => c.id === save.selected) || CHARACTERS[0];

  function newGame() {
    const d = DIFFS[save.difficulty];
    const perk = currentChar().perk || {};
    g = {
      d, perk, durMul: perk.dur || 1, t: 0, score: 0, coins: 0, speed: d.base,
      obstacles: [], items: [], particles: [],
      spawnIn: 700, shake: 0, flash: 0,
      shield: false, inv: 0, magnet: 0, x2: 0, boost: 0, boostMul: 1, revive: false,
      phase: 0, intro: null, tight: 0, lastLane: 'air',
      milestone: 0, bgx: 0, groundX: 0, checkIn: 0.5,
      started: false, committed: false, result: null,
      run: { coins: 0, passed: 0, powers: 0, doubleJumps: 0, smashed: 0, revives: 0, nights: 0, enemies: 0, types: new Set() },
      player: { x: 100, y: GY, vy: 0, jumps: 0, grounded: true, ducking: false, run: 0 },
    };
  }

  function burst(x, y, color, n = 10, spd = 200) {
    if (g.particles.length > 400) return;
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
    p.vy = (p.jumps === 0 ? -JUMP : -JUMP * 0.9) * (g.perk.jump || 1);
    (p.jumps === 0 ? sfx.jump : sfx.jump2)();
    if (p.jumps === 0) dust(p.x + 20, GY);
    if (p.jumps === 1) g.run.doubleJumps++;
    p.jumps++;
    p.grounded = false;
  }

  /* ---------- ساخت مانع و سکه ---------- */
  function pickPower() {
    const pool = POWER_WEIGHTS.filter(([t]) => !(t === 'revive' && g.revive));
    let r = Math.random() * pool.reduce((a, [, w]) => a + w, 0);
    for (const [t, w] of pool) { if ((r -= w) < 0) return t; }
    return pool[0][0];
  }

  /* ---------- مراحل و دشمن‌ها ---------- */
  function phaseFor(score, d) {
    let idx = 0;
    for (let i = 1; i < PHASES.length; i++) if (score >= PHASES[i].from * d.phaseScale) idx = i;
    return idx;
  }
  function countEnemies() {
    let n = 0;
    for (const o of g.obstacles) if (o.enemy && !o.dead) n++;
    return n;
  }

  // زمان رسیدن مرکز خطر به بازیکن (شامل مدت هشدار و سرعت نهایی دشمن)
  function arrivalTime(o, sp) {
    return (o.warn || 0) + Math.max(0, o.x + o.w / 2 - g.player.x) / (sp + (o.vxf || 0));
  }
  // قانون انصاف: فاصلهٔ زمانی رسیدن هر دو خطر باید حداقل minGap باشد تا همیشه زمان واکنش/فرود هست.
  function arrivalGapOk(u, sp) {
    const tu = arrivalTime(u, sp);
    for (const o of g.obstacles) {
      if (o.dead || o.x + o.w < g.player.x) continue;
      if (Math.abs(arrivalTime(o, sp) - tu) < g.d.minGap) return false;
    }
    return true;
  }

  function makeGround(x) {
    if (Math.random() < 0.6) {
      const h = rand(38, 64), single = rand(22, 32);
      const dbl = g.score > 40 && Math.random() < 0.3;
      return { type: 'cactus', lane: 'ground', x, w: dbl ? single * 2 + 6 : single, h, y: GY - h, dbl, single };
    }
    return { type: 'rock', lane: 'ground', x, w: 40, h: 28, y: GY - 28 };
  }
  function makeBird(x, high) {
    return { type: 'bird', lane: high ? 'air' : 'ground', x, w: 40, h: 28, y: high ? GY - 58 : GY - 36 };
  }
  function makeEnemy(kind, intro) {
    const def = ENEMIES[kind];
    const warn = def.warn * g.d.warnMul * (intro ? 1.4 : 1);
    const o = { type: kind, kind, enemy: true, intro: !!intro, lane: def.lane, x: W + 60, w: def.w, h: def.h, y: GY - def.h,
      vx: 0, vxf: def.vx, warn, maxWarn: warn, t: 0, noHit: false };
    if (kind === 'bat') {
      o.cy = GY - rand(60, 90); o.amp = 20; o.freq = rand(2.6, 3.4); o.phase = rand(0, 6.28);
      o.y = o.cy - o.h / 2;
    } else if (kind === 'ghost') {
      o.y = GY - 61; // مرکز ≈ GY-44: ایستاده گیر می‌کند، خم‌شده رد می‌شود
    }
    return o;
  }

  // انتخاب واحد بعدی: معرفی دشمن جدید › ترکیب فشرده (تغییر زمینی/هوایی) › دشمن › مانع معمولی
  function pickUnit(x) {
    const ph = PHASES[g.phase], d = g.d;
    if (g.intro && countEnemies() < 2) { const k = g.intro; g.intro = null; return makeEnemy(k, true); }
    const want = g.tight > 0 ? (g.lastLane === 'ground' ? 'air' : 'ground') : null;
    if (ph.pool.length && countEnemies() < 2) {
      const start = ph.from * d.phaseScale;
      const next = PHASES[g.phase + 1] ? PHASES[g.phase + 1].from * d.phaseScale : start + 800;
      const ramp = 0.7 + 0.3 * Math.min(1, Math.max(0, (g.score - start) / (next - start)));
      if (Math.random() < ph.enemy * d.enemyMul * ramp) {
        const kinds = ph.pool.filter(k => !want || ENEMIES[k].lane === want);
        if (kinds.length) return makeEnemy(kinds[(Math.random() * kinds.length) | 0], false);
      }
    }
    if (want === 'air') return makeBird(x, true);
    if (want === 'ground') return makeGround(x);
    const birdChance = g.score > 150 ? 0.25 : g.score > 60 ? 0.12 : 0;
    if (Math.random() < birdChance) return makeBird(x, Math.random() < 0.5);
    return makeGround(x);
  }

  function spawn() {
    const x = W + 40;
    const sp = g.speed * g.boostMul;
    const ph = PHASES[g.phase], d = g.d;
    if (g.obstacles.length >= 8) { g.spawnIn = sp * 0.2; return; }
    const o = pickUnit(x);
    if (!arrivalGapOk(o, sp)) { // ترکیب ناعادلانه: کمی صبر می‌کنیم
      if (o.intro) g.intro = o.kind;
      g.spawnIn = sp * 0.05;
      return;
    }
    g.obstacles.push(o);
    g.lastLane = o.lane;
    if (o.enemy) sfx.warn();
    if (g.tight > 0) g.tight--;
    else if (Math.random() < ph.combo * d.comboMul) g.tight = Math.random() < 0.35 ? 2 : 1;

    // سکه‌ها به صورت قوس بالای مانع ثابت
    if (!o.enemy && Math.random() < 0.65) {
      for (let i = 0; i < 5; i++) {
        g.items.push({ type: 'coin', x: x + o.w / 2 - 80 + i * 40, y: GY - 45 - Math.sin((i / 4) * Math.PI) * 75, r: 11 });
      }
    }
    // پاورآپ
    if (Math.random() < 0.12 * (g.perk.luck || 1)) {
      g.items.push({ type: pickPower(), x: x + (o.w || 40) + 90, y: GY - 80, r: 16 });
    }
    const gapT = g.tight > 0 ? d.minGap + 0.06 : Math.max(d.minGap + 0.04, rand(ph.gap[0], ph.gap[1]) * d.gapMul);
    g.spawnIn = sp * gapT;
  }

  function updateEnemy(o, dt, sp) {
    o.t += dt;
    if (o.warn > 0) { // هشدار: ثابت در لبهٔ بیرون صفحه، بدون برخورد
      o.warn -= dt;
      if (o.warn <= 0) { o.warn = 0; o.vx = o.vxf; }
      return;
    }
    o.x -= (sp + o.vx) * dt;
    if (o.kind === 'bat') {
      o.y = o.cy + Math.sin(o.t * o.freq + o.phase) * o.amp - o.h / 2;
    } else if (o.kind === 'ghost') {
      const c = (o.t % 1.6) / 1.6;
      o.noHit = c >= 0.55 && c < 0.95; // فاز کم‌رنگ = قابل عبور
    } else if (o.kind === 'boar' && g.particles.length < 400 && Math.random() < 0.6) {
      g.particles.push({ x: o.x + o.w, y: GY - 2, vx: rand(40, 120), vy: rand(-50, -10), life: 0.3, max: 0.3, color: '#d7c9a7', size: rand(2, 4) });
    }
  }
  const hittable = o => !o.dead && !(o.warn > 0) && !o.noHit;

  /* ---------- برخورد ---------- */
  function playerBox() {
    const p = g.player, h = p.ducking ? 24 : 44;
    return { l: p.x + 8, r: p.x + 36, t: p.y - h + 6, b: p.y - 4 };
  }
  const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

  // ذخیرهٔ نتیجهٔ دور (امتیاز، سکه، آمار مأموریت‌ها). فقط یک بار برای هر دور اجرا می‌شود.
  function commitRun() {
    if (!g || !g.started || g.committed) return g && g.result ? g.result : { score: 0, isRecord: false };
    g.committed = true;
    const score = Math.floor(g.score);
    const isRecord = score > save.best;
    if (isRecord) save.best = score;
    save.coins = Math.min(1e9, save.coins + g.coins);
    STAT_KEYS.forEach(k => { save.stats[k] = Math.min(1e9, save.stats[k] + (g.run[k] || 0)); });
    save.stats.runs = Math.min(1e9, save.stats.runs + 1);
    save.stats.bestPhase = Math.max(save.stats.bestPhase, g.phase + 1);
    if (score > 0) {
      save.scores.push(score);
      save.scores.sort((a, b) => b - a);
      save.scores = save.scores.slice(0, 5);
    }
    persist();
    g.result = { score, isRecord };
    return g.result;
  }

  function die() {
    state = 'over';
    sfx.die(); vibrate([60, 40, 120]);
    stopMusic();
    g.shake = 0.6; g.flash = 0.8;
    const p = g.player;
    burst(p.x + 22, p.y - 22, '#ff5252', 24, 320);
    const res = commitRun();
    checkProgress();
    $('hud').hidden = true;
    hideBanner();
    setTimeout(() => {
      if (state !== 'over') return;
      fillGameOver(res);
      show('gameover');
    }, 650);
  }

  function obBox(o) { return { l: o.x + 5, r: o.x + o.w - 5, t: o.y + 5, b: o.y + o.h - 3 }; }

  // سرعت‌دهنده: مانع را می‌شکند
  function smash(o) {
    o.dead = true; o.counted = true;
    g.run.passed++; g.run.smashed++;
    if (o.enemy) g.run.enemies++;
    g.score += 5;
    burst(o.x + o.w / 2, o.y + o.h / 2, '#ff9800', 14, 280);
    sfx.smash(); vibrate(10);
    g.shake = Math.max(g.shake, 0.12);
  }

  // نجات یک‌باره: به‌جای مرگ، مانع‌های نزدیک پاک می‌شوند
  function rescue() {
    const p = g.player;
    g.revive = false; g.inv = 2.5; g.run.revives++;
    g.obstacles = g.obstacles.filter(o => o.x > p.x + 340 || o.x + o.w < p.x - 20);
    p.vy = -520; p.grounded = false; p.jumps = 1;
    burst(p.x + 22, p.y - 22, '#ff4081', 26, 340);
    g.flash = 0.7; g.shake = 0.3;
    sfx.revive(); vibrate([40, 30, 80]);
    toast('نجات پیدا کردی!', '💖');
  }

  function collectPower(it) {
    g.run.powers++; g.run.types.add(it.type);
    sfx.power(); vibrate(15);
    burst(it.x, it.y, POWER_COLORS[it.type] || '#fff', 12);
    switch (it.type) {
      case 'shield': g.shield = true; break;
      case 'magnet': g.magnet = POWER_DUR.magnet * g.durMul; break;
      case 'x2':     g.x2 = POWER_DUR.x2 * g.durMul; break;
      case 'boost':  g.boost = POWER_DUR.boost * g.durMul; g.flash = 0.5; g.shake = 0.25; sfx.boost(); vibrate([20, 20, 40]); break;
      case 'revive': g.revive = true; sfx.revive(); break;
    }
  }

  // مقدار زندهٔ آمار یک مأموریت (ذخیره‌شده + دور جاری)
  function statValue(m) {
    const live = g && g.started && !g.committed;
    if (m.stat === 'best') return Math.max(save.best, live ? Math.floor(g.score) : 0);
    if (m.stat === 'bestPhase') return Math.max(save.stats.bestPhase, live ? g.phase + 1 : 0);
    return save.stats[m.stat] + (live ? (g.run[m.stat] || 0) : 0);
  }
  const claimableCount = () => MISSIONS.filter(m => !save.claimed[m.id] && statValue(m) >= m.target).length;

  const announced = new Set();
  function syncAnnounced() {
    announced.clear();
    MISSIONS.forEach(m => { if (statValue(m) >= m.target) announced.add(m.id); });
  }
  function checkProgress() {
    let changed = false;
    for (const m of MISSIONS) {
      if (!save.claimed[m.id] && !announced.has(m.id) && statValue(m) >= m.target) {
        announced.add(m.id);
        sfx.mission(); toast(`مأموریت کامل شد: ${m.title}`, '🎯');
      }
    }
    for (const a of ACHIEVEMENTS) {
      if (!save.achievements[a.id] && a.test()) {
        save.achievements[a.id] = true; changed = true;
        sfx.mission(); toast(`دستاورد: ${a.title}`, a.icon);
      }
    }
    if (changed) persist();
  }

  function toast(msg, icon) {
    const box = $('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = (icon ? icon + ' ' : '') + msg;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2600);
  }

  /* ---------- به‌روزرسانی ---------- */

  let bannerTimer = 0;
  function hideBanner() {
    const el = $('phaseBanner');
    if (el) { el.hidden = true; el.classList.remove('show'); }
    clearTimeout(bannerTimer);
  }
  function showBanner(idx) {
    const el = $('phaseBanner'), ph = PHASES[idx];
    if (!el || !ph) return;
    el.textContent = `${ph.icon} مرحلهٔ ${fa(idx + 1)} — ${ph.name}`;
    el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideBanner, 2400);
  }
  function onPhase(idx) {
    const ph = PHASES[idx];
    if (ph.intro) g.intro = ph.intro;
    showBanner(idx); sfx.phase(); vibrate(30);
  }

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
    g.speed = Math.min(g.d.max, g.speed + g.d.accel * (1 + 0.1 * g.phase) * dt);
    if (g.boost > 0) {
      g.boost -= dt;
      if (g.boost <= 0) { g.boost = 0; g.inv = Math.max(g.inv, 1.2); }
    }
    g.boostMul += ((g.boost > 0 ? BOOST_MUL : 1) - g.boostMul) * Math.min(1, dt * 6);
    if (g.boost <= 0 && g.boostMul < 1.01) g.boostMul = 1;
    const sp = g.speed * g.boostMul; // سرعت مؤثر (با احتساب سرعت‌دهنده)
    g.score += ((sp * dt) / 18) * (g.x2 > 0 ? 2 : 1) * (g.perk.score || 1);
    const phNow = phaseFor(g.score, g.d);
    if (phNow > g.phase) { g.phase = phNow; onPhase(phNow); }
    if (g.phase >= 4 && Math.random() < dt * 0.12) g.flash = Math.max(g.flash, 0.25); // رعد و برق مرحلهٔ طوفان
    g.bgx += sp * 0.15 * dt;
    g.groundX = (g.groundX + sp * dt) % 40;
    if (g.inv > 0) g.inv -= dt;
    if (g.magnet > 0) g.magnet -= dt;
    if (g.x2 > 0) g.x2 -= dt;
    if (nightFactor() > 0.85) g.run.nights = 1;
    g.checkIn -= dt;
    if (g.checkIn <= 0) { g.checkIn = 0.5; checkProgress(); }

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
    p.run += dt * sp / 400;
    if (g.boost > 0 && g.particles.length < 400) {
      const cols = ['#ff9800', '#ffeb3b', '#ff5722'];
      for (let i = 0; i < 2; i++) {
        g.particles.push({ x: p.x + 2, y: p.y - rand(4, 38), vx: -rand(160, 320), vy: rand(-50, 50), life: 0.3, max: 0.3, color: cols[(Math.random() * 3) | 0], size: rand(3, 6) });
      }
    }

    // ساخت مانع
    g.spawnIn -= sp * dt;
    if (g.spawnIn <= 0) spawn();

    // حرکت
    for (const o of g.obstacles) {
      if (o.enemy) updateEnemy(o, dt, sp); else o.x -= sp * dt;
      if (!o.counted && o.x + o.w < g.player.x) { o.counted = true; g.run.passed++; if (o.enemy) g.run.enemies++; }
    }
    g.obstacles = g.obstacles.filter(o => !o.dead && o.x + o.w > -60);

    const pb = playerBox();
    const pcx = p.x + 22, pcy = p.y - (p.ducking ? 12 : 22);
    for (const it of g.items) {
      it.x -= sp * dt;
      if (it.type === 'coin' && g.magnet > 0) {
        const dx = pcx - it.x, dy = pcy - it.y, dist = Math.hypot(dx, dy);
        if (dist < 240 && dist > 1) { it.x += (dx / dist) * 600 * dt; it.y += (dy / dist) * 600 * dt; }
      }
      if (!it.done && Math.hypot(pcx - it.x, pcy - it.y) < it.r + 22 + (it.type === 'coin' ? (g.perk.coinRange || 0) : 0)) {
        it.done = true;
        if (it.type === 'coin') { g.coins++; g.run.coins++; sfx.coin(); burst(it.x, it.y, '#ffd600', 5, 120); }
        else collectPower(it);
      }
    }
    g.items = g.items.filter(it => !it.done && it.x > -40);

    // برخورد با مانع
    if (g.boost > 0) {
      // حین سرعت‌دهنده شکست‌ناپذیر است و مانع‌ها را خرد می‌کند
      for (const o of g.obstacles) if (hittable(o) && overlap(pb, obBox(o))) smash(o);
    } else if (g.inv <= 0) {
      for (const o of g.obstacles) {
        if (!hittable(o)) continue;
        if (overlap(pb, obBox(o))) {
          if (g.shield) {
            g.shield = false; g.inv = g.perk.hitInv || 1.2; sfx.shield();
            burst(o.x + o.w / 2, o.y + o.h / 2, '#40c4ff', 16, 250);
            g.obstacles = g.obstacles.filter(x => x !== o);
            g.shake = 0.2;
          } else if (g.revive) { rescue(); }
          else { die(); return; }
          break;
        }
      }
    }
    updateParticles(dt);
    updateHud();
  }

  const hudCache = Object.create(null);
  const powerChips = {};
  function initHud() {
    document.querySelectorAll('#powerBar [data-p]').forEach(el => {
      powerChips[el.dataset.p] = { el, time: el.querySelector('b'), bar: el.querySelector('.bar') };
    });
  }
  function setNum(id, n) {
    n = Math.floor(n);
    if (hudCache[id] !== n) { hudCache[id] = n; $(id).textContent = fa(n); }
  }
  function updateHud() {
    setNum('hudScore', g.score);
    setNum('hudBest', Math.max(save.best, g.score));
    setNum('hudCoins', g.coins);
    if (hudCache.ph !== g.phase) {
      hudCache.ph = g.phase;
      $('hudPhase').textContent = `${PHASES[g.phase].icon} مرحله ${fa(g.phase + 1)}`;
    }
    const x2on = g.x2 > 0;
    if (hudCache.x2on !== x2on) { hudCache.x2on = x2on; $('hudScoreChip').classList.toggle('x2', x2on); }
    const fr = {
      shield: g.shield ? 1 : 0, revive: g.revive ? 1 : 0,
      magnet: g.magnet / (POWER_DUR.magnet * g.durMul), x2: g.x2 / (POWER_DUR.x2 * g.durMul), boost: g.boost / (POWER_DUR.boost * g.durMul),
    };
    for (const k in powerChips) {
      const c = powerChips[k], f = Math.max(0, Math.min(1, fr[k]));
      const on = f > 0;
      if (c.el.hidden === on) c.el.hidden = !on;
      if (!on) continue;
      c.bar.style.transform = `scaleX(${f.toFixed(2)})`;
      if (c.time) {
        const sec = Math.ceil(f * POWER_DUR[k] * g.durMul);
        if (hudCache['t' + k] !== sec) { hudCache['t' + k] = sec; c.time.textContent = fa(sec); }
      }
    }
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

  function ghostAlpha(c) {
    if (c < 0.55) return 1;
    if (c < 0.65) return 1 - 0.7 * ((c - 0.55) / 0.1);
    if (c < 0.85) return 0.3;
    if (c < 0.95) return 0.3 + 0.7 * ((c - 0.85) / 0.1);
    return 1;
  }

  // نشانهٔ هشدار در لبهٔ راست: نوع دشمن + مثلث ! + (برای گراز) خط قرمز روی زمین
  function drawWarn(o, def) {
    const k = 1 - o.warn / o.maxWarn;
    const blink = Math.floor(g.t * 9) % 2 === 0;
    const x = W - 34, y = o.lane === 'air' ? (o.cy || GY - 60) : GY - 34;
    ctx.save();
    if (o.kind === 'boar') {
      ctx.fillStyle = `rgba(229,57,53,${blink ? 0.5 : 0.2})`;
      ctx.fillRect(W - 220 * (0.4 + k * 0.6), GY - 8, 220, 6);
    }
    ctx.globalAlpha = blink ? 1 : 0.55;
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(x - 20, y); ctx.lineTo(x + 14, y - 20 - k * 4); ctx.lineTo(x + 14, y + 20 + k * 4); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x + 3, y + 1);
    ctx.font = `18px ${EMOJI_FONT}`;
    ctx.fillText(def.icon, x - 12, y - 28);
    ctx.restore();
  }

  function drawEnemy(o) {
    const def = ENEMIES[o.kind];
    if (o.warn > 0) { drawWarn(o, def); return; }
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    if (o.lane === 'ground') {
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath(); ctx.ellipse(cx, GY + 3, o.w * 0.5, 4, 0, 0, 7); ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, cy + (o.kind === 'ghost' ? Math.sin(o.t * 4) * 4 : 0));
    let sx = 1, sy = 1;
    if (o.kind === 'hedgehog') sy = 1 + Math.sin(o.t * 12) * 0.06;
    else if (o.kind === 'bat') sx = 1 + Math.sin(o.t * 18) * 0.25;
    else if (o.kind === 'boar') ctx.translate(0, Math.sin(o.t * 40) * 1.5);
    else if (o.kind === 'ghost') ctx.globalAlpha = ghostAlpha((o.t % 1.6) / 1.6);
    ctx.scale(sx, sy);
    ctx.font = `${def.size}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, 0, 0);
    ctx.restore();
  }

  // حاشیهٔ قرمز خطر از مرحلهٔ ۴ (گرادیان برای هر مرحله فقط یک بار ساخته می‌شود)
  const dangerGrads = {};
  function drawDangerFx() {
    if (g.phase < 3) return;
    let gr = dangerGrads[g.phase];
    if (!gr) {
      gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.65);
      gr.addColorStop(0, 'rgba(200,0,0,0)');
      gr.addColorStop(1, `rgba(200,0,0,${0.12 + 0.06 * (g.phase - 3)})`);
      dangerGrads[g.phase] = gr;
    }
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
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
    } else if (o.enemy) {
      drawEnemy(o);
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
      const sx = Math.max(0.15, Math.abs(Math.cos(g.t * 5 + it.x * 0.05)));
      ctx.save(); ctx.translate(it.x, it.y); ctx.scale(sx, 1);
      ctx.fillStyle = '#ffd600'; ctx.strokeStyle = '#e6a100'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, it.r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-3, -3, 3.5, 0, 7); ctx.fill();
      ctx.restore();
    } else {
      const bob = Math.sin(g.t * 4) * 4;
      ctx.fillStyle = (POWER_COLORS[it.type] || '#ffffff') + '33';
      ctx.beginPath(); ctx.arc(it.x, it.y + bob, 20 + Math.sin(g.t * 6) * 2, 0, 7); ctx.fill();
      ctx.font = `28px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(POWER_ICONS[it.type] || '❓', it.x, it.y + bob);
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
    if (g.boostMul > 1.1) { // رد (ghost) هنگام سرعت‌دهنده
      ctx.save();
      ctx.font = `44px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      for (let k = 1; k <= 3; k++) { ctx.globalAlpha = 0.28 / k; ctx.fillText(char.emoji, p.x + 22 - k * 18, p.y + bob + 4); }
      ctx.restore();
    }
    ctx.save();
    ctx.translate(p.x + 22, p.y + bob);
    if (!p.grounded) ctx.rotate(Math.max(-0.3, Math.min(0.4, p.vy / 2500)));
    if (p.ducking) ctx.scale(1.2, 0.62);
    ctx.font = `44px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(char.emoji, 0, 4);
    ctx.restore();

    if (g.x2 > 0) { // هالهٔ طلایی امتیاز دوبرابر
      ctx.fillStyle = `rgba(255,214,0,${0.14 + 0.08 * Math.sin(g.t * 8)})`;
      ctx.beginPath(); ctx.arc(p.x + 22, p.y - 22, 30, 0, 7); ctx.fill();
    }
    if (g.revive) { // قلب بالای سر = نجات یک‌باره فعال است
      ctx.font = `16px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💖', p.x + 22, p.y - 62 + Math.sin(g.t * 5) * 3);
    }
    if (g.shield) {
      ctx.strokeStyle = `rgba(64,196,255,${0.6 + 0.3 * Math.sin(g.t * 8)})`;
      ctx.fillStyle = 'rgba(64,196,255,.18)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x + 22, p.y - 22, 32, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  // خطوط سرعت و درخشش نارنجی لبه‌ها هنگام سرعت‌دهنده
  function drawBoostFx() {
    const k = Math.min(1, (g.boostMul - 1) / (BOOST_MUL - 1));
    if (k < 0.02) return;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * k})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const y = 20 + ((i * 53) % (GY - 30)), len = 60 + (i % 4) * 30;
      const x = W - ((g.t * 1400 + i * 211) % (W + len));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
    const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.65);
    gr.addColorStop(0, 'rgba(255,120,0,0)');
    gr.addColorStop(1, `rgba(255,120,0,${0.28 * k})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = nightFactor();
    ctx.save();
    if (g.shake > 0) ctx.translate(rand(-1, 1) * g.shake * 14, rand(-1, 1) * g.shake * 14);
    drawBackground(n);
    drawBoostFx();
    drawDangerFx();
    g.items.forEach(drawItem);
    g.obstacles.forEach(o => { if (!o.dead) drawObstacle(o); });
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
  let last = 0, shownState = null;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    if (state === 'playing') update(dt);
    else if (state === 'over') updateParticles(dt);
    else if (state === 'menu') { g.t += dt; g.bgx += 25 * dt; g.groundX = (g.groundX + 120 * dt) % 40; g.player.run += dt; }
    if (state !== shownState) { // حین بازی: جلوگیری از اسکرول/زوم لمسی
      shownState = state;
      document.body.classList.toggle('playing', state === 'playing');
    }
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
    const n = claimableCount();
    document.querySelectorAll('[data-bind="claimable"]').forEach(e => { e.textContent = fa(n); e.hidden = n === 0; });
    document.querySelectorAll('#difficulty [data-d]').forEach(b => b.classList.toggle('active', b.dataset.d === save.difficulty));
    document.querySelectorAll('[data-action="mute"]').forEach(b => { b.textContent = save.muted ? '🔇' : '🔊'; });
    const ch = CHARACTERS.find(c => c.id === save.selected) || CHARACTERS[0];
    $('menuHero').textContent = ch.emoji;
    document.querySelectorAll('[data-bind="version"]').forEach(e => { e.textContent = VERSION_FA; });
  }
  /* ---------- فروشگاه آرکید ---------- */
  let shopIndex = 0;
  const shopChar = () => CHARACTERS[shopIndex] || CHARACTERS[0];

  function countTo(el, from, to, ms) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === to) { el.textContent = fa(to); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = fa(from + (to - from) * k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderShop() {
    const c = shopChar();
    const owned = save.owned.includes(c.id), selected = save.selected === c.id;
    const st = $('shopStage');
    $('shopCoins').textContent = fa(save.coins);
    $('shopPreview').textContent = c.emoji;
    st.classList.toggle('owned', owned);
    st.classList.toggle('selected', selected);
    st.classList.toggle('locked', !owned);
    $('shopLock').hidden = owned;
    $('shopName').textContent = c.name;
    const rb = $('shopRarity');
    rb.textContent = RARITY[c.rarity];
    rb.className = 'rarity ' + c.rarity;
    $('shopDesc').textContent = c.desc;
    $('shopPerk').textContent = '⭐ ' + c.perkText;
    $('shopMeters').innerHTML = METER_LABELS.map((l, i) => `<div class="meter"><span>${l}</span><i style="--v:${c.meters[i]}"></i></div>`).join('');
    $('shopPrice').textContent = owned ? (selected ? '✔ انتخاب‌شده' : '✔ در مالکیت شما') : `🪙 ${fa(c.price)}`;
    const buy = $('shopBuy');
    buy.textContent = selected ? '✔ در حال استفاده' : owned ? 'انتخاب' : `خرید 🪙 ${fa(c.price)}`;
    buy.disabled = selected;
    buy.classList.toggle('cant', !owned && save.coins < c.price);
    const strip = $('shopStrip');
    strip.innerHTML = '';
    CHARACTERS.forEach((x, i) => {
      const o = save.owned.includes(x.id), sel = save.selected === x.id;
      const b = document.createElement('button');
      b.className = 'thumb' + (sel ? ' selected' : o ? ' owned' : ' locked') + (i === shopIndex ? ' current' : '') + (!o && save.coins >= x.price ? ' afford' : '');
      b.dataset.action = 'shopView';
      b.dataset.i = String(i);
      b.innerHTML = `<span class="emoji">${x.emoji}</span><small>${sel ? '✔' : o ? '' : '🪙 ' + fa(x.price)}</small>`;
      strip.appendChild(b);
    });
  }

  function shopMove(dir) {
    shopIndex = (shopIndex + dir + CHARACTERS.length) % CHARACTERS.length;
    sfx.tick();
    renderShop();
  }

  // افکت‌های بصری خرید موفق / ناموفق
  function shopFx(kind, from, to) {
    const st = $('shopStage'), cls = kind === 'buy' ? 'bought' : 'deny';
    st.classList.remove('bought', 'deny'); void st.offsetWidth; st.classList.add(cls);
    setTimeout(() => st.classList.remove(cls), 800);
    if (kind !== 'buy') return;
    const box = $('shopSparks');
    box.innerHTML = '';
    for (let i = 0; i < 14; i++) {
      const sp = document.createElement('i');
      const a = (i / 14) * Math.PI * 2, r = 60 + (i % 3) * 20;
      sp.className = 'spark';
      sp.style.setProperty('--dx', Math.round(Math.cos(a) * r) + 'px');
      sp.style.setProperty('--dy', Math.round(Math.sin(a) * r - 20) + 'px');
      box.appendChild(sp);
    }
    setTimeout(() => { box.innerHTML = ''; }, 900);
    const pill = $('shopCoinPill');
    pill.classList.remove('pop'); void pill.offsetWidth; pill.classList.add('pop');
    countTo($('shopCoins'), from, to, 600);
  }

  function bindShop() {
    const st = $('shopStage');
    let x0 = null;
    st.addEventListener('pointerdown', e => { x0 = e.clientX; });
    st.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) shopMove(dx < 0 ? 1 : -1); // در راست‌به‌چپ: کشیدن به چپ = بعدی
    });
    st.addEventListener('pointercancel', () => { x0 = null; });
  }
  function backToMenu() {
    commitRun();
    state = 'menu'; stopMusic(); newGame();
    $('hud').hidden = true;
    hideBanner();
    refreshMenu(); show('menu');
  }
  function startGame() {
    ensureAudio();
    if (document.activeElement) document.activeElement.blur();
    commitRun(); // اگر دور قبلی (مثلاً از صفحهٔ توقف) هنوز ذخیره نشده، ذخیره شود
    newGame();
    g.started = true;
    state = 'playing';
    show(null);
    $('hud').hidden = false;
    updateHud();
    showBanner(0);
    startMusic();
  }
  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused'; stopMusic();
    $('pauseScore').textContent = fa(g.score);
    $('pauseCoins').textContent = fa(g.coins);
    show('pause');
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
  // خرید یا انتخاب. خرید فقط یک بار و به‌صورت یکجا (سکه + مالکیت) ذخیره می‌شود؛ کلیک تکراری فقط «انتخاب» است.
  function shopItem(id) {
    const c = CHARACTERS.find(x => x.id === id);
    if (!c) return false;
    const msg = $('shopMsg');
    ensureAudio();
    let bought = null;
    if (save.owned.includes(id)) {
      if (save.selected !== id) { save.selected = id; sfx.tick(); msg.textContent = `${c.name} انتخاب شد.`; }
    } else if (Number.isFinite(c.price) && c.price >= 0 && save.coins >= c.price) {
      bought = { from: save.coins, to: save.coins - c.price };
      save.coins -= c.price; save.owned.push(id); save.selected = id;
      sfx.buy(); vibrate(25);
      msg.textContent = `${c.name} خریداری شد! 🎉`;
    } else {
      sfx.error(); vibrate(40);
      msg.textContent = `سکه کافی نیست! ${fa(c.price - save.coins)} سکهٔ دیگر لازم است.`;
      renderShop(); shopFx('deny');
      return false;
    }
    persist(); renderShop(); refreshMenu(); checkProgress();
    if (bought) shopFx('buy', bought.from, bought.to);
    return true;
  }

  /* ---------- مأموریت‌ها و دستاوردها ---------- */
  let missionTab = 'missions';
  function renderMissions(tab) {
    if (tab) missionTab = tab;
    document.querySelectorAll('#missions [data-action="tab"]').forEach(b => b.classList.toggle('active', b.dataset.tab === missionTab));
    $('missionCoins').textContent = fa(save.coins);
    $('claimAllBtn').hidden = missionTab !== 'missions';
    const box = $('missionList');
    box.innerHTML = '';
    if (missionTab === 'missions') {
      MISSIONS.forEach(m => {
        const val = Math.min(m.target, statValue(m)), done = val >= m.target, claimed = !!save.claimed[m.id];
        const row = document.createElement('div');
        row.className = 'mission' + (claimed ? ' claimed' : done ? ' done' : '');
        row.innerHTML = `<span class="m-icon">${m.icon}</span><div class="m-body"><div class="m-title">${m.title}</div>` +
          `<div class="bar-track"><i style="width:${Math.round((val / m.target) * 100)}%"></i></div><small>${fa(val)} / ${fa(m.target)}</small></div>`;
        const btn = document.createElement('button');
        if (claimed) { btn.textContent = '✔ دریافت شد'; btn.disabled = true; }
        else if (done) { btn.textContent = `دریافت 🪙 ${fa(m.reward)}`; btn.className = 'primary'; btn.dataset.action = 'claim'; btn.dataset.id = m.id; }
        else { btn.textContent = `🪙 ${fa(m.reward)}`; btn.disabled = true; }
        row.appendChild(btn);
        box.appendChild(row);
      });
    } else {
      ACHIEVEMENTS.forEach(a => {
        const on = !!save.achievements[a.id];
        const row = document.createElement('div');
        row.className = 'mission ach' + (on ? ' done' : ' locked');
        row.innerHTML = `<span class="m-icon">${on ? a.icon : '🔒'}</span><div class="m-body"><div class="m-title">${a.title}</div><small>${a.desc}</small></div>`;
        box.appendChild(row);
      });
    }
  }
  // جایزه فقط یک بار: پرچم claimed قبل از افزودن سکه ثبت می‌شود.
  function claimMission(id, quiet) {
    const m = MISSIONS.find(x => x.id === id);
    if (!m || save.claimed[m.id] || statValue(m) < m.target) return false;
    save.claimed[m.id] = true;
    save.coins = Math.min(1e9, save.coins + m.reward);
    persist();
    if (!quiet) { sfx.buy(); vibrate(20); toast(`+${fa(m.reward)} سکه`, '🪙'); }
    return true;
  }
  function claimAll() {
    let sum = 0, n = 0;
    MISSIONS.forEach(m => { if (claimMission(m.id, true)) { sum += m.reward; n++; } });
    if (n) { sfx.buy(); vibrate(20); toast(`+${fa(sum)} سکه از ${fa(n)} مأموریت`, '🎁'); }
    renderMissions(); refreshMenu();
  }

  /* ---------- صفحهٔ پایان ---------- */
  function countUp(el, to, ms = 700) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || to <= 0) { el.textContent = fa(to); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = fa(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function fillGameOver(res) {
    countUp($('goScore'), res.score);
    countUp($('goCoins'), g.coins, 500);
    countUp($('goPassed'), g.run.passed, 500);
    $('goBest').textContent = fa(save.best);
    $('goRecord').hidden = !res.isRecord;
    $('goScores').innerHTML = save.scores.map(s => `<li>${fa(s)}</li>`).join('');
    const n = claimableCount();
    $('goHint').hidden = n === 0;
    if (n) $('goHint').textContent = `🎯 ${fa(n)} مأموریت آمادهٔ دریافت جایزه است`;
  }

  /* ---------- تنظیمات و ذخیره (خروجی/ورودی JSON) ---------- */
  function renderSettings() {
    $('optMusic').checked = save.music;
    $('optSfx').checked = save.sfx;
    $('optVibrate').checked = save.vibrate;
    $('volMusic').value = Math.round(save.musicVol * 100);
    $('volSfx').value = Math.round(save.sfxVol * 100);
    $('dataBox').hidden = state === 'paused'; // وسط بازی جایگزینی ذخیره مجاز نیست
    $('dataMsg').textContent = '';
  }
  function bindSettings() {
    $('optMusic').addEventListener('change', e => { save.music = e.target.checked; persist(); applyAudio(); });
    $('optSfx').addEventListener('change', e => { save.sfx = e.target.checked; persist(); sfx.coin(); });
    $('optVibrate').addEventListener('change', e => { save.vibrate = e.target.checked; persist(); vibrate(30); });
    $('volMusic').addEventListener('input', e => { save.musicVol = clamp01(Number(e.target.value) / 100, 0.6); applyAudio(); });
    $('volMusic').addEventListener('change', () => persist());
    $('volSfx').addEventListener('input', e => { save.sfxVol = clamp01(Number(e.target.value) / 100, 0.8); });
    $('volSfx').addEventListener('change', () => { persist(); ensureAudio(); sfx.coin(); });
    $('importFile').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) importFile(f);
    });
  }
  function exportSave() {
    const blob = new Blob([serializeSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cat-runner-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    $('dataMsg').textContent = '✅ فایل ذخیره ساخته شد.';
  }
  function importFile(file) {
    const msg = $('dataMsg');
    if (file.size > MAX_IMPORT_BYTES) { msg.textContent = '❌ حجم فایل بیش از حد مجاز است.'; sfx.error(); return; }
    const r = new FileReader();
    r.onerror = () => { msg.textContent = '❌ خواندن فایل ناموفق بود.'; };
    r.onload = () => {
      const res = parseImport(String(r.result));
      if (res.error) { msg.textContent = '❌ ' + res.error; sfx.error(); return; }
      const d = res.data;
      const ok = window.confirm(`ذخیرهٔ فعلی با این فایل جایگزین شود؟\nرکورد: ${fa(d.best)} | سکه: ${fa(d.coins)} | شخصیت‌ها: ${fa(d.owned.length)}`);
      if (!ok) return;
      try { localStorage.setItem(SAVE_KEY + '_backup', JSON.stringify(save)); } catch (e) {} // برگشت‌پذیر
      replaceSave(d);
      persist(); syncAnnounced(); applyAudio(); refreshMenu(); renderSettings();
      msg.textContent = '✅ ذخیره با موفقیت بازیابی شد.';
      sfx.buy();
    };
    r.readAsText(file);
  }

  /* ---------- اکشن‌های دکمه‌ها ---------- */
  let returnTo = 'menu';
  const currentScreen = () => { const a = document.querySelector('.screen.active'); return a ? a.id : 'menu'; };
  function openScreen(name, render) { returnTo = currentScreen(); if (render) render(); show(name); }

  const actions = {
    start: startGame,
    menu: backToMenu,
    tutorial: () => show('tutorial'),
    shop: () => {
      shopIndex = Math.max(0, CHARACTERS.findIndex(c => c.id === save.selected));
      $('shopMsg').innerHTML = '&nbsp;';
      renderShop(); show('shop');
    },
    shopPrev: () => shopMove(-1),
    shopNext: () => shopMove(1),
    shopView: b => { shopIndex = Number(b.dataset.i) || 0; sfx.tick(); renderShop(); },
    shopBuy: () => shopItem(shopChar().id),
    pause: pauseGame,
    resume: resumeGame,
    mute: toggleMute,
    settings: () => openScreen('settings', renderSettings),
    missions: () => openScreen('missions', () => renderMissions()),
    back: () => { refreshMenu(); show(returnTo); },
    tab: b => renderMissions(b.dataset.tab),
    claim: b => { claimMission(b.dataset.id); renderMissions(); refreshMenu(); },
    claimAll,
    diff: b => { if (has(DIFFS, b.dataset.d)) { save.difficulty = b.dataset.d; persist(); refreshMenu(); } },
    export: exportSave,
    import: () => $('importFile').click(),
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    if (b.dataset.action === 'shopItem') return shopItem(b.dataset.id);
    const fn = actions[b.dataset.action];
    if (fn) fn(b);
  });

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
      case 'ArrowLeft': case 'ArrowRight':
        if (state !== 'playing' && currentScreen() === 'shop') { e.preventDefault(); shopMove(e.code === 'ArrowLeft' ? 1 : -1); }
        break;
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
  initHud();
  bindSettings();
  bindShop();
  applyAudio();
  syncAnnounced();
  refreshMenu();
  document.addEventListener('pointerdown', ensureAudio, { once: true });
  $('touchControls').addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('pagehide', e => { if (!e.persisted) commitRun(); }); // سکه/آمار دور نیمه‌تمام از بین نرود
  window.addEventListener('resize', () => { if (Math.min(2, window.devicePixelRatio || 1) !== dpr) resizeCanvas(); });
  requestAnimationFrame(frame);
})();
