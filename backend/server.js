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
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
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
    console.error('Erreur API Yahoo:', error.response?.data || error.message);
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
    console.error('Erreur standings:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur lecture standings' });
  }
});

app.get('/api/roster/:teamKey', async (req, res) => {
  if (!tokenData) return res.status(401).json({ error: 'Non connecté' });
  try {
    const response = await axios.get(
      `https://fantasysports.yahooapis.com/fantasy/v2/team/${req.params.teamKey}/roster/players?format=json`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Erreur roster:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur lecture roster' });
  }
});

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`Backend Kent démarré en HTTPS sur le port ${PORT}`);
});