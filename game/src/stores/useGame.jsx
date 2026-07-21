import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

/**
 * localStorage only stores strings, so the old `localStorage.getItem(k) || false`
 * returned the *string* "false" — which is truthy. Muting the music and reloading
 * brought it straight back on.
 */
const readFlag = (key, fallback) => {
  const stored = localStorage.getItem(key);

  return stored === null ? fallback : stored === "true";
};

const writeFlag = (key, value) => localStorage.setItem(key, String(value));

export default create(
  subscribeWithSelector((set) => {
    return {
      // targetCount: 25,
      playTime: 0,
      startTime: 0,
      endTime: 0,
      // Incremented on every run start. Experience.jsx uses it as a React key so a
      // restart always remounts the world — see restart() below.
      runId: 0,
      isMusicOn: readFlag("isMusicOn", false),
      // Split from isMusicOn, which used to gate both — so muting the soundtrack also
      // silenced ring pickups and impacts. Defaults on.
      isSfxOn: readFlag("isSfxOn", true),
      score: 0,
      crashed: false,
      beaconsOn: readFlag("beaconsOn", false),
      // Post-processing. The only setting with meaningful GPU cost, so it's opt-out.
      effectsOn: readFlag("effectsOn", true),
      flewOutOfMap: false,
      outOfBounds: false,
      ringLocations: [
        // x, y, z, rotY
        [4, -10, -68, 0],
        [-45, -22, -185, -1.82],
        [-105, 82, -320, 0],
        [0, -7, -477, -1.7],
        [0, -15, -527, -2.11],
        [328, 24, -175, 0],
        [186, -50, -504, 1],
        [186, -26, -200, 1.7],
        [-202, 7, -214, 1.29],
        [-316, -42, -311, 0.17],
      ],

      /**
       * Phases
       */
      phase: "ready",

      start: () => {
        console.log("start");
        set((state) => {
          if (state.phase === "ready") {
            return {
              phase: "playing",
              runId: state.runId + 1,
              paused: false,
              pausedAt: 0,
              // Stamped by beginRun() once the world has loaded and the plane
              // starts moving, so loading time isn't counted as run time.
              startTime: 0,
              score: 0,
              flewOutOfMap: false,
              outOfBounds: false,
            };
          }

          return {};
        });
      },
      beginRun: () => {
        set({ startTime: Date.now() });
      },
      // Straight back into a new run, skipping the menu round-trip.
      //
      // Bumping runId is load-bearing: Experience.jsx keys the world on it. Going
      // "failed" -> "playing" doesn't otherwise remount <Plane> (the world stays
      // mounted through the crash sequence), so resetFlight() and beginRun() — which
      // live in Plane's mount effect — would never fire and the plane would carry on
      // from the crash site with a stale clock.
      restart: () => {
        set((state) => ({
          phase: "playing",
          runId: state.runId + 1,
          paused: false,
          pausedAt: 0,
          startTime: 0,
          endTime: 0,
          playTime: 0,
          score: 0,
          crashed: false,
          flewOutOfMap: false,
          outOfBounds: false,
          menuPhase: "main",
        }));
      },
      // Winning. Synchronous, like failed() — this used to defer the phase flip by
      // 10ms, during which the HUD kept ticking, so every recorded time ran ~10ms
      // long. The deferral existed to let the last ring's score settle; the win
      // check now lives in one place (Experience.jsx) so it isn't needed.
      end: () => {
        set((state) => {
          if (state.phase !== "playing") return {};

          // Stamp once and reuse. This previously read `state.endTime` — the
          // *pre-update* value — so playTime was the previous run's end timestamp
          // minus this run's start, i.e. always garbage (hugely negative on a first
          // run, since endTime started at 0).
          const finishedAt = Date.now();

          return {
            crashed: true,
            phase: "ended",
            endTime: finishedAt,
            playTime: finishedAt - state.startTime,
          };
        });
      },
      ready: () => {
        set({
          phase: "ready",
          menuPhase: "main",
          crashed: false,
          outOfBounds: false,
          paused: false,
          pausedAt: 0,
          // Reset the run record too. Leaving these stale is what made the old
          // playTime bug permanent rather than first-run-only.
          score: 0,
          startTime: 0,
          endTime: 0,
          playTime: 0,
          flewOutOfMap: false,
        });
      },
      // A failed run no longer jumps straight to the game-over screen. It enters
      // "crashing" — the plane keeps falling, the bunny is ejected as a ragdoll
      // (CrashBunny.jsx), and only once the bunny comes to rest does settle()
      // flip to "failed". Set synchronously: Plane.jsx calls this from inside
      // useFrame and the very next frame must already see the new phase.
      failed: () => {
        set((state) => {
          if (state.phase !== "playing") return {};

          return { crashed: true, phase: "crashing" };
        });
      },
      // Ends the crash sequence and shows the game-over screen. Called by
      // CrashBunny once the bunny settles, drowns, or the max timer expires —
      // any of which can fire more than once, hence the phase guard.
      settle: () => {
        set((state) => {
          if (state.phase !== "crashing") return {};

          return { phase: "failed" };
        });
      },
      // Pause. Kept separate from `phase` rather than added as another phase value:
      // the world must stay mounted and every phase check elsewhere ("playing",
      // "crashing", …) should keep reading the same value it did before.
      paused: false,
      pausedAt: 0,

      setPaused: (value) => {
        set((state) => {
          // Only mid-run, and only on an actual change — setPaused(true) firing
          // twice (Escape plus a blur event) must not stamp pausedAt again.
          if (state.phase !== "playing" || state.paused === value) return {};

          if (value) return { paused: true, pausedAt: Date.now() };

          // The run clock is `Date.now() - startTime`, so time spent paused would
          // otherwise be counted. Push startTime forward by the paused duration.
          const pausedFor = state.pausedAt ? Date.now() - state.pausedAt : 0;

          return {
            paused: false,
            pausedAt: 0,
            startTime: state.startTime ? state.startTime + pausedFor : 0,
          };
        });
      },

      // menu phase
      menuPhase: "main",

      menuMain: () => {
        set({ menuPhase: "main" });
      },
      menuSettings: () => {
        set({ menuPhase: "settings" });
      },
      menuLeaderboards: () => {
        set({ menuPhase: "leaderboards" });
      },
      menuCredits: () => {
        set({ menuPhase: "credits" });
      },
      menuControls: () => {
        set({ menuPhase: "controls" });
      },
      // username
      userName: "Player",
      setUserName: (name) => {
        set({ userName: name });
      },

      //audio

      setMusicOn: () => {
        set({ isMusicOn: true });
        writeFlag("isMusicOn", true);
      },
      setMusicOff: () => {
        set({ isMusicOn: false });
        writeFlag("isMusicOn", false);
      },
      toggleSfx: () => {
        set((state) => {
          writeFlag("isSfxOn", !state.isSfxOn);

          return { isSfxOn: !state.isSfxOn };
        });
      },

      // score
      addScore: () => {
        set((state) => {
          return { score: state.score + 1 };
        });
      },
      toggleEffects: () => {
        set((state) => {
          writeFlag("effectsOn", !state.effectsOn);

          return { effectsOn: !state.effectsOn };
        });
      },
      toggleBeacons: () => {
        set((state) => {
          // Now persisted, like the audio flags — it used to reset every reload.
          writeFlag("beaconsOn", !state.beaconsOn);

          return { beaconsOn: !state.beaconsOn };
        });
      },
      setFlewOutOfMapOn: () => {
        set(() => {
          return { flewOutOfMap: true };
        });
      },
      setOutOfBounds: (value) => {
        set(() => {
          return { outOfBounds: value };
        });
      },
    };
  })
);
