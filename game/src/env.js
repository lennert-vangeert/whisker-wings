/**
 * Emulator vs real-project switch.
 *
 *   dev -> Firestore emulator on :8080, no real credentials.
 *   prd -> the real project, read from VITE_FIREBASE_* (see FIREBASE.md).
 *
 * Resolution order:
 *   1. explicit VITE_APP_ENV ("dev" | "prd") if set
 *   2. otherwise Vite's build flag — `vite` dev server -> dev, `vite build` -> prd
 *
 * So local `npm run dev` uses the emulator with zero env setup, while a production
 * build automatically targets the real project. Anything that isn't the literal
 * string "dev" resolves to "prd", so the fallback fails safe toward production.
 */
const override = import.meta.env.VITE_APP_ENV;

export const APP_ENV = override
  ? override === "dev"
    ? "dev"
    : "prd"
  : import.meta.env.DEV
  ? "dev"
  : "prd";

export const IS_DEV = APP_ENV === "dev";
