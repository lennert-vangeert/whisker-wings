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

/**
 * Clamps `position` into BOUNDS in place, and kills the velocity component pushing
 * into the wall.
 *
 * Only the *outward* component is zeroed, so the plane slides along the boundary and
 * can still fly away from it. Clamping position alone would pin the plane while its
 * velocity kept pointing into the wall, and next frame's aero would then see a
 * velocity that contradicts the position.
 *
 * Side effect worth keeping: the zeroed component makes velocity diverge from the
 * nose, which spikes the angle of attack and therefore drag — so a wall scrape is
 * something you feel. No restitution; a bounce would be jarring.
 *
 * Returns true if the plane is against the boundary.
 */
export function clampToBounds(position, velocity) {
  let touching = false;

  for (const axis of ["x", "y", "z"]) {
    if (position[axis] < BOUNDS.min[axis]) {
      position[axis] = BOUNDS.min[axis];
      if (velocity && velocity[axis] < 0) velocity[axis] = 0;
      touching = true;
    } else if (position[axis] > BOUNDS.max[axis]) {
      position[axis] = BOUNDS.max[axis];
      if (velocity && velocity[axis] > 0) velocity[axis] = 0;
      touching = true;
    }
  }

  return touching;
}
