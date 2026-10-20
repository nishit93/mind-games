const fs = require('fs');

// ---- similarity.js: recommendations above a cutoff ----
let t = fs.readFileSync('similarity.js', 'utf8');
const add = `
  // ---- Recommendations: games close enough to your taste (cosine similarity at or above CUTOFF) that you have not played much ----
  const CUTOFF = 0.75;
  const PLAYED = 1;   // a game with this much (faded) play weight counts as already known
  function recommend(games, limit = 12) {
    try {
      const w = weights();
      if (!(total(w) > 0)) return { games: [], reason: {}, cold: true };
      const p = profile(w);
      const playedIds = Object.keys(w).filter(id => w[id] > 0);
      const picks = games
        .filter(g => VEC[g.id] && (w[g.id] || 0) < PLAYED)
        .map(g => ({ g, s: cos(p, vec(g.id)) }))
        .filter(x => x.s >= CUTOFF)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit);
      const reason = {};
      for (const { g } of picks) {
        let best = null, bs = -1;
        for (const id of playedIds) { const s = cos(vec(g.id), vec(id)); if (s > bs) { bs = s; best = id; } }
        reason[g.id] = best;
      }
      return { games: picks.map(x => x.g), reason, cold: false };
    } catch { return { games: [], reason: {}, cold: true }; }
  }
`;
t = t.replace('  // The nearest games to one game', add + '\n  // The nearest games to one game');
t = t.replace('rankGames, nearest, KEY };', 'rankGames, recommend, CUTOFF, nearest, KEY };');
fs.writeFileSync('similarity.js', t);

// ---- index.html ----
let h = fs.readFileSync('index.html', 'utf8');
const rep = (a, b) => { if (!h.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); h = h.replace(a, b); };
// duo: puzzle of the day and continue playing side by side
rep("html = dailyStrip()\n            + hero()", "html = `<div class=\"duo\">${dailyStrip()}${hero()}</div>`");
// For you route
rep("(f === 'stats' || f === 'lists' || f === 'favs' || f.startsWith('l-')) ? 'sub' : 'browse';", "(f === 'stats' || f === 'lists' || f === 'favs' || f === 'foryou' || f.startsWith('l-')) ? 'sub' : 'browse';");
rep("!(f === 'stats' || f === 'lists' || f === 'favs' || f.startsWith('l-')));\n        nav.hidden", "!(f === 'stats' || f === 'lists' || f === 'favs' || f === 'foryou' || f.startsWith('l-')));\n        nav.hidden");
rep("} else if (f === 'stats') {\n          html = '<div class=\"topbar\">", `} else if (f === 'foryou') {
          const rec = window.MGTaste ? MGTaste.recommend(GAMES.filter(vis)) : { games: [], reason: {}, cold: true };
          const why = g => { const b = byId(rec.reason[g.id]); return b ? { ...g, blurb: 'Like ' + b.name + ' · ' + g.blurb } : g; };
          html = \`
            <div class="topbar"><a class="back" href="#all">‹ All games</a></div>
            <h2 class="view-title">For you <small>\${rec.games.length || ''}</small></h2>
            <p class="section-blurb">Games that sit close to the ones you play, and that you have not played much yet. It learns quietly, on this device only.</p>
            \${rec.games.length ? \`<div class="list">\${rec.games.map(g => row(why(g), km)).join('')}</div>\` : \`<p class="empty">\${rec.cold ? 'Play a few games and this page will start suggesting others you might like.' : 'Nothing new sits close to your taste right now. Try something from the Play tab.'}</p>\`}\`;
        } else if (f === 'stats') {
          html = '<div class="topbar">`);
fs.writeFileSync('index.html', h);

// ---- shell.js: tab bar and drawer focus ----
let s = fs.readFileSync('shell.js', 'utf8');
const r2 = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); s = s.replace(a, b); };
r2("(current || drawer.querySelector('.drawer-search')).focus({ preventScroll: true });", "// Never focus the search box here: on a phone that pops the keyboard open as soon as the menu opens.\n      (current || drawer.querySelector('.drawer-home') || drawer).focus({ preventScroll: true });");
r2("today: '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 5.5h10a3 3 0 0 1 3 3v8.5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8.5a3 3 0 0 1 3-3zM4 10h16M8.5 3.5v4M15.5 3.5v4\"/></svg>',",
  "foryou: '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3.5l2.4 5.6 6.1.5-4.6 4 1.4 6-5.3-3.2-5.3 3.2 1.4-6-4.6-4 6.1-.5z\"/></svg>',");
r2("<a class=\"tab\" data-tab=\"today\" href=\"${todayHref()}\"><span class=\"pill\">${I.today}</span><span>Today</span></a>", "<a class=\"tab\" data-tab=\"foryou\" href=\"#foryou\"><span class=\"pill\">${I.foryou}</span><span>For you</span></a>");
r2("f === 'stats' ? 'stats' : 'explore';", "f === 'stats' ? 'stats' : f === 'foryou' ? 'foryou' : 'explore';");
r2("    document.addEventListener('mg-kidmode', () => { tabs.querySelector('[data-tab=\"today\"]').href = todayHref(); });\n", "");
fs.writeFileSync('shell.js', s);

// ---- CSS: the duo ----
fs.appendFileSync('styles.css', `
/* Puzzle of the day and Continue playing sit side by side */
.duo { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.duo > .daily, .duo > .hero { margin-top: 0; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 14px; border-radius: 22px; min-width: 0; }
.duo > .daily .calart, .duo > .hero .gicon.hero-art { order: -1; width: 52px; height: 52px; border-radius: 14px; }
.duo > .daily .calart { height: 58px; }
.duo > .daily .calart b { font-size: 1.35rem; }
.duo > .daily .calart i { padding: 4px 0 3px; font-size: .56rem; }
.duo > .daily .daily-text, .duo > .hero .hero-text { width: 100%; }
.duo .hero-text b, .duo .daily-text b { font-size: 1rem; line-height: 1.25; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.duo .hero-text small, .duo .hero-link { display: none; }
.duo .hero-label, .duo .daily-text small { font-size: .62rem; }
.duo .daily-go { margin-top: 6px; font-size: .8rem; }
.duo > :only-child { grid-column: 1 / -1; flex-direction: row; align-items: center; }
.duo > :only-child .hero-text small { display: block; }
`);
