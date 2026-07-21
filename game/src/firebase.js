import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { IS_DEV } from "./env";

const USE_EMULATORS = IS_DEV;

// In emulator mode we talk to a "demo-" project, which needs no real credentials —
// so a fresh clone runs with zero setup. The whole config object is swapped rather
// than just adding an emulator connect call, so dev never references the real
// project at all.
//
// In production these come from VITE_FIREBASE_* (see FIREBASE.md). They are the
// public Firebase web-app config values: they ship to the browser by design, and
// access is gated by firestore.rules, not by keeping them secret. That's the
// meaningful difference from the old VITE_API_KEY, which was pretending to be auth
// while sitting in plain sight in the bundle.
const firebaseConfig = USE_EMULATORS
  ? {
      projectId: "demo-whisker-wings",
      apiKey: "demo",
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 127.0.0.1 rather than localhost: on macOS the latter can resolve to the IPv6
// ::1, which the emulator isn't listening on.
if (USE_EMULATORS) connectFirestoreEmulator(db, "127.0.0.1", 8080);

/** The one collection this game uses. */
export const SCORES = "scores";
