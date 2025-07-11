# SanctuaryLeagueUpdate

A League of Legends player management web application that fetches player data from the Riot API, stores it in a PostgreSQL database, and displays it on a modern web interface.

## Features

- 🎮 Fetch player data using Riot Games API
- 📊 Display player ranks, levels, and champion mastery
- 🏆 Show top champions with mastery points
- 🌐 Clean, modern web interface
- 🔄 Real-time data updates
- 📱 Responsive design

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- Riot Games API key

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/jamzezak/SanctuaryLeagueUpdate-main.git
   cd SanctuaryLeagueUpdate-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Get your Riot API key from [Riot Developer Portal](https://developer.riotgames.com/)
   - Set up your PostgreSQL database and get the connection string
   - Update the `.env` file with your actual values:
   ```
   RIOT_API_KEY=your_riot_api_key_here
   DATABASE_URL=your_postgresql_connection_string
   ```

4. **Set up the database**
   The application will automatically create the necessary tables when you first run it.

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the application**
   Open your browser and go to `http://localhost:3000`

## Usage

### Adding Players
Use the import script to add players to your database:
```bash
node import_players.js
```

### Updating Player Data
Run the update script to refresh player information:
```bash
node update_players.js
```

## API Endpoints

- `GET /` - Serve the web interface
- `GET /players` - Get all players from database
- `POST /add-player` - Add a new player
- `POST /update-player` - Update existing player data

## File Structure

```
├── public/
│   ├── index.html      # Main web interface
│   ├── main.js         # Frontend JavaScript
│   └── styles.css      # Styling
├── server.js           # Express server and API logic
├── import_players.js   # Script to add new players
├── update_players.js   # Script to update player data
├── package.json        # Dependencies and scripts
└── .env.example        # Environment variables template
```

## Important Notes

- **API Key Limitations**: Personal Riot API keys have limited access to rank data. You may see "Unranked*" for players due to API restrictions.
- **Rate Limiting**: The application includes built-in rate limiting to respect Riot API limits.
- **Privacy**: Player PUUIDs are used internally but not displayed on the website for privacy.

## Troubleshooting

### Common Issues

1. **401/403 API Errors**: Your API key may be expired or invalid. Generate a new one from the Riot Developer Portal.

2. **Database Connection Issues**: Ensure your PostgreSQL database is running and the connection string is correct.

3. **Player Not Found**: Make sure the player name and tag are correct (e.g., "PlayerName#TAG").

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes. Riot Games API usage must comply with their Terms of Service.