// lakeConfig.js
// The lake is a flat horizontal plane, and the plane's transform is hand-integrated
// (see flightControls.js), so drowning is a position test rather than a collider —
// same approach as worldBounds.js.

export const LAKE_SIZE = 200; // the water plane is LAKE_SIZE x LAKE_SIZE
export const LAKE_POSITION = [-96, -48, -210];

export const WATER_LEVEL = LAKE_POSITION[1];

// How long the plane may stay under the surface before the run fails. Keeps the
// splash readable: you dip under, then it calls it.
export const SUBMERGE_SECONDS = 0.5;

const HALF = LAKE_SIZE / 2;
const MIN_X = LAKE_POSITION[0] - HALF;
const MAX_X = LAKE_POSITION[0] + HALF;
const MIN_Z = LAKE_POSITION[2] - HALF;
const MAX_Z = LAKE_POSITION[2] + HALF;

/** True when the plane is below the surface AND within the lake's footprint. */
export function isSubmerged(position) {
  return (
    position.y < WATER_LEVEL &&
    position.x >= MIN_X &&
    position.x <= MAX_X &&
    position.z >= MIN_Z &&
    position.z <= MAX_Z
  );
}
