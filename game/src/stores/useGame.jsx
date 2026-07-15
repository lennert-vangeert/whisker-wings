import { useFrame } from "@react-three/fiber";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export default create(
  subscribeWithSelector((set) => {
    return {
      // targetCount: 25,
      playTime: 0,
      startTime: 0,
      endTime: 0,
      isMusicOn: localStorage.getItem("isMusicOn") || false,
      score: 0,
      crashed: false,
      beaconsOn: false,
      flewOutOfMap: false,
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
              startTime: Date.now(),
              score: 0,
              flewOutOfMap: false,
            };
          }

          return {};
        });
      },
      restart: () => {
        console.log("restart");
        set((state) => {
          if (state.phase === "playing") {
            return { phase: "ready" };
          } else if (state.phase === "ended") return { phase: "ready" };

          return {};
        });
      },
      end: () => {
        set({ crashed: true });
        setTimeout(() => {
          set((state) => {
            if (state.phase === "playing") {
              return {
                phase: "ended",
                endTime: Date.now(),
                playTime: state.endTime - state.startTime,
              };
            }
            return {};
          });
        }, 10);
      },
      ready: () => {
        set({ phase: "ready", menuPhase: "main", crashed: false });
      },
      failed: () => {
        setTimeout(() => {
          set({ phase: "failed" });
        }, 10);
        set({ crashed: true });
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
        console.log("setMusicOn");
        localStorage.setItem("isMusicOn", true);
      },
      setMusicOff: () => {
        set({ isMusicOn: false });
        console.log("setMusicOff");
        localStorage.setItem("isMusicOn", false);
      },

      // score
      addScore: () => {
        set((state) => {
          return { score: state.score + 1 };
        });
      },
      toggleBeacons: () => {
        set((state) => {
          return { beaconsOn: !state.beaconsOn };
        });
      },
      setFlewOutOfMapOn: () => {
        set(() => {
          return { flewOutOfMap: true };
        });
      },
    };
  })
);
