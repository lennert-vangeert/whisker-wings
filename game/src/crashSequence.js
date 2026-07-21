// crashSequence.js
// Handoff between Plane.jsx (which knows the plane's attitude and momentum at the
// moment of the crash) and CrashBunny.jsx (which spawns the ragdoll one React
// render later).
//
// Module-scope mutable state rather than zustand, same as boundsState in
// worldBounds.js and flightState in flightControls.js: this is written from inside
// useFrame and must not re-render React.

import { Quaternion, Vector3 } from "three";

// The bunny leaves like an ejector seat: straight up out of the cockpit, along the
// plane's own up-axis, carrying *none* of the plane's forward momentum. Inheriting
// the momentum made it look like it was thrown down the runway with the wreck rather
// than fired clear of it.
// Tuned against the crash sequence's timing: the bunny is under the flight model's
// G = 22 (see GRAVITY_SCALE in CrashBunny.jsx), so this reaches apex at v/g ≈ 1.8s,
// about 36 units up. The game-over screen is timed to that apex, so the player never
// sees the landing.
const EJECT_UP = 40;
/** Tumble rate, rad/s. Fast enough to read as "flung", slow enough to follow. */
const TUMBLE_RATE = 7;

export const crashState = {
  position: new Vector3(),
  quaternion: new Quaternion(),
  velocity: new Vector3(),
  angular: new Vector3(),
};

/**
 * Snapshots where the bunny is and where it's going, at the instant of the crash.
 *
 * `pilotObject` is the pilot's scene graph node, not a hand-computed offset: it sits
 * at local [0, 2.2, 0.6] inside a group that is itself position [0, -1.5, 0] and
 * scale 0.5, and that group's matrix is written manually with matrixAutoUpdate off.
 * Asking three for the world transform is the only version of this that can't drift
 * if those offsets are ever tweaked.
 *
 * `planeUp` is the plane's local +y basis vector (see Plane.jsx), so the pop is
 * "out of the cockpit" rather than "toward the sky" — a crash while inverted throws
 * the bunny downward, which is what you'd expect.
 */
export function captureEjection(pilotObject, planeUp, seed = 0) {
  pilotObject.getWorldPosition(crashState.position);
  pilotObject.getWorldQuaternion(crashState.quaternion);

  crashState.velocity.copy(planeUp).multiplyScalar(EJECT_UP);

  // Deterministic-ish spin axis derived from the crash itself, so we don't need
  // Math.random() and every crash still tumbles differently.
  crashState.angular.set(
    Math.sin(seed * 12.9898 + 1.7),
    Math.sin(seed * 78.233 + 4.2),
    Math.sin(seed * 37.719 + 2.9)
  );

  // three's normalize() divides by (length || 1), so a degenerate axis would leave
  // a zero vector rather than NaN — but a bunny that doesn't spin looks broken.
  if (crashState.angular.lengthSq() < 1e-6) crashState.angular.set(1, 0.4, 0.2);

  crashState.angular.normalize().multiplyScalar(TUMBLE_RATE);
}
