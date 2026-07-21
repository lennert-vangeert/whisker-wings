import React, { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import useGame from "../stores/useGame";
import useSound from "../useSound";
import { addCameraShake, SHAKE_IMPACT } from "../cameraShake";

const LANDSCAPE_URL = "./models/landscape/landscape.gltf";

// Warms the cache while the player is still on the menu — this module is imported
// by Experience.jsx at boot, but Landscape itself only mounts once the run starts.
useGLTF.preload(LANDSCAPE_URL);

const Landscape = () => {
  const failed = useGame((state) => state.failed);
  // Was `new Audio(...)` in the component body — a fresh element every render, so
  // the pause()/currentTime reset acted on something that had never played.
  const playHit = useSound("/audio/hit.mp3", { volume: 0.3 });

  const landscape = useGLTF(LANDSCAPE_URL);
  useEffect(() => {
    landscape.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, []);

  const onCollission = () => {
    // Reads the phase at call time rather than closing over it. This handler is
    // handed to Rapier, so a captured `phase` goes stale as soon as it changes.
    //
    // The guard matters for more than failed(), which is already idempotent: this
    // fires for *every* body that touches the terrain, and the crash bunny is a real
    // dynamic RigidBody that bounces off it several times on the way to rest. Without
    // this the hit sound and the camera punch retriggered on every one of those
    // bounces. Only the collision that actually ends the run should be heard.
    const isCrashImpact = useGame.getState().phase === "playing";

    failed();

    if (isCrashImpact) {
      playHit();
      addCameraShake(SHAKE_IMPACT);
    }
  };

  return (
    <>
      {/*
        Stays "dynamic" on purpose. The plane's CuboidCollider has no RigidBody
        parent and is therefore a *fixed* collider, and Rapier generates no contact
        events between two fixed colliders — switching this to "fixed" would silently
        kill terrain crash detection.

        The locks make it behave like a kinematic body anyway, which matters now that
        the crash bunny is a real dynamic body bouncing off this trimesh: without
        them it could transfer momentum and shove the entire landscape.
      */}
      <RigidBody
        onCollisionEnter={onCollission}
        type="dynamic"
        colliders="trimesh"
        gravityScale={0}
        lockTranslations
        lockRotations
      >
        <primitive
          object={landscape.scene}
          scale={100}
          position={[0, -80, -250]}
        />
      </RigidBody>
    </>
  );
};

export default Landscape;
