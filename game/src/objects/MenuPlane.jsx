import React, { useEffect, useRef } from "react";
import { useGLTF, useAnimations, OrbitControls } from "@react-three/drei";
import { AnimationClip } from "three";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import useGame from "../stores/useGame";

const MenuPlane = () => {
  const plane = useGLTF("./models/plane/scene.gltf");
  const pilot = useGLTF("./models/pilot/pilot.gltf");
  const smoke = useGLTF("./models/smoke/scene.gltf");
  const menuPhase = useGame((state) => state.menuPhase);
  const phase = useGame((state) => state.phase);

  const planeRef = useRef();

  useEffect(() => {
    plane.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    pilot.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    smoke.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [plane, pilot, smoke]);

  const planeAnimations = useAnimations(plane.animations, plane.scene);
  const smokeAnimations = useAnimations(smoke.animations, smoke.scene);
  const animationspeed = 1;

  useEffect(() => {
    const singleTrack = planeAnimations.actions.Animation._clip.tracks[1];

    const singleTrackClip = new AnimationClip("SingleTrackAnimation", -1, [
      singleTrack,
    ]);

    const singleTrackAction = planeAnimations.mixer.clipAction(singleTrackClip);
    planeAnimations.mixer.timeScale = animationspeed;
    singleTrackAction.play();

    smokeAnimations.actions["Default Take"].play();
  }, [animationspeed]);

  const bobbingSpeed = 0.5;
  const bobbingHeight = 0.2;
  const rotationSpeed = 0.1;

  useFrame(({ clock, camera }) => {
    if (planeRef.current) {
      const elapsedTime = clock.getElapsedTime();

      planeRef.current.position.y =
        113 + Math.sin(elapsedTime * bobbingSpeed) * bobbingHeight;

      planeRef.current.rotation.z =
        Math.sin(elapsedTime * rotationSpeed) * 0.05;
      planeRef.current.rotation.x =
        Math.cos(elapsedTime * rotationSpeed) * 0.02;
    }
    // set camera position
    camera.position.set(-203, 115.5, 271);
    camera.lookAt(-198, 113, 265);
  });

  useEffect(() => {
    if (planeRef.current) {
      let targetPosition;
      let targetRotation;

      if (menuPhase === "leaderboards" || menuPhase === "credits" || menuPhase === "controls") {
        targetPosition = [-201, 113, 265];
        targetRotation = [0, Math.PI * 0.8, 0];
      } else if (menuPhase === "settings") {
        targetPosition = [-198, 113, 265]; // Adjusted position for "settings"
        targetRotation = [0, Math.PI * -0.3, Math.PI * -0.1]; // Adjusted rotation for "settings"
      } else {
        // Default to "main" menu phase
        targetPosition = [-198, 113, 265];
        targetRotation = [0, Math.PI * 0.65, Math.PI * -0.05];
      }

      // GSAP animations for position and rotation transitions
      gsap.to(planeRef.current.position, {
        x: targetPosition[0],
        y: targetPosition[1],
        z: targetPosition[2],
        duration: 1,
        ease: "power2.inOut",
      });

      gsap.to(planeRef.current.rotation, {
        x: targetRotation[0],
        y: targetRotation[1],
        z: targetRotation[2],
        duration: 1,
        ease: "power2.inOut",
      });
    }
  }, [menuPhase]);

  return (
    <group
      ref={planeRef}
      scale={0.5}
      rotation={[0, Math.PI * 0.65, Math.PI * -0.05]}
      position={[-198, 113, 265]}
    >
      <primitive
        object={plane.scene}
        scale={1}
        position={[0, 2, 0]}
        rotation={[0, Math.PI, 0]}
      />

      <primitive
        object={pilot.scene}
        scale={0.3}
        position={[0, 2, 1]}
        rotation={[Math.PI * 0.1, Math.PI, 0]}
      />

      <primitive
        object={smoke.scene}
        rotation={[Math.PI * 0.2, Math.PI, 0]}
        scale={3.5}
        position={[0, 4, -2]}
      />
    </group>
  );
};

export default MenuPlane;
