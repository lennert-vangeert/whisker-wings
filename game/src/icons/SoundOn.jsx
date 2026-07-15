import React from "react";
import useGame from "../stores/useGame";

const SoundOn = () => {
  const phase = useGame((state) => state.phase);
  const setMusicOff = useGame((state) => state.setMusicOff);
  return (
    <div
      className={phase === "playing" ? "sound_icon_bottom" : "sound_icon"}
      onClick={setMusicOff}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64.167"
        height="52.661"
        viewBox="0 0 64.167 52.661"
      >
        <path
          id="Icon_akar-sound-on"
          data-name="Icon akar-sound-on"
          d="M5.833,43.63V26.367A2.978,2.978,0,0,1,8.75,23.333H19.209a2.858,2.858,0,0,0,2.062-.89l8.75-9.882A2.9,2.9,0,0,1,35,14.709V55.291a2.9,2.9,0,0,1-5.005,2.118l-8.721-9.826a2.858,2.858,0,0,0-2.088-.916H8.75A2.979,2.979,0,0,1,5.833,43.63ZM46.667,24.792c3.888,5.186,3.888,15.231,0,20.417m8.75-30.625a28.194,28.194,0,0,1,0,40.833"
          transform="translate(-2.917 -8.669)"
          fill="none"
          stroke="#000"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5.833"
        />
      </svg>
    </div>
  );
};

export default SoundOn;
