// worldBounds.js
// Flight is hand-integrated (see flightControls.js), so the plane's transform is
// authoritative and Rapier never gets a say. The boundary is therefore a position
// clamp rather than a collider.

// Inset so the plane's body stops at the wall instead of half-poking through:
// its world half-extents are [3.75, 1, 3.75] (args [7.5, 2, 7.5] inside a scale-0.5 group).
const INSET = 4;

export const BOUNDS = {
  min: { x: -365 + INSET, y: -195 + INSET, z: -625 + INSET },
  max: { x: 365 - INSET, y: 195 - INSET, z: 115 - INSET },
};

// How long the plane may stay pressed against the boundary before the run fails.
export const GRACE_SECONDS = 3;

// Mutated per frame by Plane.jsx, read per frame by Interface.jsx via addEffect.
// Kept off the zustand store so the countdown doesn't re-render React 60x/sec.
export const boundsState = {
  touching: false,
  remaining: GRACE_SECONDS,
};

const clampAxis = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Clamps `position` into BOUNDS in place.
 * Returns true if it had to move the plane, i.e. the plane is against the boundary.
 */
export function clampToBounds(position) {
  const x = clampAxis(position.x, BOUNDS.min.x, BOUNDS.max.x);
  const y = clampAxis(position.y, BOUNDS.min.y, BOUNDS.max.y);
  const z = clampAxis(position.z, BOUNDS.min.z, BOUNDS.max.z);

  const touching = x !== position.x || y !== position.y || z !== position.z;

  position.set(x, y, z);

  return touching;
}
