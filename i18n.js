// Languages. English is the default and the source text everywhere. A chosen language is kept on this device (localStorage "mg-lang")
// and loaded from lang/<code>.js (the interface) and lang/<code>.games.js (how to play, history, tutorial steps for every game).
// The page itself stays English in the file (search engines read that); this layer swaps the words in the browser.
//
// How it works:
//  - the interface is a dictionary of English text -> translated text, plus patterns for text with numbers or names in it;
//    a small observer translates text and labels as they appear, so games and tutorials need no changes to their own code;
//  - per-game content (rules, tips, history, tutorial steps) is positional: the n-th paragraph of the how-to box, and so on;
//  - game names stay in English (they are never in the dictionary), and so does anything not found: English is the fallback.
// To add a language: add it to LANGS and FILES below, write lang/<code>.js and lang/<code>.games.js, and that is all.
(() => {
  const LANGS = [{ code: 'en', label: 'English' }, { code: 'hi', label: 'हिन्दी' }];
  const FILES = { hi: ['hi.js', 'hi.games1.js', 'hi.games2.js', 'hi.games3.js', 'hi.games4.js', 'hi.play.js'] };

  let code = 'en';
  try { const v = localStorage.getItem('mg-lang'); if (LANGS.some(l => l.code === v)) code = v; } catch (e) { /* storage may be blocked */ }

  const cs = document.currentScript;
  const base = cs && cs.src ? cs.src.replace(/[^/]*$/, '') : '';
  const pack = { dict: {}, patterns: [], games: {}, sections: {}, ui: {}, labels: {} };
  const L = window.MGLang = { code, langs: LANGS, pack, loaded: false, base: base.replace(/\/$/, '') ? base : '' };
  const cache = new Map();

  L.add = part => {
    if (!part) return;
    Object.assign(pack.dict, part.dict || {});
    (part.patterns || []).forEach(p => pack.patterns.push(p));
    Object.assign(pack.games, part.games || {});
    Object.assign(pack.sections, part.sections || {});
    Object.assign(pack.ui, part.ui || {});
    Object.assign(pack.labels, part.labels || {});
  };

  // Translate one piece of text. Returns the same text when there is no translation.
  L.t = s => {
    if (code === 'en' || typeof s !== 'string') return s;
    if (cache.has(s)) return cache.get(s);
    let r = pack.dict[s];
    if (r === undefined) {
      for (const [re, rep] of pack.patterns) {
        const m = re.exec(s);
        if (m) { r = typeof rep === 'function' ? rep(...m.slice(1)) : s.replace(re, rep); break; }
      }
    }
    if (r === undefined) {
      // a leading symbol (a heart, an arrow, a sun) is kept: translate the words after it
      const m = /^([^A-Za-z0-9]+)([A-Za-z].*)$/.exec(s);
      if (m) { const r2 = L.t(m[2]); if (r2 !== m[2]) r = m[1] + r2; }
    }
    if (r === undefined) r = s;
    if (cache.size > 3000) cache.clear();
    cache.set(s, r);
    return r;
  };

  L.set = c => {
    if (!LANGS.some(l => l.code === c)) return;
    try { localStorage.setItem('mg-lang', c); } catch (e) { /* the choice just will not be remembered */ }
    location.reload();
  };

  // A tutorial step: the translated step if the game has one, else the dictionary, else English.
  L.tut = (id, i, en) => {
    const g = pack.games[id];
    return g && g.steps && g.steps[i] ? g.steps[i] : L.t(en);
  };

  const LATIN = /[A-Za-z]{2,}/;
  const SKIP = 'script,style,textarea,[data-no-i18n]';
  const trNode = n => {
    const v = n.nodeValue;
    if (!v || !LATIN.test(v)) return;
    const p = n.parentElement;
    if (p && p.closest && p.closest(SKIP)) return;
    const s = v.trim();
    if (!s) return;
    // a game name in front of its number (Mines 10) is a label; anywhere else it is a name and stays English
    const r = pack.labels[s] && n.nextSibling && n.nextSibling.nodeType === 1 ? pack.labels[s] : L.t(s);
    if (r !== s) n.nodeValue = v.slice(0, v.indexOf(s)) + r + v.slice(v.indexOf(s) + s.length);
  };
  const ATTRS = ['aria-label', 'title', 'placeholder'];
  const trAttrs = el => {
    if (el.closest && el.closest('[data-no-i18n]')) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && LATIN.test(v)) { const r = L.t(v.trim()); if (r !== v.trim()) el.setAttribute(a, r); }
    }
  };
  const walk = root => {
    if (root.nodeType === 3) { trNode(root); return; }
    if (root.nodeType !== 1) return;
    if (root.matches && root.matches(SKIP)) return;
    trAttrs(root);
    const tw = document.createTreeWalker(root, 4);
    let n;
    while ((n = tw.nextNode())) trNode(n);
    if (root.querySelectorAll) root.querySelectorAll('[aria-label],[title],[placeholder]').forEach(trAttrs);
  };
  L.walk = walk;

  // The per-game page text: rules, tips and history, by position.
  function applyGamePage() {
    const id = document.body && document.body.dataset && document.body.dataset.game;
    const g = id && pack.games[id];
    if (!g) return;
    const how = document.querySelector('details.howto');
    if (how && g.how) {
      const all = [...how.querySelectorAll('h3, p, li')].filter(e => !e.closest('.demo-btn') && !e.querySelector('.demo-btn'));
      // a list inside a list item is part of that item's text
      const els = all.filter(e => !all.some(o => o !== e && o.contains(e)));
      els.forEach((e, i) => { if (typeof g.how[i] === 'string') e.innerHTML = g.how[i]; });
    }
    const hp = document.querySelector('#history p');
    if (hp && g.history) hp.innerHTML = g.history;
  }

  let finished = false;
  // Called at the end of the last language file: patch the shared lists, then translate the page and keep it translated.
  L.finish = () => {
    if (finished || code === 'en') return;
    finished = true;
    L.loaded = true;
    try {
      if (typeof SECTIONS === 'object') SECTIONS.forEach(s => { const p = pack.sections[s.id]; if (p) { if (p.name) s.name = p.name; if (p.blurb) s.blurb = p.blurb; if (p.short) s.short = p.short; } });
      if (typeof GAMES === 'object') GAMES.forEach(g => { const p = pack.games[g.id]; if (p) { if (p.origin) g.origin = p.origin; if (p.blurb) g.blurb = p.blurb; } });
    } catch (e) { console.error(e); }
    const go = () => { try { applyGamePage(); walk(document.body); } catch (e) { console.error(e); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    try {
      new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === 'childList') m.addedNodes.forEach(walk);
          else if (m.type === 'characterData') trNode(m.target);
          else if (m.type === 'attributes') trAttrs(m.target);
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    } catch (e) { /* an old browser: the page stays in English */ }
  };

  if (code !== 'en') {
    document.documentElement.setAttribute('lang', code);
    document.documentElement.setAttribute('data-lang', code);
    // the page is already in the chosen language, so the browser should not offer to translate it
    document.documentElement.setAttribute('translate', 'no');
    try { const m = document.createElement('meta'); m.name = 'google'; m.content = 'notranslate'; document.head.appendChild(m); } catch (e) { /* optional */ }
    // Load the language files in order, right now (the next scripts on the page then see the translated lists).
    (FILES[code] || []).forEach(f => document.write('<script src="' + base + 'lang/' + f + '"><\/script>'));
    // If the content file could not be loaded, still translate what did load once the page is ready.
    document.addEventListener('DOMContentLoaded', () => L.finish());
  }
})();
