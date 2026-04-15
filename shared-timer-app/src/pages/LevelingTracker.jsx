import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Trash2, 
  Clock, 
  Zap, 
  Target, 
  History, 
  Calculator, 
  Trophy,
  Coins,
  User,
  Edit2,
  Tag,
  Search,
  RefreshCw,
  Download
} from 'lucide-react';

/**
 * Format milliseconds to a readable duration string (e.g. 2h 15m or HH:MM:SS)
 */
const formatDuration = (ms) => {
  if (!ms || ms <= 0 || !isFinite(ms)) return '--';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 999) return '> 999h';
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return 'Unbekannt';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unbekannt';
  const diffMs = Date.now() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours < 24) {
    if (diffHours < 1) {
      const mins = Math.max(1, Math.floor(diffHours * 60));
      return `vor ${mins} Minute${mins !== 1 ? 'n' : ''}`;
    }
    const hrs = Math.floor(diffHours);
    return `vor ${hrs} Stunde${hrs !== 1 ? 'n' : ''}`;
  } else if (diffHours < 48) {
    return 'gestern';
  } else if (diffHours < 24 * 7) {
    const days = Math.floor(diffHours / 24);
    return `vor ${days} Tagen`;
  } else {
    return `am ${d.toLocaleDateString('de-DE')}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
  }
};

const FwcCountdown = () => {
  const [now, setNow] = useState(Date.now());
  const [spStylerLive, setSpStylerLive] = useState(null);
  // Target: 23. April 2026, 10:00 Uhr
  const target = new Date('2026-04-23T10:00:00').getTime();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/twitch/status');
        if (res.ok) {
          const data = await res.json();
          const match = data.find(c => c.user_login.toLowerCase() === 'spielestyler');
          if (match && match.is_live) {
            setSpStylerLive(match);
          } else {
            setSpStylerLive(null);
          }
        }
      } catch (e) {}
    };
    fetchStatus();
    const iv = setInterval(fetchStatus, 60000);
    return () => clearInterval(iv);
  }, []);

  const diff = target - now;
  const isFuture = diff > 0;
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass-card animate-fade-in" style={{ 
        padding: '12px 24px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '16px',
        background: 'rgba(245, 158, 11, 0.05)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '16px'
      }}>
        <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
          <Trophy size={20} color="#f59e0b" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            {isFuture ? 'Countdown zum Flyff FWC 2026:' : 'Zeit seit dem Flyff FWC 2026 Start:'}
          </span>
          <div style={{ display: 'flex', gap: '8px', fontFamily: "'JetBrains Mono', monospace", fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>
            <span>{days}d</span>
            <span>{hours}h</span>
            <span>{minutes}m</span>
            <span style={{ minWidth: '45px' }}>{seconds}s</span>
          </div>
        </div>
      </div>
      
      {spStylerLive && (
        <a 
          href={`https://twitch.tv/spielestyler`}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-card stream-trigger animate-glow"
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px',
            textDecoration: 'none', color: 'inherit', borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)'
          }}
        >
          <div style={{ position: 'relative', display: 'flex' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px #ef4444' }} />
          </div>
          <span style={{ fontWeight: 600 }}>Spielestyler ist LIVE mit Flyff!</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', opacity: 0.8 }}>
              {spStylerLive.viewer_count} Zuschauer
          </span>
        </a>
      )}
    </div>
  );
};

