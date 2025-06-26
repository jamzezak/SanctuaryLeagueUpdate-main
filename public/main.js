// Riot API Regions (do not change unless targeting different regions)
    const REGION_ROUTING = "americas"; // For Riot Account V1 (name#tag to PUUID)
    const REGION_PLATFORM = "na1";     // For LoL-specific endpoints (summoner, rank, mastery)

    // Data Dragon Base URL (for game assets like champion images, profile icons)
    const DDRAGON_BASE_URL = "https://ddragon.leagueoflegends.com/cdn";

    // Add this helper function:
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- NEW CODE STARTS HERE --- (around line 82)
    // --- CACHING FUNCTIONS ---
    const CACHE_EXPIRATION_HOURS = 1; // Data is considered stale after 1 hour. You can adjust this.

    function getCachedData(key) {
        const cachedItem = localStorage.getItem(key);
        if (cachedItem) {
            const { data, timestamp } = JSON.parse(cachedItem);
            const now = new Date().getTime();
            // Convert CACHE_EXPIRATION_HOURS to milliseconds
            const expirationTime = timestamp + CACHE_EXPIRATION_HOURS * 60 * 60 * 1000; 

            if (now < expirationTime) {
                console.log(`Cache hit for ${key}`);
                return data; // Data is fresh
            } else {
                console.log(`Cache expired for ${key}`);
                localStorage.removeItem(key); // Remove stale data
            }
        }
        console.log(`Cache miss for ${key}`);
        return null; // No fresh data in cache
    }

    function setCachedData(key, data) {
        const itemToStore = {
            data: data,
            timestamp: new Date().getTime()
        };
        localStorage.setItem(key, JSON.stringify(itemToStore));
        console.log(`Data cached for ${key}`);
    }
    // --- NEW CODE ENDS HERE --- (around line 105)


    // --- INTERNAL CACHE --- (Original line 83/84)
    let championData = {}; 
    let latestDDragonVersion = "";   // Stores the latest Data Dragon version string
    let PLAYERS = [];            

        // --- ROLE ICONS (Image URLs) ---
        // These are image URLs for each role icon.
        const ROLE_ICONS = {
            top: `https://i.ibb.co/YTK79V84/Top-icon.webp`,
            jungle: `https://i.ibb.co/qYNwGKq1/Jungle-icon.webp`,
            mid: `https://i.ibb.co/nMgdwswj/Middle-icon.webp`,
            adc: `https://i.ibb.co/j909V51k/Bottom-icon.webp`,
            support: `https://i.ibb.co/wZGnMXHd/Support-icon.webp`,
            fill: `https://i.ibb.co/Fq7dxXcJ/Specialist-icon.webp`
        };


        // --- API HELPER FUNCTIONS ---

        

        /**
         * Fetches the latest Data Dragon version from Riot's API.
         * Caches the result to prevent repeated calls.
         * @returns {Promise<string>} The latest Data Dragon version, or a fallback if fetching fails.
         */
        async function getLatestDDragonVersion() {
            if (latestDDragonVersion) {
                return latestDDragonVersion; // Use cached version
            }
            try {
                const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
                if (!response.ok) {
                    throw new Error(`Failed to fetch DDragon versions: ${response.status} ${response.status.text}`);
                }
                const versions = await response.json();
                latestDDragonVersion = versions[0]; // The first element is usually the latest
                return latestDDragonVersion;
            } catch (error) {
                console.error("Error getting Data Dragon version:", error);
                return "14.11.1"; // Fallback to a recent known version if API fails
            }
        }

        /**
         * Loads and caches champion data from Data Dragon.
         * @returns {Promise<Object>} A map of champion data keyed by champion ID.
         */
        async function loadChampionData() {
            if (Object.keys(championData).length > 0) {
                return championData; // Use cached data
            }
            const version = await getLatestDDragonVersion();
            const url = `${DDRAGON_BASE_URL}/${version}/data/en_US/champion.json`;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to load champion data: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                const champMapById = {};
                if (data && data.data) {
                    Object.values(data.data).forEach(champ => {
                        champMapById[champ.key] = champ;
                    });
                }
                championData = champMapById; 
                return championData;
            } catch (error) {
                console.error("Error loading champion data:", error);
                return {}; // Return empty object on failure
            }
        }

        // Note: Frontend doesn't make direct Riot API calls
        // All Riot API calls are handled by the backend server

        // Note: Player data fetching is now handled entirely by the backend
        // The frontend only displays data from the database via /players endpoint

        // --- UI RENDERING FUNCTIONS ---

        /**
         * Creates an HTML card element for a given player's data.
         * @param {Object} playerData - The comprehensive data for a player.
         * @returns {HTMLElement} The constructed player card div.
         */
        function createPlayerCard(playerData) {
    const profileIconUrl = `${DDRAGON_BASE_URL}/${latestDDragonVersion}/img/profileicon/${playerData.profileIconId}.png`;

    // Role icons
    const roles = Array.isArray(playerData.role)
        ? playerData.role.map(r => r.trim().toLowerCase())
        : (playerData.role || "").split(',').map(r => r.trim().toLowerCase()).filter(Boolean);

    const roleIconsHtml = roles.map(role => {
        const iconUrl = ROLE_ICONS[role] || 'https://placehold.co/20x20/888888/FFFFFF?text=?';
        return `<img src="${iconUrl}" alt="${role} icon" class="role-icon">`;
    }).join('');

    // Mastery champions
    const champsHtml = (playerData.topChamps || []).map(champ => {
        const points = champ.points ?? champ.championPoints;
        return `
        <div class="champ-item">
            <img src="${champ.img || ''}" alt="${champ.name || ''}" class="champ-row-icon" title="${champ.name || ''}: ${points !== undefined ? points.toLocaleString() : 'N/A'} pts">
            <div class="champ-label">${champ.name || ''}</div>
        </div>
    `;
}).join('');

    return htmlToElement(`
        <div class="player-card">
            <div class="player-info-header">
                <div class="player-icon">
                    <img src="${profileIconUrl}" alt="Profile Icon">
                </div>
                <div class="player-main-info">
                    <div class="player-name">
                        ${playerData.name}#${playerData.tag}
                        <span class="role-icons-display">${roleIconsHtml}</span>
                    </div>
                    <div class="player-level-rank">
                        Level ${playerData.summonerLevel || "?"}<br>
                        <span class="player-rank">
                            Rank: ${playerData.soloRank && playerData.soloRank.tier !== "Unranked"
                                ? `${playerData.soloRank.tier} ${playerData.soloRank.rank} (${playerData.soloRank.leaguePoints} LP)`
                                : "Unranked*"}
                        </span>
                    </div>
                </div>
                <a class="opgg-link" href="https://na.op.gg/summoners/na/${playerData.name}-${playerData.tag}" target="_blank">OP.GG</a>
            </div>
            <div class="champion-masteries-row">
                ${champsHtml}
            </div>
            <div class="highest-mastery">
                Highest Mastery: <strong>${playerData.highestMasteryChamp ? playerData.highestMasteryChamp.name : "N/A"}</strong>
                ${
      playerData.highestMasteryChamp && (playerData.highestMasteryChamp.points ?? playerData.highestMasteryChamp.championPoints) !== undefined
        ? `(${(playerData.highestMasteryChamp.points ?? playerData.highestMasteryChamp.championPoints).toLocaleString()} pts)`
        : ""
    }
            </div>
            ${playerData.soloRank && playerData.soloRank.tier === "Unranked" ? 
                '<div style="font-size:0.7em; color:#888; margin-top:4px;">*Rank data may be limited with personal API keys</div>' : ''}
        </div>
    `);
}

