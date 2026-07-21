// CrashBunny.jsx
// The bunny that gets flung out of the cockpit when a run fails, and the camera
// that chases it. Mounts only for the "crashing" and "failed" phases.
//
// Unlike the plane — whose transform is hand-integrated (see flightControls.js) —
// this is a real Rapier body, so it actually bounces off the landscape trimesh.

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody, useRapier } from "@react-three/rapier";
import { Box3, Vector3 } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import useGame from "../stores/useGame";
import { crashState } from "../crashSequence";
import { liftAboveTerrain, resolveCameraPosition } from "../terrainCollision";

const PILOT_URL = "./models/pilot/pilot.gltf";

// Experience.jsx runs Physics at real-world gravity (-9.81), but the flight model
// uses G = 22.0 and flightControls.js explicitly warns not to harmonise the two.
// Scaling the bunny to ~22 keeps its arc in the same visual language as the flight.
const GRAVITY_SCALE = 22.0 / 9.81;

const BUNNY_SCALE = 0.3; // matches the cockpit pilot in Plane.jsx

// The game-over screen is deliberately timed to the apex of the bunny's arc rather
// than waiting for it to come to rest. EJECT_UP / G = 40 / 22 ≈ 1.8s, so the cut
// happens at the top of the launch and the landing is never shown.
const APEX_SECONDS = 1.8;

const CHASE_DISTANCE = 12;
const CHASE_HEIGHT = 4;
const CHASE_LERP = 2.5; // per-second damping rate for the camera position
const FOV_LERP = 3;

// Once the run has ended the camera leaves the bunny and pulls back to a wide,
// elevated shot of the map behind the game-over overlay.
const WIDE_DISTANCE = 190;
const WIDE_HEIGHT = 120;
const WIDE_LERP = 0.9; // slower than the chase — this is a drift, not a snap
const WIDE_FOV = 55;
const WIDE_GROUND_CLEARANCE = 25; // clears ridges, not just the ground directly below

useGLTF.preload(PILOT_URL);

/** Eases the camera toward a target FOV, skipping the projection rebuild when settled. */
function easeFov(camera, target, delta) {
  if (Math.abs(camera.fov - target) < 0.01) return;

  camera.fov += (target - camera.fov) * (1 - Math.exp(-FOV_LERP * delta));
  camera.updateProjectionMatrix();
}

