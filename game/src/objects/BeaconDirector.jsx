// BeaconDirector.jsx
// Decides which ring is the player's current target: the nearest one they haven't
// collected yet.
//
// Renders nothing. It exists so the choice is made in exactly one place — each
// BeaconShaft then reads beaconState and highlights itself, with no React state
// involved in a per-frame decision.
//
// Nearest-remaining rather than a fixed order, because rings can legitimately be
// collected in any sequence. This gives the player a route to fly without taking
// that freedom away.

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import useGame from "../stores/useGame";
import { planePosition } from "./Plane";
import { beaconState, resetBeaconState } from "../beaconState";

// The answer only changes when the plane crosses a midpoint between two rings, so
// recomputing every frame is waste. At 25 m/s this is ~5 units of travel.
const INTERVAL = 0.2;

const BeaconDirector = () => {
  const ringLocations = useGame((state) => state.ringLocations);
  const collectedRings = useGame((state) => state.collectedRings);
  const timer = useRef(INTERVAL); // pick a target on the very first frame

  // Module-scope state, so a stale target would otherwise survive into the next run.
  useEffect(() => resetBeaconState, []);

  useFrame((state, delta) => {
    timer.current += delta;
    if (timer.current < INTERVAL) return;
    timer.current = 0;

    let nearest = -1;
    let nearestDistance = Infinity;

    for (let i = 0; i < ringLocations.length; i++) {
      if (collectedRings.includes(i)) continue;

      const [x, y, z] = ringLocations[i];
      // Squared distance — we only ever compare these, so the sqrt is pointless.
      const dx = x - planePosition.x;
      const dy = y - planePosition.y;
      const dz = z - planePosition.z;
      const distance = dx * dx + dy * dy + dz * dz;

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    }

    beaconState.activeIndex = nearest;
  });

  return null;
};

export default BeaconDirector;