const LevelingTracker = ({ user, token }) => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('mmo_active_tab') || 'xp');
  const [now, setNow] = useState(Date.now());
  const [calcMode, setCalcMode] = useState('10'); // 'tick', '10', '6h'
  const [modalState, setModalState] = useState(null);

  useEffect(() => {
    localStorage.setItem('mmo_active_tab', activeTab);
  }, [activeTab]);

  // Character Management State
  const [characters, setCharacters] = useState(() => {
    try {
      const savedChars = localStorage.getItem('mmo_characters');
      if (savedChars) return JSON.parse(savedChars);

      // Migration
      const oldXp = JSON.parse(localStorage.getItem('mmo_xp_history') || '[]');
      const oldGold = JSON.parse(localStorage.getItem('mmo_gold_history') || '[]');
      
      const defaultChar = {
        id: 'char_' + Date.now(),
        name: 'Main Character',
        xpHistory: oldXp,
        goldHistory: oldGold
      };
      return [defaultChar];
    } catch (e) {
      return [{ id: 'char_' + Date.now(), name: 'Main Character', xpHistory: [], goldHistory: [] }];
    }
  });
  const [activeCharId, setActiveCharId] = useState(() => {
    try {
      const savedId = localStorage.getItem('mmo_active_char_id');
      const savedChars = localStorage.getItem('mmo_characters');
      if (savedChars) {
        const parsed = JSON.parse(savedChars);
        if (savedId && parsed.find(c => c.id === savedId)) return savedId;
        if (parsed.length > 0) return parsed[0].id;
      }
      return null;
    } catch (e) { return null; }
  });

  useEffect(() => {
    if (activeCharId) localStorage.setItem('mmo_active_char_id', activeCharId);
  }, [activeCharId]);

  const activeChar = useMemo(() => characters.find(c => c.id === (activeCharId || characters[0]?.id)) || characters[0], [characters, activeCharId]);
  const xpHistory = activeChar?.xpHistory || [];
  const goldHistory = activeChar?.goldHistory || [];

  const handleAddCharacter = () => {
    setModalState({ type: 'addChar' });
  };

  const handleRenameCharacter = (id, currentName) => {
    setModalState({ type: 'renameChar', charId: id, nameStr: currentName, nameStrInitial: currentName });
  };

  const handleDeleteCharacter = (id) => {
    if (characters.length <= 1) return;
    if (window.confirm("Bist du sicher, dass du diesen Charakter und seine Historie löschen möchtest?")) {
      const updatedChars = characters.filter(c => c.id !== id);
      setCharacters(updatedChars);
      setActiveCharId(updatedChars[0].id);
    }
  };

  const updateActiveChar = (updates) => {
    setCharacters(prev => prev.map(c => c.id === activeChar.id ? { ...c, ...updates } : c));
  };

  // Calculator State
  const [fcoinBasePrice, setFcoinBasePrice] = useState(() => {
    try {
      const saved = localStorage.getItem('mmo_fcoin_base_price');
      if (saved) return parseFloat(saved);
    } catch(e) {}
    // try to calculate initial reasonable base price if needed, otherwise 0
    return 15000000 / 80; 
  });

  useEffect(() => {
    localStorage.setItem('mmo_fcoin_base_price', fcoinBasePrice.toString());
  }, [fcoinBasePrice]);

  // Entry Form States
  const [currentLevel, setCurrentLevel] = useState('');
  const [currentXP, setCurrentXP] = useState('');
  const [currentGold, setCurrentGold] = useState('');

  // Database Milestones
  const [milestones, setMilestones] = useState([]);

  // Market Prices
  const [marketItems, setMarketItems] = useState([]);
  const [deletedMarketItems, setDeletedMarketItems] = useState([]);
  const [marketSearch, setMarketSearch] = useState('');

  const fetchMarketPrices = async () => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/market', { headers });
      if (res.ok) {
        const data = await res.json();
        setMarketItems(data);
      }
    } catch(e) {}
  };

  const fetchDeletedMarketPrices = async () => {
    if (!user?.is_superadmin) return;
    try {
      const res = await fetch('/api/admin/market/deleted', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDeletedMarketItems(data);
      }
    } catch(e) {}
  };

  useEffect(() => {
    if (activeTab === 'market') {
      fetchMarketPrices();
      if (user?.is_superadmin) fetchDeletedMarketPrices();
    }
  }, [activeTab, token, user]);

  const handleAddMarketItem = () => {
    if (!token) return alert('Bitte zuerst einloggen.');
    setModalState({ type: 'addMarketItem', itemNameStr: '', priceStr: '' });
  };

  const handleUpdateMarketItem = (item) => {
    if (!token) return alert('Bitte zuerst einloggen.');
    setModalState({ type: 'updateMarketItem', itemId: item.id, itemNameStr: item.itemName, priceStr: item.price.toString() });
  };

  const submitModal = async (e) => {
    e.preventDefault();
    if (!modalState) return;

    if (modalState.type === 'addChar') {
      const name = modalState.nameStr?.trim();
      if (name) {
        const newChar = {
          id: 'char_' + Date.now(),
          name,
          xpHistory: [],
          goldHistory: []
        };
        setCharacters(prev => [...prev, newChar]);
        setActiveCharId(newChar.id);
      }
    } else if (modalState.type === 'renameChar') {
      const newName = modalState.nameStr?.trim();
      if (newName && newName !== modalState.nameStrInitial) {
        setCharacters(prev => prev.map(c => c.id === modalState.charId ? { ...c, name: newName } : c));
      }
    } else if (modalState.type === 'addMarketItem' || modalState.type === 'updateMarketItem') {
      const itemName = modalState.itemNameStr?.trim();
      const priceStrRaw = modalState.priceStr || '';
      // Remove thousand separators before parsing
      const price = parseInt(priceStrRaw.replace(/\./g, ''));

      if (!itemName || !price || price <= 0) return alert('Ungültiger Name oder Preis');

      const endpoint = modalState.type === 'addMarketItem' ? '/api/market' : `/api/market/${modalState.itemId}`;
      const method = modalState.type === 'addMarketItem' ? 'POST' : 'PUT';

      try {
        const res = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ itemName, price })
        });
        if (res.ok) fetchMarketPrices();
      } catch(err) {}
    }
    setModalState(null);
  };

  const handleDeleteMarketItem = async (id) => {
    if (!token) return;
    if (window.confirm('Aus Liste entfernen?')) {
      await fetch(`/api/market/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      fetchMarketPrices();
      if (user?.is_superadmin) fetchDeletedMarketPrices();
    }
  };

  const handleRestoreMarketItem = async (id) => {
    if (!token) return;
    await fetch(`/api/admin/market/${id}/restore`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } });
    fetchMarketPrices();
    fetchDeletedMarketPrices();
  };

  const handleHardDeleteMarketItem = async (id) => {
    if (!token) return;
    if (window.confirm('Das Item wird permanent aus der Datenbank gelöscht. Fortfahren?')) {
      await fetch(`/api/admin/market/${id}/hard`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      fetchDeletedMarketPrices();
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMilestones = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/leveling/milestones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMilestones(data);
      }
    } catch (e) { console.error("Failed to fetch milestones", e); }
  };

  useEffect(() => {
    fetchMilestones();
  }, [token]);

  useEffect(() => {
    localStorage.setItem('mmo_characters', JSON.stringify(characters));
  }, [characters]);

  useEffect(() => {
    if (xpHistory.length > 0 && currentLevel === '') {
      setCurrentLevel(xpHistory[0].level.toString());
    }
  }, [xpHistory]);

  const handleKeyShortcut = (e) => {
    if (activeTab === 'xp') {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextLvl = parseInt(currentLevel || '0') + 1;
        setCurrentLevel(nextLvl.toString());
      }
    }
  };

  const addXP = async () => {
    if (!currentLevel || !currentXP) return;
    const xpVal = parseFloat(currentXP);
    const lvlVal = parseInt(currentLevel);
    if (isNaN(xpVal) || xpVal < 0 || xpVal >= 100) return;

    const newEntry = { id: Date.now(), timestamp: Date.now(), level: lvlVal, xp: xpVal };
    updateActiveChar({ xpHistory: [newEntry, ...xpHistory].slice(0, 100) });
    setCurrentXP('');

    if (token) {
      try {
        const res = await fetch('/api/leveling/milestone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ level: lvlVal })
        });
        if (res.ok) fetchMilestones();
      } catch (e) { console.error("Failed to save milestone", e); }
    }
  };

  const addGold = () => {
    if (!currentGold) return;
    const goldVal = parseFloat(currentGold);
    if (isNaN(goldVal)) return;

    const newEntry = { id: Date.now(), timestamp: Date.now(), amount: goldVal };
    updateActiveChar({ goldHistory: [newEntry, ...goldHistory].slice(0, 100) });
    setCurrentGold('');
  };

  const deleteEntry = (id, type) => {
    if (type === 'xp') updateActiveChar({ xpHistory: xpHistory.filter(e => e.id !== id) });
    else updateActiveChar({ goldHistory: goldHistory.filter(e => e.id !== id) });
  };

  const resetHistory = (type) => {
    if (window.confirm(`Möchtest du den gesamten Verlauf leeren?`)) {
      if (type === 'xp') updateActiveChar({ xpHistory: [] }); 
      else updateActiveChar({ goldHistory: [] });
    }
  };

  const xpStats = useMemo(() => {
    if (xpHistory.length < 2) return null;
    let totalGained = 0;
    let elapsedMs = 0;
    const latest = xpHistory[0];

    if (calcMode === 'tick') {
      const prev = xpHistory[1];
      elapsedMs = latest.timestamp - prev.timestamp;
      totalGained = (latest.level - prev.level) * 100 + latest.xp - prev.xp;
    } else if (calcMode === '10') {
      const count = Math.min(xpHistory.length - 1, 10);
      const oldest = xpHistory[count];
      elapsedMs = latest.timestamp - oldest.timestamp;
      totalGained = (latest.level - oldest.level) * 100 + latest.xp - oldest.xp;
    } else if (calcMode === '6h') {
      const maxAgeMs = 6 * 60 * 60 * 1000;
      let oldestIndex = 0;
      for (let i = 1; i < xpHistory.length; i++) {
        if (latest.timestamp - xpHistory[i].timestamp <= maxAgeMs) {
          oldestIndex = i;
        } else break;
      }
      if (oldestIndex === 0) return null;
      const oldest = xpHistory[oldestIndex];
      elapsedMs = latest.timestamp - oldest.timestamp;
      totalGained = (latest.level - oldest.level) * 100 + latest.xp - oldest.xp;
    }

    if (elapsedMs <= 0 || totalGained <= 0) return null;
    const xpPerMs = totalGained / elapsedMs;
    const remainingXP = 100 - latest.xp;
    const timeToLevelUpMs = remainingXP / xpPerMs;
    return {
      xpPerHour: xpPerMs * 3600000,
      xpPerMin: xpPerMs * 60000,
      xpPerDay: xpPerMs * 86400000,
      timeToLevelUpMs,
      targetDate: new Date(Date.now() + timeToLevelUpMs)
    };
  }, [xpHistory, calcMode]);

  const goldStats = useMemo(() => {
    if (goldHistory.length < 2) return null;
    let totalGained = 0;
    let elapsedMs = 0;
    const latest = goldHistory[0];

    if (calcMode === 'tick') {
      const prev = goldHistory[1];
      elapsedMs = latest.timestamp - prev.timestamp;
      totalGained = latest.amount - prev.amount;
    } else if (calcMode === '10') {
      const count = Math.min(goldHistory.length - 1, 10);
      const oldest = goldHistory[count];
      elapsedMs = latest.timestamp - oldest.timestamp;
      totalGained = latest.amount - oldest.amount;
    } else if (calcMode === '6h') {
      const maxAgeMs = 6 * 60 * 60 * 1000;
      let oldestIndex = 0;
      for (let i = 1; i < goldHistory.length; i++) {
        if (latest.timestamp - goldHistory[i].timestamp <= maxAgeMs) {
          oldestIndex = i;
        } else break;
      }
      if (oldestIndex === 0) return null;
      const oldest = goldHistory[oldestIndex];
      elapsedMs = latest.timestamp - oldest.timestamp;
      totalGained = latest.amount - oldest.amount;
    }

    if (elapsedMs <= 0 || totalGained <= 0) return null;
    const goldPerMs = totalGained / elapsedMs;
    return {
      goldPerHour: goldPerMs * 3600000,
      goldPerMin: goldPerMs * 60000,
      goldPerDay: goldPerMs * 86400000,
      futureHour: goldPerMs * 3600000
    };
  }, [goldHistory, calcMode]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
          <TrendingUp size={40} color="var(--accent-primary)" />
          <h1 style={{ fontSize: '2.5rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            MMO Leveling Tracker
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '32px' }}>Tracke deinen Fortschritt und berechne deine Level-Up Zeiten.</p>
        <a 
          href="https://drive.google.com/drive/folders/1azJ08r8eZcf0dO2uxX4s8pIbANifPHaJ?usp=sharing" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '6px', 
            fontSize: '0.82rem', 
            color: 'var(--text-muted)', 
            textDecoration: 'none',
            marginTop: '-24px',
            marginBottom: '32px',
            opacity: 0.7,
            transition: 'opacity 0.2s',
            fontWeight: 500
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
        >
          <Download size={14} /> Download: Flyff Browser Addon (by Antigravity)
        </a>
        <FwcCountdown />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {characters.map(char => (
          <div key={char.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={() => setActiveCharId(char.id)} 
              className={`btn-ghost ${activeChar.id === char.id ? 'active' : ''}`} 
              style={{ 
                padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', 
                background: activeChar.id === char.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)', 
                color: activeChar.id === char.id ? 'var(--accent-primary)' : 'var(--text-main)', 
                border: activeChar.id === char.id ? '1px solid var(--accent-primary)' : '1px solid transparent' 
              }}
            >
              <User size={16} /> {char.name}
              
              {activeChar.id === char.id && (
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: '6px', gap: '4px' }}>
                  <div 
                    onClick={(e) => { e.stopPropagation(); handleRenameCharacter(char.id, char.name); }} 
                    style={{ padding: '2px', cursor: 'pointer', display: 'flex' }}
                    title="Charakter umbenennen"
                  >
                    <Edit2 size={14} color="var(--accent-primary)" />
                  </div>
                  {characters.length > 1 && (
                    <div 
                      onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(char.id); }} 
                      style={{ padding: '2px', cursor: 'pointer', display: 'flex', opacity: 0.8 }}
                      title="Charakter löschen"
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </div>
                  )}
                </div>
              )}
            </button>
          </div>
        ))}
        {characters.length < 5 && (
          <button onClick={handleAddCharacter} className="btn-ghost" style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
            <Plus size={16} /> Charakter hinzufügen
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
        <button onClick={() => setActiveTab('xp')} className={`btn-ghost ${activeTab === 'xp' ? 'active' : ''}`} style={{ padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} /> XP Tracker
        </button>
        <button onClick={() => setActiveTab('gold')} className={`btn-ghost ${activeTab === 'gold' ? 'active' : ''}`} style={{ padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Coins size={18} /> Gold Tracker
        </button>
        <button onClick={() => setActiveTab('calculator')} className={`btn-ghost ${activeTab === 'calculator' ? 'active' : ''}`} style={{ padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calculator size={18} /> FCoin Rechner
        </button>
        <button onClick={() => setActiveTab('market')} className={`btn-ghost ${activeTab === 'market' ? 'active' : ''}`} style={{ padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tag size={18} /> Preisliste
        </button>
      </div>

      <div className="leveling-grid" style={{ display: 'grid', gridTemplateColumns: (activeTab === 'xp' || activeTab === 'gold') ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activeTab === 'calculator' ? <Calculator size={20} color="var(--accent-primary)" /> : activeTab === 'market' ? <Tag size={20} color="var(--accent-primary)" /> : <Plus size={20} color="var(--accent-primary)" />}
              {activeTab === 'xp' ? 'XP Eintrag hinzufügen' : activeTab === 'gold' ? 'Goldbestand erfassen' : activeTab === 'calculator' ? 'FCoin Penya Rechner' : 'Community Preisliste'}
            </h2>

            {activeTab === 'xp' ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Aktuelles Level</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="input-primary" value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value.replace(/\D/g, ''))} onKeyDown={handleKeyShortcut} placeholder="z.B. 60" style={{ width: '100%' }} />
                    <button onClick={() => setCurrentLevel((parseInt(currentLevel || '0') + 1).toString())} className="btn-ghost" style={{ padding: '0 12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', height: '48px', fontWeight: 700, borderRadius: '10px' }}>+1</button>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Erfahrung (%)</label>
                  <input type="number" className="input-primary" value={currentXP} onChange={(e) => setCurrentXP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addXP()} placeholder="z.B. 50.1234" step="0.0001" style={{ width: '100%' }} />
                </div>
                <button onClick={addXP} className="btn-primary" style={{ height: '48px', padding: '0 24px', borderRadius: '12px' }}>Hinzufügen</button>
              </div>
            ) : activeTab === 'gold' ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Goldbestand</label>
                  <input type="number" className="input-primary" value={currentGold} onChange={(e) => setCurrentGold(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGold()} placeholder="z.B. 1000000" style={{ width: '100%' }} />
                </div>
                <button onClick={addGold} className="btn-primary" style={{ height: '48px', padding: '0 24px', borderRadius: '12px' }}>Hinzufügen</button>
              </div>
            ) : activeTab === 'calculator' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Trage Penya in ein beliebiges Feld ein. Alle anderen Felder berechnen sich automatisch.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { amount: 30, label: 'Upcut Stone' },
                    { amount: 50, label: 'AProtect / Activation / Refresher Hold' },
                    { amount: 80, label: 'S Protect' },
                    { amount: 100, label: 'G Protect / E Protect' },
                    { amount: 1000, label: 'Allgemeiner Richtwert / Sammelpets' }
                  ].map(item => {
                    const amount = item.amount;
                    // Format explicitly with thousands separator
                    const valStr = fcoinBasePrice > 0 ? Math.round(fcoinBasePrice * amount).toLocaleString('de-DE') : '';
                    
                    return (
                      <div key={amount} className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: amount === 80 ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: amount === 80 ? 'var(--accent-primary)' : 'var(--text-main)' }}>
                            {amount} FCoins
                          </span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {item.label} {amount === 1000 && <strong style={{ color: '#10b981', marginLeft: '6px' }}>(10€ ≈ 1000 FCoins)</strong>}
                          </span>
                        </div>
                        <input 
                          type="text" 
                          className="input-primary" 
                          value={valStr}
                          onChange={(e) => {
                            const rawStr = e.target.value.replace(/\./g, '').replace(/\D/g, '');
                            const val = parseFloat(rawStr);
                            if (!isNaN(val) && val > 0) {
                              setFcoinBasePrice(val / amount);
                            } else if (rawStr === '') {
                              setFcoinBasePrice(0);
                            }
                          }} 
                          placeholder="Penya..." 
                          style={{ width: '220px', textAlign: 'right', fontSize: '1.1rem', fontFamily: "'JetBrains Mono', monospace", padding: '12px 16px' }} 
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="text" className="input-primary" value={marketSearch} onChange={(e) => setMarketSearch(e.target.value.toLowerCase())} placeholder="Suchen..." style={{ width: '100%', paddingLeft: '40px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={fetchMarketPrices} className="btn-ghost" style={{ padding: '8px 12px' }} title="Aktualisieren"><RefreshCw size={18} /></button>
                    <button onClick={handleAddMarketItem} className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={18} /> Neues Item</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
                  {marketItems.filter(i => i.itemName.toLowerCase().includes(marketSearch)).map(item => (
                    <div key={item.id} className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>{item.itemName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ fontSize: '1.1rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#f59e0b' }}>
                            {item.price.toLocaleString('de-DE')} Penya
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                            Aktualisiert {formatRelativeTime(item.updatedAt)} von {item.updatedByName || 'Unbekannt'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleUpdateMarketItem(item)} className="btn-ghost" style={{ padding: '6px', color: 'var(--text-muted)' }}><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteMarketItem(item.id)} className="btn-ghost" style={{ padding: '6px', color: '#ef4444' }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {marketItems.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Keine Einträge gefunden.</p>}
                </div>

                {user?.is_superadmin && (
                  <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#ef4444', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Trash2 size={18} /> Papierkorb (Nur Admins)</h3>
                    {deletedMarketItems.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Keine gelöschten Items im Papierkorb.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {deletedMarketItems.map(item => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.itemName} ({item.price.toLocaleString('de-DE')} Penya)</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gelöscht am {new Date(item.updatedAt).toLocaleDateString('de-DE')}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleRestoreMarketItem(item.id)} className="btn-ghost" style={{ padding: '6px 12px', color: '#10b981', fontSize: '0.85rem' }}>Wiederherstellen</button>
                              <button onClick={() => handleHardDeleteMarketItem(item.id)} className="btn-danger" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Permanent löschen</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {activeTab !== 'calculator' && activeTab !== 'market' && (
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><History size={20} color="var(--accent-primary)" /> Verlauf</h2>
                <button onClick={() => resetHistory(activeTab)} className="btn-ghost" style={{ color: '#ef4444', fontSize: '0.85rem' }}><Trash2 size={16} /> Leeren</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px' }}>Uhrzeit</th>
                      {activeTab === 'xp' && <th style={{ padding: '12px' }}>Lvl</th>}
                      <th style={{ padding: '12px' }}>{activeTab === 'xp' ? 'XP (%)' : 'Gold'}</th>
                      <th style={{ padding: '12px' }}>Diff</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTab === 'xp' ? xpHistory : goldHistory).map((entry, idx, arr) => {
                      let diff = 0;
                      if (idx < arr.length - 1) {
                        const prev = arr[idx + 1];
                        diff = activeTab === 'xp' ? (entry.level - prev.level) * 100 + (entry.xp - prev.xp) : entry.amount - prev.amount;
                      }
                      return (
                        <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</td>
                          {activeTab === 'xp' && <td style={{ padding: '12px', fontWeight: 600 }}>{entry.level}</td>}
                          <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace" }}>{activeTab === 'xp' ? `${entry.xp.toFixed(4)}%` : entry.amount.toLocaleString('de-DE')}</td>
                          <td style={{ padding: '12px', color: diff > 0 ? '#10b981' : (diff < 0 ? '#ef4444' : 'inherit') }}>
                            {diff !== 0 ? (activeTab === 'xp' ? `${diff > 0 ? '+' : ''}${diff.toFixed(4)}%` : `${diff > 0 ? '+' : ''}${diff.toLocaleString('de-DE')}`) : '-'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <button className="btn-ghost" style={{ color: '#ef4444' }} onClick={() => deleteEntry(entry.id, activeTab)}><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      );
                    })}
                    {(activeTab === 'xp' ? xpHistory : goldHistory).length === 0 && (
                      <tr><td colSpan={activeTab === 'xp' ? 5 : 4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Keine Einträge.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {(activeTab === 'xp' || activeTab === 'gold') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Basis</h3>
                <Calculator size={18} color="var(--accent-primary)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => setCalcMode('tick')} className={`btn-ghost ${calcMode === 'tick' ? 'active' : ''}`} style={{ justifyContent: 'flex-start', padding: '10px 14px', borderRadius: '10px' }}>Tick</button>
                <button onClick={() => setCalcMode('10')} className={`btn-ghost ${calcMode === '10' ? 'active' : ''}`} style={{ justifyContent: 'flex-start', padding: '10px 14px', borderRadius: '10px' }}>Letzte 10</button>
                <button onClick={() => setCalcMode('6h')} className={`btn-ghost ${calcMode === '6h' ? 'active' : ''}`} style={{ justifyContent: 'flex-start', padding: '10px 14px', borderRadius: '10px' }}>Session (6h)</button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-primary)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                {activeTab === 'xp' ? 'Estimated Level-Up' : 'Estimated Gold in 1h'}
              </div>
              {activeTab === 'xp' ? (
                <>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", margin: '8px 0' }}>
                    {xpStats ? formatDuration(xpStats.targetDate.getTime() - now) : '--h --m --s'}
                  </div>
                  {xpStats && (
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      <Clock size={14} style={{ marginRight: '6px' }} />
                      {xpStats.targetDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '1.85rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", margin: '8px 0', color: '#10b981' }}>
                  {goldStats ? `+${goldStats.futureHour.toLocaleString('de-DE')}` : '--'}
                </div>
              )}
            </div>

            {(activeTab === 'xp' ? [
              { label: 'XP / h', value: xpStats?.xpPerHour, color: '#ec4899', suffix: '%/h' },
              { label: 'XP / d', value: xpStats?.xpPerDay, color: '#3b82f6', suffix: '%/d' }
            ] : [
              { label: 'Gold / h', value: goldStats?.goldPerHour, color: '#10b981', suffix: '' },
              { label: 'Gold / d', value: goldStats?.goldPerDay, color: '#3b82f6', suffix: '' }
            ]).map((stat, i) => (
              <div key={i} className="glass-card" style={{ padding: '16px', borderLeft: `4px solid ${stat.color}` }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: stat.color }}>
                  {stat.value ? `${stat.value.toLocaleString('de-DE', { maximumFractionDigits: activeTab === 'xp' ? 4 : 0 })}${stat.suffix}` : '--'}
                </div>
              </div>
            ))}

            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 16px 0', fontWeight: 700, textTransform: 'uppercase' }}>Meilensteine</h3>
              {milestones.length > 0 ? milestones.map(m => (
                <div key={m.level} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700 }}>Lvl {m.level}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(m.reachedAt).toLocaleDateString('de-DE')}</span>
                </div>
              )) : <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>Keine Meilensteine.</div>}
            </div>
          </div>
        )}
      </div>

      {modalState && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'transparent', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form className="glass-card" style={{ padding: '24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--panel-bg, #1e293b)', backdropFilter: 'none' }} onSubmit={submitModal}>
            <h3 style={{ margin: 0 }}>
              {modalState.type === 'addChar' && 'Neuen Charakter hinzufügen'}
              {modalState.type === 'renameChar' && 'Charakter umbenennen'}
              {modalState.type === 'addMarketItem' && 'Neues Markt-Item eintragen'}
              {modalState.type === 'updateMarketItem' && 'Markt-Item bearbeiten'}
            </h3>
            
            {(modalState.type === 'addChar' || modalState.type === 'renameChar') && (
              <input 
                type="text" 
                className="input-primary" 
                value={modalState.nameStr || ''} 
                onChange={e => setModalState({...modalState, nameStr: e.target.value})} 
                placeholder="Name..." 
                autoFocus
                style={{ backgroundColor: 'var(--bg-main, #0f172a)' }}
              />
            )}

            {(modalState.type === 'addMarketItem' || modalState.type === 'updateMarketItem') && (
              <>
                <input 
                  type="text" 
                  className="input-primary" 
                  value={modalState.itemNameStr || ''} 
                  onChange={e => setModalState({...modalState, itemNameStr: e.target.value})} 
                  placeholder="Item Name..." 
                  autoFocus
                  style={{ backgroundColor: 'var(--bg-main, #0f172a)' }}
                />
                <input 
                  type="text" 
                  className="input-primary" 
                  value={modalState.priceStr || ''} 
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    const formatted = raw ? parseInt(raw).toLocaleString('de-DE') : '';
                    setModalState({...modalState, priceStr: formatted});
                  }} 
                  placeholder="Preis in Penya (z.B. 15.000.000)" 
                  style={{ backgroundColor: 'var(--bg-main, #0f172a)' }}
                />
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button type="button" className="btn-ghost" onClick={() => setModalState(null)}>Abbrechen</button>
              <button type="submit" className="btn-primary">Bestätigen</button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) { .leveling-grid { grid-template-columns: 1fr !important; } }
        kbd { font-family: inherit; padding: 2px 5px; font-size: 11px; color: #fff; background-color: #333; border: 1px solid #555; border-radius: 3px; }
      `}</style>
    </div>
  );
};

export default LevelingTracker;
