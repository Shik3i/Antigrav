const db = require('../connection');
const PROFILE_FIELDS = new Set(['level', 'hype', 'dollars', 'last_sync_at', 'upgrades_json']);
const INVENTORY_FIELDS = new Set(['team_code', 'tier', 'role', 'level', 'experience', 'rarity', 'base_stats', 'is_equipped']);
function updateAllowed(table, idColumn, id, data, allowed) {
  const keys = Object.keys(data).filter((key) => allowed.has(key));
  if (keys.length === 0) return 0;
  return Number(db.prepare(`UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE ${idColumn} = ?`)
    .run(...keys.map((key) => data[key]), id).changes);
}
async function getIdleProfile(userId) { const row = db.prepare('SELECT * FROM Idle_Profiles WHERE userId=?').get(userId); if (row && (row.dollars === null || row.dollars < 1000000)) row.dollars=1000000; return row; }
const createIdleProfile = async (userId) => Number(db.prepare('INSERT OR IGNORE INTO Idle_Profiles (userId) VALUES (?)').run(userId).changes);
const updateIdleProfile = async (userId, data) => updateAllowed('Idle_Profiles', 'userId', userId, data, PROFILE_FIELDS);
const updateInventoryUnit = async (id, data) => { updateAllowed('Idle_Inventory', 'id', id, data, INVENTORY_FIELDS); };
const getIdleInventory = async (userId) => db.prepare('SELECT * FROM Idle_Inventory WHERE userId=?').all(userId);
async function addInventoryUnit(userId, teamCode, rarity='Common', baseStats=10, role='Top') { const result=db.prepare('INSERT INTO Idle_Inventory (userId,team_code,rarity,base_stats,role,level) VALUES (?,?,?,?,?,1)').run(userId,teamCode,rarity,baseStats,role); return { id:Number(result.lastInsertRowid), userId, team_code:teamCode, tier:1, rarity, base_stats:baseStats, role, level:1 }; }
const deleteInventoryUnit = async (unitId) => { db.prepare('DELETE FROM Idle_Inventory WHERE id=?').run(unitId); };

