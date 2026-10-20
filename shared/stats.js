// The stats page: streaks, a calendar of the days you played, your puzzle-of-the-day record and your best result in every game.
// Everything comes from the progress record kept on the device (and backed up if the player turned that on); nothing extra is stored.
//
// Loaded on demand by the home page when #stats is opened. To show a new game's best scores here, add it to BEST below.
(() => {
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // How each game's saved best is read. kind: time (milliseconds), moves, turns, guesses, squares, cards, pegs, number.
  // lv: names for the level part of the key (a number n is shown as `${n}×${n}` by 'grid', as `${n} discs` and so on by 'unit',
  // and as Level n+1 by 'level'); order puts the easiest first.
  const grid = { fmt: n => `${n}×${n}` };
  const unit = (word) => ({ fmt: n => `${n} ${word}` });
  const levelN = { fmt: n => `Level ${+n + 1}` };
  const names = o => ({ fmt: k => o[k] || k });
  const BEST = {
    'sudoku': { prefix: 'sudoku-best-', kind: 'time', lv: names({ mini: 'Mini', easy: 'Easy', medium: 'Medium', hard: 'Hard' }), order: ['mini', 'easy', 'medium', 'hard'] },
    'nonogram': { prefix: 'nonogram-best-', kind: 'time', lv: grid },
    'binary': { prefix: 'binary-best-', kind: 'time', lv: grid },
    'futoshiki': { prefix: 'futoshiki-best-', kind: 'time', lv: grid },
    'skyscrapers': { prefix: 'sky-best-', kind: 'time', lv: grid },
    'tents': { prefix: 'tents-best-', kind: 'time', lv: grid },
    'mines': { prefix: 'mines-best-', kind: 'time', lv: names({ easy: 'Easy', medium: 'Medium', hard: 'Hard' }), order: ['easy', 'medium', 'hard'] },
    'cages': { prefix: 'cages-best-', kind: 'time', lv: grid },
    'schulte-table': { prefix: 'schulte-best-', kind: 'time', lv: grid },
    'hanoi': { prefix: 'hanoi-best-', kind: 'moves', lv: unit('discs') },
    'chinese-rings': { prefix: 'rings-best-', kind: 'moves', lv: unit('rings') },
    'colour-flood': { prefix: 'flood-best-', kind: 'moves', lv: grid },
    'huarong-dao': { prefix: 'huarong-best-', kind: 'moves', lv: levelN },
    'traffic-jam': { prefix: 'traffic-best-', kind: 'moves', lv: levelN },
    'warehouse': { prefix: 'warehouse-best-', kind: 'moves', lv: levelN },
    'water-jugs': { prefix: 'jugs-best-', kind: 'moves', lv: levelN },
    'pipes': { prefix: 'pipes-best-', kind: 'moves', lv: grid },
    'bulls-and-cows': { prefix: 'bulls-best-', kind: 'guesses', lv: unit('digits') },
    'memory': { prefix: 'memory-best-', kind: 'turns', lv: unit('cards') },
    'knights-tour': { prefix: 'knight-best-', kind: 'squares', lv: grid },
    '2048': { key: '2048-best', kind: 'score' },
    'recall': { key: 'sequence-best', kind: 'pattern' },
    'grid-recall': { key: 'recall-grid-best', kind: 'level' },
    'digit-span': { prefix: 'span-best-', kind: 'digits', lv: names({ forward: 'Forward', backward: 'Backward' }), order: ['forward', 'backward'] },
    'golf': { key: 'golf-best', kind: 'cardsleft' },
    'accordion': { key: 'accordion-best', kind: 'piles' },
    'tripeaks': { key: 'tripeaks-best', kind: 'cardsleft' },
    'calculation': { key: 'calculation-best', kind: 'cardsleft' },
    'monte-carlo': { key: 'montecarlo-best', kind: 'cardsleft' },
    'peg-solitaire': { key: 'pegs-best', kind: 'pegsleft' },
    'maze': { prefix: 'maze-best-', kind: 'steps', lv: names({ 7: 'Small', 10: 'Medium', 14: 'Large' }), order: ['7', '10', '14'] },
    'one-stroke': { prefix: 'stroke-best-', kind: 'moves', lv: levelN },
    'next-in-line': { key: 'nextline-best', kind: 'streak' },
    'colour-word': { key: 'colourword-best', kind: 'score' },
    'odd-one-out': { key: 'oddone-best', kind: 'level' },
    'word-search': { prefix: 'wordsearch-best-', kind: 'moves', lv: grid },
  };
  // Games that only count wins.
  const COUNTS = { 'klondike': 'klondike-wins', 'pyramid': 'pyramid-wins', 'number-pyramid': 'pyramid-solved', 'pentominoes': 'pento-solved', 'target-number': 'target-solved', 'tchoukaillon': 'tchouk-solved', 'free-cells': 'freecells-wins' };

  const show = (kind, v) => {
    switch (kind) {
      case 'time': { const s = Math.floor(v / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; }
      case 'moves': return `${v} moves`;
      case 'turns': return `${v} turns`;
      case 'guesses': return `${v} guesses`;
      case 'squares': return `${v} squares`;
      case 'score': return `${v}`;
      case 'pattern': return `${v} in a row`;
      case 'level': return `Level ${v}`;
      case 'digits': return `${v} digits`;
      case 'cardsleft': return `${v} left`;
      case 'piles': return `${v} pile${v === 1 ? '' : 's'}`;
      case 'pegsleft': return `${v} left`;
      case 'streak': return `${v} in a row`;
      case 'steps': return `${v} steps`;
      case 'wins': return `${v} won`;
      default: return String(v);
    }
  };

  const longestStreak = days => {
    const set = [...new Set(days)].sort();
    let best = 0, run = 0, prev = null;
    for (const d of set) {
      const ms = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
      run = prev !== null && ms - prev === 86400000 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = ms;
    }
    return best;
  };

  // ---- Puzzle of the day record (kept on this device) ----
  const dailyDays = () => { try { const v = JSON.parse(localStorage.getItem('mg-daily')); return Array.isArray(v) ? v.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : []; } catch { return []; } };

  function calendar(days) {
    const played = new Set(days);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weeks = 15;
    const dow = (today.getDay() + 6) % 7;                  // Monday = 0
    const start = new Date(today); start.setDate(start.getDate() - dow - (weeks - 1) * 7);
    let cells = '', count = 0;
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
      if (day > today) { cells += '<i class="cal-empty"></i>'; continue; }
      const k = dayKey(day), on = played.has(k);
      if (on) count++;
      cells += `<i class="${on ? 'cal-on' : ''}${k === dayKey(today) ? ' cal-today' : ''}" title="${day.toDateString()}${on ? ': played' : ''}"></i>`;
    }
    return { html: `<div class="cal" role="img" aria-label="You played on ${count} of the last ${weeks * 7} days">${cells}</div>`, count };
  }

  function render(el, P) {
    let st = { bests: {}, stats: {}, days: [], lists: {} };
    try { st = { ...st, ...P._state() }; } catch {}
    const get = k => { const b = st.bests && st.bests[k]; return b && Number.isFinite(b.v) ? b.v : null; };
    const days = Array.isArray(st.days) ? st.days : [];
    let sum = { streak: 0, plays: 0 };
    try { sum = P.summary(); } catch {}
    const cal = calendar(days);
    const dd = dailyDays();
    const dailyStreak = (() => {
      const have = new Set(dd); const d = new Date(); d.setHours(0, 0, 0, 0);
      if (!have.has(dayKey(d))) d.setDate(d.getDate() - 1);
      let n = 0; while (have.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
      return n;
    })();
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

    // best results per game, grouped by section
    const rows = [];
    for (const g of GAMES) {
      const info = BEST[g.id];
      const chips = [];
      if (info && info.key) { const v = get(info.key); if (v !== null) chips.push({ label: '', text: show(info.kind, v) }); }
      if (info && info.prefix) {
        const found = Object.keys(st.bests || {}).filter(k => k.startsWith(info.prefix)).map(k => ({ lv: k.slice(info.prefix.length), v: get(k) })).filter(x => x.v !== null);
        found.sort((a, b) => {
          const ia = info.order ? info.order.indexOf(a.lv) : -1, ib = info.order ? info.order.indexOf(b.lv) : -1;
          if (info.order) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          return (+a.lv || 0) - (+b.lv || 0);
        });
        for (const x of found) chips.push({ label: info.lv ? info.lv.fmt(x.lv) : x.lv, text: show(info.kind, x.v) });
      }
      // 15-Puzzle keeps moves and time together in one number
      if (g.id === '15-puzzle') {
        for (const k of Object.keys(st.bests || {}).filter(k => /^fifteen-best-\d+$/.test(k)).sort()) {
          const v = get(k); if (v !== null) chips.push({ label: `${k.split('-').pop()}×${k.split('-').pop()}`, text: `${Math.floor(v / 1e5)} moves` });
        }
      }
      if (COUNTS[g.id]) { const n = (st.stats && st.stats[COUNTS[g.id]]) || 0; if (n > 0) chips.push({ label: 'Won', text: String(n) }); }
      if (chips.length) rows.push({ g, chips });
    }
    const art = g => (window.MG && MG.iconAttrs ? MG.iconAttrs(g) : '');
    const longest = longestStreak(days);
    el.innerHTML = `
      <div class="topbar"><a class="back" href="#all">‹ All games</a></div>
      <h2 class="view-title">Your stats</h2>
      <p class="section-blurb">Kept on this device${P.configured && P.configured() && P.syncEnabled && P.syncEnabled() ? ' and backed up online' : ''}. Nothing here is shared.</p>

      <section class="st-card st-hero">
        <div class="st-big"><b class="st-num">${sum.streak || 0}</b><span>day streak</span></div>
        <dl class="st-facts">
          <div><dt>Longest streak</dt><dd><b class="st-num">${longest}</b> ${longest === 1 ? 'day' : 'days'}</dd></div>
          <div><dt>Days played</dt><dd><b class="st-num">${days.length}</b></dd></div>
          <div><dt>Games played</dt><dd><b class="st-num">${sum.plays || 0}</b></dd></div>
        </dl>
      </section>

      <section class="st-card">
        <h3>Activity <small>last 15 weeks · ${plural(cal.count, 'day')} played</small></h3>
        ${cal.html}
      </section>

      <section class="st-card">
        <h3>Puzzle of the day</h3>
        <dl class="st-facts">
          <div><dt>Completed</dt><dd><b class="st-num">${dd.length}</b></dd></div>
          <div><dt>Current streak</dt><dd><b class="st-num">${dailyStreak}</b> ${dailyStreak === 1 ? 'day' : 'days'}</dd></div>
        </dl>
      </section>

      <h3 class="st-title">Best results <small>${plural(rows.length, 'game')}</small></h3>
      ${rows.length ? SECTIONS.map(s => {
        const mine = rows.filter(r => r.g.sec === s.id);
        return mine.length ? `<h4 class="st-sec">${esc(s.name)}</h4>` + mine.map(r => `
          <div class="st-row">
            <span class="mini sec-${r.g.sec}${r.g.icon.length > 2 ? ' small' : ''}" ${art(r.g)} aria-hidden="true"><span class="gglyph">${esc(r.g.icon)}</span></span>
            <a class="st-name" href="games/${r.g.id}/">${esc(r.g.name)}</a>
            <div class="st-vals">${r.chips.map(c => `<span>${c.label ? `<small>${esc(c.label)}</small>` : ''}<b>${esc(c.text)}</b></span>`).join('')}</div>
          </div>`).join('') : '';
      }).join('') : '<p class="empty">Finish a puzzle and your best results will appear here.</p>'}
      <p class="lists-link"><a href="#lists">Your lists and favourites ›</a></p>`;
  }

  window.MGStats = { render, longestStreak, BEST };
})();
