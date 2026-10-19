# Mind Games: notes for Claude

A calm website of single-player puzzle and mind games from around the world. Live at https://nishit93.github.io/mind-games/ (GitHub Pages, published straight from `main`; no build step). The plan is to turn it into Android and iOS apps later, most likely by wrapping this same code with Capacitor.

## Working rules from the owner

- **Always commit and push to GitHub when a piece of work is done.** Nothing should exist only on the laptop. Before finishing, check `git status` is clean and `git log origin/main..main` is empty.
- **Keep this project separate.** It lives in its own folder and repo. Never put its files or settings in other projects (for example `D:\TradApp`, which is an unrelated trading app).
- **Single-player games only** for now. No games against the computer or another player unless the owner asks.
- Every game needs a **How to play** section: goal, rules, how the controls work, tips, and a short history.
- Keep the design calm: soft colours, gentle motion, no harsh alerts. The colours come from recent Pantone Colours of the Year: Cloud Dancer (2026), Mocha Mousse (2025), Peach Fuzz (2024), Very Peri (2022), plus Ultimate Gray (2021). Light and dark mode are both supported.
- Test changes in the browser at phone width before pushing, then check the live site after the push.

## How the code is organised

- `games.js`: the list of games (id, name, origin, icon, blurb). The menu, the home page and the offline cache all read it.
- `shell.js`: shared header, hamburger games menu, How to play toggle, and helpers on `window.MG` (`store`, `fmt`, `overlay`, `seg`, `clock`, `wait`, `shuffle`).
- `styles.css`: shared styles and colour tokens.
- `sw.js`: offline support (network first, cache as fallback). Bump `CACHE` when the file list changes.
- `games/<id>/index.html` holds the page and its How to play text; `games/<id>/game.js` holds the game logic.
- To add a game, copy an existing game folder's structure and add one entry to `games.js`.

## Local preview

`node .claude/serve.mjs 8766` and open http://localhost:8766 (also set up as `mindgames` in `.claude/launch.json`). Python on this laptop is only the Microsoft Store placeholder, so use Node.
