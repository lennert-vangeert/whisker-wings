// TurboEffects.jsx
// Screen effects that build with the boost: radial speed lines plus a tightening
// vignette.
//
// @react-three/postprocessing was already a dependency and had never been imported.
// This is the only thing in the juice pass with real GPU cost, so it sits behind a
// Settings toggle (see `effectsOn` in useGame.jsx).

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  Vignette,
  wrapEffect,
} from "@react-three/postprocessing";
import { flightState } from "../flightControls";
import SpeedLinesEffect from "./SpeedLinesEffect";

// The same helper the library's own effects are built with. Using it rather than
// <primitive object={new SpeedLinesEffect()} /> because EffectComposer discovers its
// effects by scanning the r3f instance's `objects` array, and wrapEffect is the path
// that's guaranteed to register there.
const SpeedLines = wrapEffect(SpeedLinesEffect);

const VIGNETTE_BASE = 0.35;
const VIGNETTE_TURBO_ADD = 0.35;
const LERP = 4; // per-second damping, so the effect doesn't pop on/off

const TurboEffects = () => {
  const vignetteRef = useRef();
  const speedLinesRef = useRef();
  const amount = useRef(0);

  useFrame((state, delta) => {
    amount.current +=
      (flightState.turbo - amount.current) * (1 - Math.exp(-LERP * delta));

    if (speedLinesRef.current) {
      speedLinesRef.current.strength = amount.current;
    }

    if (vignetteRef.current) {
      vignetteRef.current.darkness =
        VIGNETTE_BASE + amount.current * VIGNETTE_TURBO_ADD;
    }
  });

  return (
    <EffectComposer>
      <Vignette ref={vignetteRef} offset={0.25} darkness={VIGNETTE_BASE} />
      <SpeedLines ref={speedLinesRef} />
    </EffectComposer>
  );
};

export default TurboEffects;
