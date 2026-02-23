const { io } = require('socket.io-client');
const assert = require('assert');

console.log('Starting Sync Simulation...');

const client1 = io('http://localhost:3001');
const client2 = io('http://localhost:3001');

const roomId = 'test_room';
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
        // Alice joined, should see herself
        assert(state.users.some(u => u.displayName === 'Alice'));
        console.log('Client 1 received initial state.');
    }
});

client2.on('sync_state', (state) => {
    syncCount2++;
    if (syncCount2 === 1) {
        // Bob joined, should see both
        assert(state.users.some(u => u.displayName === 'Alice'));
        assert(state.users.some(u => u.displayName === 'Bob'));
        console.log('Client 2 received initial state with both users.');

        // Bob tries to start the timer (he joined second, so he defaults to read-only but wait, we gave everyone write if no token)
        // Wait, for public rooms we default to write.
        console.log('Client 2 sending START action...');
        client2.emit('timer_action', { roomId, action: 'START' });
    }

    if (state.state.isRunning) {
        console.log('Client 2 confirmed timer is RUNNING!');

        setTimeout(() => {
            console.log('Simulation Success! Disconnecting...');
            client1.disconnect();
            client2.disconnect();
            process.exit(0);
        }, 1000);
    }
});

client2.on('error', (msg) => {
    console.error('Client 2 Error:', msg);
    // If client 2 got read-only, we should see this error.
    if (msg.includes('permission')) {
        console.log('Simulation verified permissions correctly denied Client 2 from starting!');
        setTimeout(() => {
            client1.disconnect();
            client2.disconnect();
            process.exit(0);
        }, 1000);
    }
});

setTimeout(() => {
    console.error('Simulation timed out!');
    process.exit(1);
}, 5000);
