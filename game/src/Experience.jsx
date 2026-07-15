import { OrbitControls, Sky } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import Plane from "./objects/Plane";
import Ring from "./objects/Ring";
import Landscape from "./objects/Landscape";
import Lake from "./objects/Lake";
import MenuPlane from "./objects/MenuPlane";
import useGame from "./stores/useGame";
import DeadZones from "./objects/DeadZones";

export default function Experience() {
  const ringLocations = useGame((state) => state.ringLocations);
  const phase = useGame((state) => state.phase);
  return (
    <>
      <ambientLight intensity={2} />
      <directionalLight
        castShadow
        position={[100, 100, 100]}
        intensity={2}
        color={"#FFA500"} 
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={5000}
        shadow-camera-left={-1000}
        shadow-camera-right={1000}
        shadow-camera-top={1000}
        shadow-camera-bottom={-1000}
      />
      <Physics gravity={[0, -9.81, 0]}>
        {phase === "playing" && (
          <>
          <DeadZones />
            <Plane />
   
            {ringLocations.map(([x, y, z, rotY], index) => (
              <Ring
                key={index}
                position={[x, y, z]}
                rotY={[0, rotY, 0]}
                diameter={Math.random() * (5 - 3) + 3}
              />
            ))}
            <Landscape />
            <Lake />
          </>
        )}
        {phase === "ready" && <MenuPlane />}
      </Physics>
      <Sky sunPosition={[100, 10, 100]} distance={100000} />
    </>
  );
}
