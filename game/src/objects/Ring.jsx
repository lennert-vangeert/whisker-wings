import React, { useRef, useState } from "react";
import { RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import useGame from "../stores/useGame";
import useSound from "../useSound";
import BeaconShaft from "./BeaconShaft";

// How long the collected ring stays on screen, popping and fading, before it goes.
const POP_SECONDS = 0.25;
const POP_SCALE = 1.6;

// Each consecutive pickup plays a semitone higher, so a clean run builds audibly.
const SEMITONE = 2 ** (1 / 12);
const MAX_COMBO_STEPS = 12;

const Ring = ({ index, diameter, position, rotY }) => {
  const [isVisible, setIsVisible] = useState(true);
  // Mirrors collectedRef for rendering. The ref is the latch (refs don't re-render,
  // so it can't be used to drive JSX); the state is what the beacon reads.
  const [collected, setCollected] = useState(false);
  const collectRing = useGame((state) => state.collectRing);
  const beaconsOn = useGame((state) => state.beaconsOn);
  const playCollect = useSound("/audio/collect.mp3", { volume: 0.5 });

  // A ref, not a closure variable. This used to live in an IIFE evaluated during
  // render, so the latch reset on every re-render and a ring could score twice.
  const collectedRef = useRef(false);
  const popRef = useRef(null);
  const popTimer = useRef(0);
  // Drives the beacon down alongside the ring's pop. Previously the beacon was
  // gated on `!collected`, so it blinked out a beat before the pop finished.
  const beaconFadeRef = useRef(1);

  const onCollission = () => {
    if (collectedRef.current) return;
    collectedRef.current = true;
    setCollected(true);

    // Read the score *before* incrementing to get this ring's position in the run.
    const step = Math.min(useGame.getState().score, MAX_COMBO_STEPS);
    playCollect({ playbackRate: SEMITONE ** step });

    collectRing(index);
  };

  useFrame((state, delta) => {
    if (!collectedRef.current || !popRef.current) return;

    popTimer.current += delta;
    const t = Math.min(popTimer.current / POP_SECONDS, 1);

    // Scale up and fade out, then remove.
    popRef.current.scale.setScalar(1 + (POP_SCALE - 1) * t);
    popRef.current.material.opacity = 1 - t;
    beaconFadeRef.current = 1 - t;

    if (t >= 1) setIsVisible(false);
  });

  if (!isVisible) return null;

  return (
    <>
      <RigidBody
        onCollisionEnter={onCollission}
        type="dynamic"
        gravityScale={0}
        position={position}
        rotation={rotY}
        colliders="hull"
        // Once collected the ring is purely a visual flourish — stop it registering
        // further contacts while it plays out its pop.
        sensor={collected}
      >
        <mesh ref={popRef}>
          <torusGeometry args={[diameter, 0.8, 16, 100]} />
          <meshStandardMaterial color="red" transparent />
        </mesh>
      </RigidBody>

      {/* Size is fixed, not derived from `diameter` — beacons should be uniform, so
          that any difference between them reads as "this one is your target"
          rather than "this ring happens to be bigger". */}
      {beaconsOn && (
        <BeaconShaft index={index} position={position} fadeRef={beaconFadeRef} />
      )}
    </>
  );
};

export default Ring;
