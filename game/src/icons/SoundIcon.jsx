import React from "react";

// Replaces the old SoundOn/SoundOff pair. Those each read the store directly,
// hardcoded pixel dimensions, hardcoded stroke="#000" (ignoring --color-primary),
// and picked their own wrapper class off the phase — all of which fought the
// responsive layout. This one is presentational: sized by CSS, coloured by
// currentColor, positioned by wherever the grid puts it.
const SoundIcon = ({ on }) => (
  <svg
    className="icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 68 52.661"
    fill="none"
    stroke="currentColor"
    strokeWidth="5.833"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Speaker body, shared by both states. */}
    <path
      d="M5.833,43.63V26.367A2.978,2.978,0,0,1,8.75,23.333H19.209a2.858,2.858,0,0,0,2.062-.89l8.75-9.882A2.9,2.9,0,0,1,35,14.709V55.291a2.9,2.9,0,0,1-5.005,2.118l-8.721-9.826a2.858,2.858,0,0,0-2.088-.916H8.75A2.979,2.979,0,0,1,5.833,43.63Z"
      transform="translate(-2.917 -8.669)"
    />
    {on ? (
      // Sound waves.
      <path
        d="M46.667,24.792c3.888,5.186,3.888,15.231,0,20.417m8.75-30.625a28.194,28.194,0,0,1,0,40.833"
        transform="translate(-2.917 -8.669)"
      />
    ) : (
      // Cross.
      <path
        d="M64.167,43.75l-17.5-17.5m17.5,0-17.5,17.5"
        transform="translate(-2.917 -8.669)"
      />
    )}
  </svg>
);

export default SoundIcon;
