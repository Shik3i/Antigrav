const dbLayer = require('../database');

const getTimes = async (req, res) => {
    try {
        const userId = req.user.userId;
        const times = await dbLayer.getSpeedcubeTimes(userId);
        res.json(times);
    } catch (error) {
        console.error('Error fetching speedcube times:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addTime = async (req, res) => {
    const { time_ms, note, scramble } = req.body;
    if (time_ms === undefined || typeof time_ms !== 'number') {
        return res.status(400).json({ error: 'time_ms is required and must be a number' });
    }

    try {
        const userId = req.user.userId;
        const result = await dbLayer.addSpeedcubeTime(userId, time_ms, note || '', scramble || '');
        res.status(201).json(result);
    } catch (error) {
        console.error('Error adding speedcube time:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updateNote = async (req, res) => {
    const { id } = req.params;
    const { note } = req.body;
    
    if (note === undefined) {
        return res.status(400).json({ error: 'note is required' });
    }

    try {
        const userId = req.user.userId;
        const changes = await dbLayer.updateSpeedcubeNote(id, userId, note);
        if (changes === 0) {
            return res.status(404).json({ error: 'Time entry not found or not owned by user' });
        }
        res.json({ message: 'Note updated successfully' });
    } catch (error) {
        console.error('Error updating speedcube note:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteTime = async (req, res) => {
    const { id } = req.params;

    try {
        const userId = req.user.userId;
        const changes = await dbLayer.deleteSpeedcubeTime(id, userId);
        if (changes === 0) {
            return res.status(404).json({ error: 'Time entry not found or not owned by user' });
        }
        res.json({ message: 'Time entry deleted successfully' });
    } catch (error) {
        console.error('Error deleting speedcube time:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getTimes,
    addTime,
    updateNote,
    deleteTime
};
