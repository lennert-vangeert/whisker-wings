// SpeedLinesEffect.js
// Radial speed lines — the streaks that rush past the edges of the screen under
// boost. A custom postprocessing Effect rather than one of the stock ones, because
// nothing in the library does this.
//
// @react-three/postprocessing's EffectComposer collects its children by walking the
// r3f group and testing `instanceof Effect`, so an instance of this can be dropped in
// with <primitive object={...} />.

import { Effect } from "postprocessing";
import { Uniform } from "three";

// Naming notes, both of which cost a shader-compile failure to learn:
//  - `active` is a RESERVED KEYWORD in GLSL ES 3.00 (as are `common`, `partition`
//    and `filter`). Using one as a variable name fails to compile with only a
//    generic "Fragment shader is not compiled" from three.
//  - postprocessing's shader library already defines helpers in the shared fragment
//    head (`rand`, `luminance`, `average`, …), so effect-local helpers get a
//    distinctive prefix to avoid ever colliding with them.
const fragmentShader = /* glsl */ `
  uniform float uStrength;
  uniform float uTime;

  float slHash(const in float n) {
    return fract(sin(n) * 43758.5453123);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 d = uv - 0.5;
    float r = length(d);
    float a = atan(d.y, d.x);

    // Slice the screen into angular lanes; each lane holds at most one streak.
    float lanes = 110.0;
    float laneF = (a + 3.14159265) / 6.28318531 * lanes;
    float rnd = slHash(floor(laneF));

    // Only some lanes light up, and more of them as the boost builds.
    float lit = step(0.72 - 0.30 * uStrength, rnd);

    // A thin line down the centre of the lane. The power sharpens it to a streak
    // rather than a wedge — without it, lanes read as pie slices.
    float line = smoothstep(0.5, 0.0, abs(fract(laneF) - 0.5) * 2.0);
    line = pow(line, 10.0);

    // Each streak sweeps outward on its own phase and speed.
    float phase = fract(uTime * (0.9 + rnd * 1.6) + rnd);
    float band = smoothstep(0.25, 0.0, abs(r - mix(0.1, 0.85, phase)));

    // Keep the middle of the screen clear so the plane stays readable.
    float edge = smoothstep(0.16, 0.5, r);

    // Multiplied through by uStrength rather than early-returning when it's zero:
    // effects are composed into a shared main(), so an early return from mainImage
    // is a trap even where it compiles.
    float intensity = lit * line * band * edge * uStrength;

    outputColor = vec4(inputColor.rgb + vec3(intensity), inputColor.a);
  }
`;

export default class SpeedLinesEffect extends Effect {
  constructor() {
    super("SpeedLinesEffect", fragmentShader, {
      uniforms: new Map([
        ["uStrength", new Uniform(0)],
        ["uTime", new Uniform(0)],
      ]),
    });
  }

  set strength(value) {
    this.uniforms.get("uStrength").value = value;
  }

  // Called by the composer each frame; deltaTime is in seconds.
  update(renderer, inputBuffer, deltaTime) {
    this.uniforms.get("uTime").value += deltaTime;
  }
}
