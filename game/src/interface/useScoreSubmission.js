// useScoreSubmission.js
// Writes a finished run to Firestore.

import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, SCORES } from "../firebase";

/** Milliseconds to the "12.34" string shown on screen. Display only. */
export const formatTime = (ms) => (Math.max(ms, 0) / 1000).toFixed(2);

/**
 * Submits once when `enabled` flips true.
 *
 * @returns {"idle"|"saving"|"saved"|"failed"}
 */
export default function useScoreSubmission(enabled, playTime, userName) {
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("saving");

    addDoc(collection(db, SCORES), {
      userName: (userName || "Player").slice(0, 20),
      // The raw integer is the source of truth, and Math.round is load-bearing:
      // firestore.rules requires `timeMs is int`, so a float is rejected outright.
      // Formatting to 2dp is a display concern (see formatTime) — storing that
      // formatted string is exactly what made the old server sort lexicographic.
      timeMs: Math.round(Math.max(playTime, 0)),
      createdAt: serverTimestamp(),
    })
      .then(() => {
        if (!cancelled) setStatus("saved");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
    // playTime/userName are intentionally not deps: the run is over, so they're
    // frozen, and re-running would double-submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return status;
}
