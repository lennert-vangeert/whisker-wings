// Plane.jsx (or Plane.js)
import { useEffect, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { CuboidCollider, useRapier } from "@react-three/rapier";
import { AnimationClip, Matrix4, Quaternion, Vector3 } from "three";
import {
  flightState,
  resetFlight,
  SPAWN_POSITION,
  SPEED_RANGE,
  updatePlaneAxis,
} from "../flightControls";
import useSound from "../useSound";
import { useFrame, useThree } from "@react-three/fiber";
import useGame from "../stores/useGame";
import { BOUNDS, boundsState, clampToBounds, GRACE_SECONDS } from "../worldBounds";
import { isSubmerged, SUBMERGE_SECONDS } from "../lakeConfig";
import { captureEjection } from "../crashSequence";
import { resolveCameraPosition, terrainHeightBelow } from "../terrainCollision";
import {
  addCameraShake,
  applyCameraShake,
  resetCameraShake,
  SHAKE_IMPACT,
  SHAKE_SCRAPE,
} from "../cameraShake";

const x = new Vector3(1, 0, 0);
const y = new Vector3(0, 1, 0);
const z = new Vector3(0, 0, 1);
export const planePosition = new Vector3(...SPAWN_POSITION);
// Velocity is independent of the nose — that's the whole point of the flight model.
// resetFlight() puts it at cruise along -z.
export const planeVelocity = new Vector3();

const delayedRotMatrix = new Matrix4();
const delayedQuaternion = new Quaternion();

// Post-crash the plane stops flying and starts falling: gravity only, no thrust and
// no lift, plus a slow tumble. Matches the flight model's G rather than Rapier's
// 9.81 — see the warning in flightControls.js about not harmonising the two.
const CRASH_GRAVITY = 22.0;
const CRASH_DRAG = 0.12;
const CRASH_TUMBLE_RATE = 1.6; // rad/s
const CRASH_MAX_SECONDS = 8; // stop integrating eventually, even in free space
// How far above the terrain surface the wreck comes to rest. Roughly the plane's
// own half-height, so it sits on the ground rather than sinking into it.
const WRECK_CLEARANCE = 2.5;
const crashTumbleAxis = new Vector3(1, 0.3, 0.2).normalize();

// Engine playbackRate at cruise vs. at the top of the speed range. Kept subtle —
// past ~1.35 the loop starts sounding like a mosquito rather than an aero engine.
const ENGINE_PITCH = { min: 0.85, max: 1.3 };
const ENGINE_PITCH_LERP = 3;
const SMOKE_TURBO_ADD = 2.5; // mixer timeScale multiplier at full turbo

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);


// How fast the camera's rotation catches up to the plane's. The lag is what makes
// the chase read as a chase rather than a rigid mount.
const CAMERA_SLERP = 0.175;

