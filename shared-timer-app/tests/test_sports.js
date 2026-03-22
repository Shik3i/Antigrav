const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function checkSports() {
    const apiKey = process.env.THE_ODDS_API_KEY;
    try {
        const response = await axios.get('https://api.the-odds-api.com/v4/sports', {
            params: { apiKey }
        });
        const sports = response.data.map(s => s.key);
        console.log("Esports available:");
        console.log(sports.filter(s => s.includes('esport')));
    } catch (e) {
        console.error(e.message);
    }
}
checkSports();
