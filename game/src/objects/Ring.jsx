import { RigidBody } from "@react-three/rapier";
import React, { useEffect, useState } from "react";
import useGame from "../stores/useGame";
import { Float } from "@react-three/drei";

const Ring = ({ diameter, position, rotY }) => {
  const [isVisible, setIsVisible] = useState(true);
  const addScore = useGame((state) => state.addScore);
  const score = useGame((state) => state.score);
  const end = useGame((state) => state.end);
  const ringLocations = useGame((state) => state.ringLocations);
  const isMusicOn = useGame((state) => state.isMusicOn);
  const beaconsOn = useGame((state) => state.beaconsOn);
  const audio = new Audio("/audio/collect.mp3");

  const playAudio = () => {
    if (!isMusicOn) return;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.5;
    audio.play();
  };

  const onCollission = (() => {
    let hasCollided = false;
    return (e) => {
      if (!hasCollided) {
        addScore();
        setIsVisible(false);
        hasCollided = true;
        playAudio();
      }
    };
  })();

  useEffect(() => {
    if (score === ringLocations.length) {
      end();
    }
  }, [score]);

  return (
    isVisible && (
      <>
        <RigidBody
          onCollisionEnter={onCollission}
          type="dynamic"
          gravityScale={0}
          position={position}
          rotation={rotY}
          colliders="hull"
        >
          <mesh>
            <torusGeometry args={[diameter, 0.8, 16, 100]} />
            <meshStandardMaterial color="red" />
          </mesh>
        </RigidBody>

        {beaconsOn && (
          <Float
            position={[position[0], position[1] + 30, position[2]]}
            speed={0.5}
            rotationIntensity={0.2}
            floatIntensity={0.2}
          >
            <group>
              <mesh position={[0, 40, 0]}>
                <coneGeometry args={[diameter * 0.5, 40, 4]} />
                <meshStandardMaterial color="red" transparent opacity={0.3} />
              </mesh>
              <mesh rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[diameter * 0.5, 40, 4]} />
                <meshStandardMaterial color="red" transparent opacity={0.3} />
              </mesh>
            </group>
          </Float>
        )}
      </>
    )
  );
};

export default Ring;