// Scratch for the per-frame camera and terrain work — reused, never allocated. The
// useFrame below used to build ~8 Matrix4/Quaternion/Vector3 objects per frame; this
// pattern was already established here for some of them and is now used throughout.
const prevPlanePosition = new Vector3();
const rawCameraPosition = new Vector3();
const safeCameraPosition = new Vector3();
const scratchRotMatrix = new Matrix4();
const scratchQuaternion = new Quaternion();
const cameraMatrix = new Matrix4();
const colliderPosition = new Vector3();
const colliderOffset = new Vector3();
// Constant, so it's built once rather than every frame.
const cameraOffsetMatrix = new Matrix4().makeTranslation(0, 10, 30);
const Plane = () => {
  const plane = useGLTF("./models/plane/scene.gltf");
  const pilot = useGLTF("./models/pilot/pilot.gltf");
  const smoke = useGLTF("./models/smoke/scene.gltf");
  const crashed = useGame((state) => state.crashed);
  // Only a *failure* ejects the pilot. Winning also sets `crashed`, but goes to
  // "ended" and should freeze the plane exactly as before.
  const isCrashing = useGame(
    (state) => state.phase === "crashing" || state.phase === "failed"
  );
  // The engine drone is a sound effect, not music — it used to be silenced by the
  // music toggle along with everything else.
  const isSfxOn = useGame((state) => state.isSfxOn);
  const failed = useGame((state) => state.failed);
  const setFlewOutOfMapOn = useGame((state) => state.setFlewOutOfMapOn);
  const setOutOfBounds = useGame((state) => state.setOutOfBounds);
  const beginRun = useGame((state) => state.beginRun);
  const paused = useGame((state) => state.paused);
  const sceneCamera = useThree((state) => state.camera);
  const rapierApi = useRapier();
  const audioRef = useRef();
  const enginePitchRef = useRef(1);

  useEffect(() => {
    // Create the Audio object only once
    if (!audioRef.current) {
      const audio = new Audio("/audio/plane.mp3");
      audio.loop = true;
      audio.volume = 0.5;
      // Chrome/Safari default to pitch-preserving time-stretching, which would make
      // playbackRate change tempo but not pitch — the opposite of what an engine
      // does. Both spellings: the unprefixed one is still vendor-prefixed in Safari.
      audio.preservesPitch = false;
      audio.mozPreservesPitch = false;
      audio.webkitPreservesPitch = false;
      audioRef.current = audio;
    }

    const audio = audioRef.current;

    // Cut the engine the instant the run ends. `crashed` is set synchronously by
    // both failed() and end(), so this lands on the same frame as the impact rather
    // than droning on underneath the ejection sequence or the finish screen.
    // Paused mutes it too — a frozen plane shouldn't still be running.
    if (isSfxOn && !crashed && !paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }

    // Cleanup on component unmount (optional)
    return () => {
      audio.pause();
      audio.currentTime = 0; // Reset playback position
    };
  }, [isSfxOn, crashed, paused]);

  const groupRef = useRef();
  const colliderRef = useRef();
  const pilotRef = useRef();

  // Crash sequence bookkeeping. One-shot latch for the ejection, plus a timer that
  // eventually parks the wreck so it doesn't fall forever.
  const ejectedRef = useRef(false);
  const crashElapsedRef = useRef(0);

  // Boundary + water contact state. Refs, not state: this runs every frame and must not re-render.
  const touchingRef = useRef(false);
  const graceTimerRef = useRef(0);
  const submergeTimerRef = useRef(0);
  // Shared by the boundary and the water: once the run has failed, nothing else fires.
  const failedRef = useRef(false);

  const playHit = useSound("/audio/hit.mp3", { volume: 0.3 });

  // This component only mounts once Suspense has resolved every model in the scene,
  // and its useFrame (i.e. the plane moving) starts on the same tick. So mounting is
  // the moment the run truly begins — start the clock here, not when Start is clicked.
  useEffect(() => {
    touchingRef.current = false;
    graceTimerRef.current = 0;
    submergeTimerRef.current = 0;
    failedRef.current = false;
    ejectedRef.current = false;
    crashElapsedRef.current = 0;
    // Module-scope, so a crash's trauma would otherwise carry into the next run.
    resetCameraShake();
    // useGLTF caches by URL, so pilot.scene survives between runs — including the
    // visible = false we set on it when the last run's bunny was ejected.
    pilot.scene.visible = true;
    boundsState.touching = false;
    boundsState.remaining = GRACE_SECONDS;

    resetFlight(x, y, z, planePosition, planeVelocity);
    beginRun();

    // The frame loop below takes manual control of the camera matrix. Hand it back on
    // unmount, or MenuPlane's camera.position.set/lookAt silently do nothing (nothing
    // recomposes the matrix) and the menu inherits this run's final attitude and FOV.
    return () => {
      sceneCamera.matrixAutoUpdate = true;
      sceneCamera.fov = 45;
      sceneCamera.updateProjectionMatrix();

      // Un-hide the pilot on the way out, not just on the way in.
      //
      // pilot.scene is the *same* cached Object3D that MenuPlane renders, so the
      // visible = false set when the bunny ejects follows it back to the menu and
      // leaves the menu plane flying empty. Resetting only on mount fixed the next
      // run but not the menu in between. Uses pilot.scene rather than pilotRef,
      // because React detaches refs in the mutation phase — before this passive
      // cleanup runs — so pilotRef.current is already null here.
      pilot.scene.visible = true;
    };
  }, []);

  const planeAnimations = useAnimations(plane.animations, plane.scene);
  const smokeAnimations = useAnimations(smoke.animations, smoke.scene);
  const animationspeed = 1;
  useEffect(() => {
    // guard: make sure animation exists
    if (planeAnimations.actions && planeAnimations.actions.Animation && planeAnimations.actions.Animation._clip) {
      const tracks = planeAnimations.actions.Animation._clip.tracks;
      if (tracks && tracks.length > 1) {
        const singleTrack = tracks[1];
        const singleTrackClip = new AnimationClip("SingleTrackAnimation", -1, [singleTrack]);
        const singleTrackAction = planeAnimations.mixer.clipAction(singleTrackClip);
        planeAnimations.mixer.timeScale = animationspeed;
        singleTrackAction.play();
      }
    }

    if (smokeAnimations.actions && smokeAnimations.actions["Default Take"]) {
      smokeAnimations.actions["Default Take"].play();
    }
  }, [animationspeed, planeAnimations, smokeAnimations]);

  // Composes the current basis + position onto the group. Shared by the normal
  // flight path and the post-crash fall, which differ only in how they got there.
  const writePlaneMatrix = () => {
    if (!groupRef.current) return;

    const rotMatrix = scratchRotMatrix.makeBasis(x, y, z);

    groupRef.current.matrixAutoUpdate = false;
    groupRef.current.matrix
      .makeTranslation(planePosition.x, planePosition.y, planePosition.z)
      .multiply(rotMatrix);
    groupRef.current.matrixWorldNeedsUpdate = true;

    return rotMatrix;
  };

  useFrame((state, delta) => {
    const { camera } = state;

    // Paused: hold the last frame. Returning before updatePlaneAxis means no time
    // passes for the flight model, and before the camera write so the view stays put.
    // The run clock is rebased by setPaused() rather than tracked here.
    if (paused) return;

    // The run is over. `crashed` is set by both end() (win) and failed() (crash), and
    // it used to be passed to updatePlaneAxis as its `reset` flag, which teleported
    // the plane to spawn every frame until the phase flip 10ms later. That meant
    // collecting the final ring snapped you back to the start line.
    //
    // On a *failure* we no longer freeze: the pilot is ejected and the plane falls
    // where it crashed. On a win we still freeze — `crashing` is only entered by
    // failed(), so this branch reads the phase rather than `crashed` alone.
    if (crashed) {
      if (!isCrashing) return;

      // The bunny now exists as a ragdoll (crashState was captured on the last
      // playing frame — see the note at the bottom of this callback); hide the
      // cockpit copy so it isn't in two places at once.
      if (!ejectedRef.current && pilotRef.current) {
        ejectedRef.current = true;
        pilotRef.current.visible = false;

        // The bunny spawns at the pilot's seat, which is *inside* the plane's
        // CuboidCollider — Rapier would resolve that overlap by firing it out in a
        // random direction. The plane is no longer gameplay-relevant once the run
        // has failed, so retire its collider rather than fight the penetration.
        colliderRef.current?.setEnabled?.(false);
      }

      crashElapsedRef.current += delta;

      // Free-fall: gravity and drag only, no thrust and no lift. Symplectic Euler,
      // same ordering as integrate() in flightControls.js.
      const stillFalling =
        crashElapsedRef.current < CRASH_MAX_SECONDS &&
        planePosition.y > BOUNDS.min.y;

      if (stillFalling) {
        // Measure the ground from *before* the step. A downward ray cast from the
        // post-step position is useless if that position is already underneath the
        // surface — which is exactly the case we're trying to catch.
        prevPlanePosition.copy(planePosition);
        const groundY = terrainHeightBelow(rapierApi, prevPlanePosition);

        planeVelocity.y -= CRASH_GRAVITY * delta;
        planeVelocity.multiplyScalar(Math.max(1 - CRASH_DRAG * delta, 0));
        planePosition.addScaledVector(planeVelocity, delta);

        // Landed. Park the wreck on the surface instead of letting it sink through.
        if (groundY !== null && planePosition.y < groundY + WRECK_CLEARANCE) {
          planePosition.y = groundY + WRECK_CLEARANCE;
          planeVelocity.set(0, 0, 0);
          crashElapsedRef.current = CRASH_MAX_SECONDS; // stop integrating from here
        }

        // Tumble by rotating the basis vectors in place — the same trick the flight
        // model uses for attitude.
        const spin = CRASH_TUMBLE_RATE * delta;
        x.applyAxisAngle(crashTumbleAxis, spin);
        y.applyAxisAngle(crashTumbleAxis, spin);
        z.applyAxisAngle(crashTumbleAxis, spin);
      }

      writePlaneMatrix();

      // Deliberately no camera work here — CrashBunny owns the camera from the
      // moment the run fails, and chases the bunny instead of the wreck.
      return;
    }

    updatePlaneAxis(x, y, z, planePosition, planeVelocity, camera, delta);

    // Keep the plane inside the world. Must run before the matrix is built below,
    // otherwise the plane renders one frame outside the boundary.
    const touching = clampToBounds(planePosition, planeVelocity);

    if (touching) {
      if (!touchingRef.current) {
        touchingRef.current = true;
        setOutOfBounds(true);
        playHit();
        addCameraShake(SHAKE_SCRAPE);
      }

      graceTimerRef.current += delta;
      boundsState.touching = true;
      boundsState.remaining = Math.max(GRACE_SECONDS - graceTimerRef.current, 0);

      // failed() flips the phase via a 10ms setTimeout, so this loop keeps running
      // for a few more frames — guard so it only fires once.
      if (graceTimerRef.current >= GRACE_SECONDS && !failedRef.current) {
        failedRef.current = true;
        setFlewOutOfMapOn();
        failed();
      }
    } else if (touchingRef.current) {
      touchingRef.current = false;
      graceTimerRef.current = 0;
      boundsState.touching = false;
      boundsState.remaining = GRACE_SECONDS;
      setOutOfBounds(false);
    }

    // Hitting the water is a crash, but let the plane sink under the surface for a
    // beat first so the splash reads, rather than failing the instant it touches.
    if (isSubmerged(planePosition)) {
      if (submergeTimerRef.current === 0) {
        playHit();
        addCameraShake(SHAKE_IMPACT);
      }

      submergeTimerRef.current += delta;

      if (submergeTimerRef.current >= SUBMERGE_SECONDS && !failedRef.current) {
        failedRef.current = true;
        failed();
      }
    } else {
      submergeTimerRef.current = 0;
    }

    const rotMatrix = writePlaneMatrix() ?? scratchRotMatrix.makeBasis(x, y, z);

    // Slerp toward the desired rotation, in place — this used to build two fresh
    // Quaternions per frame.
    scratchQuaternion.setFromRotationMatrix(rotMatrix);
    delayedQuaternion.slerp(scratchQuaternion, CAMERA_SLERP);

    delayedRotMatrix.identity().makeRotationFromQuaternion(delayedQuaternion);

    // T(plane) * R(delayed) * T(offset), composed into reused matrices.
    cameraMatrix
      .makeTranslation(planePosition.x, planePosition.y, planePosition.z)
      .multiply(delayedRotMatrix)
      .multiply(cameraOffsetMatrix);

    // Keep the chase camera out of the scenery. The offset above is a fixed position
    // in the plane's frame, so flying low or banking near a hillside used to bury the
    // camera inside the terrain and render the world from underneath it.
    //
    // Only the translation is corrected — the orientation still comes from the
    // delayed rotation, so the camera keeps pointing the same way and just slides
    // closer to the plane.
    rawCameraPosition.setFromMatrixPosition(cameraMatrix);
    resolveCameraPosition(
      rapierApi,
      planePosition,
      rawCameraPosition,
      safeCameraPosition
    );
    // Shake goes on last, on top of the resolved position.
    //
    // Ordering matters and is the fiddly part: resolveCameraPosition has already
    // guaranteed this point is clear of terrain, and shake displaces by at most
    // SHAKE_MAX_OFFSET — comfortably inside the margins that function leaves. Doing
    // it the other way round (shake, then resolve) would let the resolve fight the
    // shake and produce a jitter that reads as a bug rather than an impact.
    applyCameraShake(delta, safeCameraPosition);
    cameraMatrix.setPosition(safeCameraPosition);

    camera.matrixAutoUpdate = false;
    camera.matrix.copy(cameraMatrix);
    camera.matrixWorldNeedsUpdate = true;

    // Engine pitch tracks airspeed. Smoothed rather than following flightState.speed
    // directly, so a wall scrape (which zeroes a velocity component) doesn't make the
    // engine stutter.
    if (audioRef.current) {
      const t = clamp01(
        (flightState.speed - SPEED_RANGE.min) /
          (SPEED_RANGE.max - SPEED_RANGE.min)
      );
      const target = ENGINE_PITCH.min + (ENGINE_PITCH.max - ENGINE_PITCH.min) * t;

      enginePitchRef.current +=
        (target - enginePitchRef.current) * (1 - Math.exp(-ENGINE_PITCH_LERP * delta));
      audioRef.current.playbackRate = enginePitchRef.current;
    }

    // Smoke thickens under boost.
    if (smokeAnimations.mixer) {
      smokeAnimations.mixer.timeScale = 1 + flightState.turbo * SMOKE_TURBO_ADD;
    }

    if (colliderRef.current) {
      colliderOffset.set(0, 2, 0).applyQuaternion(delayedQuaternion);
      colliderPosition.copy(planePosition).add(colliderOffset);

      // rapier cuboid collider methods
      if (colliderRef.current.setTranslation) {
        colliderRef.current.setTranslation(colliderPosition);
      }
      if (colliderRef.current.setRotation) {
        colliderRef.current.setRotation(delayedQuaternion);
      }
    }

    // Snapshot the ejection every playing frame, so a crash from *any* source has a
    // valid launch state ready the instant it happens.
    //
    // This can't be done lazily on the crashed frame: failed() sets the phase
    // synchronously, so React mounts CrashBunny — which reads crashState in its
    // RigidBody position prop and its mount effect — before Plane's next useFrame
    // ever runs. Capturing after the fact spawns the bunny at the previous run's
    // crash site.
    // Cheap: getWorldPosition/getWorldQuaternion each call updateWorldMatrix(true,
    // false) internally, which walks the pilot's ancestor chain only — it does not
    // recurse into the plane and smoke subtrees.
    if (pilotRef.current) {
      captureEjection(pilotRef.current, y, planePosition.z);
    }
  });

  useEffect(() => {
    plane.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    pilot.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    smoke.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [plane, pilot, smoke]);

  return (
    <>
      <group ref={groupRef} scale={0.5} position={[0, -1.5, 0]}>
        {/* The propeller is animated by the GLTF's own track (see the mixer setup
            above), not by a mesh here. There used to be an empty <group> at this
            spot being rotated every frame — a no-op on a node with no children. */}
        <primitive
          object={plane.scene}
          scale={1}
          position={[0, 2, 0]}
          rotation={[0, Math.PI, 0]}
        />

        <primitive
          ref={pilotRef}
          object={pilot.scene}
          scale={0.3}
          position={[0, 2.2, 0.6]}
          rotation={[Math.PI * -0.1, Math.PI, 0]}
        />

        <primitive
          object={smoke.scene}
          rotation={[Math.PI * -0.2, Math.PI, 0]}
          scale={3.5}
          position={[0, 4, -2]}
        />
        <CuboidCollider ref={colliderRef} args={[7.5, 2, 7.5]} />
      </group>
    </>
  );
};

export default Plane;
