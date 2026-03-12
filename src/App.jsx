import { useEffect, useState } from "react";

const LEAGUE_KEY = "465.l.107565";
const LEAGUE_NAME = "SÉRIES - Ligue des bons";

function parseTeams(data) {
  const teamsObj = data.fantasy_content.league[1].standings[0].teams;
  const teams = [];
  Object.keys(teamsObj).forEach((key) => {
    if (key === "count") return;
    const t = teamsObj[key].team;
    const infoArray = t[0];
    const statsBlock = t[1];

    console.log("TEAM KEY:", key);
    console.log("statsBlock:", JSON.stringify(statsBlock));

    let name = "";
    for (let i = 0; i < infoArray.length; i++) {
      if (infoArray[i] && infoArray[i].name) {
        name = infoArray[i].name;
        break;
      }
    }
    let teamKey = "";
    for (let i = 0; i < infoArray.length; i++) {
      if (infoArray[i] && infoArray[i].team_key) {
        teamKey = infoArray[i].team_key;
        break;
      }
    }

    const points = parseFloat(statsBlock?.team_points?.total || 0);
    const pointsChange = parseFloat(statsBlock?.team_standings?.points_change || 5);
    const rank = parseInt(statsBlock?.team_standings?.rank || 99);

    teams.push({ key: teamKey, name, rank, points, pointsChange });
  });
  return teams.sort((a, b) => a.rank - b.rank);
}

function simulateSeason(teams, simulations = 10000) {
  const wins = Object.fromEntries(teams.map((t) => [t.key, 0]));
  const remaining = Math.max(5, 36 - Math.round(teams[0].points / Math.max(1, teams[0].pointsChange)));

  for (let i = 0; i < simulations; i++) {
    const simPoints = teams.map((t) => ({
      key: t.key,
      points: t.points + (Math.random() * 2 - 0.5) * t.pointsChange * remaining,
    }));
    simPoints.sort((a, b) => b.points - a.points);
    wins[simPoints[0].key]++;
  }

  return Object.fromEntries(
    Object.entries(wins).map(([k, v]) => [k, ((v / simulations) * 100).toFixed(1)])
  );
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [teams, setTeams] = useState([]);
  const [probabilities, setProbabilities] = useState({});
  const [view, setView] = useState("leagues");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const fetchStandings = () => {
    setLoading(true);
    setError(null);
    fetch(`https://localhost:3001/api/standings/${LEAGUE_KEY}`)
      .then((res) => res.json())
      .then((data) => {
        const parsed = parseTeams(data);
        setTeams(parsed);
        setProbabilities(simulateSeason(parsed));
        setView("standings");
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erreur standings:", err);
        setError("Erreur : " + err.message);
        setLoading(false);
      });
  };

  const s = {
    page: { fontFamily: "Arial", padding: "40px", background: "#0a0e1a", minHeight: "100vh", color: "white" },
    header: { borderBottom: "2px solid #1e3a5f", paddingBottom: "20px", marginBottom: "40px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: "2.5rem", color: "#4fc3f7", margin: 0 },
    btn: { padding: "10px 20px", background: "#4fc3f7", color: "#0a0e1a", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "0.95rem" },
    card: { background: "#1e2a3a", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "20px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" },
    rank: { fontSize: "1.5rem", fontWeight: "bold", color: "#4fc3f7", width: "40px" },
    teamName: { flex: 1, fontWeight: "bold", fontSize: "1.1rem" },
    points: { color: "#90caf9", marginRight: "30px" },
    bar: (pct) => ({ height: "10px", borderRadius: "5px", background: `linear-gradient(90deg, #4fc3f7 ${pct}%, #1e3a5f ${pct}%)`, width: "150px" }),
    pct: { color: "#4fc3f7", fontWeight: "bold", width: "60px", textAlign: "right" },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>🏒 Kent</h1>
          <p style={{ color: "#90caf9", margin: "5px 0 0 0" }}>Your AI Fantasy Hockey Assistant</p>
        </div>
        {view === "standings" && (
          <button style={s.btn} onClick={() => setView("leagues")}>← Ligues</button>
        )}
      </div>

      {!connected ? (
        <div style={{ textAlign: "center", marginTop: "100px" }}>
          <h2 style={{ color: "#90caf9" }}>Connecte ta ligue Yahoo pour commencer</h2>
          <a href="https://localhost:3001/auth/yahoo" style={{ display: "inline-block", marginTop: "20px", padding: "15px 40px", background: "#4fc3f7", color: "#0a0e1a", borderRadius: "8px", textDecoration: "none", fontWeight: "bold", fontSize: "1.1rem" }}>
            Connecter Yahoo Fantasy
          </a>
        </div>
      ) : view === "leagues" ? (
        <div>
          <h2 style={{ color: "#4fc3f7" }}>Tes ligues</h2>
          {loading && <p style={{ color: "#90caf9" }}>Chargement des probabilités...</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}
          {leagues.map((league) => (
            <div key={league.league_id} onClick={() => fetchStandings()} style={s.card}>
              <div>
                <h3 style={{ margin: 0 }}>{league.name}</h3>
                <p style={{ color: "#90caf9", margin: "5px 0 0 0" }}>{league.num_teams} équipes · Saison {league.season}</p>
              </div>
              <span style={{ color: "#4fc3f7" }}>Voir les probabilités →</span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <h2 style={{ color: "#4fc3f7" }}>🎯 Probabilités de gagner — {LEAGUE_NAME}</h2>
          <p style={{ color: "#90caf9", marginBottom: "30px" }}>Basé sur 10 000 simulations de la saison restante</p>
          {teams.map((team) => (
            <div key={team.key} style={{ ...s.card, cursor: "default" }}>
              <span style={s.rank}>#{team.rank}</span>
              <span style={s.teamName}>{team.name}</span>
              <span style={s.points}>{team.points} pts</span>
              <div style={s.bar(probabilities[team.key])}></div>
              <span style={s.pct}>{probabilities[team.key]}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}