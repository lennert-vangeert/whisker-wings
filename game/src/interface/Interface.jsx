// Interface.jsx
// Container for the UI. Owns everything stateful — store subscriptions, the
// per-frame HUD loop, the music crossfade, pause keybindings and the two network
// calls — and renders nothing itself but <Ui>, which is purely presentational.

import React, { useEffect, useMemo, useRef } from "react";
import { addEffect } from "@react-three/fiber";
import useGame from "../stores/useGame";
import { boundsState } from "../worldBounds";
import { flightState } from "../flightControls";
import Ui from "./Ui";
import useLeaderboard from "./useLeaderboard";
import useScoreSubmission from "./useScoreSubmission";

// The one music track serves both contexts: full level on the menu, pulled back
// during a run so the engine and SFX sit on top of it.
const MENU_VOLUME = 0.5;
const GAMEPLAY_VOLUME = 0.18;
const FADE_MS = 600;

const Interface = () => {
  // HUD nodes written directly from the render loop — see the addEffect block below.
  const time = useRef();
  const boundsCountdown = useRef();
  const airspeed = useRef();
  const stallWarning = useRef();
  const menuAudioRef = useRef(null);

  const phase = useGame((state) => state.phase);
  const menuPhase = useGame((state) => state.menuPhase);
  const paused = useGame((state) => state.paused);
  const startTime = useGame((state) => state.startTime);
  const playTime = useGame((state) => state.playTime);
  const score = useGame((state) => state.score);
  const ringLocations = useGame((state) => state.ringLocations);
  const userName = useGame((state) => state.userName);
  const isMusicOn = useGame((state) => state.isMusicOn);
  const isSfxOn = useGame((state) => state.isSfxOn);
  const effectsOn = useGame((state) => state.effectsOn);
  const beaconsOn = useGame((state) => state.beaconsOn);
  const flewOutOfMap = useGame((state) => state.flewOutOfMap);
  const outOfBounds = useGame((state) => state.outOfBounds);

  const start = useGame((state) => state.start);
  const ready = useGame((state) => state.ready);
  const restart = useGame((state) => state.restart);
  const setPaused = useGame((state) => state.setPaused);
  const setUserName = useGame((state) => state.setUserName);
  const setMusicOn = useGame((state) => state.setMusicOn);
  const setMusicOff = useGame((state) => state.setMusicOff);
  const toggleSfx = useGame((state) => state.toggleSfx);
  const toggleEffects = useGame((state) => state.toggleEffects);
  const toggleBeacons = useGame((state) => state.toggleBeacons);
  const menuMain = useGame((state) => state.menuMain);
  const menuSettings = useGame((state) => state.menuSettings);
  const menuLeaderboards = useGame((state) => state.menuLeaderboards);
  const menuCredits = useGame((state) => state.menuCredits);
  const menuControls = useGame((state) => state.menuControls);

  // Start was clicked but the world hasn't finished loading yet.
  const isLoadingRun = phase === "playing" && startTime === 0;

  const leaderboard = useLeaderboard(
    phase === "ready" && menuPhase === "leaderboards"
  );
  const submission = useScoreSubmission(phase === "ended", playTime, userName);

  // Create the track once, for the lifetime of the app.
  useEffect(() => {
    const menuAudio = new Audio("/audio/song-menu.mp3");
    menuAudio.loop = true;
    menuAudio.volume = MENU_VOLUME;
    menuAudioRef.current = menuAudio;

    return () => {
      menuAudio.pause();
      menuAudioRef.current = null;
    };
  }, []);

  // Play/pause and volume, driven by the mute flag and the phase.
  //
  // This used to be a single effect with deps [isMusicOn, phase]: on every phase
  // change its cleanup paused the track and reset currentTime, then the effect body
  // immediately replayed it — so the menu song restarted from zero constantly and
  // carried on playing straight through the run. Splitting creation from control
  // means the track survives phase changes, and the run gets its own quieter mix.
  useEffect(() => {
    const menuAudio = menuAudioRef.current;
    if (!menuAudio) return;

    if (!isMusicOn) {
      menuAudio.pause();
      return;
    }

    const target = phase === "ready" ? MENU_VOLUME : GAMEPLAY_VOLUME;
    menuAudio.play().catch(() => {});

    // Short crossfade so the level change isn't a step.
    const from = menuAudio.volume;
    const startedAt = performance.now();
    const id = setInterval(() => {
      const t = Math.min((performance.now() - startedAt) / FADE_MS, 1);
      menuAudio.volume = from + (target - from) * t;

      if (t >= 1) clearInterval(id);
    }, 50);

    return () => clearInterval(id);
  }, [isMusicOn, phase]);

  // The HUD readouts are written straight into the DOM from the r3f render loop,
  // deliberately bypassing React — they change every frame and must not re-render
  // the tree. State is read via getState() rather than subscribed selectors for the
  // same reason. Every write is null-guarded because these nodes unmount on phase
  // change.
  useEffect(() => {
    const unsubscribeEffect = addEffect(() => {
      const state = useGame.getState();

      // startTime is 0 until beginRun() fires, i.e. while the world is still loading.
      // Skipped while paused: startTime isn't rebased until resume, so continuing to
      // write would let the display run on and then jump backwards.
      if (
        time.current &&
        state.phase === "playing" &&
        !state.paused &&
        state.startTime !== 0
      ) {
        time.current.textContent = (
          (Date.now() - state.startTime) /
          1000
        ).toFixed(2);
      }

      if (boundsCountdown.current) {
        boundsCountdown.current.textContent = boundsState.remaining.toFixed(1);
      }

      if (airspeed.current) {
        airspeed.current.textContent = Math.round(flightState.speed);
      }

      if (stallWarning.current) {
        // Idempotent: a toggle that doesn't change the class list doesn't touch the
        // DOM. The animation lives on .is_stalling, never .stall.
        stallWarning.current.classList.toggle(
          "is_stalling",
          flightState.stalling
        );
      }
    });

    return unsubscribeEffect;
  }, []);

  useEffect(() => {
    setUserName(localStorage.getItem("userName") || "Player");
  }, []);

  // Pause on Escape/P, and force it when the tab loses focus.
  //
  // flightControls.js clamps its delta on tab restore (MAX_DELTA), which mitigated
  // the symptom of tabbing away mid-flight but still let the run clock keep counting
  // wall-clock time you weren't playing. setPaused rebases startTime on resume.
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key !== "escape" && key !== "p") return;

      const state = useGame.getState();
      if (state.phase !== "playing") return;

      state.setPaused(!state.paused);
    };

    const onVisibility = () => {
      if (document.hidden) useGame.getState().setPaused(true);
    };

    // Separate from onVisibility: document.hidden is false on blur (the tab is still
    // visible, it just isn't focused), so reusing that handler would never fire.
    const onBlur = () => useGame.getState().setPaused(true);

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const hudRefs = useMemo(
    () => ({ time, boundsCountdown, airspeed, stallWarning }),
    []
  );

  const on = useMemo(() => {
    const navigate = (target) =>
      ({
        main: menuMain,
        settings: menuSettings,
        leaderboards: menuLeaderboards,
        credits: menuCredits,
        controls: menuControls,
      }[target]?.());

    return {
      start: () => {
        if (!useGame.getState().userName.trim()) {
          alert("Please enter a name");
          return;
        }
        start();
      },
      changeUserName: (value) => {
        setUserName(value);
        localStorage.setItem("userName", value);
      },
      navigate,
      resume: () => setPaused(false),
      restart,
      mainMenu: ready,
      toggleMusic: () =>
        useGame.getState().isMusicOn ? setMusicOff() : setMusicOn(),
      toggleSfx,
      toggleEffects,
      toggleBeacons,
    };
  }, [
    start,
    setUserName,
    setPaused,
    restart,
    ready,
    setMusicOn,
    setMusicOff,
    toggleSfx,
    toggleEffects,
    toggleBeacons,
    menuMain,
    menuSettings,
    menuLeaderboards,
    menuCredits,
    menuControls,
  ]);

  return (
    <Ui
      phase={phase}
      menuPhase={menuPhase}
      paused={paused}
      isLoadingRun={isLoadingRun}
      userName={userName}
      score={score}
      ringCount={ringLocations.length}
      playTime={playTime}
      flewOutOfMap={flewOutOfMap}
      outOfBounds={outOfBounds}
      isMusicOn={isMusicOn}
      isSfxOn={isSfxOn}
      effectsOn={effectsOn}
      beaconsOn={beaconsOn}
      leaderboard={leaderboard}
      submission={submission}
      hudRefs={hudRefs}
      on={on}
    />
  );
};

export default Interface;
