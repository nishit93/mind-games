// Player progress: favourites, best scores, counters, settings and days played.
//
// Everything lives on this device first (localStorage), so the site works fully offline and without any server.
// When an API address is set (MG_CONFIG.api in games.js), progress is also backed up and merged across devices.
// Players are anonymous guests: no email, name or tracking, only a random id and a secret token.
//
// The games keep writing their own localStorage keys. mirror() watches those writes and copies the ones that
// matter into one record (`state`), whose shape matches the server's (see mind-games-api/src/merge.js).
(() => {
  const DAY_MS = 86_400_000;
  const MAX_DAYS = 400;
  const cfg = typeof MG_CONFIG === 'object' && MG_CONFIG ? MG_CONFIG : {};

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
    keys() { try { return Object.keys(localStorage); } catch { return []; } },
  };

  // ---- Which local keys count -----------------------------------------------------------------------------

  const KEY_OK = /^[a-z0-9][a-z0-9:_.-]{0,63}$/;
  // Higher is better for these bests; for every other best, lower (fewer moves, shorter time) is better.
  const HIGHER_BETTER = /^(2048-best|sequence-best|recall-grid-best|span-best-.+|knight-best-.+|nextline-best|colourword-best|oddone-best)$/;

  function classify(key) {
    if (!KEY_OK.test(key)) return null;
    if (/^fifteen-best-\d+$/.test(key)) return 'fifteen';
    if (/-best(-|$)/.test(key)) return 'best';
    if (/-(solved|wins)$/.test(key)) return 'counter';
    if (/-(level|n|size|draw|rows|len|mode|speed|sound|shade|seeds)$/.test(key)) return 'setting';
    return null;
  }

  const toNumber = raw => {
    const n = Number(raw);
    return raw !== null && raw !== '' && Number.isFinite(n) && n >= 0 && n <= 1e9 ? n : null;
  };
  // 15-Puzzle keeps {moves, ms}; it is stored as one number: moves first, then time in tenths of a second.
  function encode15(raw) {
    try {
      const b = JSON.parse(raw);
      if (!b || !(b.moves >= 0 && b.moves < 10000)) return null;
      return Math.round(b.moves) * 1e5 + Math.min(Math.round((b.ms || 0) / 100), 99999);
    } catch { return null; }
  }
  const decode15 = v => ({ moves: Math.floor(v / 1e5), ms: (v % 1e5) * 100 });
  const better = (a, b, dir) => (dir === 'max' ? a > b : a < b);

  // ---- The record -----------------------------------------------------------------------------------------

  const empty = () => ({ favourites: {}, bests: {}, stats: {}, settings: {}, days: [], lists: {} });
  const fill = s => {
    const o = { ...empty(), ...(s && typeof s === 'object' ? s : {}) };
    if (!o.lists || typeof o.lists !== 'object' || Array.isArray(o.lists)) o.lists = {};
    return o;
  };

  let state, fresh = false;
  let lastRaw = null; // the stored record as this page last wrote or read it
  let ver = 0;       // bumps on every change, so a sync can tell whether something changed while it was away
  let applying = false;
  const listeners = [];

  try { state = fill(JSON.parse(ls.get('mg-progress')).state); } catch { state = empty(); fresh = true; }

  const emit = () => listeners.forEach(fn => { try { fn(); } catch {} });
  function save() {
    ver++;
    ls.set('mg-progress', JSON.stringify({ state }));
    lastRaw = ls.get('mg-progress');
  }

  // Called for every localStorage write the games make through MG.store.
  function mirror(key, value, t = Date.now()) {
    if (applying) return;
    const kind = classify(key);
    if (!kind) return;
    let changed = false;
    if (kind === 'best' || kind === 'fifteen') {
      const v = kind === 'fifteen' ? encode15(value) : toNumber(value);
      if (v === null) return;
      const dir = HIGHER_BETTER.test(key) ? 'max' : 'min';
      const cur = state.bests[key];
      if (!cur || better(v, cur.v, dir)) { state.bests[key] = { v, dir, t }; changed = true; }
    } else if (kind === 'counter') {
      const v = toNumber(value);
      if (v !== null && Math.floor(v) > (state.stats[key] || 0)) { state.stats[key] = Math.floor(v); changed = true; }
    } else {
      const v = String(value);
      const cur = state.settings[key];
      if (v.length <= 100 && (!cur || cur.v !== v)) { state.settings[key] = { v, t }; changed = true; }
    }
    if (changed) { save(); schedule(); }
  }

  // ---- Favourites, days played, plays ---------------------------------------------------------------------

  const isFav = id => !!(state.favourites[id] && state.favourites[id].on);
  const favs = () => Object.entries(state.favourites).filter(([, v]) => v.on).sort((a, b) => b[1].t - a[1].t).map(([id]) => id);

  function toggleFav(id) {
    const on = !isFav(id);
    state.favourites[id] = { on, t: Date.now() };
    if (on) track('f.fav');
    save();
    emit();
    schedule();
    return on;
  }

  // ---- Game lists: named groups of games. Favourites is the first list; the player's own lists come after it. ----
  const MAX_LISTS = 30, MAX_LIST_GAMES = 60;
  const cleanName = n => String(n == null ? '' : n).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const liveLists = () => Object.entries(state.lists).filter(([, l]) => l && l.on !== false && typeof l.name === 'string').sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const lists = () => liveLists().map(([id, l]) => ({ id, name: l.name, games: Array.isArray(l.games) ? l.games.slice() : [] }));
  // Favourites plus every list, in the order they are shown.
  const collections = () => [{ id: 'favs', name: 'Favourites', games: favs(), fav: true }, ...lists()];
  const touchList = (id, patch) => {
    const cur = state.lists[id];
    state.lists[id] = { name: cur.name, games: Array.isArray(cur.games) ? cur.games.slice() : [], on: cur.on !== false, ...patch, t: Date.now() };
    save(); emit(); schedule();
  };
  function createList(name, firstGame) {
    const n = cleanName(name);
    if (!n || liveLists().length >= MAX_LISTS) return null;
    const id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    state.lists[id] = { name: n, games: firstGame ? [String(firstGame)] : [], on: true, t: Date.now() };
    track('f.list');
    save(); emit(); schedule();
    return id;
  }
  function renameList(id, name) {
    const n = cleanName(name);
    if (!n || !state.lists[id] || state.lists[id].on === false) return false;
    touchList(id, { name: n });
    return true;
  }
  function deleteList(id) {
    if (!state.lists[id]) return;
    touchList(id, { on: false, games: [] }); // kept as a tombstone, so the delete reaches other devices
  }
  const inList = (id, game) => id === 'favs' ? isFav(game) : !!(state.lists[id] && state.lists[id].on !== false && (state.lists[id].games || []).includes(game));
  function setInList(id, game, on) {
    if (id === 'favs') { if (isFav(game) !== on) toggleFav(game); return true; }
    const l = state.lists[id];
    if (!l || l.on === false) return false;
    const games = (l.games || []).filter(g => g !== game);
    if (on) { if (games.length >= MAX_LIST_GAMES) return false; games.push(game); }
    touchList(id, { games });
    return true;
  }

  const dayString = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => dayString(new Date());

  // A brand-new device has no id yet; the id is created just below, so this is true only on a device's very first visit.
  const firstEver = !ls.get('mg-device');
  let device = ls.get('mg-device');
  if (!device) {
    device = Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('');
    ls.set('mg-device', device);
  }

  // One play per page visit, counted on the first real touch. Each device has its own counter, so totals add up.
  function recordPlay() {
    const key = `plays-d${device}`;
    state.stats[key] = (state.stats[key] || 0) + 1;
    trackGame('p');
    if (/[?&]daily=/.test(location.search)) track('f.daily');
    const d = today();
    if (!state.days.includes(d)) state.days = [...state.days, d].sort().slice(-MAX_DAYS);
    save();
    emit();
    schedule();
  }

  const dayMs = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const dayName = ms => new Date(ms).toISOString().slice(0, 10);

  // Days in a row up to today (or yesterday, so the streak is still alive in the morning).
  function streak() {
    const have = new Set(state.days);
    let ms = dayMs(today());
    if (!have.has(dayName(ms))) { ms -= DAY_MS; if (!have.has(dayName(ms))) return 0; }
    let n = 0;
    while (have.has(dayName(ms))) { n++; ms -= DAY_MS; }
    return n;
  }

  const plays = () => Object.entries(state.stats).filter(([k]) => k.startsWith('plays-d')).reduce((s, [, v]) => s + v, 0);
  const summary = () => ({ streak: streak(), plays: plays(), favourites: favs().length, days: state.days.length });

  // ---- Sync -----------------------------------------------------------------------------------------------

  const api = () => {
    const url = (ls.get('mg-api') || cfg.api || '').replace(/\/+$/, '');
    return /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url) ? url : '';
  };
  const syncEnabled = () => ls.get('mg-sync') !== 'off';
  const getPlayer = () => { try { return JSON.parse(ls.get('mg-player')); } catch { return null; } };
  const clearPlayer = () => ls.del('mg-player');

  let status = !api() ? 'off' : syncEnabled() ? 'idle' : 'paused';
  let lastSync = Number(ls.get('mg-last-sync')) || 0;
  let syncing = false, again = false, timer = 0, backoff = 0;
  const setStatus = s => { if (s !== status) { status = s; emit(); } };

  function schedule(ms = 3000) {
    if (!api() || !syncEnabled()) return;
    clearTimeout(timer);
    timer = setTimeout(() => sync(), ms);
  }

  const call = (base, method, path, player, body) => fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(player ? { authorization: `Bearer ${player.id}.${player.token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'omit',
    cache: 'no-store',
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(10_000) : undefined,
  });

  // Two coarse facts that help us see who plays: the phone's time zone (the server turns it into a country; no address or location is ever read) and the chosen language.
  function context() {
    let tz = '', lang = 'en';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* optional */ }
    try { lang = localStorage.getItem('mg-lang') || 'en'; } catch (e) { /* optional */ }
    return { tz, lang };
  }
  async function createPlayer(base) {
    const res = await call(base, 'POST', '/v1/players');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const player = await res.json();
    ls.set('mg-player', JSON.stringify(player));
    return player;
  }

  // Replace the local record with the merged one from the server, and write it back into the games' own keys.
  function applyRemote(remote) {
    applying = true;
    try {
      const keepLists = remote && typeof remote === 'object' && remote.lists && typeof remote.lists === 'object' ? null : state.lists;
      state = fill(remote);
      if (keepLists) state.lists = keepLists;
      for (const [key, b] of Object.entries(state.bests)) {
        const kind = classify(key);
        if (kind !== 'best' && kind !== 'fifteen') continue;
        const local = ls.get(key);
        const cur = kind === 'fifteen' ? encode15(local) : toNumber(local);
        if (cur === null || better(b.v, cur, b.dir)) ls.set(key, kind === 'fifteen' ? JSON.stringify(decode15(b.v)) : String(b.v));
      }
      for (const [key, s] of Object.entries(state.settings)) if (classify(key) === 'setting') ls.set(key, String(s.v));
      for (const [key, n] of Object.entries(state.stats)) {
        if (classify(key) === 'counter' && n > (toNumber(ls.get(key)) || 0)) ls.set(key, String(n));
      }
    } finally { applying = false; }
    ls.set('mg-progress', JSON.stringify({ state }));
    emit();
  }

  // Returns 'ok', 'off', 'busy', 'offline', 'error', or (with strict) 'unknown' when the server doesn't know the player.
  async function sync({ strict = false } = {}) {
    const base = api();
    if (!base || !syncEnabled()) { setStatus(base ? 'paused' : 'off'); return 'off'; }
    if (syncing) { again = true; return 'busy'; }
    if (navigator.onLine === false) { setStatus('offline'); return 'offline'; }
    // Nobody is created on the server until there is something worth saving (default settings alone do not count).
    if (!getPlayer() && !hasProgress()) { setStatus('idle'); return 'idle'; }
    syncing = true;
    setStatus('syncing');
    let result = 'ok';
    try {
      let player = getPlayer() || await createPlayer(base);
      const sent = ver;
      let res = await call(base, 'POST', '/v1/sync', player, { state, ...context() });
      if (res.status === 401) {
        if (strict) throw Object.assign(new Error('unknown player'), { code: 'unknown' });
        clearPlayer();
        player = await createPlayer(base);
        res = await call(base, 'POST', '/v1/sync', player, { state, ...context() });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (ver === sent) applyRemote(body.state); else again = true; // changed meanwhile: send again before replacing
      lastSync = Date.now();
      ls.set('mg-last-sync', String(lastSync));
      backoff = 0;
      setStatus('ok');
      flushUsage();
    } catch (err) {
      result = err.code === 'unknown' ? 'unknown' : navigator.onLine === false ? 'offline' : 'error';
      setStatus(result === 'unknown' ? 'idle' : result);
      if (result === 'error') { backoff = Math.min((backoff || 15_000) * 2, 300_000); schedule(backoff); }
    } finally {
      syncing = false;
      if (again) { again = false; schedule(500); }
    }
    return result;
  }

  const hasProgress = () => state.days.length > 0 || Object.keys({ ...state.favourites, ...state.bests, ...state.stats, ...state.lists }).length > 0;

  // Move progress to another device: the code is the guest's id and secret. Whoever has it can see and change the progress.
  const exportCode = () => { const p = getPlayer(); return p ? `${p.id}.${p.token}` : ''; };

  async function useCode(code) {
    const m = /^([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/.exec(String(code).trim());
    if (!m) return 'invalid';
    const before = ls.get('mg-player');
    ls.set('mg-player', JSON.stringify({ id: m[1], token: m[2] }));
    ls.set('mg-sync', 'on');
    const result = await sync({ strict: true });
    if (result === 'unknown' || result === 'error' || result === 'offline') {
      if (before) ls.set('mg-player', before); else clearPlayer();
    }
    return result;
  }

  // Delete everything stored online and stop syncing. Progress stays on this device.
  async function eraseOnline() {
    const base = api(), player = getPlayer();
    if (base && player) {
      const res = await call(base, 'DELETE', '/v1/me', player);
      if (!res.ok && res.status !== 401) throw new Error(`HTTP ${res.status}`);
    }
    clearPlayer();
    ls.set('mg-sync', 'off');
    clearTimeout(timer);
    setStatus(base ? 'paused' : 'off');
  }

  function setSyncEnabled(on) {
    ls.set('mg-sync', on ? 'on' : 'off');
    if (on) { setStatus(api() ? 'idle' : 'off'); schedule(200); } else { clearTimeout(timer); setStatus(api() ? 'paused' : 'off'); }
  }

  // ---- Anonymous usage counts -------------------------------------------------------------------------------
  // What is counted: plays and wins per game and level, a few feature uses, the kind of device, and script errors.
  // What is never counted: anything in Kid mode (or a game opened from the Kids section), anything when the browser says
  // Do Not Track or Global Privacy Control, or when the player switched sharing off in the Progress tab. No text the player
  // typed, no list names, no addresses, no per-tap log. The server adds the counts to daily totals that are not linked to a player.
  const USAGE_KEY = 'mg-usage';
  const COUNT_KEY = /^[a-z0-9][a-z0-9.:_-]{0,39}$/;
  const MAX_COUNT_KEYS = 120;
  function usageOff() {
    try {
      if (ls.get('mg-usage-off') === '1') return true;
      if (ls.get('mg-kidmode') === 'on') return true;
      if (/[?&]kids(&|$)/.test(location.search)) return true;
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true) return true;
    } catch { /* if in doubt, count nothing */ return true; }
    return false;
  }
  let usage = (() => {
    try {
      const u = JSON.parse(ls.get(USAGE_KEY));
      return { c: u && u.c && typeof u.c === 'object' && !Array.isArray(u.c) ? u.c : {}, e: u && Array.isArray(u.e) ? u.e : [] };
    } catch { return { c: {}, e: [] }; }
  })();
  const saveUsage = () => ls.set(USAGE_KEY, JSON.stringify(usage));
  function track(key) {
    if (usageOff() || !COUNT_KEY.test(key)) return;
    if (!(key in usage.c) && Object.keys(usage.c).length >= MAX_COUNT_KEYS) return;
    usage.c[key] = Math.min((+usage.c[key] || 0) + 1, 100000);
    saveUsage();
  }
  const pageId = () => (document.body && document.body.dataset && document.body.dataset.game) || 'home';
  // The level the player is on, as a short tag (the setting named in LEVELS), or _ when the game has none.
  function levelTag(id) {
    try {
      const L = typeof LEVELS === 'object' && LEVELS ? LEVELS[id] : null;
      const v = L ? ls.get(L[0]) : null;
      return v ? String(v).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || '_' : '_';
    } catch { return '_'; }
  }
  const trackGame = kind => { const id = pageId(); if (id !== 'home') track(kind + '.' + id + '.' + levelTag(id)); };

  function envNow() {
    let os = 'other', device = 'desktop', mode = 'browser';
    try {
      const ua = navigator.userAgent || '';
      const p = (navigator.userAgentData && navigator.userAgentData.platform) || '';
      os = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) || /android/i.test(p) ? 'android' : /Windows/i.test(ua) || /windows/i.test(p) ? 'windows' : /Mac/i.test(ua) ? 'mac' : /Linux|CrOS/i.test(ua) ? 'linux' : 'other';
      const w = Math.min(screen.width || 0, screen.height || 0);
      device = w && w < 600 ? 'phone' : w && w < 900 ? 'tablet' : 'desktop';
      mode = matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'app' : 'browser';
    } catch { /* coarse guesses only */ }
    return { os, device, mode };
  }
  // Script errors: only a short cleaned message and the page, a handful per visit.
  function noteError(msg, where) {
    if (usageOff()) return;
    let m = String(msg || '').replace(/https?:\/\/[^\s)]*\/([^/\s)?#]*)[^\s)]*/g, '$1').replace(/[\w.+-]+@[\w.-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!m || /ResizeObserver loop|Script error\.?$|Transition was aborted|Skipped ViewTransition|Skipping view transition|view transition/i.test(m)) return;
    if (where) m += ' @' + where;
    if (usage.e.length >= 10 || usage.e.some(x => x.m === m && x.p === pageId())) return;
    usage.e.push({ p: pageId(), m });
    saveUsage();
  }
  try {
    addEventListener('error', ev => noteError(ev.message, ev.filename ? String(ev.filename).split('/').pop().split('?')[0] + ':' + (ev.lineno || 0) : ''));
    addEventListener('unhandledrejection', ev => noteError('Unhandled: ' + ((ev.reason && ev.reason.message) || ev.reason)));
  } catch { /* optional */ }

  let flushing = false;
  async function flushUsage(keepalive) {
    const base = api(), player = getPlayer();
    if (!base || !player || flushing || !syncEnabled() || usageOff() || navigator.onLine === false) return;
    const counts = { ...usage.c }, errs = usage.e.slice(0, 5), env = envNow();
    const envKey = JSON.stringify(env);
    if (!Object.keys(counts).length && !errs.length && ls.get('mg-env-sent') === envKey) return;
    flushing = true;
    try {
      const res = await fetch(base + '/v1/usage', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${player.id}.${player.token}` },
        body: JSON.stringify({ counts, errs, env }),
        credentials: 'omit', cache: 'no-store', keepalive: !!keepalive,
      });
      if (res.ok) {
        for (const [k, n] of Object.entries(counts)) { const left = (+usage.c[k] || 0) - n; if (left > 0) usage.c[k] = left; else delete usage.c[k]; }
        usage.e = usage.e.filter(x => !errs.some(y => y.m === x.m && y.p === x.p));
        saveUsage();
        ls.set('mg-env-sent', envKey);
      }
    } catch { /* tried again at the next chance */ } finally { flushing = false; }
  }
  // One anonymous page view for the visitor count. Nothing is stored on the device and no cookie is used; the server counts each visitor
  // once a day without keeping their address. Same safeguards as the usage counts (never in Kid mode, never with Do Not Track), and not
  // for automated browsers or for local test copies of the site.
  const SRC = [
    ['ai', ['chatgpt.com', 'openai.com', 'perplexity.ai', 'claude.ai', 'anthropic.com', 'gemini.google.com', 'copilot.microsoft.com', 'poe.com']],
    ['search', ['google.', 'bing.com', 'duckduckgo.com', 'yahoo.', 'baidu.com', 'ecosia.org', 'brave.com', 'yandex.', 'startpage.com', 'qwant.com']],
    ['social', ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 't.co', 'reddit.com', 'linkedin.com', 'youtube.com', 'whatsapp.com', 'pinterest.com', 'tiktok.com', 't.me', 'telegram.org', 'threads.net']],
  ];
  const hostIs = (host, h) => host === h || host.endsWith('.' + h) || (h.endsWith('.') && ('.' + host).includes('.' + h));
  // What would be sent for this page view, or null when nothing may be sent.
  function visitBody(ignoreAutomation) {
    try {
      if (!api() || usageOff() || (navigator.webdriver && !ignoreAutomation)) return null;
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
      if (local && !ls.get('mg-api')) return null;
      let src = 'direct';
      if (document.referrer) {
        let host = '';
        try { host = new URL(document.referrer).hostname.toLowerCase(); } catch { /* unreadable */ }
        if (host === location.hostname) src = 'direct';
        else { src = 'other'; for (const [name, list] of SRC) if (list.some(h => hostIs(host, h))) { src = name; break; } }
      }
      const e = envNow();
      let tz = '', lang = 'en';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* optional */ }
      lang = ls.get('mg-lang') || 'en';
      return { p: pageId(), src, tz, lang, os: e.os, device: e.device, n: firstEver ? 1 : 0 };
    } catch { return null; }
  }
  function visit() {
    const body = visitBody();
    if (!body) return;
    fetch(api() + '/v1/visit', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      credentials: 'omit', cache: 'no-store', keepalive: true,
    }).catch(() => {});
  }
  function setUsageSharing(on) {
    if (on) ls.del('mg-usage-off'); else { ls.set('mg-usage-off', '1'); usage = { c: {}, e: [] }; saveUsage(); }
  }
  try {
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushUsage(true); });
    setTimeout(() => flushUsage(false), 8000);
    setTimeout(visit, 800);
    setInterval(() => flushUsage(false), 60_000);
  } catch { /* optional */ }

  // Pick up anything already stored, such as scores from before this module existed, or keys a game
  // wrote without going through MG.store. This must run last: it uses everything defined above.
  // First run: older values get time 0, so they can never overwrite something newer from another device.
  try {
    for (const key of ls.keys()) if (classify(key)) mirror(key, ls.get(key), fresh ? 0 : Date.now());
  } catch (err) { console.error('Progress import skipped:', err); }
  fresh = false;

  // Coming back to a page (the Back button restores it from the browser's memory) or changing something in another tab
  // leaves this page's copy of the record out of date. Every change is saved at once, so storage is always the truth:
  // reload it, and tell the page if anything differs.
  lastRaw = ls.get('mg-progress');
  function refresh() {
    try {
      const raw = ls.get('mg-progress');
      if (raw === lastRaw) return false;
      lastRaw = raw;
      state = fill(JSON.parse(raw).state);
      ver++;
      emit();
      return true;
    } catch { return false; }
  }
  try {
    addEventListener('pageshow', e => { if (e.persisted) refresh(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    addEventListener('storage', e => { if (e.key === 'mg-progress') refresh(); });
  } catch {}

  // Sync soon after loading, when coming back online and when the tab is shown again.
  if (api()) {
    if (hasProgress() || getPlayer()) schedule(1500);
    addEventListener('online', () => schedule(500));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastSync > 60_000) schedule(500); });
  }

  window.MGProgress = {
    mirror, isFav, favs, toggleFav, recordPlay, summary, refresh,
    lists, collections, createList, renameList, deleteList, inList, setInList,
    onChange: fn => listeners.push(fn),
    sync, exportCode, useCode, eraseOnline, setSyncEnabled,
    track, trackGame, flushUsage, _visitBody: visitBody, setUsageSharing, usageSharing: () => ls.get('mg-usage-off') !== '1', usageBlocked: usageOff,
    configured: () => !!api(),
    syncEnabled,
    status: () => ({ status, lastSync, hasPlayer: !!getPlayer() }),
    _state: () => state,
  };
})();
