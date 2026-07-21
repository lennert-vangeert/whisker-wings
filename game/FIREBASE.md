# Firebase setup

The leaderboard uses **Cloud Firestore** and nothing else — no auth, no functions,
no hosting config. Local development runs against the **emulator** with zero
credentials; production uses your real Firebase project.

This replaced a separate Express + Mongoose service that used to live in
`leaderboard/`. See "Why" at the bottom.

## Local development (emulator)

```bash
npm install
npm run dev   # boots the Firestore emulator (:8080), then Vite
```

`npm run dev` runs `scripts/dev.sh`, which uses `firebase emulators:exec` to bring
up Firestore on the offline `demo-whisker-wings` project, start Vite with
`VITE_APP_ENV=dev`, and tear it all down on Ctrl+C. Emulator UI is on
**http://127.0.0.1:4001** — use it to inspect and edit `scores` documents.

Firestore data is in-memory and **resets on every run**, so the leaderboard starts
empty each time. Finish a run or two (or add documents in the Emulator UI) before
expecting rows.

Need just the emulator? `npm run emulators`. Need Vite on its own, without
Firestore? `npm run vite` — note that this points the client at the *real*
project, since the emulator switch keys off `VITE_APP_ENV`/`import.meta.env.DEV`.

## Production setup

Do these once:

1. **Firebase console → Project settings → Your apps → Web app →** copy the config
   values.
2. Put your real project ID in `.firebaserc` (it currently says
   `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`).
3. Deploy the rules: `npm run deploy:firestore`.

Then provide the config as build-time environment variables. The `VITE_` prefix is
required — Vite only exposes prefixed vars to client code:

```
VITE_APP_ENV=prd
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

These web-config values are **public by design** — they ship in the browser bundle
and access is enforced by `firestore.rules`, not by keeping them secret. That is
genuinely different from the old `VITE_API_KEY`, which was pretending to be auth
while sitting in plain sight in the same bundle.

For local production-style builds put them in `.env.production.local` (git-ignored
via `*.local`). In CI/hosting, set them as environment variables.

> **`.env.example` still needs updating by hand.** It currently lists `API_URL=`
> and `API_KEY=` from the old API — names that never worked anyway, since they lack
> the `VITE_` prefix. Replace its contents with the block above.

## Data model

```
scores/{autoId}   userName   string     1–20 chars
                  timeMs     number     integer milliseconds — source of truth
                  createdAt  timestamp  serverTimestamp()
```

- **Append-only.** Every finished run is a new document; nothing is ever updated or
  deleted. Best-per-player is computed client-side in `useLeaderboard.js`, which
  fetches the top 100 by `timeMs` and dedupes down to 10 — one fast player can
  legitimately occupy the whole top ten, so the dedupe needs headroom.
- **`timeMs` is an integer, not a formatted string.** This is the point of the
  migration: the old Mongo model typed `score` as a `String` and sorted it
  lexicographically, so `"10.55"` ranked above `"9.20"` and the API returned the
  wrong ten rows. Formatting to 2dp is a display concern (`formatTime`).
- The rules enforce shape, ranges and immutability, but there is **no auth**, so a
  determined player can still forge a time. That was equally true of the old API
  and is an accepted trade-off for a game with no accounts. If it ever matters:
  enable anonymous auth, key documents by `request.auth.uid`, and allow updates
  only when `request.resource.data.timeMs < resource.data.timeMs`.

## Why this replaced the Express API

The old `leaderboard/` service was an Express 4 + Mongoose app with two endpoints.
It had to be hosted and paid for, its `verifyApiKey` middleware checked a key that
shipped to every browser, and its `score` field was a string — so the ordering it
existed to provide was wrong. Firestore removes the service, and storing the time
as a number fixes the sort as a side effect.
