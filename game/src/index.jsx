import "./style.css";
import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import Experience from "./Experience.jsx";
import Interface from "./interface/Interface.jsx";

const root = ReactDOM.createRoot(document.querySelector("#root"));

// The <KeyboardControls> wrapper that used to live here has been removed. Nothing
// ever called useKeyboardControls — flightControls.js binds raw window listeners —
// and its map actively misdescribed the game: it declared WASD as
// forward/backward/left/right when the real scheme is roll/pitch/yaw, and never
// mentioned turbo at all.
root.render(
  <>
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
  </>
);
