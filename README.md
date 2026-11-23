# BUZZ! — Một thời online

A Vietnamese, Yahoo-inspired emoji chain puzzle, made from the emoticon sheet supplied by the requester. Match adjacent faces (including diagonals), finish three collection goals in 20 moves, and reconnect a nostalgic chat room. Works with mouse, touch, or keyboard.

## Run

Node.js 20+ is the only requirement. No package installation, API keys, account, database, or service worker is needed.

```sh
npm run dev     # http://localhost:5173
npm test
npm run build
npm start       # production server on 4173; override with PORT
```

## Play

- Click or drag across at least three matching neighbors, then press **Gửi cảm xúc** (or Space).
- Longer chains earn bonus points. Complete all three goals before the 20 moves run out.
- **BUZZ!** clears a 3×3 area for one move. Start with one charge; collect 18 regular faces to recharge (up to three).
- Hints are free; shuffling costs one move. The board always contains a valid chain.
- Win to advance to a harder room and unlock another of the 16 supplied faces.
- Best score, collection, and sound preference stay in this browser's local storage. The active round resets on reload. No personal data is sent anywhere.
- Arrow keys move grid focus, Enter selects, Space sends, and Escape cancels a selection or closes a dialog. `?` opens the instructions.

The optional Google Font has a system fallback. The supplied sprites are cropped and isolated as PNGs in `public/emotes/`. They are user-provided nostalgic artwork; this project is not affiliated with Yahoo and does not claim ownership of the original emoticons.

`src/engine.js` contains the pure game rules; `src/app.js` handles the accessible browser UI; `scripts/serve.mjs` serves the production build without dependencies. Progress is local only; there are no multiplayer, accounts, paid features, or network chat. The chat panel reacts to your actual game actions.
