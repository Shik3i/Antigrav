const { db } = require('../database');

exports.getAllActive = (req, res) => {
    const query = `
        SELECT m.*, u.displayName as updatedByName 
        FROM MMO_MarketPrices m 
        LEFT JOIN Users u ON m.updatedBy = u.id 
        WHERE m.isDeleted = 0 
        ORDER BY m.itemName ASC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
};

exports.addItem = (req, res) => {
    const { itemName, price } = req.body;
    const updatedBy = req.user.id;
    if (!itemName || price == null) return res.status(400).json({ error: 'Missing itemName or price' });

    const query = `INSERT INTO MMO_MarketPrices (itemName, price, updatedBy, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    db.run(query, [itemName, price, updatedBy], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to add item' });
        res.status(201).json({ id: this.lastID, itemName, price, updatedBy });
    });
};

exports.updateItem = (req, res) => {
    const { id } = req.params;
    const { itemName, price } = req.body;
    const updatedBy = req.user.id;

    if (!itemName || price == null) return res.status(400).json({ error: 'Missing itemName or price' });

    const query = `UPDATE MMO_MarketPrices SET itemName = ?, price = ?, updatedBy = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(query, [itemName, price, updatedBy, id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update item' });
        if (this.changes === 0) return res.status(404).json({ error: 'Item not found' });
        res.json({ success: true });
    });
};

exports.softDeleteItem = (req, res) => {
    const { id } = req.params;
    const query = `UPDATE MMO_MarketPrices SET isDeleted = 1 WHERE id = ?`;
    db.run(query, [id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete item' });
        if (this.changes === 0) return res.status(404).json({ error: 'Item not found' });
        res.json({ success: true });
    });
};

// --- Superadmin Routes ---
exports.getAllDeleted = (req, res) => {
    if (!req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    
    const query = `
        SELECT m.*, u.displayName as updatedByName 
        FROM MMO_MarketPrices m 
        LEFT JOIN Users u ON m.updatedBy = u.id 
        WHERE m.isDeleted = 1 
        ORDER BY m.updatedAt DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
};

exports.restoreItem = (req, res) => {
    if (!req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    
    const { id } = req.params;
    const query = `UPDATE MMO_MarketPrices SET isDeleted = 0 WHERE id = ?`;
    db.run(query, [id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to restore item' });
        res.json({ success: true });
    });
};

exports.hardDeleteItem = (req, res) => {
    if (!req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const query = `DELETE FROM MMO_MarketPrices WHERE id = ?`;
    db.run(query, [id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to hard delete item' });
        res.json({ success: true });
    });
};
