const dbLayer = require('../../database');
const EVENTS = require('../../socketEvents.json');

function setupScratchcardHandlers(socket, io, dbLayer, verifyAdmin) {
    // Scratchcard Packs
    socket.on('GET_SCRATCHCARD_PACKS', async ({ token }) => {
        try {
            const packs = await dbLayer.getScratchcardPacks();
            socket.emit('SCRATCHCARD_PACKS_DATA', packs);
        } catch (err) {
            console.error('[Admin API Debug] Request failed for Scratchcard Packs:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
        }
    });

    socket.on('ADMIN_GET_SCRATCHCARD_PACKS', async ({ token }) => {
        if (!(await verifyAdmin(token))) {
            socket.emit(EVENTS.ERROR, 'Unauthorized');
            return;
        }
        try {
            const packs = await dbLayer.getScratchcardPacks();
            socket.emit('SCRATCHCARD_PACKS_DATA', packs);
        } catch (err) {
            console.error('[Admin API Debug] Request failed for Scratchcard Packs:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
        }
    });
}

module.exports = {
    setupScratchcardHandlers
};