// Helper to convert HTML string to DOM element
function htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

        /**
         * Displays a placeholder card for players whose data failed to load.
         * @param {Object} player - The original player object (name, tag, role).
         * @returns {HTMLElement} The constructed failed player card div.
         */
        function createFailedPlayerCard(player) {
            const card = document.createElement("div");
            card.className = "player-card";
            card.style.opacity = "0.6"; // Dim it to indicate failure

            // Generate role icons for failed card too
            const roles = player.role.split(',').map(r => r.trim().toLowerCase());
            const roleIconsHtml = roles.map(role => {
                const iconUrl = ROLE_ICONS[role] || 'https://placehold.co/20x20/888888/FFFFFF?text=?';
                return `<img src="${iconUrl}" alt="${role} icon" class="role-icon">`;
            }).join('');

            console.log(`[DEBUG: createFailedPlayerCard] Creating failed card for ${player.name}. Roles:`, roles); // Added debug log

            card.innerHTML = `
                <div class="player-info-header">
                    <div class="player-icon">
                        <img src="https://placehold.co/60x60/FF6B6B/FFFFFF?text=!" alt="Error Icon">
                    </div>
                    <div class="player-details">
                        <div class="player-name-and-roles">
                            <strong>${player.name}#${player.tag}</strong>
                            <div class="role-icons-display">
                                ${roleIconsHtml}
                            </div>
                        </div>
                        <span class="error-message">Failed to Load Data</span>
                    </div>
                </div>
                <div class="champion-masteries">
                    <p style="color:#ff6b6b; font-size:0.9em;">Could not retrieve full data for this player.</p>
                    <small style="color:#aaa; font-size:0.8em;">Check Riot ID or API key status in console.</small>
                </div>
                <div class="highest-mastery">
                    Highest Mastery: <span style="color:#ff6b6b;">N/A</span>
                </div>
            `;
            return card;
        }

        /**
         * Fetches player data from the published Google Sheet CSV.
         * @returns {Promise<Array<Object>>} An array of player objects {name, tag, role}.
         */
        async function fetchPlayersFromSheet() {
            if (!GOOGLE_SHEET_CSV_URL || GOOGLE_SHEET_CSV_URL === "YOUR_GOOGLE_SHEET_CSV_URL_HERE") {
                console.error("ERROR: Google Sheet CSV URL is not set. Please update 'GOOGLE_SHEET_CSV_URL' in the script.");
                return [];
            }

            try {
                const response = await fetch(GOOGLE_SHEET_CSV_URL);
                if (!response.ok) {
                    throw new Error(`Failed to fetch Google Sheet: ${response.status} ${response.statusText}`);
                }
                const csvText = await response.text();
                console.log("[DEBUG: fetchPlayersFromSheet] Raw CSV text received:", csvText);
                
                const lines = csvText.split('\n').filter(line => line.trim() !== '');
                const playersData = [];
                
                if (lines.length > 1) {
                    const headers = lines[0].split(',').map(h => h.trim());
                    console.log("[DEBUG: fetchPlayersFromSheet] CSV Headers:", headers);

                    const ignHeader = "In-Game Name";
                    const roleHeader = "Preferred Role(s)";
                    const timestampHeader = "Timestamp"; // Assuming Timestamp is still a header

                    const ignIndex = headers.indexOf(ignHeader);
                    const roleIndex = headers.indexOf(roleHeader);
                    const timestampIndex = headers.indexOf(timestampHeader); // Get index

                    if (ignIndex === -1 || roleIndex === -1) {
                        console.error(`ERROR: Google Sheet headers '${ignHeader}' or '${roleHeader}' not found. Please ensure they match exactly.`);
                        return [];
                    }

                    for (let i = 1; i < lines.length; i++) {
                        const rawLine = lines[i];
                        const values = [];
                        let inQuote = false;
                        let currentField = '';

                        // Simple CSV parsing for comma-separated values, handling quotes
                        for (let j = 0; j < rawLine.length; j++) {
                            const char = rawLine[j];
                            if (char === '"') {
                                // Handle escaped quotes (e.g., "" inside a quoted field)
                                if (inQuote && rawLine[j + 1] === '"') {
                                    currentField += '"';
                                    j++; // Skip the next quote
                                } else {
                                    inQuote = !inQuote; // Toggle inQuote state
                                }
                            } else if (char === ',' && !inQuote) {
                                values.push(currentField.trim());
                                currentField = '';
                            } else {
                                currentField += char;
                            }
                        }
                        values.push(currentField.trim()); // Push the last field

                        console.log(`[DEBUG: fetchPlayersFromSheet] Processing raw line ${i}: "${rawLine}"`);
                        console.log(`[DEBUG: fetchPlayersFromSheet] Parsed raw values (manual):`, values);
                        console.log(`[DEBUG: fetchPlayersFromSheet] Parsed values length: ${values.length}, Headers length: ${headers.length}`);

                        if (values.length === headers.length) {
                            const fullIGN = values[ignIndex];
                            const ignParts = fullIGN.split('#');
                            
                            const player = {
                                name: ignParts[0] ? ignParts[0].trim() : '',
                                tag: ignParts[1] ? ignParts[1].trim() : '',
                                role: values[roleIndex].trim(), // Ensure roles are trimmed
                                timestamp: values[timestampIndex] ? values[timestampIndex].trim() : '' // Include timestamp if available
                            };
                            
                            // Only add player if both name and tag are present
                            if (player.name && player.tag) {
                                console.log(`[DEBUG: fetchPlayersFromSheet] Successfully parsed player:`, player);
                                playersData.push(player);
                            } else {
                                console.warn(`[DEBUG: fetchPlayersFromSheet] Skipping row due to missing In-Game Name or Tag: "${rawLine}"`);
                            }
                        } else {
                            console.warn(`[DEBUG: fetchPlayersFromSheet] Skipping malformed row (mismatched columns after parsing): "${rawLine}"`);
                        }
                    }
                } else {
                    console.warn("Google Sheet is empty or only contains headers.");
                }
                return playersData;

            } catch (error) {
                console.error("Error fetching or parsing Google Sheet data:", error);
                return [];
            }
        }


        // --- MAIN APPLICATION LOGIC ---

