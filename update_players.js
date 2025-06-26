// update_players.js
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

// --- CONFIGS ---
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZ7vNRxpMdHCpFpp_DCkc0HkubuIoQ0nlppTfYHcQrsWwKcH8Zin_QTePZnVCX8g1tSKa-Hj4qZZIo/pub?output=csv';
const API_KEY = process.env.RIOT_API_KEY;
const REGION_ROUTING = 'americas';
const REGION_PLATFORM = 'na1';
const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com/cdn';

// --- DATABASE POOL ---
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});


async function fetchCSV(url) {
    const res = await fetch(url);
    return res.text();
}

async function fetchRiotApi(url) {
    const res = await fetch(`<span class="math-inline">\{url\}?api\_key\=</span>{API_KEY}`);
    if (!res.ok) {
        console.error(`  Riot API Error: ${res.status} for ${url}`);
        return null;
    }
    return res.json();
}

// --- UPSERT (Update or Insert) Player Function ---
async function upsertPlayer(playerData) {
    const query = `
        INSERT INTO players (
            puuid, name, tag, roles, summoner_level, profile_icon_id,
            solo_rank, top_champs, highest_mastery_champ, last_updated
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (puuid)
        DO UPDATE SET
            name = EXCLUDED.name,
            tag = EXCLUDED.tag,
            roles = EXCLUDED.roles,
            summoner_level = EXCLUDED.summoner_level,
            profile_icon_id = EXCLUDED.profile_icon_id,
            solo_rank = EXCLUDED.solo_rank,
            top_champs = EXCLUDED.top_champs,
            highest_mastery_champ = EXCLUDED.highest_mastery_champ,
            last_updated = NOW()
    `;
    const values = [
        playerData.puuid,
        playerData.name,
        playerData.tag,
        playerData.roles, // This is a JS array, 'pg' driver handles conversion to TEXT[]
        playerData.summonerLevel,
        playerData.profileIconId,
        JSON.stringify(playerData.soloRank), // Convert JSON object to string for DB
        JSON.stringify(playerData.topChamps),
        JSON.stringify(playerData.highestMasteryChamp),
    ];

    try {
        await pool.query(query, values);
        console.log(`  Successfully upserted data for <span class="math-inline">\{playerData\.name\}\#</span>{playerData.tag}`);
    } catch (error) {
        console.error(`  Database error for <span class="math-inline">\{playerData\.name\}\#</span>{playerData.tag}:`, error);
    }
}


async function main() {
    console.log('Starting player update process...');
    const csv = await fetchCSV(GOOGLE_SHEET_CSV_URL);
    const records = parse(csv, { columns: true, skip_empty_lines: true });

    for (const row of records) {
        const ign = (row['In-Game Name'] || '').trim();
        const [name, tag] = ign.split('#');
        if (!name || !tag) {
            console.warn('  Skipping row, invalid name/tag:', ign);
            continue;
        }
        const roles = (row['Preferred Role(s)'] || '').split(',').map(r => r.trim()).filter(Boolean);
        console.log(`Fetching data for <span class="math-inline">\{name\}\#</span>{tag}...`);

        const account = await fetchRiotApi(`https://<span class="math-inline">\{REGION\_ROUTING\}\.api\.riotgames\.com/riot/account/v1/accounts/by\-riot\-id/</span>{encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
        if (!account || !account.puuid) {
            console.warn(`  Could not fetch account for <span class="math-inline">\{name\}\#</span>{tag}`);
            continue;
        }

        const summoner = await fetchRiotApi(`https://<span class="math-inline">\{REGION\_PLATFORM\}\.api\.riotgames\.com/lol/summoner/v4/summoners/by\-puuid/</span>{account.puuid}`);
        if (!summoner) {
            console.warn(`  Could not fetch summoner for <span class="math-inline">\{name\}\#</span>{tag}`);
            continue;
        }

        const [ranks, masteries] = await Promise.all([
            fetchRiotApi(`https://<span class="math-inline">\{REGION\_PLATFORM\}\.api\.riotgames\.com/lol/league/v4/entries/by\-summoner/</span>{summoner.id}`),
            fetchRiotApi(`https://<span class="math-inline">\{REGION\_PLATFORM\}\.api\.riotgames\.com/lol/champion\-mastery/v4/champion\-masteries/by\-puuid/</span>{account.puuid}`)
        ]);

        let soloRank = { tier: "Unranked", rank: "", leaguePoints: 0 };
        if (Array.isArray(ranks)) {
            const solo = ranks.find(r => r.queueType === "RANKED_SOLO_5x5");
            if (solo) soloRank = { tier: solo.tier, rank: solo.rank, leaguePoints: solo.leaguePoints };
        }

        let topChamps = [];
        let highestMasteryChamp = null;
        if (Array.isArray(masteries) && masteries.length > 0) {
             if (!global.championData) {
                const versionRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
                const versions = await versionRes.json();
                const latestVersion = versions[0];
                const champRes = await fetch(`<span class="math-inline">\{DDRAGON\_BASE\_URL\}/</span>{latestVersion}/data/en_US/champion.json`);
                const champData = await champRes.json();
                global.championData = {};
                Object.values(champData.data).forEach(champ => {
                    global.championData[champ.key] = champ;
                });
                global.latestDDragonVersion = latestVersion;
            }

            topChamps = masteries.slice(0, 5).map(m => {
                const champ = global.championData[m.championId];
                return champ ? {
                    name: champ.name,
                    img: `<span class="math-inline">\{DDRAGON\_BASE\_URL\}/</span>{global.latestDDragonVersion}/img/champion/${champ.image.full}`,
                    points: m.championPoints
                } : null;
            }).filter(Boolean);

            const highest = masteries[0];
            const champ = global.championData[highest.championId];
            if (champ) highestMasteryChamp = { name: champ.name, points: highest.championPoints };
        }

        // Await the database operation
        await upsertPlayer({
            puuid: account.puuid,
            name: name.trim(),
            tag: tag.trim(),
            roles: roles,
            summonerLevel: summoner.summonerLevel,
            profileIconId: summoner.profileIconId,
            soloRank,
            topChamps,
            highestMasteryChamp
        });

        await new Promise(res => setTimeout(res, 1200)); // Respect API rate limits
    }

    console.log('Done! Player data has been updated in the database.');
    await pool.end(); // Close the database connection pool
}

main().catch(err => console.error(err));