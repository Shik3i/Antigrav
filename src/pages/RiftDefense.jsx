import React, { useState, useEffect } from 'react';
import { Shield, ShoppingBag, Map, Backpack } from 'lucide-react';
import GachaShop from '../components/RiftDefense/GachaShop';
import Inventory from '../components/RiftDefense/Inventory';
import GameMap from '../components/RiftDefense/GameMap';

import { RiftDefenseProvider } from '../context/RiftDefenseContext';

const RiftDefense = () => {
    const [activeTab, setActiveTab] = useState('inventory');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    const styles = {
        container: {
            width: '100%',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
        },
        header: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '16px'
        },
        title: {
            fontSize: '2.5rem',
            margin: 0,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px',
            fontWeight: 800
        },
        subtitle: {
            color: 'var(--text-muted)',
            fontSize: '0.95rem',
            margin: 0
        },
        tabs: {
            display: 'flex',
            gap: '12px',
            background: 'rgba(255,255,255,0.03)',
            padding: '8px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.05)',
            marginBottom: '24px'
        },
        tabBtn: (isActive) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
            color: isActive ? '#10b981' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: isActive ? 700 : 600,
            transition: 'all 0.2s',
            flex: 1,
            justifyContent: 'center'
        })
    };

    return (
        <RiftDefenseProvider>
            <div style={styles.container}>
                <header style={styles.header}>
                    <h1 style={styles.title}>LEC RIFT DEFENSE</h1>
                    <p style={styles.subtitle}>Der ultimative Tower Defense Money Sink. Baue dein LEC Team-Deck auf und verteidige den Nexus!</p>
                </header>

                <div style={styles.tabs}>
                    <button 
                        style={styles.tabBtn(activeTab === 'shop')} 
                        onClick={() => setActiveTab('shop')}
                    >
                        <ShoppingBag size={20} /> Gacha Kapseln
                    </button>
                    <button 
                        style={styles.tabBtn(activeTab === 'inventory')} 
                        onClick={() => setActiveTab('inventory')}
                    >
                        <Backpack size={20} /> Inventar & Kombinieren
                    </button>
                    <button 
                        style={styles.tabBtn(activeTab === 'map')} 
                        onClick={() => setActiveTab('map')}
                    >
                        <Map size={20} /> Spielfeld
                    </button>
                </div>

                <main>
                    {activeTab === 'shop' && <GachaShop onPurchase={triggerRefresh} />}
                    {activeTab === 'inventory' && <Inventory refreshTrigger={refreshTrigger} />}
                    {activeTab === 'map' && <GameMap />}
                </main>
            </div>
        </RiftDefenseProvider>
    );
};

export default RiftDefense;
