import React, { useEffect, useState } from "react";

const Leaderboard = () => {
  const [leaderBoard, setLeaderBoard] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/leaderboard`)
      .then((res) => res.json())
      .then((data) => {
        const userShortestTimes = data.reduce((acc, item) => {
          if (!acc[item.userName] || parseFloat(item.score) < parseFloat(acc[item.userName].score)) {
            acc[item.userName] = item;
          }
          return acc;
        }, {});
        const sortedData = Object.values(userShortestTimes)
          .sort((a, b) => parseFloat(a.score) - parseFloat(b.score))
          .slice(0, 10);
        setLeaderBoard(sortedData);
      });
  }, []);

  if (leaderBoard.length === 0) {
    return <div className="right_container">Loading...</div>;
  } else
    return (
      <div className="right_container">
        {leaderBoard.map((item, index) => (
          <div key={index} className="leaderboard_item">
            <span className="leaderboard_rank">{index + 1}</span>
            <span className="leaderboard_name">{item.userName}</span>
            <span className="leaderboard_score">{item.score}</span>
          </div>
        ))}
      </div>
    );
};

export default Leaderboard;
