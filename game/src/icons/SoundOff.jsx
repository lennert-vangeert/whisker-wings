import React from "react";
import useGame from "../stores/useGame";

const SoundOff = () => {
  const setMusicOn = useGame((state) => state.setMusicOn);
  const phase = useGame((state) => state.phase);
  return (
    <div
      className={phase === "playing" ? "sound_icon_bottom" : "sound_icon"}
      onClick={setMusicOn}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="65.375"
        height="52.661"
        viewBox="0 0 65.375 52.661"
      >
        <g
          id="Icon_akar-sound-off"
          data-name="Icon akar-sound-off"
          transform="translate(-2.917 -8.669)"
        >
          <path
            id="Path_18"
            data-name="Path 18"
            d="M64.167,43.75l-17.5-17.5m17.5,0-17.5,17.5"
            fill="none"
            stroke="#000"
            strokeLinecap="round"
            strokeWidth="5.833"
          />
          <path
            id="Path_19"
            data-name="Path 19"
            d="M5.833,43.63V26.367A2.978,2.978,0,0,1,8.75,23.333H19.209a2.858,2.858,0,0,0,2.062-.89l8.75-9.882A2.9,2.9,0,0,1,35,14.709V55.291a2.9,2.9,0,0,1-5.005,2.118l-8.721-9.826a2.858,2.858,0,0,0-2.088-.916H8.75A2.979,2.979,0,0,1,5.833,43.63Z"
            fill="none"
            stroke="#000"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5.833"
          />
        </g>
      </svg>
    </div>
  );
};

export default SoundOff;
