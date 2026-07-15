// Plane.jsx (or Plane.js)
import { useEffect, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { CuboidCollider } from "@react-three/rapier";
import { AnimationClip, Matrix4, Quaternion, Vector3 } from "three";
import { updatePlaneAxis } from "../flightControls";
import { useFrame } from "@react-three/fiber";
import useGame from "../stores/useGame";

const x = new Vector3(1, 0, 0);
const y = new Vector3(0, 1, 0);
const z = new Vector3(0, 0, 1);
export const planePosition = new Vector3(0, 3, 7);

const delayedRotMatrix = new Matrix4();
const delayedQuaternion = new Quaternion();
const Plane = () => {
  const plane = useGLTF("./models/plane/scene.gltf");
  const pilot = useGLTF("./models/pilot/pilot.gltf");
  const smoke = useGLTF("./models/smoke/scene.gltf");
  const crashed = useGame((state) => state.crashed);
  const isMusicOn = useGame((state) => state.isMusicOn);
  const audioRef = useRef();

  useEffect(() => {
    // Create the Audio object only once
    if (!audioRef.current) {
      const audio = new Audio("/audio/plane.mp3");
      audio.loop = true;
      audio.volume = 0.5;
      audioRef.current = audio;
    }

    const audio = audioRef.current;

    if (isMusicOn) {
      audio.play();
    } else {
      audio.pause();
    }

    // Cleanup on component unmount (optional)
    return () => {
      audio.pause();
      audio.currentTime = 0; // Reset playback position
    };
  }, [isMusicOn]);

  const groupRef = useRef();
  const helixMeshRef = useRef();
  const colliderRef = useRef();

  const planeAnimations = useAnimations(plane.animations, plane.scene);
  const smokeAnimations = useAnimations(smoke.animations, smoke.scene);
  const animationspeed = 1;
  useEffect(() => {
    // guard: make sure animation exists
    if (planeAnimations.actions && planeAnimations.actions.Animation && planeAnimations.actions.Animation._clip) {
      const tracks = planeAnimations.actions.Animation._clip.tracks;
      if (tracks && tracks.length > 1) {
        const singleTrack = tracks[1];
        const singleTrackClip = new AnimationClip("SingleTrackAnimation", -1, [singleTrack]);
        const singleTrackAction = planeAnimations.mixer.clipAction(singleTrackClip);
        planeAnimations.mixer.timeScale = animationspeed;
        singleTrackAction.play();
      }
    }

    if (smokeAnimations.actions && smokeAnimations.actions["Default Take"]) {
      smokeAnimations.actions["Default Take"].play();
    }
  }, [animationspeed, planeAnimations, smokeAnimations]);

  useFrame((state, delta) => {
    const { camera } = state;

    // Pass delta to updatePlaneAxis so movement scales with time
    updatePlaneAxis(x, y, z, planePosition, camera, crashed, delta);

    const rotMatrix = new Matrix4().makeBasis(x, y, z);

    const matrix = new Matrix4()
      .multiply(
        new Matrix4().makeTranslation(
          planePosition.x,
          planePosition.y,
          planePosition.z
        )
      )
      .multiply(rotMatrix);

    if (groupRef.current) {
      groupRef.current.matrixAutoUpdate = false;
      groupRef.current.matrix.copy(matrix);
      groupRef.current.matrixWorldNeedsUpdate = true;
    }

    const quaternionA = new Quaternion().copy(delayedQuaternion);
    const quaternionB = new Quaternion().setFromRotationMatrix(rotMatrix);

    // small slerp toward desired rotation (keeps it smooth)
    const interpolationFactor = 0.175;
    quaternionA.slerp(quaternionB, interpolationFactor);
    delayedQuaternion.copy(quaternionA);

    delayedRotMatrix.identity().makeRotationFromQuaternion(delayedQuaternion);

    const cameraOffset = new Vector3(0, 10, 30);
    const cameraMatrix = new Matrix4()
      .multiply(
        new Matrix4().makeTranslation(
          planePosition.x,
          planePosition.y,
          planePosition.z
        )
      )
      .multiply(delayedRotMatrix)
      .multiply(
        new Matrix4().makeTranslation(
          cameraOffset.x,
          cameraOffset.y,
          cameraOffset.z
        )
      );

    camera.matrixAutoUpdate = false;
    camera.matrix.copy(cameraMatrix);
    camera.matrixWorldNeedsUpdate = true;

    // rotate helix based on time (radians per second)
    if (helixMeshRef.current) {
      const helixRotationSpeed = 6.0; // radians per second (tweak as desired)
      helixMeshRef.current.rotation.z -= helixRotationSpeed * delta;
    }

    if (colliderRef.current) {
      const colliderOffset = new Vector3(0, 2, 0);
      const adjustedPosition = planePosition
        .clone()
        .add(colliderOffset.applyQuaternion(delayedQuaternion));
      // rapier cuboid collider methods
      if (colliderRef.current.setTranslation) {
        colliderRef.current.setTranslation(adjustedPosition);
      }
      if (colliderRef.current.setRotation) {
        colliderRef.current.setRotation(delayedQuaternion);
      }
    }
  });

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

  return (
    <>
      <group ref={groupRef} scale={0.5} position={[0, -1.5, 0]}>
        <group ref={helixMeshRef}></group>
        <primitive
          object={plane.scene}
          scale={1}
          position={[0, 2, 0]}
          rotation={[0, Math.PI, 0]}
        />

        <primitive
          object={pilot.scene}
          scale={0.3}
          position={[0, 2.2, 0.6]}
          rotation={[Math.PI * -0.1, Math.PI, 0]}
        />

        <primitive
          object={smoke.scene}
          rotation={[Math.PI * -0.2, Math.PI, 0]}
          scale={3.5}
          position={[0, 4, -2]}
        />
        <CuboidCollider ref={colliderRef} args={[7.5, 2, 7.5]} />
      </group>
    </>
  );
};

export default Plane;
