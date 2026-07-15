import "./style.css";
import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import Experience from "./Experience.jsx";
import Interface from "./interface/Interface.jsx";
import { KeyboardControls } from "@react-three/drei";

const root = ReactDOM.createRoot(document.querySelector("#root"));

root.render(
  <KeyboardControls
    map={[
      { name: "forward", keys: ["ArrowUp", "KeyW"] },
      { name: "backward", keys: ["ArrowDown", "KeyS"] },
      { name: "left", keys: ["ArrowLeft", "KeyA"] },
      { name: "right", keys: ["ArrowRight", "KeyD"] },
      { name: "restart", keys: ["KeyR"] },
    ]}
  >
    <Canvas
      shadows
      camera={{
        fov: 45,
        near: 0.1,
        far: 2000,
        position: [-203, 115.5, 271],
      }}
    >
      {/* Without this, a suspending model propagates out of <Canvas> to the DOM root,
          where nothing catches it. Interface renders outside the Canvas and shows the
          loading screen while this is suspended. */}
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
    </Canvas>
    <Interface />
  </KeyboardControls>
);
