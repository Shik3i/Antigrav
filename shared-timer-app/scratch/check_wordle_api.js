const axios = require('axios');

async function checkWordle() {
    try {
        const res = await axios.get('http://localhost:3001/api/wordle/random');
        console.log('Random Wordle Response:', JSON.stringify(res.data, null, 2));
        
        // Also check daily for a specific date
        const date = new Date().toISOString().split('T')[0];
        const resDaily = await axios.get(`http://localhost:3001/api/wordle/daily?date=${date}`);
        console.log('Daily Wordle Response:', JSON.stringify(resDaily.data, null, 2));
    } catch (err) {
        console.error('Error checking Wordle API:', err.message);
    }
}

checkWordle();
