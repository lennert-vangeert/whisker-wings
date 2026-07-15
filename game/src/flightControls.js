// flightControls.js
import useGame from "./stores/useGame";

function easeOutQuad(x) {
  return 1 - (1 - x) * (1 - x);
}

export let controls = {};

window.addEventListener("keydown", (e) => {
  controls[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => {
  controls[e.key.toLowerCase()] = false;
});

export let SPEED = 2.5;
export let TURN_SPEED = 2.5;

let jawVelocity = 0;
let pitchVelocity = 0;
let yawVelocity = 0;
export let turbo = 0;

// ---- continuous-time constants (per-second units) ----
const MAX_VELOCITY = 3.0; // radians per second (max angular velocity)
const ACCEL = 2.0; // radians per second^2 (angular accel)
const TURBO_INC = 1.5; // turbo build per second while shift held
const PLANE_SPEED = 10.0; // units per second (forward base speed)
const TURBO_SPEED = 6.0; // additional speed at full turbo (units/sec)

// damping constants (use exponential decay: vel *= exp(-damping * delta))
const JAW_DAMPING = 6.0; // per second
const PITCH_YAW_DAMPING = 6.5; // per second

// Camera FOV smoothing & limits
const CAMERA_FOV_BASE = 45;
const CAMERA_FOV_MAX_ADD = 25; // how many degrees FOV can increase at full turbo
const CAMERA_FOV_SMOOTHNESS = 8.0; // larger = faster interpolation

export function updatePlaneAxis(
  x,
  y,
  z,
  planePosition,
  camera,
  reset,
  delta = 1 / 60
) {
  if (reset) {
    console.log("reset");
  }

  // decay velocities smoothly (continuous-time)
  const jawDecay = Math.exp(-JAW_DAMPING * delta);
  const pitchYawDecay = Math.exp(-PITCH_YAW_DAMPING * delta);

  jawVelocity *= jawDecay;
  pitchVelocity *= pitchYawDecay;
  yawVelocity *= pitchYawDecay;

  // clamp according to max, scaled by TURN_SPEED
  const maxVel = MAX_VELOCITY * TURN_SPEED;
  if (Math.abs(jawVelocity) > maxVel)
    jawVelocity = Math.sign(jawVelocity) * maxVel;
  if (Math.abs(pitchVelocity) > maxVel)
    pitchVelocity = Math.sign(pitchVelocity) * maxVel;
  if (Math.abs(yawVelocity) > maxVel)
    yawVelocity = Math.sign(yawVelocity) * maxVel;

  // Inputs: acceleration scaled by delta and TURN_SPEED (for responsiveness)
  const accelThisFrame = ACCEL * delta * TURN_SPEED;
  if (controls["a"] || controls["q"]) {
    jawVelocity += accelThisFrame;
  }
  if (controls["d"]) {
    jawVelocity -= accelThisFrame;
  }
  if (controls["w"] || controls["z"] || controls["arrowup"]) {
    pitchVelocity -= accelThisFrame;
  }
  if (controls["s"] || controls["arrowdown"]) {
    pitchVelocity += accelThisFrame;
  }
  if (controls["arrowleft"]) {
    yawVelocity += accelThisFrame;
  }
  if (controls["arrowright"]) {
    yawVelocity -= accelThisFrame;
  }

  if (controls["r"] || reset) {
    jawVelocity = 0;
    pitchVelocity = 0;
    yawVelocity = 0;
    turbo = 0;
    x.set(1, 0, 0);
    y.set(0, 1, 0);
    z.set(0, 0, 1);
    planePosition.set(0, 3, 7);
  }

  // apply rotations using velocities (radians/sec) scaled by delta
  x.applyAxisAngle(z, jawVelocity * delta);
  y.applyAxisAngle(z, jawVelocity * delta);

  y.applyAxisAngle(x, pitchVelocity * delta);
  z.applyAxisAngle(x, pitchVelocity * delta);

  x.applyAxisAngle(y, yawVelocity * delta);
  z.applyAxisAngle(y, yawVelocity * delta);

  x.normalize();
  y.normalize();
  z.normalize();

  // turbo accumulation / decay in continuous time
  if (controls.shift) {
    turbo += TURBO_INC * delta * SPEED;
  } else {
    // exponential decay toward zero when not holding shift
    turbo *= Math.exp(-2.5 * delta);
  }
  turbo = Math.min(Math.max(turbo, 0), 1);

  // turbo speed in units/sec scaled by SPEED
  let turboSpeedPerSec = TURBO_SPEED * turbo * SPEED;

  // camera FOV: smooth interpolation to target to avoid wild jumps
  const targetFov = CAMERA_FOV_BASE + easeOutQuad(turbo) * CAMERA_FOV_MAX_ADD;
  // smooth factor based on delta
  const lerpFactor = 1 - Math.exp(-CAMERA_FOV_SMOOTHNESS * delta);
  camera.fov = camera.fov + (targetFov - camera.fov) * lerpFactor;
  camera.updateProjectionMatrix();

  // move plane forward (per-second plane speed scaled by SPEED) and apply delta
  const forwardSpeed = PLANE_SPEED * SPEED + turboSpeedPerSec;
  planePosition.add(z.clone().multiplyScalar(-forwardSpeed * delta));
}
