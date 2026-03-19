import React, { useState, useEffect, useRef } from 'react';
import { Database, Plus, Trash2, ShieldAlert, Server, Activity, Monitor, Users, Bug, Dices, History, RefreshCcw, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import EVENTS from '../socketEvents';

const Admin = ({ socket }) => {
    const navigate = useNavigate();
    const token = sessionStorage.getItem('admin_token');
    const adminTokenRef = useRef(token);

    useEffect(() => {
        adminTokenRef.current = token;
    }, [token]);

    // UI state
    const [activeTab, setActiveTab] = useState('mappings');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Data state
    const [mappings, setMappings] = useState([]);
    const [cacheStatus, setCacheStatus] = useState(null);
    const [activity, setActivity] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [errorLogs, setErrorLogs] = useState([]);
    const [betsList, setBetsList] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);

    // Action logs
    const [logs, setLogs] = useState([]);

    const addLog = (title, message, status) => {
        const id = Math.random().toString(36).substr(2, 9);
        setLogs(prev => [{ id, title, message, status, timestamp: Date.now() }, ...prev].slice(0, 50));
    };

    // Broadcast
    const [globalMessage, setGlobalMessage] = useState('');

    const handleBroadcastMessage = () => {
        if (!globalMessage.trim()) return;
        if (!window.confirm(`Are you sure you want to broadcast this message to ALL online users?\n\n"${globalMessage}"`)) return;

        socket.emit(EVENTS.ADMIN_BROADCAST_MESSAGE, { token, message: globalMessage });
        setGlobalMessage('');
        alert("Broadcast sent via websocket.");
    };

    const globalToken = localStorage.getItem('timerToken');

    // Forms
    const [originalCode, setOriginalCode] = useState('');
    const [polymarketCode, setPolymarketCode] = useState('');
    const [availableTeams, setAvailableTeams] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [esportsLastUpdated, setEsportsLastUpdated] = useState(null);

    // Friends State (hoisted for useEffect dependency array to avoid TDZ)
    const [expandedUserFriends, setExpandedUserFriends] = useState(null);
    const [userFriendsList, setUserFriendsList] = useState([]);

    const [koalaBaseline, setKoalaBaseline] = useState(100);
    const [koalaBaselineStr, setKoalaBaselineStr] = useState('1.00');
    const [koalaStartCoins, setKoalaStartCoins] = useState(0);
    const [koalaStartCoinsStr, setKoalaStartCoinsStr] = useState('0.00');
    const [koalaCoinRate, setKoalaCoinRate] = useState(0.01);
    const [koalaCoinRateStr, setKoalaCoinRateStr] = useState('0.01');
    const [koalaTransactions, setKoalaTransactions] = useState({});
    const [expandedKoalaUser, setExpandedKoalaUser] = useState(null);
    const [gameScores, setGameScores] = useState([]);
    const [koalaDailyMissionMultiplier, setKoalaDailyMissionMultiplier] = useState(1.0);
    const [koalaDailyMissionMultiplierStr, setKoalaDailyMissionMultiplierStr] = useState('1.0');
    const [koalaFlapPayoutEnabled, setKoalaFlapPayoutEnabled] = useState(true);

    useEffect(() => {
        if (!token) {
            navigate('/settings');
            return;
        }

        if (!socket) return;

        const handleMappings = (data) => { setMappings(data); setLoading(false); };
        const handleCache = (data) => { setCacheStatus(data); setLoading(false); };
        const handleActivity = (data) => { setActivity(data); setLoading(false); };
        const handleRooms = (data) => { setRooms(data); setLoading(false); };
        const handleAllTeamsData = (data) => {
            if (data && Array.isArray(data.teams)) {
                const sorted = [...data.teams].sort((a, b) => a.name.localeCompare(b.name));
                setAvailableTeams(sorted);
                setEsportsLastUpdated(data.lastUpdated);
            } else if (Array.isArray(data)) {
                const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
                setAvailableTeams(sorted);
            }
            setLoading(false);
        };

        const handleError = (msg) => {
            if (msg === 'Unauthorized admin access' || msg === 'Unauthorized') {
                sessionStorage.removeItem('admin_token');
                navigate('/settings');
            } else {
                setError(msg);
                setLoading(false);
            }
        };

        socket.on(EVENTS.ADMIN_MAPPINGS_DATA, handleMappings);
        socket.on(EVENTS.ADMIN_CACHE_DATA, handleCache);
        socket.on(EVENTS.ADMIN_ACTIVITY_DATA, handleActivity);
        socket.on(EVENTS.ADMIN_ROOMS_DATA, handleRooms);
        socket.on(EVENTS.DB_ESPORTS_TEAMS_DATA, handleAllTeamsData);
        socket.on(EVENTS.ERROR, handleError);

        socket.on('KOALA_BASELINE_DATA', ({ baseline }) => {
            if (baseline) {
                if (baseline.koala_points_per_hour !== undefined) {
                    setKoalaBaseline(baseline.koala_points_per_hour);
                    setKoalaBaselineStr((baseline.koala_points_per_hour / 100).toFixed(2));
                }
                if (baseline.koala_start_coins !== undefined) {
                    setKoalaStartCoins(baseline.koala_start_coins);
                    setKoalaStartCoinsStr((baseline.koala_start_coins / 100).toFixed(2));
                }
                if (baseline.koala_coin_conversion_rate !== undefined) {
                    setKoalaCoinRate(baseline.koala_coin_conversion_rate);
                    setKoalaCoinRateStr(baseline.koala_coin_conversion_rate.toString());
                }
                if (baseline.koala_daily_mission_multiplier !== undefined) {
                    setKoalaDailyMissionMultiplier(baseline.koala_daily_mission_multiplier);
                    setKoalaDailyMissionMultiplierStr(baseline.koala_daily_mission_multiplier.toString());
                }
                if (baseline.game_koalaflap_payout_enabled !== undefined) {
                    setKoalaFlapPayoutEnabled(baseline.game_koalaflap_payout_enabled !== 'false');
                }
            }
        });
        socket.on('KOALA_BASELINE_UPDATED', ({ success, baseline, error }) => {
            if (success) {
                if (baseline.koala_points_per_hour !== undefined) {
                    setKoalaBaseline(baseline.koala_points_per_hour);
                    setKoalaBaselineStr((baseline.koala_points_per_hour / 100).toFixed(2));
                }
                if (baseline.koala_start_coins !== undefined) {
                    setKoalaStartCoins(baseline.koala_start_coins);
                    setKoalaStartCoinsStr((baseline.koala_start_coins / 100).toFixed(2));
                }
                if (baseline.koala_coin_conversion_rate !== undefined) {
                    setKoalaCoinRate(baseline.koala_coin_conversion_rate);
                    setKoalaCoinRateStr(baseline.koala_coin_conversion_rate.toString());
                }
                if (baseline.koala_daily_mission_multiplier !== undefined) {
                    setKoalaDailyMissionMultiplier(baseline.koala_daily_mission_multiplier);
                    setKoalaDailyMissionMultiplierStr(baseline.koala_daily_mission_multiplier.toString());
                }
                if (baseline.game_koalaflap_payout_enabled !== undefined) {
                    setKoalaFlapPayoutEnabled(baseline.game_koalaflap_payout_enabled !== 'false');
                }
                addLog('Success', 'KoalaCoins baseline updated.', 'success');
            } else {
                addLog('Error', `Failed to update baseline: ${error}`, 'error');
            }
        });
        socket.on('KOALA_TRANSACTIONS_DATA', ({ userId, transactions }) => {
            setKoalaTransactions(prev => ({ ...prev, [userId]: transactions }));
        });
        socket.on('KOALA_COINS_ADJUSTED', ({ success, error }) => {
            if (success) {
                addLog('Success', 'KoalaCoins adjusted successfully.', 'success');
                // Refresh transactions for the expanded user if they are currently viewed
                if (expandedUserFriends) { // Assuming expandedUserFriends is the userId being viewed
                    socket.emit('ADMIN_GET_KOALA_TRANSACTIONS', { token: adminTokenRef.current, userId: expandedUserFriends });
                }
            } else {
                addLog('Error', `Failed to adjust coins: ${error}`, 'error');
            }
        });

        const fetchAll = () => {
            socket.emit(EVENTS.GET_ADMIN_MAPPINGS, { token });
            socket.emit(EVENTS.GET_ADMIN_CACHE, { token });
            socket.emit(EVENTS.GET_ADMIN_ACTIVITY, { token });
            socket.emit(EVENTS.GET_ADMIN_ROOMS, { token });
            socket.emit(EVENTS.GET_DB_ESPORTS_TEAMS);
            socket.emit('ADMIN_GET_KOALA_BASELINE', { token });
        };

        if (socket.connected) {
            fetchAll();
        } else {
            socket.once(EVENTS.CONNECT, fetchAll);
        }

        return () => {
            socket.off(EVENTS.ADMIN_MAPPINGS_DATA, handleMappings);
            socket.off(EVENTS.ADMIN_CACHE_DATA, handleCache);
            socket.off(EVENTS.ADMIN_ACTIVITY_DATA, handleActivity);
            socket.off(EVENTS.ADMIN_ROOMS_DATA, handleRooms);
            socket.off(EVENTS.DB_ESPORTS_TEAMS_DATA, handleAllTeamsData);
            socket.off(EVENTS.ERROR, handleError);
            socket.off('KOALA_BASELINE_DATA');
            socket.off('KOALA_BASELINE_UPDATED');
            socket.off('KOALA_TRANSACTIONS_DATA');
            socket.off('KOALA_COINS_ADJUSTED');
        };
    }, [token, navigate, socket, expandedUserFriends]); // Added expandedUserFriends to dependencies for refreshing transactions
    useEffect(() => {
        if (activeTab === 'users' && usersList.length === 0) {
            setLoading(true);
            fetch('/api/auth/users', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setUsersList(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [activeTab, globalToken, usersList.length]);

    useEffect(() => {
        if (activeTab === 'errors' && errorLogs.length === 0) {
            handleFetchErrorLogs();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'bets' && betsList.length === 0) {
            handleFetchBets();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'audit' && auditLogs.length === 0) {
            handleFetchAuditLogs();
        }
    }, [activeTab]);

    const handleFetchBets = () => {
        setLoading(true);
        fetch('/api/admin/bets', {
            headers: { 'Authorization': `Bearer ${globalToken}` }
        })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setBetsList(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    const handleFetchAuditLogs = () => {
        setLoading(true);
        fetch('/api/admin/actions', {
            headers: { 'Authorization': `Bearer ${globalToken}` }
        })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setAuditLogs(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    const handleTriggerResolver = async () => {
        if (!window.confirm("Bist du sicher, dass du den Bet Resolver erzwingen willst?")) return;
        try {
            const res = await fetch('/api/admin/bets/trigger-resolver', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            const data = await res.json();
            if (res.ok) alert(data.message);
            else alert(data.error || "Failed finding action");
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdateBetStatus = async (betId, newStatus) => {
        if (!window.confirm(`Wette auf ${newStatus} setzen? Das passt den Kontostand des Users an!`)) return;
        try {
            const res = await fetch(`/api/admin/bets/${betId}/status`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${globalToken}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (res.ok) {
                alert("Erfolgreich geupdated!");
                handleFetchBets(); // Refresh list to get accurate state
            } else {
                alert(data.error || "Error updating bet");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleFetchErrorLogs = () => {
        setLoading(true);
        fetch('/api/errors', {
            headers: { 'Authorization': `Bearer ${globalToken}` }
        })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setErrorLogs(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    const handleDeleteErrorLog = (id) => {
        fetch(`/api/errors/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${globalToken}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setErrorLogs(prev => prev.filter(log => log.id !== id));
                    addLog('Success', 'Error log deleted.', 'success');
                }
            })
            .catch(err => console.error(err));
    };

    const handleClearErrorLogs = () => {
        if (!window.confirm("Are you sure you want to CLEAR ALL error logs?")) return;
        fetch('/api/errors', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${globalToken}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setErrorLogs([]);
                    addLog('Success', 'All error logs cleared.', 'success');
                }
            })
            .catch(err => console.error(err));
    };

    // Mappings actions
    const handleAddMapping = (e) => {
        e.preventDefault();
        setError('');
        if (!originalCode || !polymarketCode) return;
        setLoading(true);
        socket.emit(EVENTS.ADD_ADMIN_MAPPING, { token, originalCode, polymarketCode });
        setOriginalCode('');
        setPolymarketCode('');
    };

    const handleDeleteMapping = (id) => {
        setLoading(true);
        socket.emit(EVENTS.DELETE_ADMIN_MAPPING, { token, id });
    };

    // Cache actions
    const handleFlushCache = (target) => {
        setLoading(true);
        socket.emit(EVENTS.FLUSH_ADMIN_CACHE, { token, target });
    };

    // User Sorting
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

    const handleSortChange = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortUsers = (users) => {
        return [...users].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (sortConfig.key === 'createdAt' || sortConfig.key === 'lastActive') {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB ? valB.toLowerCase() : '';
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const superadminUsers = sortUsers(usersList.filter(u => u.is_superadmin));
    const regularUsers = sortUsers(usersList.filter(u => !u.is_superadmin));

    // Activity actions
    const handleDeleteActivity = (id) => {
        if (window.confirm("Are you sure you want to delete this activity log?")) {
            setLoading(true);
            socket.emit(EVENTS.DELETE_ADMIN_ACTIVITY, { token, id });
        }
    };

    const handleDeleteRoom = (id) => {
        if (window.confirm("WARNING: This will delete the room and disconnect anyone inside. Proceed?")) {
            setLoading(true);
            socket.emit(EVENTS.DELETE_ADMIN_ROOM, { token, id });
        }
    };

    const handleEditRoom = (id, currentName) => {
        const newName = prompt(`Enter new name for room "${currentName}":`, currentName);
        if (newName === null) return; // cancelled

        let defaultRole = prompt(`Enter default role (read/write):`, "read");
        if (defaultRole === null) return;
        defaultRole = defaultRole.toLowerCase().trim();
        if (defaultRole !== 'read' && defaultRole !== 'write') {
            alert("Role must be 'read' or 'write'.");
            return;
        }

        setLoading(true);
        socket.emit(EVENTS.EDIT_ADMIN_ROOM, { token, id, newName, defaultRole });
    };

    const toggleSuperadmin = async (userId, currentStatus) => {
        try {
            await fetch(`/api/auth/users/${userId}/superadmin`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({ is_superadmin: !currentStatus })
            });
            setUsersList(prev => prev.map(u => u.id === userId ? { ...u, is_superadmin: !currentStatus } : u));
        } catch (err) {
            console.error(err);
        }
    };

    const handlePasswordChange = async (userId) => {
        const pwd = prompt("Enter new password for this user (min 3 chars):");
        if (!pwd || pwd.length < 3) return;

        try {
            const res = await fetch(`/api/auth/users/${userId}/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({ newPassword: pwd })
            });
            const data = await res.json();
            if (res.ok) {
                alert("Password updated successfully.");
            } else {
                alert(data.error || "Failed to update password.");
            }
        } catch (err) {
            console.error(err);
            alert("Error updating password.");
        }
    };

    const [friendsLoading, setFriendsLoading] = useState(false);

    const handleAdjustKoalaCoins = (userId, amountCents, reason) => {
        if (!amountCents || amountCents === 0) return;
        // amountCents is already in cents from the UI input
        socket.emit('ADMIN_ADJUST_KOALA_COINS', {
            token: adminTokenRef.current,
            userId,
            amountCents,
            reason
        });
        // Refresh transactions
        socket.emit('ADMIN_GET_KOALA_TRANSACTIONS', { token: adminTokenRef.current, userId });
    };

    const handleViewKoalaCoins = (userId) => {
        if (expandedKoalaUser === userId) {
            setExpandedKoalaUser(null);
            return;
        }
        setExpandedKoalaUser(userId);
        socket.emit('ADMIN_GET_KOALA_TRANSACTIONS', { token: adminTokenRef.current, userId });
    };

    const handleViewFriends = async (userId) => {
        if (expandedUserFriends === userId) {
            setExpandedUserFriends(null);
            setUserFriendsList([]);
            setKoalaTransactions(prev => {
                const newState = { ...prev };
                delete newState[userId];
                return newState;
            });
            return;
        }

        setExpandedUserFriends(userId);
        setFriendsLoading(true);
        socket.emit('ADMIN_GET_KOALA_TRANSACTIONS', { token: adminTokenRef.current, userId });

        try {
            const res = await fetch(`/api/auth/users/${userId}/friends`, {
                headers: { 'Authorization': token }
            });
            const data = await res.json();
            if (res.ok) {
                setUserFriendsList(data);
            } else {
                alert(data.error || "Failed to load friends.");
                setExpandedUserFriends(null);
            }
        } catch (err) {
            console.error(err);
            alert("Error fetching friends.");
            setExpandedUserFriends(null);
        } finally {
            setFriendsLoading(false);
        }
    };

    const handleDeleteUserAccount = async (userId, username) => {
        if (!window.confirm(`CRITICAL WARNING: Are you sure you want to completely delete "${username}" and all their associated data (Friends, Timer Events, Rooms)? This action is irreversible.`)) {
            return;
        }

        const confirmCheck = prompt("Type 'DELETE' to confirm deletion:");
        if (confirmCheck !== 'DELETE') {
            alert("Deletion cancelled.");
            return;
        }

        try {
            const res = await fetch(`/api/auth/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });

            if (res.ok) {
                alert(`User ${username} deleted successfully.`);
                setUsersList(prev => prev.filter(u => u.id !== userId));
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete user.");
            }
        } catch (err) {
            console.error('Delete user error:', err);
            alert("An error occurred while deleting the user.");
        }
    };

    const handleBanUser = async (userId, username) => {
        const reason = prompt(`Enter a reason for banning ${username} (optional):`, "Violating terms of service");
        if (reason === null) return; // User cancelled

        try {
            const res = await fetch(`/api/auth/users/${userId}/ban`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({ username, reason })
            });

            if (res.ok) {
                setUsersList(prev => prev.map(u => u.id === userId ? { ...u, is_banned: 1 } : u));
            } else {
                const data = await res.json();
                alert(data.error || "Failed to ban user.");
            }
        } catch (err) {
            console.error('Ban error:', err);
        }
    };

    const handleUnbanUser = async (userId) => {
        if (!window.confirm("Are you sure you want to unban this user?")) return;

        try {
            const res = await fetch(`/api/auth/users/${userId}/ban`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });

            if (res.ok) {
                setUsersList(prev => prev.map(u => u.id === userId ? { ...u, is_banned: 0 } : u));
            } else {
                const data = await res.json();
                alert(data.error || "Failed to unban user.");
            }
        } catch (err) {
            console.error('Unban error:', err);
        }
    };

    const handleFetchGameScores = async () => {
        try {
            const res = await axios.get('/api/admin/games/scores?gameId=koala_flap', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setGameScores(res.data);
        } catch (err) {
            console.error('Failed to fetch game scores:', err);
            addLog('Error', 'Failed to load game highscores', 'error');
        }
    };

    const handleDeleteGameScore = async (id) => {
        if (!window.confirm("Are you sure you want to delete this highscore entry?")) return;
        try {
            await axios.delete(`/api/admin/games/scores/${id}`, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setGameScores(prev => prev.filter(s => s.id !== id));
            addLog('Success', 'Game score deleted.', 'success');
        } catch (err) {
            console.error('Failed to delete score:', err);
            addLog('Error', 'Failed to delete score.', 'error');
        }
    };


    const formatDate = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        // Ensure valid date
        if (isNaN(d.getTime())) return isoStr;
        return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
    };

    const formatCacheAge = (seconds) => {
        if (seconds === null || seconds === undefined) return '-';
        if (seconds < 60) return `${seconds}s`;

        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (h > 0) {
            return `${h}h ${m}m`;
        }
        return `${m}m ${s}s`;
    };

    if (loading && mappings.length === 0 && !cacheStatus) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading Admin DB...</div>;

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 0', paddingBottom: '100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <ShieldAlert size={32} color="#ef4444" />
                <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Admin Dashboard</h1>
            </div>

            {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <ShieldAlert size={20} />
                    {error}
                </div>
            )}

            {/* Broadcast Message Card */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '32px', borderLeft: '4px solid #ef4444' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#ef4444' }}>Server Broadcast</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>Send a global alert banner to all users currently connected to the server.</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                        type="text"
                        value={globalMessage}
                        onChange={(e) => setGlobalMessage(e.target.value)}
                        placeholder="e.g. Server restarting in 5 minutes..."
                        style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white' }}
                    />
                    <button
                        className="btn-primary"
                        style={{ background: '#ef4444', color: 'white' }}
                        onClick={handleBroadcastMessage}
                        disabled={!globalMessage.trim()}
                    >
                        Send Broadcast
                    </button>
                </div>
            </div>

            {/* Admin Action Logs */}
            {logs.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                    {logs.map(log => (
                        <div key={log.id} style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: log.status === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: log.status === 'success' ? '#22c55e' : '#ef4444',
                            border: `1px solid ${log.status === 'success' ? '#22c55e' : '#ef4444'}`
                        }}>
                            {log.message}
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', overflowX: 'auto' }}>
                <button
                    className={activeTab === 'mappings' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('mappings')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Database size={16} /> Team Mappings
                </button>
                <button
                    className={activeTab === 'cache' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('cache')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Server size={16} /> API Caches
                </button>
                <button
                    className={activeTab === 'activity' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('activity')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Activity size={16} /> Activity Log
                </button>
                <button
                    className={activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('rooms')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Monitor size={16} /> Server Rooms
                </button>
                <button
                    className={activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('users')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Users size={16} /> User Management
                </button>
                <button
                    className={activeTab === 'errors' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('errors')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Bug size={16} /> Error Logs
                </button>
                <button
                    className={activeTab === 'bets' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('bets')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Dices size={16} /> Wett-Verwaltung
                </button>
                <button
                    className={activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('audit')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <History size={16} /> Audit Logs
                </button>
                <button
                    className={activeTab === 'game_scores' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => { setActiveTab('game_scores'); handleFetchGameScores(); }}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Gamepad2 size={16} /> Game Highscores
                </button>
            </div>

            {/* TAB: TEAM MAPPINGS */}
            {activeTab === 'mappings' && (
                <div className="animate-fade-in">
                    <div className="glass-card" style={{ padding: '32px', marginBottom: '32px', position: 'relative', zIndex: 100 }}>
                        <h3 style={{ marginBottom: '16px' }}>Add Team Code Mapping</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                            Map a League of Legends official team acronym to the custom acronym used by Polymarket.<br />
                            Example: Map <strong style={{ color: 'white' }}>EINS</strong> to target Polymarket code <strong style={{ color: 'white' }}>ES1</strong>.
                        </p>
                        <form onSubmit={handleAddMapping} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '200px', position: 'relative', zIndex: 50 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Official LoL Code / Team Name</label>
                                <input
                                    type="text"
                                    className="input-primary"
                                    style={{ width: '100%' }}
                                    value={originalCode}
                                    onChange={(e) => {
                                        setOriginalCode(e.target.value);
                                        setShowDropdown(true);
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                    placeholder="Search e.g. Eintracht Spandau..."
                                    required
                                    autoComplete="off"
                                />
                                {showDropdown && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                        background: '#1a1b26', border: '1px solid var(--border-color)', borderRadius: '8px',
                                        maxHeight: '220px', overflowY: 'auto', marginTop: '4px', boxShadow: '0 8px 16px rgba(0,0,0,0.6)'
                                    }}>
                                        {availableTeams
                                            .filter(t => t.name.toLowerCase().includes(originalCode.toLowerCase()) || t.code.toLowerCase().includes(originalCode.toLowerCase()))
                                            .map(team => (
                                                <div
                                                    key={team.code}
                                                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                    onClick={() => {
                                                        setOriginalCode(team.code);
                                                        setShowDropdown(false);
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.08)'}
                                                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {team.image && <img src={team.image} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />}
                                                        <span style={{ color: 'white' }}>{team.name}</span>
                                                    </div>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>{team.code}</span>
                                                </div>
                                            ))}
                                        {availableTeams.filter(t => t.name.toLowerCase().includes(originalCode.toLowerCase()) || t.code.toLowerCase().includes(originalCode.toLowerCase())).length === 0 && (
                                            <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                                                {availableTeams.length === 0 ? "Loading teams from schedule..." : "No matching teams found."}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Polymarket Code (e.g. ES1)</label>
                                <input type="text" className="input-primary" value={polymarketCode} onChange={(e) => setPolymarketCode(e.target.value)} placeholder="ES1" required />
                            </div>
                            <button type="submit" className="btn-primary" style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plus size={18} /> Add Mapping
                            </button>
                        </form>
                    </div>

                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0 }}>Active Mappings</h3>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{mappings.length} Custom Overrides</span>
                        </div>
                        {mappings.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>No mappings added yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {mappings.map(map => (
                                    <div key={map.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>LoL API Code</div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{map.originalCode}</div>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)' }}>→</div>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Polymarket Code</div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{map.polymarketCode}</div>
                                            </div>
                                        </div>
                                        <button className="btn-ghost" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px' }} onClick={() => handleDeleteMapping(map.id)} title="Delete Mapping">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: CACHE STATUS */}
            {activeTab === 'cache' && cacheStatus && (
                <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0 }}>Polymarket API</h3>
                            <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', background: cacheStatus.polymarket.isCached ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: cacheStatus.polymarket.isCached ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                                {cacheStatus.polymarket.isCached ? 'CACHED' : 'EMPTY'}
                            </span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Items fetched:</span>
                                <strong>{cacheStatus.polymarket.items} odds</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Cache age:</span>
                                <strong>{formatCacheAge(cacheStatus.polymarket.ageSeconds)}</strong>
                            </div>
                        </div>
                        <button className="btn-secondary" onClick={() => handleFlushCache('polymarket')} style={{ marginTop: 'auto', padding: '12px' }}>Clear Polymarket Cache</button>
                    </div>

                    <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0 }}>The Odds API</h3>
                            <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', background: cacheStatus.oddsApi.isCached ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: cacheStatus.oddsApi.isCached ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                                {cacheStatus.oddsApi.isCached ? 'CACHED' : 'EMPTY'}
                            </span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Items fetched:</span>
                                <strong>{cacheStatus.oddsApi.items} events</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Cache age:</span>
                                <strong>{formatCacheAge(cacheStatus.oddsApi.ageSeconds)}</strong>
                            </div>
                        </div>
                        <button className="btn-secondary" onClick={() => handleFlushCache('oddsapi')} style={{ marginTop: 'auto', padding: '12px' }}>Clear The Odds API Cache</button>
                    </div>

                    <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0 }}>Esports Teams DB</h3>
                            <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', background: availableTeams.length > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: availableTeams.length > 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                                {availableTeams.length > 0 ? 'POPULATED' : 'EMPTY'}
                            </span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Teams cached in DB:</span>
                                <strong>{availableTeams.length} teams</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Last updated:</span>
                                <strong>{esportsLastUpdated ? new Date(esportsLastUpdated).toLocaleString() : 'Never'}</strong>
                            </div>
                        </div>
                        <button className="btn-secondary" onClick={() => { setLoading(true); socket.emit(EVENTS.TRIGGER_FETCH_ALL_TEAMS, { token }); }} style={{ marginTop: 'auto', padding: '12px' }}>Fetch All Esports Teams</button>
                    </div>

                    <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0 }}>LoLEsports Schedule</h3>
                            <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', background: cacheStatus.loleSports.isCached ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: cacheStatus.loleSports.isCached ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                                {cacheStatus.loleSports.isCached ? 'CACHED' : 'EMPTY'}
                            </span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Matches cached:</span>
                                <strong>{cacheStatus.loleSports.items} matches</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Cache age:</span>
                                <strong>{formatCacheAge(cacheStatus.loleSports.ageSeconds)}</strong>
                            </div>
                        </div>
                        <button className="btn-secondary" onClick={() => handleFlushCache('lolesports')} style={{ marginTop: 'auto', padding: '12px' }}>Flush Schedule Cache</button>
                    </div>

                    <button className="btn-primary" onClick={() => handleFlushCache('all')} style={{ gridColumn: '1 / -1', background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderColor: '#ef4444' }}>Purge All Server Caches</button>
                </div>
            )}

            {/* TAB: ACTIVITY LOG */}
            {activeTab === 'activity' && (
                <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
                    <h3 style={{ marginBottom: '24px' }}>Global Timer Completions ({activity.length})</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Completed At</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>User Name</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Room Name</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Duration</th>
                                    <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activity.map(row => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px' }}>{formatDate(row.completedAt)}</td>
                                        <td style={{ padding: '12px', color: 'var(--accent-primary)' }}>{row.userName || 'Anonymous'}</td>
                                        <td style={{ padding: '12px' }}>{row.roomName || 'Unknown Room'}</td>
                                        <td style={{ padding: '12px' }}>{row.defaultDurationMinutes} min</td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <button className="btn-ghost" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => handleDeleteActivity(row.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {activity.length === 0 && (
                                    <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No completed timers yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: ROOMS OVERVIEW */}
            {activeTab === 'rooms' && (
                <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
                    <h3 style={{ marginBottom: '24px' }}>Server Rooms ({rooms.length})</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Created</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Room Name</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Active Users</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Owner</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Vis</th>
                                    <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rooms.map(row => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px' }}>{formatDate(row.createdAt)}</td>
                                        <td style={{ padding: '12px', fontWeight: 600 }}>{row.name}</td>
                                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.activeUsers > 0 ? '#10b981' : '#ef4444' }} />
                                                {row.activeUsers} Users
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', color: 'var(--accent-primary)' }}>{row.ownerName || 'Public'}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, background: row.isPublic ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: row.isPublic ? '#22c55e' : '#ef4444' }}>
                                                {row.isPublic ? 'Public' : 'Private'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => handleEditRoom(row.id, row.name)}>Edit</button>
                                            <button className="btn-ghost" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => handleDeleteRoom(row.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {rooms.length === 0 && (
                                    <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No active rooms in memory.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: USER MANAGEMENT */}
            {activeTab === 'users' && (
                <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                        <h3 style={{ margin: 0 }}>Registered Users ({usersList.length})</h3>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sort by:</span>
                            {['username', 'createdAt', 'lastActive'].map(key => (
                                <button
                                    key={key}
                                    className={sortConfig.key === key ? 'btn-primary' : 'btn-ghost'}
                                    style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', background: sortConfig.key === key ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)' }}
                                    onClick={() => handleSortChange(key)}
                                >
                                    {key === 'username' ? 'Name' : key === 'createdAt' ? 'Joined' : 'Last Active'}
                                    {sortConfig.key === key && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {[
                        { title: 'Superadmins', count: superadminUsers.length, list: superadminUsers, color: 'var(--accent-primary)' },
                        { title: 'Regular Users', count: regularUsers.length, list: regularUsers, color: 'var(--text-muted)' }
                    ].map(section => (
                        <div key={section.title} style={{ marginBottom: '32px' }}>
                            <h4 style={{ marginBottom: '16px', color: section.color, borderBottom: `1px solid ${section.color}40`, paddingBottom: '8px' }}>
                                {section.title} ({section.count})
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {section.list.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No users found in this category.</div>
                                ) : section.list.map(u => (
                                    <div key={u.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: u.is_banned ? '1px solid #ef4444' : '1px solid var(--border-color)', opacity: u.is_banned ? 0.7 : 1 }}>
                                        <div style={{ flex: '1 1 250px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ textDecoration: u.is_banned ? 'line-through' : 'none' }}>{u.username}</span>
                                                {u.is_banned ? <span style={{ fontSize: '0.65rem', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Banned</span> : null}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Display Name: {u.displayName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                <span>Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                                                <span>Last Active: {u.lastActive ? new Date(u.lastActive).toLocaleString() : 'Never'}</span>
                                                <span style={{ color: '#fbbf24', fontWeight: 600 }}>KoalaCoins: {((u.koala_balance || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <button
                                                className="btn-ghost"
                                                style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)' }}
                                                onClick={() => handleViewFriends(u.id)}
                                            >
                                                {expandedUserFriends === u.id ? 'Hide Friends' : 'See Friends'}
                                            </button>
                                            <button
                                                className="btn-ghost"
                                                style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
                                                onClick={() => handleViewKoalaCoins(u.id)}
                                            >
                                                {expandedKoalaUser === u.id ? '⬆ KoalaCoins' : '💰 KoalaCoins'}
                                            </button>
                                            <button
                                                className={u.is_superadmin ? 'btn-primary' : 'btn-ghost'}
                                                style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '8px', background: u.is_superadmin ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)' }}
                                                onClick={() => toggleSuperadmin(u.id, u.is_superadmin)}
                                            >
                                                {u.is_superadmin ? 'Superadmin' : 'Make Superadmin'}
                                            </button>
                                            <button
                                                className="btn-secondary"
                                                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                                onClick={() => handlePasswordChange(u.id)}
                                            >
                                                Change Password
                                            </button>
                                            {u.is_banned ? (
                                                <button
                                                    className="btn-primary"
                                                    style={{ padding: '8px 16px', fontSize: '0.85rem', background: '#3b82f6', color: 'white' }}
                                                    onClick={() => handleUnbanUser(u.id)}
                                                >
                                                    Unban
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn-ghost"
                                                    style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}
                                                    onClick={() => handleBanUser(u.id, u.username)}
                                                >
                                                    Ban
                                                </button>
                                            )}
                                            <button
                                                className="btn-ghost"
                                                style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
                                                onClick={() => handleDeleteUserAccount(u.id, u.username)}
                                            >
                                                Delete
                                            </button>
                                        </div>

                                        {/* Expandable KoalaCoins Panel */}
                                        {expandedKoalaUser === u.id && (
                                            <div style={{ width: '100%', marginTop: '12px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '4px solid #fbbf24' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#fbbf24' }}>💰 KoalaCoins: {((u.koala_balance || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                                    <input
                                                        id={`koala-reason-${u.id}`}
                                                        placeholder="Reason (e.g. Bonus)"
                                                        style={{ flex: 1, minWidth: '150px', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.8rem' }}
                                                    />
                                                    <input
                                                        id={`koala-amount-${u.id}`}
                                                        type="number"
                                                        placeholder="Cents (e.g. 500 = 5.00)"
                                                        style={{ width: '170px', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.8rem' }}
                                                    />
                                                    <button className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem', background: '#22c55e' }} onClick={() => {
                                                        const amt = parseInt(document.getElementById(`koala-amount-${u.id}`).value) || 0;
                                                        const reason = document.getElementById(`koala-reason-${u.id}`).value || 'Admin adjustment';
                                                        handleAdjustKoalaCoins(u.id, Math.abs(amt), reason);
                                                    }}>+ Add</button>
                                                    <button className="btn-ghost" style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }} onClick={() => {
                                                        const amt = parseInt(document.getElementById(`koala-amount-${u.id}`).value) || 0;
                                                        const reason = document.getElementById(`koala-reason-${u.id}`).value || 'Admin adjustment';
                                                        handleAdjustKoalaCoins(u.id, -Math.abs(amt), reason);
                                                    }}>- Remove</button>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Last 5 transactions:</div>
                                                {(koalaTransactions[u.id] || []).length === 0 ? (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No transactions yet.</div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {(koalaTransactions[u.id] || []).map(tx => (
                                                            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', fontSize: '0.8rem' }}>
                                                                <span style={{ color: 'var(--text-muted)' }}>{new Date(tx.created_at).toLocaleString()} — {tx.reason}</span>
                                                                <span style={{ color: tx.amount >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700, marginLeft: '12px', flexShrink: 0 }}>{tx.amount >= 0 ? '+' : ''}{(tx.amount / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Expandable Friends List */}
                                        {expandedUserFriends === u.id && (
                                            <div style={{ width: '100%', marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '4px solid var(--accent-primary)' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>Friends of {u.displayName}</h4>
                                                {friendsLoading ? (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading friends...</div>
                                                ) : userFriendsList.length === 0 ? (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>This user has no friends.</div>
                                                ) : (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                                                        {userFriendsList.map(f => (
                                                            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                                                                <div>
                                                                    <div style={{ fontWeight: 600 }}>{f.displayName}</div>
                                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>@{f.username}</div>
                                                                </div>
                                                                <span style={{
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.65rem',
                                                                    textTransform: 'uppercase',
                                                                    background: f.status === 'accepted' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                                                    color: f.status === 'accepted' ? '#22c55e' : '#f59e0b'
                                                                }}>
                                                                    {f.status}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* KoalaCoins Config inside Users tab */}
                    <div className="glass-card animate-fade-in" style={{ padding: '32px', marginTop: '32px', border: '1px solid rgba(251,191,36,0.3)' }}>
                        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                            💰 KoalaCoins Global Configuration
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                            Both values are stored in cents (1/100th of a coin). e.g. 10000 = 100.00 Coins.
                            Baseline rate = coins per 1 hour of active timer time.
                        </p>

                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '200px', maxWidth: '250px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Baseline Rate (Coins / Hour)</label>
                                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '8px' }}>Stored in DB as {koalaBaseline} Cents</div>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input-primary"
                                    style={{ width: '100%' }}
                                    value={koalaBaselineStr}
                                    onChange={(e) => {
                                        setKoalaBaselineStr(e.target.value);
                                        const parsed = parseFloat(e.target.value);
                                        if (!isNaN(parsed)) setKoalaBaseline(Math.round(parsed * 100));
                                    }}
                                    min="0"
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px', maxWidth: '250px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Start Balance (Coins)</label>
                                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '8px' }}>Stored in DB as {koalaStartCoins} Cents</div>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input-primary"
                                    style={{ width: '100%' }}
                                    value={koalaStartCoinsStr}
                                    onChange={(e) => {
                                        setKoalaStartCoinsStr(e.target.value);
                                        const parsed = parseFloat(e.target.value);
                                        if (!isNaN(parsed)) setKoalaStartCoins(Math.round(parsed * 100));
                                    }}
                                    min="0"
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px', maxWidth: '180px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Game Coin Rate</label>
                                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '8px' }}>Val: {koalaCoinRate} / Coin</div>
                                <input
                                    type="number"
                                    step="0.001"
                                    className="input-primary"
                                    style={{ width: '100%' }}
                                    value={koalaCoinRateStr}
                                    onChange={(e) => {
                                        setKoalaCoinRateStr(e.target.value);
                                        const parsed = parseFloat(e.target.value);
                                        if (!isNaN(parsed)) setKoalaCoinRate(parsed);
                                    }}
                                    min="0"
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px', maxWidth: '180px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Mission Multiplier (x Baseline)</label>
                                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '8px' }}>Val: {koalaDailyMissionMultiplierStr}x</div>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="input-primary"
                                    style={{ width: '100%' }}
                                    value={koalaDailyMissionMultiplierStr}
                                    onChange={(e) => {
                                        setKoalaDailyMissionMultiplierStr(e.target.value);
                                        const parsed = parseFloat(e.target.value);
                                        if (!isNaN(parsed)) setKoalaDailyMissionMultiplier(parsed);
                                    }}
                                    min="0"
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '200px', maxWidth: '180px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Minigame Payouts</label>
                                <div style={{ fontSize: '0.75rem', color: koalaFlapPayoutEnabled ? '#22c55e' : '#ef4444', marginBottom: '8px' }}>{koalaFlapPayoutEnabled ? 'ENABLED' : 'DISABLED'}</div>
                                <button 
                                    className={`btn-${koalaFlapPayoutEnabled ? 'primary' : 'secondary'}`}
                                    style={{ width: '100%', padding: '10px 0', border: '1px solid var(--border-color)', color: koalaFlapPayoutEnabled ? 'white' : 'var(--text-muted)' }}
                                    onClick={() => setKoalaFlapPayoutEnabled(!koalaFlapPayoutEnabled)}
                                >
                                    {koalaFlapPayoutEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            <button className="btn-primary" style={{ padding: '10px 24px', whiteSpace: 'nowrap' }} onClick={() => socket.emit('ADMIN_UPDATE_KOALA_BASELINE', { token: adminTokenRef.current, baseline: { koala_points_per_hour: koalaBaseline, koala_start_coins: koalaStartCoins, koala_coin_conversion_rate: koalaCoinRate, koala_daily_mission_multiplier: koalaDailyMissionMultiplier, game_koalaflap_payout_enabled: koalaFlapPayoutEnabled.toString() } })}>
                                Save Configuration
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: ERROR LOGS */}
            {activeTab === 'errors' && (
                <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ margin: 0 }}>Server Error Logs ({errorLogs.length})</h3>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn-secondary" onClick={handleFetchErrorLogs}>Refresh</button>
                            <button className="btn-ghost" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }} onClick={handleClearErrorLogs}>
                                Clear All Logs
                            </button>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Timestamp</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Error</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Context</th>
                                    <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {errorLogs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '4px' }}>{log.message}</div>
                                            {log.stack && (
                                                <details style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    <summary style={{ cursor: 'pointer' }}>Show Stack</summary>
                                                    <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '8px', marginTop: '4px', borderRadius: '4px' }}>
                                                        {log.stack}
                                                    </pre>
                                                </details>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.context}</td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <button className="btn-ghost" style={{ color: '#ef4444' }} onClick={() => handleDeleteErrorLog(log.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {errorLogs.length === 0 && (
                                    <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No error logs found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: BETS (WETT-VERWALTUNG) */}
            {activeTab === 'bets' && (
                <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Dices size={24} color="#fbbf24" />
                                Wett-Verwaltung ({betsList.length})
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px', maxWidth: '600px' }}>
                                Hier kannst du alle getätigten Wetten einsehen, und bei Bedarf manuell das Ergebnis überschreiben. 
                                Das Ändern eines Status korrigiert den Kontostand des Users automatisch.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn-secondary" onClick={handleFetchBets}>Aktualisieren</button>
                            <button className="btn-primary" style={{ background: '#a855f7', color: 'white' }} onClick={handleTriggerResolver}>
                                Resolver manuell starten
                            </button>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>User</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Match / Team</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Stake / Odds</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Status</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Date</th>
                                    <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {betsList.map(bet => {
                                    let statusColor = '#9ca3af';
                                    let statusBg = 'rgba(255,255,255,0.05)';
                                    let statusLabel = 'Offen';
                                    if (bet.status === 'won') {
                                        statusColor = '#22c55e';
                                        statusBg = 'rgba(34,197,94,0.1)';
                                        statusLabel = 'Gewonnen';
                                    } else if (bet.status === 'lost') {
                                        statusColor = '#ef4444';
                                        statusBg = 'rgba(239,68,68,0.1)';
                                        statusLabel = 'Verloren';
                                    } else if (bet.status === 'canceled') {
                                        statusColor = '#fbbf24';
                                        statusBg = 'rgba(251,191,36,0.1)';
                                        statusLabel = 'Storniert';
                                    }

                                    return (
                                        <tr key={bet.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ fontWeight: 600 }}>{bet.userName || 'Unknown'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {bet.userId}</div>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ fontWeight: 600 }}>{bet.chosenTeam}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bet.matchName}</div>
                                                {bet.polymarketTeam && <div style={{ fontSize: '0.7rem', color: '#a855f7' }}>Exact: {bet.polymarketTeam}</div>}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontWeight: 600, color: '#22c55e' }}>{bet.stake}</span>
                                                    <span style={{ color: 'var(--text-muted)' }}>@</span>
                                                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>{bet.odds.toFixed(2)}</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                    Payout: <span style={{ color: '#fbbf24' }}>{Math.floor(bet.stake * bet.odds)}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                                    color: statusColor, background: statusBg, border: `1px solid ${statusColor}40`
                                                }}>
                                                    {statusLabel}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{formatDate(bet.createdAt)}</td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    {bet.status !== 'open' && (
                                                        <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => handleUpdateBetStatus(bet.id, 'open')} title="Revert to Open">
                                                            Zurücksetzen
                                                        </button>
                                                    )}
                                                    {bet.status !== 'won' && (
                                                        <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }} onClick={() => handleUpdateBetStatus(bet.id, 'won')} title="Mark as Won">
                                                            Gewonnen
                                                        </button>
                                                    )}
                                                    {bet.status !== 'lost' && (
                                                        <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }} onClick={() => handleUpdateBetStatus(bet.id, 'lost')} title="Mark as Lost">
                                                            Verloren
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {betsList.length === 0 && (
                                    <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Keine Wetten gefunden.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* TAB: AUDIT LOGS */}
            {activeTab === 'audit' && (
                <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <History size={24} color="var(--accent-primary)" />
                            Admin Audit Logs ({auditLogs.length})
                        </h3>
                        <button className="btn-secondary" onClick={handleFetchAuditLogs}>
                            <RefreshCcw size={16} style={{ marginRight: '8px' }} /> Refresh
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Timestamp</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Admin</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Action</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent-primary)' }}>{log.adminName}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ 
                                                padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)'
                                            }}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {typeof log.details === 'string' && log.details.startsWith('{') ? (
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                                    {JSON.stringify(JSON.parse(log.details), null, 2)}
                                                </pre>
                                            ) : (
                                                log.details
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {auditLogs.length === 0 && (
                                    <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: GAME HIGHSCORES */}
            {activeTab === 'game_scores' && (
                <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Gamepad2 size={24} color="var(--accent-primary)" />
                            Game Highscores (KoalaFlap)
                        </h3>
                        <button className="btn-secondary" onClick={handleFetchGameScores}>Refresh</button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>User</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Score (Pipes)</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Coins Earned</th>
                                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Date</th>
                                    <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gameScores.map(gs => (
                                    <tr key={gs.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 600 }}>{gs.displayName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{gs.username}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 700, color: 'var(--accent-primary)' }}>{gs.score}</td>
                                        <td style={{ padding: '12px' }}>{(gs.coinsEarned / 100).toFixed(2)} K</td>
                                        <td style={{ padding: '12px' }}>{formatDate(gs.createdAt)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <button className="btn-ghost" style={{ color: '#ef4444' }} onClick={() => handleDeleteGameScore(gs.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {gameScores.length === 0 && (
                                    <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No game scores found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Admin;
