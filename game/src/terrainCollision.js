// terrainCollision.js
// Raycast queries against the landscape.
//
// The flight model is hand-integrated and Rapier never drives the plane (see
// flightControls.js), so terrain is handled the same way the world boundary and the
// lake are: query it, then correct the transform ourselves. The difference is that
// terrain isn't an analytic shape like BOUNDS or WATER_LEVEL, so we ask Rapier's
// query pipeline instead of doing the maths inline.
//
// The World only exists inside <Physics>, so callers grab it with useRapier() and
// pass it in rather than this module reaching for it.

import { Vector3 } from "three";

/** Camera pulls in this far from whatever it hit, so it never sits flush in a wall. */
const CAMERA_WALL_MARGIN = 1.5;
/** ...but never closer than this to its focus, or you end up inside the plane. */
const CAMERA_MIN_DISTANCE = 3;
/** Minimum gap between the camera and the ground directly beneath it. */
const CAMERA_GROUND_CLEARANCE = 3;
/** How far down to look for ground under the camera. */
const GROUND_PROBE = 60;

const DOWN = { x: 0, y: -1, z: 0 };

// Reused across calls — these run every frame and must not allocate.
let ray = null;
let terrainOnly = null;
const dirScratch = new Vector3();
const probeScratch = new Vector3();

/**
 * Distance from `origin` along `dir` to the first piece of terrain, or null.
 *
 * Only trimesh colliders are considered. The landscape is the only trimesh in the
 * scene — the plane is a cuboid, rings are convex hulls, the crash bunny is a ball —
 * so this isolates terrain without touching anyone's collision groups, and in
 * particular without disturbing the plane/landscape contact events that detect a
 * crash in the first place.
 */
export function castTerrain(api, origin, dir, maxDistance) {
  const { world, rapier } = api ?? {};
  if (!world || !rapier) return null;

  if (!ray) {
    ray = new rapier.Ray(origin, dir);
  } else {
    ray.origin = origin;
    ray.dir = dir;
  }

  if (!terrainOnly) {
    terrainOnly = (collider) =>
      collider.shape?.type === rapier.ShapeType.TriMesh;
  }

  const hit = world.castRay(
    ray,
    maxDistance,
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    terrainOnly
  );

  return hit ? hit.timeOfImpact : null;
}

/** Height of the terrain directly below `position`, or null if there is none. */
export function terrainHeightBelow(api, position, probe = GROUND_PROBE) {
  const distance = castTerrain(api, position, DOWN, probe);

  return distance === null ? null : position.y - distance;
}

/**
 * Raises `position` in place until it clears the terrain beneath it by `clearance`.
 *
 * The pull-in half of resolveCameraPosition is wrong for a distant establishing
 * shot: over a long focus→camera span some hill is almost always in the way, and
 * pulling in to just short of it collapses the wide shot into a close one. Lifting
 * is the correction that still makes sense at that range.
 */
export function liftAboveTerrain(api, position, clearance) {
  const ground = castTerrain(api, position, DOWN, clearance);

  if (ground !== null) position.y += clearance - ground;

  return position;
}

/**
 * Keeps the chase camera out of the scenery, in place, into `out`.
 *
 * Two corrections, in order:
 *  1. Anything between the focus and the desired camera position pulls the camera
 *     in to just short of the obstruction — the standard third-person fix for the
 *     camera clipping through a hillside behind the player.
 *  2. Ground directly beneath the camera pushes it up. Step 1 alone doesn't catch
 *     a camera that ends up under an overhang or below a ridge without the
 *     focus→camera segment ever crossing a surface.
 */
export function resolveCameraPosition(api, focus, desired, out) {
  out.copy(desired);

  dirScratch.subVectors(desired, focus);
  const distance = dirScratch.length();

  if (distance > 1e-4) {
    dirScratch.divideScalar(distance);

    const hit = castTerrain(api, focus, dirScratch, distance);

    if (hit !== null) {
      // solid: true means a ray starting inside a shape reports 0, so clamp — if the
      // plane itself is buried in a hillside we still want a usable camera.
      const pulled = Math.max(hit - CAMERA_WALL_MARGIN, CAMERA_MIN_DISTANCE);
      out.copy(focus).addScaledVector(dirScratch, Math.min(pulled, distance));
    }
  }

  probeScratch.copy(out);
  const ground = castTerrain(api, probeScratch, DOWN, CAMERA_GROUND_CLEARANCE);

  if (ground !== null) {
    out.y += CAMERA_GROUND_CLEARANCE - ground;
  }

  return out;
}
