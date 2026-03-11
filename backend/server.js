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

// Stockage temporaire du token
let tokenData = null;

// Certificats SSL
const sslOptions = {
  key: fs.readFileSync('./localhost-key.pem'),
  cert: fs.readFileSync('./localhost.pem'),
};

// Étape 1 : Rediriger vers Yahoo
app.get('/auth/yahoo', (req, res) => {
  const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${process.env.YAHOO_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&response_type=code&language=en-us`;
  res.redirect(authUrl);
});

// Étape 2 : Récupérer le token
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
    res.redirect('https://localhost:5174?connected=true');
  } catch (error) {
    console.error('Erreur OAuth:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur de connexion Yahoo' });
  }
});

// Étape 3 : Vérifier si connecté
app.get('/auth/status', (req, res) => {
  res.json({ connected: !!tokenData });
});

// Étape 4 : Lire les ligues Yahoo
app.get('/api/leagues', async (req, res) => {
  if (!tokenData) return res.status(401).json({ error: 'Non connecté' });
  try {
    const response = await axios.get(
      'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nhl/leagues?format=json',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Erreur API Yahoo:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur lecture ligue' });
  }
});

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`Backend Kent démarré en HTTPS sur le port ${PORT}`);
});