/**
 * Main function to fetch and display all player data.
 * Manages loading states and error messages in the UI.
 */
 async function initializePlayerDisplay() {
        const playerListContainer = document.getElementById("playerList");
        playerListContainer.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="message">Loading players...</p>
            </div>
        `;

        try {
            // Fetch latest Data Dragon version before rendering cards
            // This part can remain as is, or you could create an API endpoint for it too
            latestDDragonVersion = await getLatestDDragonVersion();

            // !!! THIS IS THE IMPORTANT CHANGE !!!
            // const response = await fetch('players.json'); // OLD WAY
            const response = await fetch('/players');     // NEW WAY

            if (!response.ok) throw new Error('Failed to load player data from the server.');

            // The JSON from the API is already in the correct format, so the rest works perfectly
            const allPlayerDetails = await response.json();

            // Re-map the role key for compatibility with the existing createPlayerCard function
            const formattedPlayerDetails = allPlayerDetails.map(player => ({
                ...player,
                role: player.role,
                summonerLevel: player.summonerlevel,
                profileIconId: player.profileiconid,
                soloRank: player.solorank,
                topChamps: player.topchamps,
                highestMasteryChamp: player.highestmasterychamp
            }));

            playerListContainer.innerHTML = "";
            if (formattedPlayerDetails.length === 0) {
                 playerListContainer.innerHTML = `<p class="message">No players in the database. Run the update script!</p>`;
                 return;
            }

            formattedPlayerDetails.forEach(playerData => {
                playerListContainer.appendChild(createPlayerCard(playerData));
            });

            // The rest of your filtering and searching logic can remain EXACTLY THE SAME
            // because it operates on the 'allPlayerDetails' array in the browser.

            // --- SEARCH FUNCTIONALITY ---
            const searchBar = document.getElementById("searchBar");
            searchBar.addEventListener("input", function() {
                const searchTerm = this.value.trim().toLowerCase();
                const filteredPlayers = formattedPlayerDetails.filter(player =>
                    (player.name + '#' + player.tag).toLowerCase().includes(searchTerm)
                );
                playerListContainer.innerHTML = "";
                filteredPlayers.forEach(player => {
                    playerListContainer.appendChild(createPlayerCard(player));
                });
                 if (filteredPlayers.length === 0) {
                    playerListContainer.innerHTML = `<div class="loading-state"><p class="message" style="color:#ff6b6b;">No players found.</p></div>`;
                }
            });

            // --- ROLE FILTERING ---
            const roleFilter = document.getElementById("roleFilter");
            roleFilter.addEventListener("change", function() {
                const selectedRole = this.value;
                playerListContainer.innerHTML = "";
                const filteredPlayers = selectedRole
                    ? formattedPlayerDetails.filter(player => {
                        const playerRoles = Array.isArray(player.role)
                            ? player.role.map(r => r.trim().toLowerCase())
                            : (player.role || "").split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
                        return playerRoles.includes(selectedRole);
                    })
                    : formattedPlayerDetails;

                filteredPlayers.forEach(player => {
                    playerListContainer.appendChild(createPlayerCard(player));
                });
                if (filteredPlayers.length === 0) {
                    playerListContainer.innerHTML = `<div class="loading-state"><p class="message" style="color:#ff6b6b;">No players found for the selected role.</p></div>`;
                }
            });

        } catch (error) {
            playerListContainer.innerHTML = `
                <div class="loading-state">
                    <p class="message error-message">Error loading player data: ${error.message}</p>
                </div>
            `;
            console.error(error);
        }
    }

    // --- INITIAL DATA FETCH ---
    initializePlayerDisplay();

    // --- ADD PLAYER FORM HANDLING ---
    document.getElementById('addPlayerForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const name = document.getElementById('summonerName').value.trim();
  const tag = document.getElementById('summonerTag').value.trim();
  const role = document.getElementById('roles').value.trim();
  const msg = document.getElementById('addPlayerMsg');
  msg.textContent = 'Adding...';

  try {
    const res = await fetch('/add-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, tag, role })
    });
    if (!res.ok) throw new Error(await res.text());
    msg.textContent = 'Player added!';
    // Optionally, refresh the player list:
    initializePlayerDisplay();
    // Clear form
    document.getElementById('summonerName').value = '';
    document.getElementById('summonerTag').value = '';
    document.getElementById('roles').value = '';
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
  }
});

document.getElementById('tabPlayers').onclick = function() {
    document.getElementById('playerControls').style.display = '';
    document.getElementById('playersSection').style.display = '';
    document.getElementById('statsSection').style.display = 'none';
    this.classList.add('active');
    document.getElementById('tabStats').classList.remove('active');
};
document.getElementById('tabStats').onclick = function() {
    document.getElementById('playerControls').style.display = 'none';
    document.getElementById('playersSection').style.display = 'none';
    document.getElementById('statsSection').style.display = '';
    this.classList.add('active');
    document.getElementById('tabPlayers').classList.remove('active');
    
    // Update stats when the tab is clicked
    updateStatsDisplay();
};

// --- STATS FUNCTIONALITY ---
async function updateStatsDisplay() {
    try {
        const response = await fetch('/players');
        if (!response.ok) throw new Error('Failed to load player data');
        
        const players = await response.json();
        
        // Basic stats calculations
        const totalPlayers = players.length;
        const rankedPlayers = players.filter(p => 
            p.solorank && p.solorank.tier !== "Unranked"
        ).length;
        
        const totalLevels = players.reduce((sum, p) => sum + (p.summonerlevel || 0), 0);
        const averageLevel = totalPlayers > 0 ? Math.round(totalLevels / totalPlayers) : 0;
        
        // Role distribution
        const roleCount = {};
        players.forEach(player => {
            let roles;
            try {
                // Handle different role data formats
                if (Array.isArray(player.role)) {
                    roles = player.role;
                } else if (typeof player.role === 'string') {
                    // Try to parse as JSON first, then fall back to comma-separated
                    try {
                        roles = JSON.parse(player.role);
                    } catch (e) {
                        roles = player.role.split(',');
                    }
                } else {
                    roles = [];
                }
                
                roles.forEach(role => {
                    const cleanRole = role.trim().toLowerCase();
                    if (cleanRole) { // Only count non-empty roles
                        roleCount[cleanRole] = (roleCount[cleanRole] || 0) + 1;
                    }
                });
            } catch (error) {
                console.warn('Error parsing roles for player:', player.name, error);
            }
        });
        
        console.log('Role distribution:', roleCount); // Debug log
        
        // Rank distribution
        const rankTiers = {};
        players.forEach(player => {
            if (player.solorank && player.solorank.tier && player.solorank.tier !== "Unranked") {
                const tier = player.solorank.tier;
                rankTiers[tier] = (rankTiers[tier] || 0) + 1;
            }
        });
        
        // Update the basic stats
        document.getElementById('totalPlayers').textContent = totalPlayers;
        document.getElementById('rankedPlayers').textContent = rankedPlayers;
        document.getElementById('averageLevel').textContent = averageLevel;
        
        // Update role chart
        updateChart('roleChart', roleCount);
        
        // Update rank chart
        updateChart('rankChart', rankTiers);
        
        console.log('Stats updated:', { totalPlayers, rankedPlayers, averageLevel, roleCount, rankTiers });
        
    } catch (error) {
        console.error('Error updating stats:', error);
        document.getElementById('totalPlayers').textContent = 'Error';
        document.getElementById('rankedPlayers').textContent = 'Error';
        document.getElementById('averageLevel').textContent = 'Error';
    }
}

function updateChart(containerId, data) {
    const container = document.getElementById(containerId);
    
    if (Object.keys(data).length === 0) {
        container.innerHTML = '<p class="message">No data available</p>';
        return;
    }
    
    const maxValue = Math.max(...Object.values(data));
    const chartHtml = Object.entries(data)
        .sort(([,a], [,b]) => b - a) // Sort by count descending
        .map(([label, count]) => {
            const percentage = maxValue > 0 ? (count / maxValue) * 100 : 0;
            return `
                <div class="chart-bar">
                    <span class="chart-label">${label}</span>
                    <div class="chart-bar-fill" style="width: ${Math.max(percentage, 5)}%;"></div>
                    <span class="chart-value">${count}</span>
                </div>
            `;
        }).join('');
    
    container.innerHTML = chartHtml;
}