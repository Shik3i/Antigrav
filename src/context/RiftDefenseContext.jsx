import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const RiftDefenseContext = createContext();

export const useRiftDefense = () => useContext(RiftDefenseContext);

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 500;
export const ENEMY_PATH = [
    { x: 0, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 400 },
    { x: 600, y: 400 },
    { x: 600, y: 200 },
    { x: 800, y: 200 }
];

export const SOCKETS = [
    { id: 1, x: 150, y: 50 },
    { id: 2, x: 250, y: 200 },
    { id: 3, x: 150, y: 300 },
    { id: 4, x: 400, y: 450 },
    { id: 5, x: 500, y: 250 },
    { id: 6, x: 700, y: 300 },
    { id: 7, x: 700, y: 100 }
];

export const TOWER_ROLES = {
    ADC: { color: '#ef4444', range: 150, damage: 20, speed: 500 },
    Mid: { color: '#3b82f6', range: 200, damage: 40, speed: 1000 },
    Top: { color: '#10b981', range: 100, damage: 80, speed: 1500 },
    Jungle: { color: '#f59e0b', range: 150, damage: 15, speed: 400 },
    Support: { color: '#ec4899', range: 250, damage: 10, speed: 800 }
};

export const RiftDefenseProvider = ({ children }) => {
    const { token } = useAuth();
    
    const [gameState, setGameState] = useState('idle'); // idle, playing, gameover
    const [wave, setWave] = useState(0);
    const [lives, setLives] = useState(20);
    const [inGameGold, setInGameGold] = useState(100);
    
    const [enemies, setEnemies] = useState([]);
    const [projectiles, setProjectiles] = useState([]);
    const [placedTowers, setPlacedTowers] = useState({});
    const [gameStats, setGameStats] = useState({ minions: 0, bosses: 0 });

    const gameLoopRef = useRef(null);
    const enemiesRef = useRef([]);
    const projectilesRef = useRef([]);
    const placedTowersRef = useRef({});
    const waveInfoRef = useRef({ wave: 0, spawned: 0, toSpawn: 0, isBoss: false, spawnTimer: 0 });
    const lastTickRef = useRef(0);
    const gameStateRef = useRef('idle');

    // Keep ref in sync for the loop
    useEffect(() => { 
        gameStateRef.current = gameState; 
    }, [gameState]);

    const calculateTowerStats = useCallback((pt) => {
        const roleStats = TOWER_ROLES[pt.role];
        if (!roleStats) return { damage: 0, speed: 1000, range: 0 };

        const rarityMult = 1 + (pt.rarityTier * 0.15);
        
        // Star multiplier: ⭐ = 1x, ⭐⭐ = 2.5x, ⭐⭐⭐ = 7x
        let starMult = 1;
        if (pt.starLevel === 2) starMult = 2.5;
        if (pt.starLevel === 3) starMult = 7;

        return {
            damage: Math.round(roleStats.damage * rarityMult * starMult),
            speed: Math.round(roleStats.speed / (starMult * 0.9)), // Faster fire rate
            range: Math.round(roleStats.range + (pt.rarityTier * 8))
        };
    }, []);

    const spawnEnemy = useCallback((isBoss, waveNum) => {
        const hpBase = isBoss ? 500 : 50;
        const hpScale = Math.pow(1.25, waveNum - 1);
        
        enemiesRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            x: ENEMY_PATH[0].x,
            y: ENEMY_PATH[0].y,
            pathIndex: 0,
            hp: Math.floor(hpBase * hpScale),
            maxHp: Math.floor(hpBase * hpScale),
            speed: isBoss ? 40 : 80 + (waveNum * 1.5),
            isBoss,
            reward: isBoss ? 100 : 10
        });
    }, []);

    const updateEnemies = useCallback((delta) => {
        const remaining = [];
        let lifeLoss = 0;
        for (let enemy of enemiesRef.current) {
            const targetNode = ENEMY_PATH[enemy.pathIndex + 1];
            if (!targetNode) {
                lifeLoss += (enemy.isBoss ? 5 : 1);
                continue;
            }

            const dx = targetNode.x - enemy.x;
            const dy = targetNode.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const moveAmt = (enemy.speed * delta) / 1000;
            if (moveAmt >= distance) {
                enemy.x = targetNode.x;
                enemy.y = targetNode.y;
                enemy.pathIndex++;
            } else {
                enemy.x += (dx / distance) * moveAmt;
                enemy.y += (dy / distance) * moveAmt;
            }
            remaining.push(enemy);
        }
        if (lifeLoss > 0) setLives(l => Math.max(0, l - lifeLoss));
        enemiesRef.current = remaining;
    }, []);

    const updateTowers = useCallback((timestamp) => {
        for (const sId in placedTowersRef.current) {
            const pt = placedTowersRef.current[sId];
            const socket = SOCKETS.find(s => s.id === parseInt(sId));
            if (!socket || !pt.role) continue;

            const stats = calculateTowerStats(pt);

            if (timestamp - pt.lastFired >= stats.speed) {
                const target = enemiesRef.current.find(e => {
                    const dist = Math.sqrt(Math.pow(e.x - socket.x, 2) + Math.pow(e.y - socket.y, 2));
                    return dist <= stats.range;
                });

                if (target) {
                    projectilesRef.current.push({
                        id: Math.random(),
                        x: socket.x,
                        y: socket.y,
                        targetId: target.id,
                        damage: stats.damage,
                        speed: 500,
                        color: TOWER_ROLES[pt.role].color
                    });
                    pt.lastFired = timestamp;
                }
            }
        }
    }, [calculateTowerStats]);

    const updateProjectiles = useCallback((delta) => {
        const remaining = [];
        let minionsKilled = 0;
        let bossesKilled = 0;
        let goldEarned = 0;

        for (let proj of projectilesRef.current) {
            const target = enemiesRef.current.find(e => e.id === proj.targetId);
            if (!target) continue;

            const dx = target.x - proj.x;
            const dy = target.y - proj.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const moveAmt = (proj.speed * delta) / 1000;
            if (moveAmt >= distance) {
                target.hp -= proj.damage;
                if (target.hp <= 0) {
                    if (target.isBoss) bossesKilled++;
                    else minionsKilled++;
                    goldEarned += target.reward;
                    enemiesRef.current = enemiesRef.current.filter(e => e.id !== target.id);
                }
            } else {
                proj.x += (dx / distance) * moveAmt;
                proj.y += (dy / distance) * moveAmt;
                remaining.push(proj);
            }
        }
        if (minionsKilled > 0 || bossesKilled > 0) {
            setGameStats(prev => ({ minions: prev.minions + minionsKilled, bosses: prev.bosses + bossesKilled }));
            setInGameGold(g => g + goldEarned);
        }
        projectilesRef.current = remaining;
    }, []);

    const checkWaveLogic = useCallback((delta) => {
        const info = waveInfoRef.current;
        if (info.spawned < info.toSpawn) {
            info.spawnTimer -= delta;
            if (info.spawnTimer <= 0) {
                spawnEnemy(info.isBoss, info.wave);
                info.spawned++;
                info.spawnTimer = info.isBoss ? 2000 : 800;
            }
        } else if (enemiesRef.current.length === 0) {
            info.wave++;
            setWave(info.wave);
            info.isBoss = info.wave % 5 === 0;
            info.toSpawn = info.isBoss ? 1 : 10 + Math.floor(info.wave * 1.5);
            info.spawned = 0;
            info.spawnTimer = 2000;
        }
    }, [spawnEnemy]);

    const gameLoop = useCallback((timestamp) => {
        if (gameStateRef.current !== 'playing') return;
        
        if (!lastTickRef.current) lastTickRef.current = timestamp;
        const delta = timestamp - lastTickRef.current;
        lastTickRef.current = timestamp;

        if (delta > 0 && delta < 500) { // Safety cap for tab switching delays
            updateEnemies(delta);
            updateTowers(timestamp);
            updateProjectiles(delta);
            checkWaveLogic(delta);
        } else if (delta >= 500) {
            // Just skip delta if it's too large to prevent jumps
            lastTickRef.current = timestamp;
        }

        setEnemies([...enemiesRef.current]);
        setProjectiles([...projectilesRef.current]);

        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [updateEnemies, updateTowers, updateProjectiles, checkWaveLogic]);

    // Cleanup loop on unmount (context unmounts on logout/hard refresh)
    useEffect(() => {
        return () => {
            if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        };
    }, []);

    // Watch lives to trigger Game Over
    useEffect(() => {
        if (gameState === 'playing' && lives <= 0) {
            setGameState('gameover');
            cancelAnimationFrame(gameLoopRef.current);
            
            // Save to DB
            const saveStats = async () => {
                try {
                    await axios.post('/api/rift-defense/save-stats', {
                        highestWave: wave,
                        minionsKilled: gameStats.minions,
                        bossesKilled: gameStats.bosses
                    }, { headers: { Authorization: `Bearer ${token}` } });
                } catch (err) { console.error('Failed to save stats', err); }
            };
            saveStats();
        }
    }, [lives, gameState, wave, gameStats.minions, gameStats.bosses, token]);

    const startGame = () => {
        setGameState('playing');
        setWave(1);
        setLives(20);
        setInGameGold(150);
        setEnemies([]);
        setProjectiles([]);
        setGameStats({ minions: 0, bosses: 0 });
        
        enemiesRef.current = [];
        projectilesRef.current = [];
        waveInfoRef.current = { wave: 1, spawned: 0, toSpawn: 10, isBoss: false, spawnTimer: 500 };
        
        lastTickRef.current = performance.now();
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    const placeTower = (socketId, tower) => {
        const cost = 50;
        if (inGameGold < cost) return false;
        
        setInGameGold(g => g - cost);
        const newPlacement = {
            ...placedTowersRef.current,
            [socketId]: { ...tower, lastFired: 0 }
        };
        placedTowersRef.current = newPlacement;
        setPlacedTowers(newPlacement);
        return true;
    };

    const getRarityColor = (tier) => {
        if (tier >= 8) return '#fbbf24'; // Legendary (Gold)
        if (tier >= 5) return '#a855f7'; // Epic (Purple)
        if (tier >= 2) return '#3b82f6'; // Rare (Blue)
        return '#94a3b8'; // Common (Silver/Gray)
    };

    return (
        <RiftDefenseContext.Provider value={{
            gameState, setGameState,
            wave, lives, inGameGold,
            enemies, projectiles, placedTowers, gameStats,
            startGame, placeTower, calculateTowerStats, getRarityColor
        }}>
            {children}
        </RiftDefenseContext.Provider>
    );
};
