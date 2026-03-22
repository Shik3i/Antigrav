const roomManager = require('./roomManager');
const dbLayer = require('./database');

async function testParsing() {
    roomManager.createRoom('test_1', 'Test', 20, true, false, '123', 'read');

    // Simulate user connecting
    const user = { userId: '123', displayName: 'Mock User', role: 'admin', preferences: { theme: 'neon' } };

    roomManager.joinRoom('test_1', 'socket_12345', user);
    roomManager.startTimer('test_1');
    roomManager.addTodo('test_1', { id: 'todo1', text: 'Task 1', completed: false });
    roomManager.tick();

    // Check serialization
    const roomState = roomManager.getRoomState('test_1');

    try {
        const jsonStr = JSON.stringify(roomState);
        console.log('Successfully stringified room state. Length:', jsonStr.length);

        // Try parsing
        JSON.parse(jsonStr);
        console.log('Successfully parsed back.');
    } catch (e) {
        console.error('PARSE ERROR DETECTED:', e.message);
    }
}
testParsing();
