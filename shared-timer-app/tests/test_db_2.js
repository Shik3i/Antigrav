const dbLayer = require('./database');

setTimeout(async () => {
    try {
        const user = await dbLayer.getUserByUsername('test');
        console.log('Got user:', user);
    } catch (err) {
        console.error('Error getting user:', err);
    }
}, 1000);
