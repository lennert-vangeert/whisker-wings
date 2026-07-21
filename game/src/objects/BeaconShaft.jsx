// BeaconShaft.jsx
// A column of light rising from a ring, marking it as a target.
//
// Replaces a pair of 4-sided cones in red `meshStandardMaterial`. Those failed for
// a specific, measurable reason: at ~2 world units wide against inter-ring
// distances of 50–700, they occupied roughly 2% of screen width — a hairline. They
// were also *lit* geometry, so the scene's orange key light dulled them, and red
// sits right in the palette of the warm sky they had to stand out against.
//
// No custom shader. The vertical fade is baked into the geometry as vertex colours
// and drawn with a stock additive `meshBasicMaterial`: black vertices contribute
// nothing under additive blending, so a black-to-white gradient *is* a fade-out.
// An earlier version did this in GLSL and the flat billboarded quad it needed
// aliased into dashed outlines at distance; a real tube has none of those problems.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  CylinderGeometry,
  DoubleSide,
} from "three";
import { beaconState } from "../beaconState";

const RADIUS_BOTTOM = 6; // ~12 across at the base, comfortably wider than a ring
const RADIUS_TOP = 3; // slight taper reads better than a straight tube
const HEIGHT = 170;

// Cool against the warm #FFA500 key light and drei Sky — a red beacon blends into
// that palette, which is half of why the old one disappeared.
const IDLE_COLOR = new Color("#38bdf8");
const ACTIVE_COLOR = new Color("#eafff8");

// The active beacon is the *least* opaque, not the most. It's the one you're flying
// straight at, so a dense column there sits right over the thing you're trying to
// line up with. The highlight reads through colour instead — near-white against
// cyan — which stays legible at distance without blocking the approach.
const IDLE_OPACITY = 0.45;
const ACTIVE_OPACITY = 0.24;
const LERP = 3; // per-second approach, so the highlight transfers smoothly

// Where the vertical gradient eases in off the ring and starts easing out into the
// sky, as a fraction of the shaft's height. Both ends taper so the tube never
// terminates on a hard rim.
const BASE_FADE = 0.16;
const TOP_FADE = 0.3;

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);

  return t * t * (3 - 2 * t);
};

// Through-terrain pass. Deliberately faint: a hint that something is back there,
// not a competing beacon.
const GHOST_RATIO = 0.35;

/**
 * One shared geometry for every beacon — they're all the same size, so there's no
 * reason for ten copies. Open-ended so you can see up the inside of the tube, which
 * is what gives it depth when you fly past.
 */
const shaftGeometry = (() => {
  // 24 height segments, not 12: vertex colours only interpolate between rings of
  // vertices, so the base fade needs enough of them to resolve as a gradient rather
  // than a couple of visible bands.
  const geometry = new CylinderGeometry(
    RADIUS_TOP,
    RADIUS_BOTTOM,
    HEIGHT,
    16,
    24,
    true
  );

  // Bake the fade in as vertex colours, tapering at *both* ends. Under additive
  // blending black adds nothing, so black vertices are invisible ones — the shaft
  // eases up out of the ring and dissipates into the sky, with no hard rim at
  // either end to give away that it's a cylinder.
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    // CylinderGeometry is centred on its own origin, so y runs -H/2 … +H/2.
    const t = (position.getY(i) + HEIGHT / 2) / HEIGHT;
    const brightness =
      smoothstep(0, BASE_FADE, t) * smoothstep(1, TOP_FADE, t);

    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness;
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  return geometry;
})();

// `fadeRef` is a ref rather than a value because it's driven from Ring's per-frame
// pop animation — a prop would need a re-render per frame to keep up.
const BeaconShaft = ({ index, position, fadeRef }) => {
  const solid = useRef();
  const ghost = useRef();

  const opacity = useRef(IDLE_OPACITY);
  const color = useMemo(() => IDLE_COLOR.clone(), []);

  useFrame((state, delta) => {
    if (!solid.current || !ghost.current) return;

    // Read the target straight from module state rather than a prop, so changing
    // the highlight never re-renders ten Ring components.
    const isTarget = beaconState.activeIndex === index;
    const k = 1 - Math.exp(-LERP * delta);

    opacity.current +=
      ((isTarget ? ACTIVE_OPACITY : IDLE_OPACITY) - opacity.current) * k;
    color.lerp(isTarget ? ACTIVE_COLOR : IDLE_COLOR, k);

    // Breathing pulse, replacing the <Float> bob that made the old beacon read as
    // unattached debris rather than as this ring's marker.
    const pulse = 0.92 + 0.08 * Math.sin(state.clock.elapsedTime * 1.6);
    const fade = fadeRef?.current ?? 1;
    const value = opacity.current * pulse * fade;

    solid.current.color.copy(color);
    solid.current.opacity = value;

    ghost.current.color.copy(color);
    ghost.current.opacity = value * GHOST_RATIO;
  });

  return (
    <group position={[position[0], position[1] + HEIGHT / 2, position[2]]}>
      {/* Ghost first and at a lower renderOrder: it draws through terrain, so it
          must not sit on top of the solid pass. Both are additive, so where the
          beacon is unobstructed the two sum — that extra lift on visible beacons is
          wanted, not a bug. */}
      <mesh geometry={shaftGeometry} renderOrder={1}>
        <meshBasicMaterial
          ref={ghost}
          vertexColors
          transparent
          opacity={IDLE_OPACITY * GHOST_RATIO}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <mesh geometry={shaftGeometry} renderOrder={2}>
        <meshBasicMaterial
          ref={solid}
          vertexColors
          transparent
          opacity={IDLE_OPACITY}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          // Required, not cosmetic: r3f's default ACES tone mapping crushes values
          // above 1, which is exactly where an additive glow lives.
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export default BeaconShaft;
