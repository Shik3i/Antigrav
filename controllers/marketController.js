const { db } = require('../database');

exports.getAllActive = (req, res) => {
    const query = `
        SELECT m.*, u.displayName as updatedByName 
        FROM MMO_MarketPrices m 
        LEFT JOIN Users u ON m.updatedBy = u.id 
        WHERE m.isDeleted = 0 
        ORDER BY m.itemName ASC
    `;
    try { res.json(db.prepare(query).all()); } catch { res.status(500).json({ error: 'Database error' }); }
};

exports.addItem = (req, res) => {
    const { itemName, price } = req.body;
    const updatedBy = req.user.id;
    if (!itemName || price == null) return res.status(400).json({ error: 'Missing itemName or price' });

    const query = `INSERT INTO MMO_MarketPrices (itemName, price, updatedBy, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    try { const result=db.prepare(query).run(itemName,price,updatedBy); res.status(201).json({id:Number(result.lastInsertRowid),itemName,price,updatedBy}); }
    catch { res.status(500).json({ error: 'Failed to add item' }); }
};

exports.updateItem = (req, res) => {
    const { id } = req.params;
    const { itemName, price } = req.body;
    const updatedBy = req.user.id;

    if (!itemName || price == null) return res.status(400).json({ error: 'Missing itemName or price' });

    const query = `UPDATE MMO_MarketPrices SET itemName = ?, price = ?, updatedBy = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
    try { const result=db.prepare(query).run(itemName,price,updatedBy,id); if(Number(result.changes)===0)return res.status(404).json({error:'Item not found'}); res.json({success:true}); }
    catch { res.status(500).json({ error: 'Failed to update item' }); }
};

exports.softDeleteItem = (req, res) => {
    const { id } = req.params;
    const query = `UPDATE MMO_MarketPrices SET isDeleted = 1 WHERE id = ?`;
    try { const result=db.prepare(query).run(id); if(Number(result.changes)===0)return res.status(404).json({error:'Item not found'}); res.json({success:true}); }
    catch { res.status(500).json({ error: 'Failed to delete item' }); }
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
    try { res.json(db.prepare(query).all()); } catch { res.status(500).json({ error: 'Database error' }); }
};

exports.restoreItem = (req, res) => {
    if (!req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
    
    const { id } = req.params;
    const query = `UPDATE MMO_MarketPrices SET isDeleted = 0 WHERE id = ?`;
    try { db.prepare(query).run(id); res.json({success:true}); } catch { res.status(500).json({error:'Failed to restore item'}); }
};

exports.hardDeleteItem = (req, res) => {
    if (!req.user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const query = `DELETE FROM MMO_MarketPrices WHERE id = ?`;
    try { db.prepare(query).run(id); res.json({success:true}); } catch { res.status(500).json({error:'Failed to hard delete item'}); }
};
