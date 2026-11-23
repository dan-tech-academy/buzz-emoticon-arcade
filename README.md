# BUZZ! — Người que phá đảo

A Vietnamese stickman action platformer using the supplied Yahoo-era emoticons. Run across a neon city, double-jump gaps, fight minions and defeat three bosses. **Defeating a boss unlocks its emoji as an equipable combat power**, not just a collection picture.

## Run

Node.js 20+ only. No package installation, backend, API keys or account needed.

```sh
npm run dev     # source server on 5173
npm test
npm run build
npm start       # production build on 4173; override with PORT
```

## Play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Run | A/D or left/right | Hold direction |
| Double-jump | Space, W or up; press twice | Tap NHẢY twice |
| Use emoji | Hold J or X | Hold ĐÁNH |
| Dash / dodge | K or Shift | LƯỚT |
| BUZZ shockwave | E or L | BUZZ! |
| Equip unlocked emoji | 1–4 or weapon rack | Weapon rack / Kho emoji |
| Pause | P or Escape | Pause button |

- Start with **Cười xoáy** (melee). Defeat **Quỷ Spam** for fireballs, **Trùm Đóng Băng** for slowing ice shots, and **Thiên Thần Lỗi** for a wide slash that heals on kills.
- Each of three stages has platforms, three gaps, minions, a healing checkpoint and a boss arena. Bosses fire aimed projectiles, telegraph charges and enrage below half health.
- Jump on minions or dash through them to deal damage. BUZZ starts full, damages nearby enemies and destroys enemy projectiles. It recharges over time, on hits and through pickups.
- Falling costs one heart and returns you to safety. Death offers a checkpoint retry with full hearts and a reset boss encounter; there is no permanent dead-board state.
- Combo kills multiply points. Stage transitions retain run score; restarting a stage starts a new score. Permanent emoji unlocks, equipped power, current stage, record and sound preference persist locally. Reload starts a fresh attempt at the saved stage, not an exact frame restoration.
- Portrait and landscape touch controls support simultaneous movement, jumps and attacks. Physical mobile hardware has not been verified.

## Structure

- `src/engine.js`: pure fixed-step movement, collisions, combat, boss AI and unlock rules.
- `src/renderer.js`: responsive HiDPI canvas, parallax city, animated stick figures and combat effects.
- `src/app.js`: keyboard/multitouch input, audio, HUD, inventory, dialogs and local persistence.
- `scripts/serve.mjs`: dependency-free static server with an explicit public-route allowlist.

Sprites are cropped from the requester-supplied sheet in `public/emotes/`. No external fonts, analytics, network chat, service worker or multiplayer. This nostalgic project is not affiliated with Yahoo or claiming ownership of the original emoticons.
