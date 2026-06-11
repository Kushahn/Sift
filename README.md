# Sift

Type anything — it finds its place. A capture-and-route organizer: free-form input is classified into trays (tasks, ideas, plans, schedule), low-confidence routes ask you, and "nothing fits" proposes a new tray. Personal and Corporate workspaces share one engine. Data persists on-device.

Design language: Risograph print shop (real riso spot-ink hexes, paper grain, off-register marks) × Teenage Engineering hardware (mono labels, hard shadows, buttons that physically press).

## Requirements
Node 18+. For native Android builds: Android Studio with SDK.

## Run on PC
```bash
npm install
npm run dev        # http://localhost:5173
```
Production: `npm run build && npm run preview`. In Chrome/Edge, the install icon in the address bar installs it as a desktop app (PWA — works on localhost and any https deployment).

## Run on Android
**Path A — PWA (fastest).** Deploy `dist/` anywhere with https (e.g. `vercel deploy dist`), open the URL in Chrome on the phone → menu → *Add to Home screen*. Full-screen, offline-capable, has an icon.

**Path B — native APK (Capacitor).**
```bash
npm run build
npx cap add android      # one-time
npx cap sync android
npx cap open android     # opens Android Studio → Build → APK
```
Subsequent builds: `npm run android`.

## Routing policy (PRD §5)
| Confidence | Behavior |
|---|---|
| ≥ 75% | filed silently |
| 35–74% | filed + undo toast |
| < 35% | asks; suggests a new tray named from the input |

## Swap in the real AI
`src/lib/classifier.js` is the single swap point. Replace `classify()` with an async Claude API call returning the same shape (`{rows, best, total, confidence}`); keep the rule engine as the offline fallback and merge scores. Nothing else changes.

## Project map
```
src/App.jsx            UI: capture, trace receipt, trays, undo, import/export
src/lib/classifier.js  routing engine + thresholds (the AI swap point)
src/lib/store.js       persistence, riso palette, seeds
src/styles.css         the print-shop design system
public/                PWA manifest, service worker, icons
```
