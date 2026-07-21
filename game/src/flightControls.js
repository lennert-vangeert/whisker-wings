// flightControls.js
//
// Arcade flight-dynamics model. Velocity is a real vector that is NOT locked to the
// nose — lift is the only thing that pulls it back in line, which is what produces
// momentum, energy management (dive to gain speed, climb to bleed it) and stall.
//
// The basis is x=right, y=up, z=back, so the nose points along -z.

import { Vector3 } from "three";

function easeOutQuad(x) {
  return 1 - (1 - x) * (1 - x);
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export let controls = {};

window.addEventListener("keydown", (e) => {
  controls[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => {
  controls[e.key.toLowerCase()] = false;
});
// Without this, alt-tabbing while holding a key leaves it stuck down forever —
// keyup fires on the other window. Momentum makes a stuck turbo especially nasty.
window.addEventListener("blur", () => {
  controls = {};
});

// ---- gravity ----
// Deliberately NOT Rapier's 9.81 from <Physics> in Experience.jsx — the two are
// unrelated. Nothing in the scene falls under Rapier gravity (rings are
// gravityScale={0}, the plane's collider has no RigidBody parent), so this is purely
// a flight-model number and is free to be whatever feels right. Do not "harmonise" them.
//
// It's high on purpose: it puts turbo thrust-to-weight at 0.98, just under 1, so
// vertical climb is impossible and gravity is actually felt. Lowering it pushes T/W
// over 1 and gravity stops mattering at all.
const G = 22.0;

// ---- lift ----
const K_L = 0.44; // a_lift = K_L * v^2 * CL(alpha)
const A_STALL = 0.35; // rad (20.1 deg) — end of the linear CL range
const A_FADE = 0.5; // rad — post-stall decay width
const CL_FLOOR = 0.45; // fraction of CL_MAX kept in deep stall, so recovery always works
const K_Y = 0.22; // side-force (vertical fin)

// ---- drag ----
// Parasitic drag sets the top speed, because top speed is just where thrust balances
// drag: T_TURBO = (K_D0 + K_I*CL^2) * v^2. Lowered from 0.0133 to widen the boost —
// 40 -> 48 u/s, i.e. 1.6x cruise up to 1.9x.
//
// This is the only lever available. Adding thrust instead would push T_TURBO past
// G = 22, and the gravity comment above explains why T/W must stay under 1.
// Side effect, and it's the point: less drag means the plane holds its energy
// longer, so a boost carries well past the moment you release it.
const K_D0 = 0.00925; // parasitic
const K_I = 0.17; // induced (x CL^2)
const K_SEP = 0.4; // post-stall flow separation
const K_BETA = 0.3; // sideslip

// ---- thrust ----
// Cruise thrust has to come down with K_D0 or the lower drag would drag cruise speed
// up with it — the boost is meant to widen, not to make everything faster.
const T0 = 6.45; // u/s^2 — pins level cruise at 25 u/s
const T_TURBO = 21.5; // u/s^2 at turbo=1 — pins top speed at 48 u/s, T/W = 0.98
const TURBO_INC = 3.75; // turbo build per second while shift held
const TURBO_DECAY = 2.5; // per second

// ---- boost fuel ----
// Turbo used to be free, so the optimal play was "hold shift forever" and the whole
// thrust/drag trade collapsed into one setting. Fuel gates *boost only* — normal
// flight never runs out of anything, you just lose the option to boost.
const FUEL_BURN = 1 / 6; // per second while boosting — ~6s of continuous turbo
const FUEL_REGEN = 1 / 25; // per second while not asking for boost
const FUEL_PER_CAN = 0.4; // one jerrycan ~= 2.4s of turbo
// Once empty, fuel has to climb back to here before shift bites again. Without this
// latch the meter earns a sliver each frame and shift immediately spends it, which
// strobes thrust, FOV and camera shake at frame rate.
const FUEL_RESTART = 0.08;

// ---- attitude ----
// Sustained angular rates. The old model's MAX_VELOCITY clamp was dead code: the rate
// was a fixed point of `w *= exp(-damping*dt); w += accel*dt`, converging to
// ACCEL*TURN_SPEED/DAMPING ~= 0.81 rad/s, and never reached the 7.5 clamp. These are
// explicit targets instead — framerate-independent, and faster than what we had.
const W_PITCH = 1.5; // rad/s
const W_YAW = 1.0;
const W_ROLL = 2.4; // roll should be the quickest axis
const RATE_TAU = 6.5; // rate-response sharpness (keeps the old ~0.15s feel)

// ---- camera ----
const CAMERA_FOV_BASE = 45;
const CAMERA_FOV_TURBO_ADD = 12; // instant punch, from the turbo accumulator
const CAMERA_FOV_SPEED_ADD = 13; // energy gauge, from actual airspeed
const CAMERA_FOV_SMOOTHNESS = 8.0;

// ---- spawn / integration ----
export const SPAWN_POSITION = [0, 3, 7];
const V_SPAWN = 25.0; // spawn at cruise: matches the old game's instant-25 feel and
const A_TRIM = 0.0799; // rad (4.58 deg) — trimmed so level flight needs no input.
// Spawning at rest instead would deep-stall on frame 1.
const V_AERO_MIN = 1.0; // below this, airflow angles are meaningless
const MAX_DELTA = 1 / 30; // never integrate more than this in one frame
const MAX_STEP = 1 / 60; // ...and never in steps bigger than this

let rollVelocity = 0;
let pitchVelocity = 0;
let yawVelocity = 0;
export let turbo = 0;
let fuel = 1;
let fuelEmpty = false;

// Mutable, read per-frame by the HUD via addEffect (same pattern as worldBounds.js's
// boundsState) so airspeed/stall never trigger a React re-render.
export const flightState = {
  speed: V_SPAWN,
  stalling: false,
  // Mirrors the module-scope `turbo` accumulator. Exported here rather than through
  // zustand because the juice that consumes it (engine pitch, smoke rate, camera
  // shake, post-processing) all runs per frame and must not re-render React.
  turbo: 0,
  // Boost fuel, 0..1. Same reasoning: the HUD gauge reads it every frame.
  fuel: 1,
};

/**
 * Top the boost meter up. Called by jerrycan pickups, which is the only thing that
 * refills it faster than the passive trickle.
 */
export function refuel(amount = FUEL_PER_CAN) {
  fuel = clamp(fuel + amount, 0, 1);
  if (fuel >= FUEL_RESTART) fuelEmpty = false;
  flightState.fuel = fuel;
}

export { FUEL_PER_CAN };

/** Cruise speed, and roughly the turbo-pinned ceiling — the range juice maps over. */
export const SPEED_RANGE = { min: V_SPAWN, max: 48 };

/**
 * Lift coefficient. Linear up to A_STALL, then a smoothstep decay to CL_FLOOR.
 * CL never reaches zero and strictly decreases past the stall, so nose-down always
 * lowers alpha, which always raises CL — recovery is monotone and guaranteed.
 */
function CL(a) {
  const s = Math.sign(a) || 1;
  const m = Math.abs(a);
  if (m <= A_STALL) return a;
  const t = Math.min((m - A_STALL) / A_FADE, 1);
  const drop = t * t * (3 - 2 * t); // smoothstep
  return s * A_STALL * (1 - (1 - CL_FLOOR) * drop);
}

/**
 * Returns the plane to a trimmed, cruising spawn state.
 * The basis vectors, velocities, turbo and planePosition all live at module scope and
 * survive unmount, so a new run has to reset them explicitly.
 */
export function resetFlight(x, y, z, planePosition, velocity) {
  rollVelocity = 0;
  pitchVelocity = 0;
  yawVelocity = 0;
  turbo = 0;
  fuel = 1;
  fuelEmpty = false;

  x.set(1, 0, 0);
  y.set(0, 1, 0);
  z.set(0, 0, 1);
  // Pitch the nose up to the trim angle so lift balances weight immediately.
  y.applyAxisAngle(x, A_TRIM);
  z.applyAxisAngle(x, A_TRIM);

  velocity.set(0, 0, -V_SPAWN); // level, along -z, already at cruise
  planePosition.set(...SPAWN_POSITION);

  flightState.speed = V_SPAWN;
  flightState.stalling = false;
  flightState.turbo = 0;
  flightState.fuel = 1;
}

// Scratch vectors — reused every substep to keep this allocation-free.
const _fwd = new Vector3();
const _vHat = new Vector3();
const _liftDir = new Vector3();
const _sideDir = new Vector3();
const _accel = new Vector3();
const _tmp = new Vector3();

function integrate(x, y, z, planePosition, velocity, dt) {
  // 1. Attitude. Kinematic and independent of aero — rotate the basis toward the
  //    commanded rates. Done before the aero read so control feels a frame sharper.
  const k = 1 - Math.exp(-RATE_TAU * dt);

  let rollInput = 0;
  if (controls["a"] || controls["q"]) rollInput += 1;
  if (controls["d"]) rollInput -= 1;

  let pitchInput = 0;
  if (controls["w"] || controls["z"] || controls["arrowup"]) pitchInput -= 1;
  if (controls["s"] || controls["arrowdown"]) pitchInput += 1;

  let yawInput = 0;
  if (controls["arrowleft"]) yawInput += 1;
  if (controls["arrowright"]) yawInput -= 1;

  rollVelocity += (rollInput * W_ROLL - rollVelocity) * k;
  pitchVelocity += (pitchInput * W_PITCH - pitchVelocity) * k;
  yawVelocity += (yawInput * W_YAW - yawVelocity) * k;

  x.applyAxisAngle(z, rollVelocity * dt);
  y.applyAxisAngle(z, rollVelocity * dt);

  y.applyAxisAngle(x, pitchVelocity * dt);
  z.applyAxisAngle(x, pitchVelocity * dt);

  x.applyAxisAngle(y, yawVelocity * dt);
  z.applyAxisAngle(y, yawVelocity * dt);

  x.normalize();
  y.normalize();
  z.normalize();

  // Turbo accumulator, now gated on fuel.
  //
  // Burn is binary on shift-held rather than proportional to `turbo`: the two barely
  // differ numerically (turbo ramps in ~0.27s), but "holding boost drains the bar" is
  // legible where "the release tail also drains it" is not. Running dry doesn't snap —
  // shift just stops building, and the existing decay bleeds the speed off over ~1s.
  const boosting = controls.shift && !fuelEmpty && fuel > 0;

  if (boosting) {
    turbo += TURBO_INC * dt;
    fuel -= FUEL_BURN * dt;
  } else {
    turbo *= Math.exp(-TURBO_DECAY * dt);
    // Gated on the key, not on `boosting` — holding a dead shift must not refill you.
    if (!controls.shift) fuel += FUEL_REGEN * dt;
  }

  if (fuel <= 0) fuelEmpty = true;
  else if (fuel >= FUEL_RESTART) fuelEmpty = false;

  fuel = clamp(fuel, 0, 1);
  turbo = clamp(turbo, 0, 1);

  // 2. Forces.
  _fwd.copy(z).multiplyScalar(-1); // nose is -z
  _accel.set(0, -G, 0);
  _accel.addScaledVector(_fwd, T0 + (T_TURBO - T0) * turbo);

  const v = velocity.length();
  let stalling = false;

  if (v >= V_AERO_MIN) {
    _vHat.copy(velocity).divideScalar(v);

    const vFwd = velocity.dot(_fwd);
    const alpha = Math.atan2(-velocity.dot(y), vFwd); // + = nose above flight path
    const beta = Math.atan2(velocity.dot(x), vFwd);

    // x cross vHat degenerates only at beta = +/-90deg (pure sideways flight).
    // Gram-Schmidt on y would instead degenerate at alpha = +/-90deg, which happens in
    // every deep stall. three's normalize() is divideScalar(length() || 1), so the
    // degenerate case yields a zero vector and silently drops the force — correct.
    _liftDir.copy(x).cross(_vHat).normalize();
    _sideDir.copy(y).cross(_vHat).normalize();

    const clAlpha = CL(alpha);
    const v2 = v * v;

    _accel.addScaledVector(_liftDir, K_L * v2 * clAlpha);
    _accel.addScaledVector(_sideDir, K_Y * v2 * CL(beta));

    const sep = Math.max(0, Math.abs(alpha) - A_STALL);
    const cd =
      K_D0 +
      K_I * clAlpha * clAlpha +
      K_SEP * Math.sin(sep) * Math.sin(sep) +
      K_BETA * Math.sin(beta) * Math.sin(beta);

    _accel.addScaledVector(_vHat, -cd * v2);

    stalling = Math.abs(alpha) > A_STALL;
  }

  // 3. Symplectic Euler: step velocity first, then use the NEW velocity for position.
  //    The naive order pumps energy into the lift oscillator.
  velocity.addScaledVector(_accel, dt);
  planePosition.addScaledVector(velocity, dt);

  flightState.speed = velocity.length();
  flightState.stalling = stalling;
  flightState.turbo = turbo;
  flightState.fuel = fuel;
}

export function updatePlaneAxis(
  x,
  y,
  z,
  planePosition,
  velocity,
  camera,
  delta = 1 / 60
) {
  if (controls["r"]) {
    resetFlight(x, y, z, planePosition, velocity);
    return;
  }

  // Lift is a stiff system (tau = 1/(K_L*v), ~0.04s in a turbo dive) so explicit Euler
  // diverges at large dt — and useFrame's delta spikes to whole seconds on tab restore.
  // Clamping alone isn't enough; substep. The old kinematic model had no such hazard.
  const d = Math.min(delta, MAX_DELTA);
  const steps = Math.ceil(d / MAX_STEP);
  const dt = d / steps;
  for (let i = 0; i < steps; i++) {
    integrate(x, y, z, planePosition, velocity, dt);
  }

  // FOV: the turbo term gives the instant punch, the speed term makes it an energy
  // gauge so a dive widens it too.
  _tmp.copy(velocity);
  const speedFactor = clamp((_tmp.length() - V_SPAWN) / V_SPAWN, 0, 1);
  const targetFov =
    CAMERA_FOV_BASE +
    easeOutQuad(turbo) * CAMERA_FOV_TURBO_ADD +
    speedFactor * CAMERA_FOV_SPEED_ADD;

  const lerpFactor = 1 - Math.exp(-CAMERA_FOV_SMOOTHNESS * delta);
  camera.fov = camera.fov + (targetFov - camera.fov) * lerpFactor;
  camera.updateProjectionMatrix();
}
