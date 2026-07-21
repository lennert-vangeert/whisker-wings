import { useEffect, useMemo } from "react";
import { Sky } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import Plane from "./objects/Plane";
import Ring from "./objects/Ring";
import Landscape from "./objects/Landscape";
import Lake from "./objects/Lake";
import MenuPlane from "./objects/MenuPlane";
import CrashBunny from "./objects/CrashBunny";
import TurboEffects from "./objects/TurboEffects";
import useGame from "./stores/useGame";

export default function Experience() {
  const ringLocations = useGame((state) => state.ringLocations);
  const phase = useGame((state) => state.phase);
  const runId = useGame((state) => state.runId);
  const score = useGame((state) => state.score);
  const end = useGame((state) => state.end);
  const effectsOn = useGame((state) => state.effectsOn);

  // Ring sizes were computed inline in the map() below, so every Experience
  // re-render (it subscribes to phase) re-randomised all ten rings *and their hull
  // colliders* mid-run. Fixed per run, re-rolled when a new run starts.
  const ringDiameters = useMemo(
    () => ringLocations.map(() => Math.random() * (5 - 3) + 3),
    [ringLocations, runId]
  );

  // The win condition used to live inside Ring.jsx, which meant all ten mounted
  // rings ran it and end() fired ten times on the final pickup. One owner instead.
  useEffect(() => {
    if (phase === "playing" && score === ringLocations.length) end();
  }, [phase, score, ringLocations.length, end]);

  // The world has to stay mounted through the crash sequence and the game-over
  // screen — the plane is still falling and the bunny is still bouncing off the
  // landscape, and unmounting at "failed" would make the wreck vanish the instant
  // the overlay appears.
  const worldMounted =
    phase === "playing" || phase === "crashing" || phase === "failed";
  const crashSequence = phase === "crashing" || phase === "failed";

  return (
    <>
      <ambientLight intensity={2} />
      <directionalLight
        castShadow
        position={[100, 100, 100]}
        intensity={2}
        color={"#FFA500"} 
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={5000}
        shadow-camera-left={-1000}
        shadow-camera-right={1000}
        shadow-camera-top={1000}
        shadow-camera-bottom={-1000}
      />
      <Physics gravity={[0, -9.81, 0]}>
        {/*
          Keyed on runId so "Try again" always gets a clean world. Without it,
          restarting from "failed" leaves <Plane> mounted — and resetFlight() and
          beginRun() only run in its mount effect.
        */}
        {worldMounted && (
          <group key={runId}>
            <Plane />
            {crashSequence && <CrashBunny />}

            {ringLocations.map(([x, y, z, rotY], index) => (
              <Ring
                key={index}
                position={[x, y, z]}
                rotY={[0, rotY, 0]}
                diameter={ringDiameters[index]}
              />
            ))}
            <Landscape />
            <Lake />
          </group>
        )}
        {phase === "ready" && <MenuPlane />}
      </Physics>
      <Sky sunPosition={[100, 10, 100]} distance={100000} />

      {/* Only during a run — the menu doesn't need it, and it's the one effect with
          real GPU cost. Unmounting tears the whole composer down. */}
      {effectsOn && worldMounted && <TurboEffects />}
    </>
  );
}
