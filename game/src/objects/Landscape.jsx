import React, { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import useGame from "../stores/useGame";

const Landscape = () => {
  const phase = useGame((state) => state.phase);
  const failed = useGame((state) => state.failed);
  const isMusicOn = useGame((state) => state.isMusicOn);

  const collissionSound = new Audio("/audio/hit.mp3");

  const landscape = useGLTF("./models/landscape/landscape.gltf");
  useEffect(() => {
    landscape.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, []);

  const onCollission = () => {
    if (phase === "playing") {
      failed();
    }
    if (isMusicOn) {
      collissionSound.pause();
      collissionSound.currentTime = 0;
      collissionSound.volume = 0.3;
      collissionSound.play();
    }
  };

  return (
    <>
      <RigidBody
        onCollisionEnter={onCollission}
        type="dynamic"
        colliders="trimesh"
        gravityScale={0}
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
