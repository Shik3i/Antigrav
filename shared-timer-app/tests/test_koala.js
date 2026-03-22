const { io } = require("socket.io-client");

const socket = io("http://localhost:3001");

socket.on("connect", () => {
    console.log("Connected to server...");

    socket.emit('REGISTER_USER', {
        userId: 'test_user_koala',
        displayName: 'TestKoalaUser',
        token: 'dummy-token'
    });

    setTimeout(() => {
        const roomId = "fast_koala_" + Date.now();
        // 0.05 minutes = 3 seconds
        socket.emit('JOIN_ROOM', { roomId, username: 'TestKoalaUser', isPrivate: false, durationMinutes: 0.05 });

        setTimeout(() => {
            socket.emit('START_TIMER', { roomId });
            console.log("3 second timer started. Waiting for completion...");
        }, 500);
    }, 500);
});

socket.on('KOALA_COINS_EARNED', (data) => {
    console.log("SUCCESS! Earned KoalaCoins:", data);
    process.exit(0);
});

socket.on('timer_completed', () => {
    console.log("Timer completed received on client!");
});

setTimeout(() => {
    console.log("Timeout waiting for coins.");
    process.exit(1);
}, 10000);
