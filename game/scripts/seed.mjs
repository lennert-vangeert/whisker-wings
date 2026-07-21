// Seeds the Firestore emulator with a handful of leaderboard entries.
//
// The emulator keeps data in memory and wipes it on every run, so without this the
// board is empty every time you boot and there's nothing to look at until you fly a
// full clean run. Run automatically by scripts/dev.sh; also available as `npm run seed`.
//
// Talks to the emulator's REST API rather than the client SDK so it stays
// dependency-free, and sends `Authorization: Bearer owner`, which is the emulator's
// admin bypass. That matters: firestore.rules requires `createdAt == request.time`,
// so a normal client write can't backdate a document — but seed rows want spread-out
// timestamps. The bypass is emulator-only and has no effect on a real project.

const PROJECT = process.env.FIREBASE_PROJECT || "demo-whisker-wings";
const HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const URL = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents/scores`;

// Deliberately includes 9.20s and 10.55s: that's the exact pair the old Mongo
// backend got wrong, because it stored the time as a string and sorted
// lexicographically, ranking "10.55" above "9.20". If the board ever shows them in
// that order again, the regression is back.
const SEED = [
  { userName: "Ana", timeMs: 9200 },
  { userName: "Bo", timeMs: 10550 },
  { userName: "Cy", timeMs: 14030 },
  { userName: "Dee", timeMs: 12480 },
  { userName: "Eli", timeMs: 22900 },
  // Second, slower run for a player who already has one — exercises the
  // best-per-player dedupe in useLeaderboard.js. Should never appear on the board.
  { userName: "Ana", timeMs: 15700 },
];

const toDoc = ({ userName, timeMs }, i) => ({
  fields: {
    userName: { stringValue: userName },
    timeMs: { integerValue: String(timeMs) },
    createdAt: {
      timestampValue: new Date(Date.UTC(2026, 0, 1, 12, i)).toISOString(),
    },
  },
});

const run = async () => {
  // Bail out quietly rather than failing the dev boot if the emulator isn't up.
  try {
    await fetch(`http://${HOST}/`);
  } catch {
    console.warn(`seed: no Firestore emulator on ${HOST}, skipping`);
    return;
  }

  const results = await Promise.all(
    SEED.map((entry, i) =>
      fetch(URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer owner",
        },
        body: JSON.stringify(toDoc(entry, i)),
      })
    )
  );

  const failed = results.filter((r) => !r.ok);

  if (failed.length) {
    console.warn(`seed: ${failed.length}/${SEED.length} writes failed`);
    return;
  }

  console.log(`seed: wrote ${SEED.length} scores to ${PROJECT}`);
};

run();
