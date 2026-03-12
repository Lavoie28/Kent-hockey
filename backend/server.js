const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');
const https = require('https');
const fs = require('fs');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
let tokenData = null;

const sslOptions = {
  key: fs.readFileSync('./localhost-key.pem'),
  cert: fs.readFileSync('./localhost.pem'),
};

app.get('/auth/yahoo', (req, res) => {
  const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${process.env.YAHOO_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&response_type=code&language=en-us`;
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const credentials = Buffer.from(`${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`).toString('base64');
    const response = await axios.post(
      'https://api.login.yahoo.com/oauth2/get_token',
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.REDIRECT_URI }),
      { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    tokenData = response.data;
    res.redirect(`${process.env.FRONTEND_URL}?connected=true`);
  } catch (error) {
    console.error('Erreur OAuth:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur de connexion Yahoo' });
  }
});

app.get('/auth/status', (req, res) => {
  res.json({ connected: !!tokenData });
});

app.get('/api/leagues', async (req, res) => {
  if (!tokenData) return res.status(401).json({ error: 'Non connecté' });
  try {
    const response = await axios.get(
      'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nhl/leagues?format=json',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lecture ligue' });
  }
});

app.get('/api/standings/:leagueKey', async (req, res) => {
  if (!tokenData) return res.status(401).json({ error: 'Non connecté' });
  try {
    const response = await axios.get(
      `https://fantasysports.yahooapis.com/fantasy/v2/league/${req.params.leagueKey}/standings?format=json`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lecture standings' });
  }
});

app.get('/api/teamstats/:leagueKey', async (req, res) => {
  if (!tokenData) return res.status(401).json({ error: 'Non connecté' });
  try {
    const { leagueKey } = req.params;

    const standingsRes = await axios.get(
      `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const teamsObj = standingsRes.data.fantasy_content.league[1].standings[0].teams;
    const teamKeys = [];
    const standingsMap = {};

    Object.keys(teamsObj).forEach((key) => {
      if (key === 'count') return;
      const team = teamsObj[key].team;
      const infoArray = team[0];
      let teamKey = '';
      for (let i = 0; i < infoArray.length; i++) {
        if (infoArray[i]?.team_key) { teamKey = infoArray[i].team_key; break; }
      }
      const pts = parseFloat(team[1]?.team_points?.total || 0);
      const pointsChange = parseFloat(team[1]?.team_standings?.points_change || 5);
      teamKeys.push(teamKey);
      standingsMap[teamKey] = { pts, pointsChange };
    });

    const rosterPromises = teamKeys.map((teamKey) =>
      axios.get(
        `https://fantasysports.yahooapis.com/fantasy/v2/team/${teamKey}/roster/players?format=json`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      ).then((r) => ({ teamKey, data: r.data }))
       .catch(() => ({ teamKey, data: null }))
    );
    const rosters = await Promise.all(rosterPromises);

    const teamStatPromises = rosters.map(async ({ teamKey, data }) => {
      if (!data) return { teamKey, totalPoints: standingsMap[teamKey]?.pts || 0, rawPoints: standingsMap[teamKey]?.pts || 0, pointsChange: 5, injuredCount: 0, activeInjuredCount: 0, playerCount: 0 };

      const roster = data.fantasy_content.team[1].roster[0].players;
      const activePlayers = [];
      const benchPlayers = [];
      let injuredCount = 0;
      let activeInjuredCount = 0;

      Object.keys(roster).forEach((pKey) => {
        if (pKey === 'count') return;
        const player = roster[pKey].player;
        const info = player[0];
        const statsBlock = player[1];

        let playerKey = '', name = '', status = '';
        for (let i = 0; i < info.length; i++) {
          if (info[i]?.player_key) playerKey = info[i].player_key;
          if (info[i]?.name?.full) name = info[i].name.full;
          if (info[i]?.status) status = info[i].status;
        }
        const position = statsBlock?.selected_position?.[1]?.position || '';
        const isInjured = ['IR', 'O', 'IR-LT', 'DTD'].includes(status);
        const isActive = !['BN', 'IR'].includes(position);

        if (isInjured) injuredCount++;
        if (isInjured && isActive) activeInjuredCount++;

        const playerObj = { playerKey, name, position, status, isInjured, isActive };
        if (isActive) activePlayers.push(playerObj);
        else benchPlayers.push(playerObj);
      });

      const allPlayerKeys = [...activePlayers, ...benchPlayers].map(p => p.playerKey).filter(Boolean);
      let playerStatsMap = {};

      if (allPlayerKeys.length > 0) {
        try {
          const keysStr = allPlayerKeys.join(',');
          const statsRes = await axios.get(
            `https://fantasysports.yahooapis.com/fantasy/v2/players;player_keys=${keysStr}/stats;type=season?format=json`,
            { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
          );
          const playersData = statsRes.data.fantasy_content.players;
          Object.keys(playersData).forEach((pk) => {
            if (pk === 'count') return;
            const p = playersData[pk].player;
            let pKey = '';
            for (let i = 0; i < p[0].length; i++) {
              if (p[0][i]?.player_key) { pKey = p[0][i].player_key; break; }
            }
            console.log(`${pKey} raw:`, JSON.stringify(p[1]));
            const pts = parseFloat(p[1]?.player_points?.total || 0);
            playerStatsMap[pKey] = pts;
          });
        } catch (e) {
          console.error('Erreur stats joueurs:', e.response?.data || e.message);
        }
      }

      let totalPoints = 0;
      activePlayers.forEach((p) => {
        if (!p.isInjured) {
          totalPoints += playerStatsMap[p.playerKey] || 0;
        } else {
          const replacement = benchPlayers
            .filter(b => !b.isInjured && b.position !== 'IR')
            .sort((a, b) => (playerStatsMap[b.playerKey] || 0) - (playerStatsMap[a.playerKey] || 0))[0];
          if (replacement) totalPoints += playerStatsMap[replacement.playerKey] || 0;
        }
      });

      const standing = standingsMap[teamKey] || { pts: 0, pointsChange: 5 };
      return { teamKey, totalPoints, rawPoints: standing.pts, pointsChange: standing.pointsChange, injuredCount, activeInjuredCount, playerCount: activePlayers.length + benchPlayers.length };
    });

    const teamStats = await Promise.all(teamStatPromises);
    res.json(teamStats);
  } catch (error) {
    console.error('Erreur teamstats:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur lecture teamstats' });
  }
});

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`Backend Kent démarré en HTTPS sur le port ${PORT}`);
});