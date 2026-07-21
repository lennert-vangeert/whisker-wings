// Jerrycan.jsx
// A boost-fuel pickup. Fly through it and the turbo meter jumps.
//
// Shaped like Ring.jsx, with three deliberate differences — see the comments at each.

import { useMemo, useRef, useState } from "react";
import { BallCollider, RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { refuel, FUEL_PER_CAN } from "../flightControls";
import useSound from "../useSound";

const POP_SECONDS = 0.25;
const POP_SCALE = 1.6;

const SCALE = 1.5; // ~3.7 units tall, about half the plane's length

// Deliberately much larger than the model. Pickup radius is a feel decision, not a
// consequence of how big the artist made the mesh — at 40 u/s a hitbox the size of
// the can would need near-perfect aim, and would risk tunnelling between substeps.
const PICKUP_RADIUS = 5;
const SPIN = 0.9; // rad/s
const BOB = 0.35; // world units either side of centre
const BOB_RATE = 1.6;

// The same pickup sample as a ring, pitched down. Distinct enough to tell apart
// without needing another asset.
const PICKUP_RATE = 0.7;

const Jerrycan = ({ index, position }) => {
  const [isVisible, setIsVisible] = useState(true);
  const { scene } = useGLTF("./models/jerrycan/scene.gltf");
  const playPickup = useSound("/audio/collect.mp3", { volume: 0.55 });

  // A ref, not state — the latch has to survive a re-render, and a re-render must
  // not be able to unlatch it. Same reasoning as Ring's collectedRef.
  const collectedRef = useRef(false);
  const popRef = useRef(null);
  const popTimer = useRef(0);

  // useGLTF caches by URL, so every jerrycan would otherwise be the *same*
  // Object3D — mounting the second would yank it out of the first.
  const model = useMemo(() => scene.clone(), [scene]);

  const onCollission = () => {
    if (collectedRef.current) return;
    collectedRef.current = true;

    refuel(FUEL_PER_CAN);
    playPickup({ playbackRate: PICKUP_RATE });
  };

  useFrame((state, delta) => {
    if (!popRef.current) return;

    if (!collectedRef.current) {
      // Idle: slow spin and bob, so it reads as a pickup rather than scenery.
      popRef.current.rotation.y += SPIN * delta;
      popRef.current.position.y =
        Math.sin(state.clock.elapsedTime * BOB_RATE) * BOB;
      return;
    }

    popTimer.current += delta;
    const t = Math.min(popTimer.current / POP_SECONDS, 1);

    // Scale only, no opacity fade. scene.clone() shares *materials* with the cached
    // original, so fading one can's material would fade every can on the map.
    // Punch out to POP_SCALE over the first half, collapse to nothing over the rest.
    const scale =
      t < 0.5 ? 1 + (POP_SCALE - 1) * (t / 0.5) : POP_SCALE * (1 - (t - 0.5) / 0.5);

    popRef.current.scale.setScalar(SCALE * Math.max(scale, 0));
    popRef.current.rotation.y += SPIN * 4 * delta;

    if (t >= 1) setIsVisible(false);
  });

  if (!isVisible) return null;

  return (
    <RigidBody
      onIntersectionEnter={onCollission}
      // dynamic + gravityScale 0, copied from Ring — not a style choice. Rapier's
      // default ActiveCollisionTypes only cover dynamic-vs-*, so a `fixed` can
      // generates no intersection events against the plane at all and silently never
      // gets picked up.
      type='dynamic'
      gravityScale={0}
      position={position}
      colliders={false}
    >
      {/* Sensor from the start, unlike a ring — a ring is solid until collected and
          physically nudges the plane. Clipping a fuel can shouldn't knock you off
          line. Separate from the mesh group so the pop animation can't resize it. */}
      <BallCollider args={[PICKUP_RADIUS]} sensor />

      <group ref={popRef} scale={SCALE}>
        <primitive object={model} />
      </group>
    </RigidBody>
  );
};

useGLTF.preload("./models/jerrycan/scene.gltf");

export default Jerrycan;
