import { useEffect, useState } from "react";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [leagues, setLeagues] = useState([]);

  useEffect(() => {
    fetch("https://localhost:3001/auth/status")
      .then((res) => res.json())
      .then((data) => {
        setConnected(data.connected);
        if (data.connected) fetchLeagues();
      });
  }, []);

  const fetchLeagues = () => {
    fetch("https://localhost:3001/api/leagues")
      .then((res) => res.json())
      .then((data) => {
        const gamesObj = data.fantasy_content.users[0].user[1].games;
        const leaguesList = [];
        Object.keys(gamesObj).forEach((key) => {
          if (key === "count") return;
          const leaguesObj = gamesObj[key].game[1].leagues;
          Object.keys(leaguesObj).forEach((lkey) => {
            if (lkey === "count") return;
            leaguesList.push(leaguesObj[lkey].league[0]);
          });
        });
        setLeagues(leaguesList);
      });
  };

  return (
    <div style={{ fontFamily: "Arial", padding: "40px", background: "#0a0e1a", minHeight: "100vh", color: "white" }}>
      <div style={{ borderBottom: "2px solid #1e3a5f", paddingBottom: "20px", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "2.5rem", color: "#4fc3f7", margin: 0 }}>🏒 Kent</h1>
        <p style={{ color: "#90caf9", margin: "5px 0 0 0" }}>Your AI Fantasy Hockey Assistant</p>
      </div>
      {!connected ? (
        <div style={{ textAlign: "center", marginTop: "100px" }}>
          <h2 style={{ color: "#90caf9" }}>Connecte ta ligue Yahoo pour commencer</h2>
          <a href="https://localhost:3001/auth/yahoo" style={{ display: "inline-block", marginTop: "20px", padding: "15px 40px", background: "#4fc3f7", color: "#0a0e1a", borderRadius: "8px", textDecoration: "none", fontWeight: "bold", fontSize: "1.1rem" }}>
            Connecter Yahoo Fantasy
          </a>
        </div>
      ) : (
        <div>
          <h2 style={{ color: "#4fc3f7" }}>Tes ligues</h2>
          {leagues.map((league) => (
            <div key={league.league_id} style={{ background: "#1e2a3a", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "20px", marginBottom: "15px", cursor: "pointer" }}>
              <h3 style={{ margin: 0, color: "white" }}>{league.name}</h3>
              <p style={{ color: "#90caf9", margin: "5px 0 0 0" }}>
                {league.num_teams} équipes · Saison {league.season} · {league.scoring_type === "point" ? "Système de points" : league.scoring_type}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}