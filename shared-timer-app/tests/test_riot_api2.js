const axios = require('axios');

async function getTeams() {
    try {
        const res = await axios.get('https://esports-api.lolesports.com/persisted/gw/getTeams?hl=en-GB', {
            headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
        });
        const teams = res.data?.data?.teams || [];
        console.log('Total teams returned:', teams.length);
        if (teams.length > 0) {
            console.log('Sample team:', JSON.stringify(teams[0], null, 2));
        }
    } catch (e) {
        console.error(e.message);
    }
}
getTeams();
