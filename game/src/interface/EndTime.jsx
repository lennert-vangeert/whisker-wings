import React, { useEffect } from "react";
import useGame from "../stores/useGame";

const EndTime = ({ time = 0 }) => {
  const ready = useGame((state) => state.ready);
  if (!localStorage.getItem("userName")) {
    localStorage.setItem("userName", "Player");
  }
  // post score to server
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/createscore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        key: import.meta.env.VITE_API_KEY,
      },
      body: JSON.stringify({
        userName: localStorage.getItem("userName"),
        score: time,
      }),
    });
  }, []);

  return (
    <div className="button_container">
      <h1 className="title">Finish</h1>
      <h1 className="subtitle">Time</h1>
      <div className="subtitle">{time}</div>
      <div className="main_button" onClick={ready}>
        Main menu
      </div>
    </div>
  );
};

export default EndTime;
