import { CuboidCollider } from "@react-three/rapier";
import { useControls } from "leva";
import React from "react";
import useGame from "../stores/useGame";

const DeadZones = () => {
  const phase = useGame((state) => state.phase);
  const failed = useGame((state) => state.failed);
  const isMusicOn = useGame((state) => state.isMusicOn);
  const setFlewOutOfMapOn = useGame((state) => state.setFlewOutOfMapOn);

  const collissionSound = new Audio("/audio/hit.mp3");

  const onCollission = () => {
    setFlewOutOfMapOn();
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
      <CuboidCollider
        onCollisionEnter={onCollission}
        args={[1000, 5, 1000]}
        position={[0, 200, 0]}
      />
      <CuboidCollider
        onCollisionEnter={onCollission}
        args={[1000, 5, 1000]}
        position={[0, -200, 0]}
      />
      <CuboidCollider
        onCollisionEnter={onCollission}
        args={[430, 300, 5]}
        position={[0, 0, 120]}
      />
      <CuboidCollider
        onCollisionEnter={onCollission}
        args={[430, 300, 5]}
        position={[0, 0, -630]}
      />
      <CuboidCollider
        onCollisionEnter={onCollission}
        args={[5, 300, 430]}
        position={[-370, 0, -200]}
      />
      <CuboidCollider
        onCollisionEnter={onCollission}
        args={[5, 300, 430]}
        position={[370, 0, -200]}
      />
    </>
  );
};

export default DeadZones;
