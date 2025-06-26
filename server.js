require('dotenv').config();
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { Pool } = require('pg');
const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let championMap = {};
let ddragonVersion = "15.12.1"; // fallback

async function loadChampionData() {
  // Get latest version
  try {
    const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await vRes.json();
    ddragonVersion = versions[0];
  } catch (e) {
    console.error("Failed to fetch DDragon version, using fallback.");
  }
  // Get champion data
  try {
    const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`);
    const champData = await champRes.json();
    for (const champName in champData.data) {
      const champ = champData.data[champName];
      championMap[parseInt(champ.key, 10)] = {
        name: champ.name,
        img: `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champ.image.full}`
      };
    }
  } catch (e) {
    console.error("Failed to fetch champion data.");
  }
}
loadChampionData();

app.use(express.json());
app.use(express.static('public')); // serve your frontend

// Basic route for health check
app.get('/', (req, res) => {
  res.send('League of Legends Player API is running!');
});

app.get('/players', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM players ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

app.post('/add-player', async (req, res) => {
  const { name, tag, role } = req.body;
  const apiKey = process.env.RIOT_API_KEY;
  
  console.log(`Adding player: ${name}#${tag} with role: ${role}`);
  
  if (!apiKey) {
    console.error('❌ RIOT_API_KEY not found');
    return res.status(500).send('API key not configured');
  }
  
  try {
    // 1. Get PUUID from Riot API
    console.log('Fetching account data...');
    const accountRes = await fetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?api_key=${apiKey}`
    );
    if (!accountRes.ok) {
      console.error(`Account API failed: ${accountRes.status} ${accountRes.statusText}`);
      return res.status(404).send('Player not found');
    }
    const account = await accountRes.json();
    console.log(`Account found: ${account.gameName}#${account.tagLine} (PUUID: ${account.puuid.substring(0, 8)}...)`);

    // 2. Get Summoner info
    console.log('Fetching summoner data...');
    const summonerRes = await fetch(
      `https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}?api_key=${apiKey}`
    );
    if (!summonerRes.ok) {
      console.error(`Summoner API failed: ${summonerRes.status} ${summonerRes.statusText}`);
      return res.status(404).send('Summoner not found');
    }
    const summoner = await summonerRes.json();
    console.log(`Summoner found: ${account.gameName}#${account.tagLine} (Level ${summoner.summonerLevel})`);

    // 3. Get Rank info (using PUUID directly - newer endpoint)
    console.log('Fetching rank data...');
    const rankUrl = `https://na1.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}?api_key=${apiKey}`;
    console.log(`Rank API URL: ${rankUrl.replace(apiKey, 'API_KEY_HIDDEN')}`); // Hide the key in logs
    console.log(`API Key length: ${apiKey ? apiKey.length : 'undefined'}`);
    console.log(`API Key starts with: ${apiKey ? apiKey.substring(0, 10) + '...' : 'undefined'}`);
    
    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay
    
    let soloRank = { tier: "Unranked", rank: "", leaguePoints: 0 };
    
    try {
      const rankRes = await fetch(rankUrl);
      
      if (rankRes.ok) {
        const ranks = await rankRes.json();
        console.log(`✅ Ranks fetched successfully. Found ${ranks.length} rank entries:`, ranks);
        
        const soloRankRaw = Array.isArray(ranks) ? ranks.find(r => r.queueType === "RANKED_SOLO_5x5") : null;
        console.log('Solo rank raw data:', soloRankRaw);
        
        if (soloRankRaw) {
          soloRank = {
            tier: soloRankRaw.tier,
            rank: soloRankRaw.rank,
            leaguePoints: soloRankRaw.leaguePoints
          };
        }
      } else {
        const errorText = await rankRes.text();
        console.warn(`⚠️ Rank API unavailable for ${account.gameName}#${account.tagLine} (${rankRes.status})`);
        console.warn(`This is common with personal API keys. Player will be saved with "Unranked" status.`);
        
        // Don't log the full error details unless it's not a 403
        if (rankRes.status !== 403) {
          console.error(`Error response:`, errorText);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Rank fetch failed for ${account.gameName}#${account.tagLine}:`, error.message);
    }
    
    console.log('Final solo rank object:', soloRank);

    // 4. Get Mastery info
    console.log('Fetching mastery data...');
    const masteryRes = await fetch(
      `https://na1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${account.puuid}?api_key=${apiKey}`
    );
    let masteries = [];
    if (masteryRes.ok) {
      masteries = await masteryRes.json();
    } else {
      console.warn(`Failed to fetch masteries for PUUID ${account.puuid}: ${masteryRes.status} ${masteryRes.statusText}`);
    }
    
    // Ensure masteries is an array before calling .slice()
    const topChamps = Array.isArray(masteries) ? masteries.slice(0, 5).map(m => {
      const champInfo = championMap[m.championId] || { name: `ID:${m.championId}`, img: '' };
      return {
        name: champInfo.name,
        img: champInfo.img,
        points: m.championPoints
      };
    }) : [];
    const highestMasteryChamp = topChamps[0]
      ? { name: topChamps[0].name, points: topChamps[0].points }
      : null;

    // 5. Save to PostgreSQL
    console.log('Saving to database...');
    console.log('PUUID:', account.puuid);
    console.log('Player data:', { name, tag, summonerLevel: summoner.summonerLevel });
    
    await pool.query(
      `INSERT INTO players (puuid, name, tag, role, summonerLevel, profileIconId, soloRank, topChamps, highestMasteryChamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (name, tag) DO UPDATE SET
         puuid = EXCLUDED.puuid,
         role = EXCLUDED.role,
         summonerLevel = EXCLUDED.summonerLevel,
         profileIconId = EXCLUDED.profileIconId,
         soloRank = EXCLUDED.soloRank,
         topChamps = EXCLUDED.topChamps,
         highestMasteryChamp = EXCLUDED.highestMasteryChamp`,
      [
        account.puuid,                                    // $1
        name,                                             // $2  
        tag,                                              // $3
        JSON.stringify(role.split(',').map(r => r.trim())), // $4
        summoner.summonerLevel,                           // $5
        summoner.profileIconId,                           // $6
        JSON.stringify(soloRank),                         // $7
        JSON.stringify(topChamps),                        // $8
        JSON.stringify(highestMasteryChamp)               // $9
      ]
    );

    console.log(`✅ Successfully added player: ${name}#${tag}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error in add-player endpoint:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).send(`Error fetching or saving player data: ${err.message}`);
  }
});

// Test API key function
async function testApiKey() {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
        console.error('❌ RIOT_API_KEY not found in environment variables');
        return false;
    }
    
    console.log(`🔑 Testing API key: ${apiKey.substring(0, 10)}...`);
    
    try {
        // Test with a simple API call
        const testUrl = `https://na1.api.riotgames.com/lol/status/v4/platform-data?api_key=${apiKey}`;
        const response = await fetch(testUrl);
        
        if (response.ok) {
            console.log('✅ API key is valid and working');
            return true;
        } else {
            console.error(`❌ API key test failed: ${response.status} ${response.statusText}`);
            if (response.status === 403) {
                console.error('🚨 API key is expired or invalid. Please regenerate at: https://developer.riotgames.com/');
            }
            return false;
        }
    } catch (error) {
        console.error('❌ Error testing API key:', error);
        return false;
    }
}

// Use PORT environment variable for Render deployment
const PORT = process.env.PORT || 3000;

// Test API key on startup
testApiKey().then(isValid => {
  if (!isValid) {
    console.error('⚠️  Server starting with invalid API key. Some features may not work.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
