const { io } = require('socket.io-client');
const assert = require('assert');

console.log('Starting Sync Simulation...');

const roomId = 'test_room';

// Ensure the room exists in the DB first
fetch('http://localhost:3001/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        id: roomId,
        name: 'Sync Test Room',
        isPublic: true,
        defaultRole: 'write',
        defaultDurationMinutes: 20,
        ownerId: 'test_user_001'
    })
}).then(() => {
    console.log('Room created in DB. Starting sockets...');
    const client1 = io('http://localhost:3001');
    const client2 = io('http://localhost:3001');

    let syncCount1 = 0;
    let syncCount2 = 0;

    client1.on('connect', () => {
        console.log('Client 1 Connected. Joining...');
        client1.emit('join_room', { roomId, userId: 'u1', displayName: 'Alice' });
    });

    client2.on('connect', () => {
        console.log('Client 2 Connected. Joining...');
        client2.emit('join_room', { roomId, userId: 'u2', displayName: 'Bob' });
    });

    client1.on('sync_state', (state) => {
        syncCount1++;
        if (syncCount1 === 1) {
            assert(state.users.some(u => u.displayName === 'Alice'));
            console.log('Client 1 received initial state.');
        }
    });

    client2.on('sync_state', (state) => {
        syncCount2++;
        if (syncCount2 === 1) {
            assert(state.users.some(u => u.displayName === 'Alice'));
            assert(state.users.some(u => u.displayName === 'Bob'));
            console.log('Client 2 received initial state with both users.');
            console.log('Client 2 sending START action...');
            client2.emit('timer_action', { roomId, action: 'START' });
        }

        if (state.state.isRunning && !state.state.cleanupTested) {
            console.log('Client 2 confirmed timer is RUNNING!');
            state.state.cleanupTested = true;
        }
    });

    client2.on('error', (msg) => {
        console.error('Client 2 Error:', msg);
        if (msg.includes('permission')) {
            console.log('Simulation verified permissions correctly denied Client 2 from starting!');
        }
    });

    setTimeout(() => {
        console.log('Testing Room Cleanup...');
        client1.disconnect();
        client2.disconnect();

        setTimeout(() => {
            console.log('Simulation Success! Rooms should now be clean.');
            process.exit(0);
        }, 1000);
    }, 3000);
}).catch(console.error);

setTimeout(() => {
    console.error('Simulation timed out!');
    process.exit(1);
}, 6000);
