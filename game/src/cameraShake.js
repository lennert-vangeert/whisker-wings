// cameraShake.js
// Trauma-based camera shake, shared by every impact source.
//
// Module-scope mutable state, same pattern as flightState and boundsState: this is
// written from collision handlers and read every frame, and must never re-render.

import { flightState } from "./flightControls";

// Kept well under the clearance resolveCameraPosition leaves, so shaking can never
// push the camera back inside the terrain it was just pulled out of.
const MAX_OFFSET = 0.8;
const DECAY = 4.5; // per second
// Sustained shake at full boost. Deliberately tiny: this is continuous rather than
// a one-off jolt, so what reads as a punchy impulse reads as a rattling mess when
// held for seconds at a time. The speed lines carry the sense of speed instead.
const TURBO_TREMBLE = 0.05;
const TURBO_FREQ = 18; // slower than an impact — a rumble, not a vibration
const FREQ = 47; // rad/s — deliberately not a round number

/** Impulse strengths. */
export const SHAKE_SCRAPE = 0.35; // clipping the world boundary
export const SHAKE_IMPACT = 1; // a real crash

// Displacement is trauma *squared*, so small values fall off fast and only genuine
// hits read as a jolt rather than everything feeling permanently wobbly.
let trauma = 0;
let clock = 0;

export function addCameraShake(amount) {
  trauma = Math.min(trauma + amount, 1);
}

export function resetCameraShake() {
  trauma = 0;
  clock = 0;
}

/**
 * Displaces `position` in place by the current shake.
 *
 * Call this *after* any terrain resolution — see the note at the call site in
 * Plane.jsx for why the order can't be flipped.
 */
export function applyCameraShake(delta, position) {
  clock += delta;
  trauma = Math.max(trauma - DECAY * delta * trauma, 0);

  const impact = trauma ** 2;
  const tremble = flightState.turbo * TURBO_TREMBLE;

  if (impact < 0.001 && tremble < 0.001) return position;

  // Impact and boost are summed at different frequencies rather than max()'d at one.
  // A single fast frequency made sustained boost feel like a fault rather than speed.
  const impactAmount = impact * MAX_OFFSET;
  const trembleAmount = tremble * MAX_OFFSET;

  // Offset sines at incommensurable rates — cheap, and unlike Math.random() it
  // doesn't make the shake frame-rate dependent.
  position.x +=
    Math.sin(clock * FREQ) * impactAmount +
    Math.sin(clock * TURBO_FREQ) * trembleAmount;
  position.y +=
    Math.sin(clock * FREQ * 1.37 + 1.7) * impactAmount +
    Math.sin(clock * TURBO_FREQ * 1.31 + 0.9) * trembleAmount;
  position.z += Math.sin(clock * FREQ * 0.83 + 3.1) * impactAmount;

  return position;
}
