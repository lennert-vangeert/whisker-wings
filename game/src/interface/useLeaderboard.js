// useLeaderboard.js
// Reads the top times out of Firestore. Kept out of the UI layer so Ui.jsx stays
// purely presentational.

import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db, SCORES } from "../firebase";

// Deliberately more than the ten rows we display. `scores` is an append-only log
// of every run, so a single fast player can legitimately own the entire top ten —
// the best-per-player dedupe below needs headroom before slicing.
const FETCH_LIMIT = 100;

/**
 * @returns {{ status: "loading"|"ready"|"error", entries: Array }}
 *
 * `status` is an explicit state machine rather than an "is the array empty?"
 * check, which couldn't distinguish "still loading" from "nobody has set a score".
 */
export default function useLeaderboard(enabled) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setStatus("loading");

    // orderBy on a number field, served by Firestore's automatic single-field
    // index — no composite index needed. This is the fix for the old API's
    // lexicographic sort, where "10.55" ranked above "9.20".
    const q = query(
      collection(db, SCORES),
      orderBy("timeMs", "asc"),
      limit(FETCH_LIMIT)
    );

    getDocs(q)
      .then((snap) => {
        if (cancelled) return;

        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Best run per player. Firestore can't express "one row per userName" in a
        // single query, so it stays client-side — but it's now deduping a correctly
        // ordered set, which it never was before.
        const best = rows.reduce((acc, row) => {
          if (!acc[row.userName] || row.timeMs < acc[row.userName].timeMs) {
            acc[row.userName] = row;
          }
          return acc;
        }, {});

        setEntries(
          Object.values(best)
            .sort((a, b) => a.timeMs - b.timeMs)
            .slice(0, 10)
        );
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { status, entries };
}
