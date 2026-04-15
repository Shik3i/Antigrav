const io = require('socket.io-client');

const API_URL = 'http://localhost:3001';

async function run() {
    try {
        const testId = 'test-room-promote-' + Math.floor(Math.random() * 10000);
        const res = await fetch(`${API_URL}/api/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: testId, name: 'Testing Room', isPublic: true, defaultRole: 'read' })
        });
        const room = await res.json();
        const roomId = testId;
        console.log('Created room:', roomId);

        const adminSocket = io(API_URL, { query: { roomId: roomId } });
        const guestSocket = io(API_URL, { query: { roomId: roomId } });

        adminSocket.on('connect', () => {
            adminSocket.emit('join_room', { roomId: room.roomId, userId: 'admin-tester-x1', displayName: 'Admin User' });
        });

        guestSocket.on('connect', () => {
            guestSocket.emit('join_room', { roomId: room.roomId, userId: 'guest-tester-y2', displayName: 'Guest User' });
        });

        // Artificially promote the admin via quick DB hack to make them 'write' so they can promote the guest
        setTimeout(async () => {
            console.log('Admin socket ID:', adminSocket.id);
            console.log('Guest socket ID:', guestSocket.id);

            // In a real flow, creator gets write token. Here we simulate the promote command
            // We just need to see if the server processes it.
            // Wait, since admin joined via public link, they are BOTH read.
            // Let's force the creator token for admin.
            const adminTokenSocket = io(API_URL, { query: { roomId: roomId } });
            adminTokenSocket.on('connect', () => {
                adminTokenSocket.emit('join_room', { roomId: roomId, userId: 'admin', displayName: 'Admin', token: room.tokens?.writeToken || room.writeToken });
            });

            setTimeout(() => {
                console.log(`Commanding promote on target: ${guestSocket.id}`);
                adminTokenSocket.emit('promote_user', { roomId: roomId, targetSocketId: guestSocket.id });
            }, 1500);

            adminTokenSocket.on('sync_state', (state) => {
                const guest = state.users.find(u => u.socketId === guestSocket.id);
                if (guest) console.log(`[Admin] Guest current role:`, guest.role);
            });
            adminTokenSocket.on('error', (err) => console.log(`[Admin Token] Error:`, err));

        }, 1000);

        setTimeout(() => process.exit(0), 3000);

    } catch (err) {
        console.error(err);
    }
}
run();
