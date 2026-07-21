// beaconState.js
// Which ring is currently the player's nearest uncollected target.
//
// Module-scope mutable state, same pattern as flightState (flightControls.js),
// boundsState (worldBounds.js) and cameraShake.js: written and read every frame by
// BeaconDirector and BeaconShaft, and must never re-render React.

export const beaconState = {
  /** Index into ringLocations, or -1 when nothing is targeted. */
  activeIndex: -1,
};

export function resetBeaconState() {
  beaconState.activeIndex = -1;
}