async function mergeInventoryUnits(userId, teamCode, tier, role) {
  db.exec('BEGIN IMMEDIATE'); try {
    const rows=db.prepare('SELECT id FROM Idle_Inventory WHERE userId=? AND team_code=? AND tier=? AND role=? AND is_equipped=0 LIMIT 3').all(userId,teamCode,tier,role);
    if(rows.length<3) throw new Error('Not enough units');
    db.prepare(`DELETE FROM Idle_Inventory WHERE id IN (${rows.map(()=>'?').join(',')})`).run(...rows.map((row)=>row.id));
    const result=db.prepare('INSERT INTO Idle_Inventory (userId,team_code,tier,role) VALUES (?,?,?,?)').run(userId,teamCode,tier+1,role);
    db.exec('COMMIT'); return { id:Number(result.lastInsertRowid), tier:tier+1, role };
  } catch(error){db.exec('ROLLBACK');throw error;}
}
async function mergeAllInventoryUnits(userId) {
  const groups={}; for(const row of db.prepare('SELECT id,team_code,tier,role FROM Idle_Inventory WHERE userId=? AND is_equipped=0').all(userId)){const key=JSON.stringify([row.team_code,row.tier,row.role]);(groups[key] ||= []).push(row.id);}
  const remove=[]; const insert=[]; for(const [key,ids] of Object.entries(groups)){const [team,tier,role]=JSON.parse(key); const sets=Math.floor(ids.length/3); for(let i=0;i<sets;i+=1){remove.push(...ids.slice(i*3,i*3+3));insert.push({team,tier:tier+1,role});}}
  if(remove.length===0)return {changes:0}; db.exec('BEGIN IMMEDIATE'); try {db.prepare(`DELETE FROM Idle_Inventory WHERE id IN (${remove.map(()=>'?').join(',')})`).run(...remove); const statement=db.prepare('INSERT INTO Idle_Inventory (userId,team_code,tier,role) VALUES (?,?,?,?)'); for(const item of insert)statement.run(userId,item.team,item.tier,item.role); db.exec('COMMIT'); return {changes:insert.length};}catch(error){db.exec('ROLLBACK');throw error;}
}
const getIdleRoster = async (userId) => db.prepare('SELECT r.slot_id,i.* FROM Idle_Roster r LEFT JOIN Idle_Inventory i ON r.inventory_id=i.id WHERE r.userId=? ORDER BY r.slot_id ASC').all(userId);
async function assignInventoryToRoster(userId,slotId,inventoryId){db.exec('BEGIN IMMEDIATE');try{const old=db.prepare('SELECT inventory_id FROM Idle_Roster WHERE userId=? AND slot_id=?').get(userId,slotId);if(old?.inventory_id)db.prepare('UPDATE Idle_Inventory SET is_equipped=0 WHERE id=?').run(old.inventory_id);if(inventoryId===null){db.prepare('UPDATE Idle_Roster SET inventory_id=NULL WHERE userId=? AND slot_id=?').run(userId,slotId);}else{db.prepare('UPDATE Idle_Inventory SET is_equipped=1 WHERE id=?').run(inventoryId);db.prepare('INSERT INTO Idle_Roster (userId,slot_id,inventory_id) VALUES (?,?,?) ON CONFLICT(userId,slot_id) DO UPDATE SET inventory_id=excluded.inventory_id').run(userId,slotId,inventoryId);}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
const updateInventoryXP=async(id,amount)=>Number(db.prepare('UPDATE Idle_Inventory SET experience=experience+? WHERE id=?').run(amount,id).changes);
const updateRosterMode=async(userId,slotId,mode)=>Number(db.prepare('UPDATE Idle_Roster SET current_mode=? WHERE userId=? AND slot_id=?').run(mode,userId,slotId).changes);
async function addRiftDefenseTower(userId,teamCode,starLevel=1,rarityTier=0){const result=db.prepare('INSERT INTO RiftDefense_Towers (userId,teamCode,starLevel,rarityTier) VALUES (?,?,?,?)').run(userId,teamCode,starLevel,rarityTier);return{id:Number(result.lastInsertRowid),userId,teamCode,starLevel,rarityTier};}
const getUserRiftDefenseTowers=async(userId)=>db.prepare('SELECT * FROM RiftDefense_Towers WHERE userId=? ORDER BY starLevel DESC,teamCode ASC').all(userId);
const deleteRiftDefenseTowers=async(userId,teamCode,starLevel,limit)=>Number(db.prepare('DELETE FROM RiftDefense_Towers WHERE id IN (SELECT id FROM RiftDefense_Towers WHERE userId=? AND teamCode=? AND starLevel=? LIMIT ?)').run(userId,teamCode,starLevel,limit).changes);
const scrapRiftDefenseTower=async(id,userId)=>Number(db.prepare('DELETE FROM RiftDefense_Towers WHERE id=? AND userId=?').run(id,userId).changes);
const updateRiftDefenseStats=async(userId,highestWave,minionsKilled,bossesKilled)=>Number(db.prepare('INSERT INTO RiftDefense_Stats (userId,highestWave,totalMinionsKilled,totalBossesKilled) VALUES (?,?,?,?) ON CONFLICT(userId) DO UPDATE SET highestWave=MAX(highestWave,excluded.highestWave),totalMinionsKilled=totalMinionsKilled+excluded.totalMinionsKilled,totalBossesKilled=totalBossesKilled+excluded.totalBossesKilled,updatedAt=CURRENT_TIMESTAMP').run(userId,highestWave,minionsKilled,bossesKilled).changes);
async function getRiftDefenseLeaderboards(){const query=(field)=>`SELECT r.userId,u.username,u.displayName,u.preferences,r.${field} AS value FROM RiftDefense_Stats r JOIN Users u ON r.userId=u.id ORDER BY r.${field} DESC LIMIT 50`;return{highestWave:db.prepare(query('highestWave')).all(),totalMinions:db.prepare(query('totalMinionsKilled')).all(),totalBosses:db.prepare(query('totalBossesKilled')).all()};}
module.exports={getIdleProfile,createIdleProfile,updateIdleProfile,updateInventoryUnit,getIdleInventory,addInventoryUnit,deleteInventoryUnit,mergeInventoryUnits,mergeAllInventoryUnits,getIdleRoster,assignInventoryToRoster,updateInventoryXP,updateRosterMode,addRiftDefenseTower,getUserRiftDefenseTowers,deleteRiftDefenseTowers,scrapRiftDefenseTower,updateRiftDefenseStats,getRiftDefenseLeaderboards};
