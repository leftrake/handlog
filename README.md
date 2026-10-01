# HandLog

A fast, offline-first No Limit Hold'em hand logger for live play. Capture a hand one-handed in about 10 seconds at the table, then reconstruct and study it after the session.

Everything stays on your device: no accounts, no backend. It installs to your phone's home screen and works with no signal.

## Features

- **Quick Capture** (one tap from anywhere): hole cards via rank + suit pads or shorthand (`AKs`), position, how far the hand went, result on a number pad, optional board, one-tap tags, a note, and a "Review this" flag. Saves automatically as you go and never lets the same card be used twice.
- **Sessions**: cash or tournament, stakes / blind levels, players at the table (heads-up to 10-handed, adjustable mid-session as people come and go), location, buy-in, rebuys, cash-out, notes. New sessions start from your last values; hands attach to the active session automatically. Tournament hands record stacks and results in big blinds.
- **Full Review editor**: street-by-street action with an action builder that knows who acts next, pot after every action, effective stacks and SPR per street, advisory validation (turn order, min-raises, acting after folding, short all-ins), starting stacks, villain descriptions/reads/shown cards, per-decision thoughts, study notes, and review status.
- **Replayer**: step through a hand on a table graphic, with pot odds (to call, pot after calling, required equity) at each of your decisions.
- **Study tools**: hand list with search and filters, review queue, stats dashboard (profit over time, $/hour, BB/hour, results by position, 13×13 starting-hand grid), and an odds helper (pot odds, rule of 2 and 4 vs exact outs math, with formulas).
- **Export**: JSON backup and merge-import (never duplicates hands), CSV export, and **Copy for analysis** to paste a clean hand history into Claude or a forum.

> Hand-level stats only reflect hands you chose to log, a biased sample. Session results are complete.

## Run locally

Requires Node 20.19+ (Node 24 recommended).

```bash
npm install
npm run dev
```

Open http://localhost:5173. To try it on your phone over Wi-Fi, run `npm run dev -- --host` and open the "Network" URL it prints. Logging works there, but the offline service worker only runs on `localhost` or HTTPS, so install from the deployed site.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript, strict mode |
| `npm run lint` | Lint (oxlint) |
| `npm run build` | Production build into `dist/` (includes the service worker) |
| `npm run preview` | Serve the production build locally |
| `npm run icons` | Regenerate PNG app icons from `public/icon.svg` |

**Sample data:** Settings → Developer → *Load sample data* adds about 20 realistic hands across five sessions so the study views have something in them. *Remove sample* deletes only those.

## Deploy

### GitHub Pages (set up)

`.github/workflows/deploy.yml` tests, builds and publishes on every push to `main`. The site is served at `https://<your-user>.github.io/<repo>/`; the workflow sets `BASE_PATH` to match the repo name automatically.

One-time setup: in the repo on GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. Or, from the command line:

```bash
gh api -X POST repos/<user>/<repo>/pages -f build_type=workflow
```

### Vercel (alternative)

Import the repo at vercel.com (framework preset: Vite). No `BASE_PATH` is needed because it serves from the domain root.

## Install on your phone

**iPhone (Safari):**
1. Open the deployed URL in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open HandLog from the home screen. It runs full-screen and works offline after the first launch.

**Android (Chrome):** open the URL, tap **⋮** → **Install app** (or accept the install banner).

When a new version is deployed, the app shows "A new version of HandLog is ready" with a **Reload** button. It never reloads by itself mid-hand.

## Your data and backups

Data lives in your browser's IndexedDB on that device only. **Export a backup regularly** (Settings → Backup & restore). On an iPhone home-screen app this opens the share sheet; choose *Save to Files* or email it to yourself.

- **Import** merges a backup into what's already there. Records match by ID, so re-importing the same file never duplicates hands; when both copies exist, the more recently edited one wins. Nothing is deleted.
- Safari can clear website data for sites you haven't used in a while. Apps added to the Home Screen are exempt, which is one more reason to install it, but keep backups anyway.
- To move to a new phone: export on the old one, install on the new one, import.

## Project structure

```
src/
├─ domain/          Pure TypeScript, no React or storage. All poker logic lives here, with tests.
│  ├─ types.ts         Data model: Session, Hand, Action, Player, Tag, Settings
│  ├─ cards.ts         Card parsing, hand classes, duplicate detection, 13×13 grid mapping
│  ├─ positions.ts     Seats and action order for every table size, heads-up to 10-handed
│  ├─ engine.ts        Action replay: pots, stacks, turn order, SPR, validation issues
│  ├─ validation.ts    Hand-level checks (cards, board vs action, …)
│  ├─ odds.ts          Pot odds, outs → equity (rule of 2/4 and exact)
│  ├─ stats.ts         Session and hand aggregations for the dashboard
│  ├─ frames.ts        Replayer frames
│  ├─ backup.ts        Backup format and merge rules
│  ├─ csv.ts, analysisText.ts   Exports
│  └─ sampleData.ts    Dev sample data, built through the engine
├─ db/              Dexie schema, data-access functions, live-query hooks
├─ features/        Screens: session, capture, hands, review, replayer, stats, odds, settings
├─ components/      Shared UI (card pad, number pad, buttons, sheets…)
└─ app/             Shell, routing (hash-based), theme, update prompt
```

Amounts are stored in "hand units": dollars for cash hands, big blinds for tournament hands (`bb = 1`). Converting to big blinds is always `amount / hand.bb`. Bets and raises are stored as the total for the street ("raise to").

Tech: React 19, TypeScript (strict), Vite, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa (Workbox), Recharts, Vitest.
