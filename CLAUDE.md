# Mind Games: notes for Claude

A calm website of single-player puzzle and mind games from around the world. Live at https://nishit93.github.io/mind-games/ (GitHub Pages, published straight from `main`; no build step). The plan is to turn it into Android and iOS apps later, most likely by wrapping this same code with Capacitor.

## Working rules from the owner

- **Always commit and push to GitHub when a piece of work is done.** Nothing should exist only on the laptop. Before finishing, check `git status` is clean and `git log origin/main..main` is empty.
- **Keep this project separate.** It lives in its own folder and repo. Never put its files or settings in other projects (for example `D:\TradApp`, which is an unrelated trading app).
- **Single-player games only** for now. No games against the computer or another player unless the owner asks.
- **Use plain, traditional game names**, never brand or trademark names (that's why it's "Lights Off", "Mines" and "Recall", not "Lights Out", "Minesweeper" or "Simon"). Brands may be mentioned only in the history notes.
- Every game needs a **How to play** section: goal, rules, how the controls work, tips, and a short history.
- Keep the design calm: soft colours, gentle motion, no harsh alerts. The colours come from recent Pantone Colours of the Year: Cloud Dancer (2026), Mocha Mousse (2025), Peach Fuzz (2024), Very Peri (2022), plus Ultimate Gray (2021). Light and dark mode are both supported.
- Test changes in the browser at phone width before pushing, then check the live site after the push.

## Backend

Player progress (favourites, best scores, streaks, settings) is stored by a separate **private** repo, `nishit93/mind-games-api` (folder `D:\MindGamesApi`), hosted on Oracle Cloud Always Free in Mumbai. Players are anonymous guests, with no personal data. Until the server is live, the site keeps working from browser storage alone, and sync must stay optional so the site works offline and without the server.

## How the code is organised

- `games.js`: the sections (`SECTIONS`: logic, math, moves, memory, cards) and the list of games (`GAMES`: id, sec, name, origin, icon, blurb, and `kids: true` for games that suit children). The menu, the home page and the offline cache all read it.
- `shell.js`: shared header, hamburger menu (grouped by section, with search), "More in …" links under each game, recently played, and helpers on `window.MG` (`kids`, `store`, `fmt`, `overlay`, `seg`, `clock`, `wait`, `shuffle`).
- **Kids:** games opened from the Kids section get `?kids` in the URL, and `MG.kids` is true. Kid-tagged games must then start on their easiest setting.
- `index.html`: home page with search, filter chips (All, Kids, each section), Continue playing, and the games by section.
- `styles.css`: shared styles and colour tokens.
- `shared/`: code used by several games: `combine.js` (Make 24, Target Number), `latin.js` (Futoshiki, Skyscrapers), `cards.js` (Klondike, Pyramid, Golf).
- `sw.js`: offline support (network first, cache as fallback). Bump `CACHE` when the file list changes, and list any new `shared/` file there.
- `games/<id>/index.html` holds the page and its How to play text; `games/<id>/game.js` holds the game logic.
- To add a game, copy an existing game folder's structure and add one entry to `games.js` with its section.
- Puzzles that promise one solution or a "fewest possible" number must be checked with a solver (in the game, or offline when levels are fixed).

## Local preview

`node .claude/serve.mjs 8766` and open http://localhost:8766 (also set up as `mindgames` in `.claude/launch.json`). Python on this laptop is only the Microsoft Store placeholder, so use Node. If the preview tool starts some other project's server instead, stop it and run `node .claude/serve.mjs 8766` in the background, then open http://localhost:8766 in the browser pane.
