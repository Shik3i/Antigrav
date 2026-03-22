const { io } = require("socket.io-client");
const socket = io("http://localhost:3001");

socket.on("connect", () => {
    console.log("Connected to server...");

    // Simulate the exact calls Admin.jsx makes on mount
    const token = 'dummy-admin-token';
    socket.emit('GET_ADMIN_MAPPINGS', { token });
    socket.emit('GET_ADMIN_CACHE', { token });
    socket.emit('GET_ADMIN_ACTIVITY', { token });
    socket.emit('GET_ADMIN_ROOMS', { token });
    socket.emit('GET_DB_ESPORTS_TEAMS');
    socket.emit('ADMIN_GET_KOALA_BASELINE', { token });

    setTimeout(() => {
        console.log("Waiting to see if server crashes...");
        process.exit(0);
    }, 2000);
});