const CrashBunny = () => {
  const pilot = useGLTF(PILOT_URL);
  const settle = useGame((state) => state.settle);
  const rapierApi = useRapier();

  // useGLTF caches by URL, so pilot.scene is the *same* Object3D that Plane.jsx has
  // mounted in the cockpit. Mounting it here would reparent it — silently teleporting
  // the plane's pilot instead of adding a second one. Clone it.
  //
  // The collider is then derived from the clone's actual bounds rather than a
  // hardcoded radius. This model's origin is nowhere near its visual centre (the
  // bounding box centres at y ≈ +0.8 at this scale), so a collider sitting at the
  // RigidBody origin ends up beside the bunny instead of around it — it reads as the
  // bunny orbiting an invisible ball. Measuring means it stays correct if the model
  // or BUNNY_SCALE ever changes.
  const { bunny, radius, offset } = useMemo(() => {
    const obj = cloneSkinned(pilot.scene);
    obj.scale.setScalar(BUNNY_SCALE);
    obj.updateMatrixWorld(true);

    const box = new Box3().setFromObject(obj);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());

    // Mean half-extent. The bunny is elongated (roughly 0.8 x 1.7 x 2.0), so the
    // largest half-extent would float it well above the ground and the smallest
    // would bury it.
    return {
      bunny: obj,
      radius: (size.x + size.y + size.z) / 6,
      // Shift the model so its bounding-box centre lands on the collider origin.
      offset: centre.negate(),
    };
  }, [pilot.scene]);

  useEffect(() => {
    bunny.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [bunny]);

  const bodyRef = useRef();
  const elapsed = useRef(0);
  const settledRef = useRef(false);
  const handedOverRef = useRef(false);
  // Where the wide shot points once the run has ended.
  const anchor = useRef(new Vector3());

  // The chase target, kept across frames so the camera eases rather than snapping
  // when the bunny's velocity direction flips mid-tumble.
  const bunnyPos = useRef(new Vector3());
  const desiredCam = useRef(new Vector3());
  const safeCam = useRef(new Vector3());
  const chaseDir = useRef(new Vector3(0, 0, 1));
  // Scratch, so the per-frame camera maths allocates nothing.
  const scratch = useRef(new Vector3());

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    elapsed.current = 0;
    settledRef.current = false;

    // Launch. Spawn position comes from the RigidBody prop below; rotation and
    // velocity are applied imperatively — rotation because passing a quaternion prop
    // through RigidBody is ambiguous, velocity because there is no prop for it.
    body.setRotation(crashState.quaternion, true);
    body.setLinvel(crashState.velocity, true);
    body.setAngvel(crashState.angular, true);

    // Seed the chase direction behind the launch so frame one isn't a whip-pan.
    if (crashState.velocity.lengthSq() > 1e-4) {
      chaseDir.current.copy(crashState.velocity).normalize().negate();
      chaseDir.current.y = 0;

      if (chaseDir.current.lengthSq() < 1e-6) chaseDir.current.set(0, 0, 1);
      chaseDir.current.normalize();
    }
  }, []);

  // Default priority (0), deliberately. Passing any priority > 0 puts react-three-fiber
  // into manual-render mode for the *entire* app — it stops calling gl.render() and
  // expects the callback to do it. The sim keeps running but nothing is ever drawn,
  // which looks exactly like a freeze and throws no error.
  //
  // Ordering against Plane's useFrame doesn't matter anyway: Plane skips all camera
  // work while crashed, so nothing here contends with it.
  useFrame((state, delta) => {
    const body = bodyRef.current;
    if (!body) return;

    // Take the camera over from Plane.jsx, once.
    //
    // Plane drives it by writing camera.matrix directly with matrixAutoUpdate off,
    // which never syncs camera.position/quaternion — those still hold whatever the
    // Canvas was constructed with in index.jsx ([-203, 115.5, 271]). Flipping
    // matrixAutoUpdate back on without decomposing first snaps the camera to that
    // stale pose, so the chase visibly flies in from across the map.
    if (!handedOverRef.current) {
      handedOverRef.current = true;
      state.camera.matrix.decompose(
        state.camera.position,
        state.camera.quaternion,
        state.camera.scale
      );
      state.camera.matrixAutoUpdate = true;
    }

    const t = body.translation();
    bunnyPos.current.set(t.x, t.y, t.z);

    elapsed.current += delta;

    // Cut to the game-over screen at the top of the arc. Deliberately a fixed timer
    // rather than rest detection: waiting for the bunny to actually land meant
    // watching it bounce and trundle down a hillside, and the landing is the least
    // interesting part of the whole sequence.
    if (!settledRef.current && elapsed.current >= APEX_SECONDS) {
      settledRef.current = true;
      // Freeze the framing target here so the wide shot stays pointed at the crash
      // site instead of tracking a bunny that's still falling off-screen.
      anchor.current.copy(bunnyPos.current);
      settle();
    }

    if (settledRef.current) {
      // Wide shot: pull back and up for a vista of the map behind the overlay.
      desiredCam.current
        .copy(anchor.current)
        .addScaledVector(chaseDir.current, WIDE_DISTANCE);
      desiredCam.current.y += WIDE_HEIGHT;

      // Lift only — no pull-in. See liftAboveTerrain for why.
      safeCam.current.copy(desiredCam.current);
      liftAboveTerrain(rapierApi, safeCam.current, WIDE_GROUND_CLEARANCE);

      const wideK = 1 - Math.exp(-WIDE_LERP * delta);
      state.camera.position.lerp(safeCam.current, wideK);
      state.camera.lookAt(anchor.current);
      easeFov(state.camera, WIDE_FOV, delta);

      return;
    }

    // Still airborne — chase the bunny.
    const v = body.linvel();

    scratch.current.set(-v.x, 0, -v.z);

    if (scratch.current.lengthSq() > 1e-6) {
      // Ease the direction rather than snapping — a tumbling bunny's horizontal
      // velocity flips sign constantly and the camera would strobe around it.
      chaseDir.current
        .lerp(scratch.current.normalize(), 1 - Math.exp(-1.5 * delta))
        .normalize();
    }

    desiredCam.current
      .copy(bunnyPos.current)
      .addScaledVector(chaseDir.current, CHASE_DISTANCE);
    desiredCam.current.y += CHASE_HEIGHT;

    // Same terrain correction the flight camera uses, so a launch alongside a
    // hillside doesn't put the camera inside it.
    resolveCameraPosition(
      rapierApi,
      bunnyPos.current,
      desiredCam.current,
      safeCam.current
    );

    // Frame-rate independent damping.
    const k = 1 - Math.exp(-CHASE_LERP * delta);
    state.camera.position.lerp(safeCam.current, k);
    state.camera.lookAt(bunnyPos.current);

    // updatePlaneAxis drives FOV up to ~70 with turbo and airspeed. Ease it back.
    easeFov(state.camera, 45, delta);
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      gravityScale={GRAVITY_SCALE}
      position={crashState.position.toArray()}
      // Barely damped on purpose. The heavy damping this used to carry existed to
      // stop the bunny rolling around after it landed — but the sequence now cuts to
      // the game-over screen at apex, so the landing is never seen and all that
      // damping did was flatten the arc and kill the tumble on the way up.
      restitution={0.2}
      friction={1}
      linearDamping={0.05}
      angularDamping={0.3}
    >
      <BallCollider args={[radius]} />
      <primitive object={bunny} position={offset.toArray()} />
    </RigidBody>
  );
};

export default CrashBunny;
