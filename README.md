# Mind Games

Calm, single-player puzzle and mind games from around the world. A static, installable web app (PWA) with no build step.

- `games.js`: the list of games, used by the menu, the home page and the offline cache
- `shell.js`: shared header, games menu, how-to toggle, and small helpers (`window.MG`)
- `styles.css`: shared styles; palette from recent Pantone Colors of the Year
- `games/<id>/`: one folder per game (`index.html` with its how-to, `game.js`)

To add a game: create `games/<id>/` like the others and add an entry to `games.js`.

Run locally: `python -m http.server -d .` then open http://localhost:8000.
