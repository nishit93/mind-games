// A quiet personalisation layer: a map of how alike the games are, and a taste profile kept on this device.
// Each game has a small vector over nine skills (0 = not at all, 3 = very much). Sections are the mean of their games.
// The home page uses it to put the sections you lean towards first, and, inside each, the games closest to your taste.
// Nothing leaves the device. If this file is missing or broken, the home page simply keeps its default order.
//
// Dimensions: deduce, number, space, memory, attention, plan, cards, visual, gentle
// A new game needs a row in VEC (the smoke test fails without one).
(() => {
  const DIMS = ['deduce', 'number', 'space', 'memory', 'attention', 'plan', 'cards', 'visual', 'gentle'];
  const VEC = {
    'sudoku': [3, 2, 0, 0, 0, 1, 0, 1, 1], 'nonogram': [3, 1, 0, 0, 1, 1, 0, 3, 1], 'binary': [3, 0, 0, 0, 0, 1, 0, 2, 0],
    'futoshiki': [3, 3, 0, 0, 0, 1, 0, 0, 0], 'skyscrapers': [3, 2, 1, 0, 0, 1, 0, 2, 0], 'tents': [3, 0, 1, 0, 0, 2, 0, 2, 0],
    'mines': [3, 1, 1, 0, 1, 1, 0, 1, 0], 'lights-off': [2, 0, 1, 0, 0, 3, 0, 2, 1], 'pipes': [1, 0, 3, 0, 0, 2, 0, 2, 1],
    'colour-flood': [0, 0, 1, 0, 0, 3, 0, 3, 1], 'eight-queens': [2, 0, 2, 0, 0, 3, 0, 1, 1], 'knights-tour': [1, 0, 3, 0, 0, 3, 0, 1, 0],
    'bulls-and-cows': [3, 2, 0, 1, 0, 2, 0, 0, 1], 'one-stroke': [1, 0, 2, 0, 0, 3, 0, 3, 1],
    'magic-square': [2, 3, 0, 0, 0, 2, 0, 1, 1], 'make-24': [1, 3, 0, 0, 1, 2, 0, 0, 1], 'target-number': [1, 3, 0, 0, 0, 2, 0, 0, 0],
    'next-in-line': [2, 2, 0, 1, 1, 0, 0, 2, 1], 'number-pyramid': [2, 3, 0, 0, 0, 1, 0, 1, 1], 'cages': [3, 3, 0, 0, 0, 1, 0, 1, 0],
    'water-jugs': [2, 2, 0, 0, 0, 3, 0, 0, 1], 'chinese-rings': [1, 0, 1, 1, 0, 3, 0, 1, 0], 'tchoukaillon': [1, 2, 0, 0, 0, 3, 0, 0, 0],
    '15-puzzle': [0, 1, 3, 0, 0, 3, 0, 1, 1], 'hanoi': [1, 0, 3, 0, 0, 3, 0, 1, 1], 'huarong-dao': [0, 0, 3, 0, 0, 3, 0, 2, 1],
    'traffic-jam': [0, 0, 3, 0, 0, 3, 0, 2, 1], 'maze': [0, 0, 3, 0, 1, 2, 0, 2, 1], 'warehouse': [0, 0, 3, 0, 0, 3, 0, 2, 0],
    'pentominoes': [0, 0, 3, 0, 0, 2, 0, 3, 0], 'peg-solitaire': [1, 0, 2, 0, 0, 3, 0, 1, 0], '2048': [0, 3, 2, 0, 1, 3, 0, 1, 0],
    'memory': [0, 0, 0, 3, 1, 0, 0, 2, 3], 'recall': [0, 0, 0, 3, 2, 0, 0, 1, 1], 'schulte-table': [0, 2, 0, 0, 3, 0, 0, 2, 1],
    'grid-recall': [0, 0, 1, 3, 1, 0, 0, 2, 1], 'digit-span': [0, 2, 0, 3, 0, 0, 0, 0, 0], 'odd-one-out': [0, 0, 0, 0, 3, 0, 0, 3, 3],
    'colour-word': [0, 0, 0, 1, 3, 0, 0, 1, 0], 'word-search': [0, 0, 0, 0, 3, 0, 0, 2, 2],
    'klondike': [0, 0, 0, 1, 0, 3, 3, 1, 0], 'pyramid': [0, 3, 0, 0, 0, 2, 3, 0, 1], 'golf': [0, 1, 0, 0, 1, 2, 3, 0, 1],
    'mahjong-solitaire': [0, 0, 1, 2, 2, 1, 0, 3, 0], 'free-cells': [1, 0, 0, 0, 0, 3, 3, 0, 0], 'accordion': [0, 0, 0, 1, 1, 3, 3, 1, 0],
    'tripeaks': [0, 1, 0, 0, 1, 2, 3, 0, 0], 'calculation': [0, 3, 0, 1, 0, 3, 3, 0, 0], 'monte-carlo': [0, 0, 1, 1, 3, 1, 3, 1, 0],
    'find-the-cat': [0, 0, 0, 0, 3, 0, 0, 3, 3], 'find-them-all': [0, 1, 0, 1, 3, 0, 0, 3, 3], 'hide-and-seek': [0, 0, 0, 2, 1, 1, 0, 1, 3],
  };
  const NEUTRAL = DIMS.map(() => 1);

  const norm = v => { const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0)); return m ? v.map(x => x / m) : v.map(() => 0); };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const cos = (a, b) => dot(norm(a), norm(b));
  const vec = id => VEC[id] || NEUTRAL;

  const secVec = secId => {
    const ids = (typeof GAMES === 'object' ? GAMES : []).filter(g => g.sec === secId).map(g => vec(g.id));
    return ids.length ? DIMS.map((_, i) => ids.reduce((s, v) => s + v[i], 0) / ids.length) : NEUTRAL;
  };

  // ---- Taste: how often, and how recently, each game was played on this device ----
  const KEY = 'mg-taste';
  const HALF_LIFE = 30 * 864e5;
  const read = () => {
    try {
      const o = JSON.parse(localStorage.getItem(KEY));
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch { return {}; }
  };
  const write = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage may refuse */ } };

  function record(id) {
    if (!VEC[id]) return;
    const o = read();
    const cur = o[id] && typeof o[id] === 'object' ? o[id] : {};
    o[id] = { n: (+cur.n > 0 ? +cur.n : 0) + 1, t: Date.now() };
    write(o);
  }

  // id -> weight (plays, fading with a 30 day half-life). Older players with no taste yet get a gentle seed from "recent".
  function weights() {
    const o = read();
    const now = Date.now();
    const w = {};
    for (const [id, v] of Object.entries(o)) {
      if (!VEC[id] || !v || typeof v !== 'object') continue;
      const n = +v.n, t = +v.t;
      if (!(n > 0)) continue;
      w[id] = n * Math.pow(0.5, Math.max(0, now - (t > 0 ? t : now)) / HALF_LIFE);
    }
    if (!Object.keys(w).length) {
      try {
        const rec = JSON.parse(localStorage.getItem('recent'));
        if (Array.isArray(rec)) rec.slice(0, 6).forEach((id, i) => { if (VEC[id]) w[id] = (w[id] || 0) + (6 - i) / 6; });
      } catch { /* no recent list */ }
    }
    return w;
  }

  const total = w => Object.values(w).reduce((s, x) => s + x, 0);
  const profile = w => {
    const p = DIMS.map(() => 0);
    for (const [id, x] of Object.entries(w)) norm(vec(id)).forEach((c, i) => { p[i] += c * x; });
    return p;
  };

  // Stable sort by score, highest first; equal scores keep their original order.
  const rank = (items, score) => items.map((x, i) => ({ x, i, s: score(x) })).sort((a, b) => (b.s - a.s) || (a.i - b.i)).map(o => o.x);

  function rankSections(sections) {
    try {
      const w = weights(), tot = total(w);
      if (!(tot > 0)) return sections;
      const p = profile(w);
      return rank(sections, s => {
        const ids = (typeof GAMES === 'object' ? GAMES : []).filter(g => g.sec === s.id).map(g => g.id);
        const share = ids.reduce((sum, id) => sum + (w[id] || 0), 0) / tot;
        return 0.5 * cos(p, secVec(s.id)) + 0.5 * share;
      });
    } catch { return sections; }
  }

  function rankGames(games) {
    try {
      const w = weights(), tot = total(w);
      if (!(tot > 0)) return games;
      const p = profile(w);
      const top = Math.max(...Object.values(w));
      return rank(games, g => 0.55 * cos(p, vec(g.id)) + 0.45 * ((w[g.id] || 0) / top));
    } catch { return games; }
  }

  // The nearest games to one game (for tools and future "more like this" links).
  function nearest(id, n = 5) {
    const base = vec(id);
    return Object.keys(VEC).filter(k => k !== id).map(k => ({ id: k, d: 1 - cos(base, VEC[k]) })).sort((a, b) => a.d - b.d).slice(0, n);
  }

  window.MGTaste = { DIMS, VEC, vec, cos, secVec, record, weights, rankSections, rankGames, nearest, KEY };
})();
