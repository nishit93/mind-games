# Mind Games: notes for Claude

A calm website of single-player puzzle and mind games from around the world. Live at https://nishit93.github.io/mind-games/ (GitHub Pages, published straight from `main`; no build step). The plan is to turn it into Android and iOS apps later, most likely by wrapping this same code with Capacitor.

## Working rules from the owner

- **Always commit and push to GitHub when a piece of work is done.** Nothing should exist only on the laptop. Before finishing, check `git status` is clean and `git log origin/main..main` is empty.
- **Keep this project separate.** It lives in its own folder and repo. Never put its files or settings in other projects (for example `D:\TradApp`, which is an unrelated trading app).
- **Single-player games only** for now. No games against the computer or another player unless the owner asks.
- **Use plain, traditional game names**, never brand or trademark names (that's why it's "Lights Off", "Mines" and "Recall", not "Lights Out", "Minesweeper" or "Simon"). Brands may be mentioned only in the history notes.
- Every game needs a **How to play** section: goal, rules, how the controls work, tips, and a short history.
- Keep the design calm: soft colours, gentle motion, no harsh alerts. The colours come from recent Pantone Colours of the Year: Cloud Dancer (2026), Mocha Mousse (2025), Peach Fuzz (2024), Very Peri (2022), plus Ultimate Gray (2021). Light and dark mode are both supported.
- **Never break what already works.** New features must fail safe: if a new script is missing, broken or old, the games must still load and play (`shell.js` installs a fallback for `MGProgress`, and the home page falls back to a plain list). Don't initialise things in an order that only works on a clean browser.
- **Run the complete test before and after every deployment, not a spot check.** Open `tools/smoke.html` (locally, then on the live site after the push) and the result must read PASS. It checks every file, all games, the home page from a new visitor *and* from returning players with old or damaged saved data, favourites and scores, and plays five games to a win. Add `?lenient=1` to only require that everything is playable (for mixed-version tests) and `?quick=1` to skip the play-throughs.
- **Test from a returning player's state, not only a clean browser.** Many real visitors have saved data from earlier versions. A change to saved data or startup code needs a test with old keys already in localStorage. When you add a new kind of state or startup step, add a matching case to `STATES` in `tools/smoke.js`.
- For a major change, also test stale-file mixtures (old pages with new scripts, new pages with old scripts, a missing or corrupt new script) by serving copies of the site built from `git show <old commit>:<file>`.
- When the live site breaks, restore a working site first (fix forward if it is small, otherwise revert), then explain.
- Test changes in the browser at phone width before pushing, then check the live site after the push.

## Backend

Player progress (favourites, best scores, streaks, settings) is stored by a separate **private** repo, `nishit93/mind-games-api` (folder `D:\MindGamesApi`), hosted on Oracle Cloud Always Free in Mumbai. Players are anonymous guests, with no personal data.

- The site works fully from browser storage alone; sync is optional and must never block play. Sync is **off until `MG_CONFIG.api` in `games.js` is set** to the server's HTTPS address. For local testing, `localStorage['mg-api']` overrides it (only https, localhost or 127.0.0.1 are accepted).
- `progress.js` is the client side. The games keep writing their own localStorage keys through `MG.store.set`, and `progress.js` mirrors the ones that matter (it recognises them by name: `*-best*`, `*-solved`/`*-wins`, and settings ending in `-level`, `-n`, `-size`, `-draw`, `-rows`, `-len`, `-mode`, `-speed`, `-sound`, `-shade`, `-seeds`). **A new game that follows these key names is synced automatically.** Add a rule in `classify()` for any other key, and add `-best` keys where higher is better to `HIGHER_BETTER`.
- The client does not merge: it sends its whole record and replaces it with the server's merged answer. The merge rules live only in the API repo (`src/merge.js`).
- A guest is created on the server only after real progress exists (a play, a favourite or a score), not on a plain visit. A "progress code" (id and secret) moves progress to another device; "Erase my online data" calls `DELETE /v1/me`.
- Not synced on purpose: `recent`, `seen-*`, `install-dismissed`, `queens-found-*` (too large) and `m24-tally`.

## How the code is organised

- `games.js`: the sections (`SECTIONS`: logic, math, moves, memory, cards) and the list of games (`GAMES`: id, sec, name, origin, icon, blurb, and `kids: true` for games that suit children). The menu, the home page and the offline cache all read it.
- `shell.js`: shared header, hamburger menu (grouped by section, with search), "More in …" links under each game, recently played, and helpers on `window.MG` (`kids`, `store`, `fmt`, `overlay`, `seg`, `clock`, `wait`, `shuffle`).
- **Kids:** games opened from the Kids section get `?kids` in the URL, and `MG.kids` is true. Kid-tagged games must then start on their easiest setting.
- `progress.js`: favourites, streaks, scores and settings kept on the device and optionally synced (`window.MGProgress`). Load it before `shell.js` on every page.
- `index.html`: the home page, designed to stay calm and short (about 1.8 phone screens). One **hero** card (Continue playing, or Today's pick), then **shelves** of icon-and-name cards that swipe sideways (Your favourites if any, Great for kids, one per section), each with "See all" that opens a **list** (`#logic`, `#math`, `#moves`, `#memory`, `#cards`, `#kids`, `#favs`) with blurbs and a heart per row. Search replaces the view with a list of matches. The streak and play count are one line under the title, and progress and backup are in a folded section at the bottom. **Keep it decluttered:** don't add more banners, chips or panels to the top of the home page; hearts live in the lists and on game pages, not on every card; a new game appears automatically in its section's shelf and list.
- Section colours: `.sec-logic`, `.sec-math`, `.sec-moves`, `.sec-memory`, `.sec-cards` set the icon colours (Pantone-based) for shelf cards, list rows, the menu and the hero.
- `styles.css`: shared styles and colour tokens.
- `shared/`: code used by several games: `combine.js` (Make 24, Target Number), `latin.js` (Futoshiki, Skyscrapers), `cards.js` (Klondike, Pyramid, Golf).
- `sw.js`: offline support (network first, cache as fallback). Bump `CACHE` when the file list changes, and list any new `shared/` file there.
- `games/<id>/index.html` holds the page and its How to play text; `games/<id>/game.js` holds the game logic.
- To add a game, copy an existing game folder's structure and add one entry to `games.js` with its section.
- Puzzles that promise one solution or a "fewest possible" number must be checked with a solver (in the game, or offline when levels are fixed).

## Local preview

`node .claude/serve.mjs 8766` and open http://localhost:8766 (also set up as `mindgames` in `.claude/launch.json`). Python on this laptop is only the Microsoft Store placeholder, so use Node. If the preview tool starts some other project's server instead, stop it and run `node .claude/serve.mjs 8766` in the background, then open http://localhost:8766 in the browser pane.
