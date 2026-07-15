import React, { useRef, useMemo } from "react";
import { extend, useThree, useLoader, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { Water } from "three/examples/jsm/objects/Water.js";
import { LAKE_POSITION, LAKE_SIZE } from "../lakeConfig";

extend({ Water });

const WATER_NORMALS_URL = "./textures/waternormals.jpg";

// Warms the cache while the player is still on the menu — this module is imported
// by Experience.jsx at boot, but Lake itself only mounts once the run starts.
useLoader.preload(THREE.TextureLoader, WATER_NORMALS_URL);

function Lake() {
  const ref = useRef();
  const gl = useThree((state) => state.gl);
  const waterNormals = useLoader(THREE.TextureLoader, WATER_NORMALS_URL);

  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  const geom = useMemo(() => new THREE.PlaneGeometry(LAKE_SIZE, LAKE_SIZE), []);
  const config = useMemo(
    () => ({
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(),
      sunColor: 0xeb8934,
      waterColor: 0x0064b5,
      distortionScale: 40,
      fog: false,
      format: gl.encoding,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [waterNormals]
  );
  useFrame(
    (state, delta) => (ref.current.material.uniforms.time.value += delta / 10)
  );
  return (
    // No collider: the plane's transform is authoritative, so drowning is detected
    // by isSubmerged() in Plane.jsx rather than by physics.
    <water
      ref={ref}
      args={[geom, config]}
      rotation-x={-Math.PI / 2}
      position={LAKE_POSITION}
    />
  );
}

export default Lake;
