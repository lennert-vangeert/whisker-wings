// useSound.js
// One implementation of "a sound effect you can retrigger".
//
// This was hand-rolled four times across the codebase, and two of those copies
// (Ring.jsx, Landscape.jsx) constructed `new Audio(...)` in the component body — so
// every render allocated a fresh element and the pause()/currentTime = 0 calls acted
// on an object that had never played. Retriggering was silently broken and Audio
// elements leaked.

import { useCallback, useEffect, useRef } from "react";
import useGame from "./stores/useGame";

/**
 * Returns a `play(options)` callback for a one-shot sound effect.
 *
 * Gated on the store's `isSfxOn` — deliberately *not* `isMusicOn`, which used to
 * control both and meant muting the music also silenced ring pickups and impacts.
 */
export default function useSound(url, { volume = 0.5, minGapMs = 120 } = {}) {
  const audioRef = useRef(null);
  const lastPlayedRef = useRef(0);
  const isSfxOn = useGame((state) => state.isSfxOn);

  useEffect(() => {
    const audio = new Audio(url);
    audio.volume = volume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [url, volume]);

  return useCallback(
    ({ playbackRate = 1 } = {}) => {
      const audio = audioRef.current;
      if (!isSfxOn || !audio) return;

      // Retrigger cooldown. Physics contacts arrive in bursts — a plane clipping a
      // boundary corner or skimming the lake surface can fire several times within a
      // couple of frames, and restarting the clip that fast reads as a stutter rather
      // than as repeated impacts.
      const now = performance.now();
      if (now - lastPlayedRef.current < minGapMs) return;
      lastPlayedRef.current = now;

      audio.playbackRate = playbackRate;
      audio.currentTime = 0;
      // Browsers reject play() if the user hasn't interacted with the page yet, and
      // an unhandled rejection here would surface as a console error on every hit.
      audio.play().catch(() => {});
    },
    [isSfxOn, minGapMs]
  );
}
