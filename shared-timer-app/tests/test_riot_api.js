const axios = require('axios');

async function exploreAPI() {
    try {
        console.log('Fetching getting leagues...');
        const leagueRes = await axios.get('https://esports-api.lolesports.com/persisted/gw/getLeagues?hl=en-GB', {
            headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
        });
        const leagues = leagueRes.data?.data?.leagues || [];
        console.log('Leagues found:', leagues.length);
        const leagueIds = leagues.map(l => l.id).join(',');

        console.log('Fetching teams for all leagues...');
        // Let's try getting standings to extract teams, or getTeams, or just getSchedule with pagination
        // Actually, there is an endpoint getStandings
        const standingsRes = await axios.get('https://esports-api.lolesports.com/persisted/gw/getStandings?hl=en-GB&tournamentId=', {
            headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
        }).catch(e => null);
        console.log('Standings worked without tournamentId?', !!standingsRes);

        // Let's try to see if getTeams exists
        const teamsRes = await axios.get('https://esports-api.lolesports.com/persisted/gw/getTeams?hl=en-GB', {
            headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
        }).catch(e => e.response?.status);
        console.log('getTeams endpoint status:', teamsRes);

    } catch (e) {
        console.error(e.message);
    }
}
exploreAPI();
