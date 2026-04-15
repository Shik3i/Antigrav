const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function checkOdds() {
    const apiKey = process.env.THE_ODDS_API_KEY;
    console.log("Using API Key:", apiKey ? apiKey.substring(0, 5) + "..." : "NULL");
    try {
        const response = await axios.get('https://api.the-odds-api.com/v4/sports/esports_lol/odds', {
            params: {
                apiKey,
                regions: 'eu,us',
                markets: 'h2h',
                oddsFormat: 'decimal'
            }
        });

        console.log("Odds API response length:", response.data.length);
        if (response.data.length > 0) {
            console.log("First event:", response.data[0].home_team, "vs", response.data[0].away_team);
        }
    } catch (e) {
        console.error("Odds error:", e.response ? JSON.stringify(e.response.data) : e.message);
    }
}
checkOdds();
