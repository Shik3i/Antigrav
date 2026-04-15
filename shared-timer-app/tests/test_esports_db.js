const io = require('socket.io-client');
const socket = io('http://localhost:3001', { transports: ['websocket'] });

socket.on('connect', () => {
    console.log('Connected to local server');
    socket.emit('trigger_fetch_all_teams', { token: 'Bearer Entangled-Napping7-Custodian' });
});

socket.on('db_esports_teams_data', (data) => {
    console.log('SUCCESS! Received DB teams count:', data.teams.length);
    console.log('Last updated timestamp:', data.lastUpdated);

    // Check if Eintracht is in the DB
    const eins = data.teams.find(t => t.code === 'EINS');
    if (eins) {
        console.log('Verified Eintracht Spandau is in the local SQLite DB:', eins.name);
    } else {
        console.log('Could not find EINS code in DB.');
    }

    process.exit(0);
});

socket.on('error', (err) => {
    console.error('Socket Error:', err);
    process.exit(1);
});

setTimeout(() => {
    console.error('Timeout waiting for response');
    process.exit(1);
}, 10000);
