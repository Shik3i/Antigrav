import React, { useState, useEffect, useRef } from 'react';
import { Database, Plus, Trash2, Save, ShieldAlert, Server, Activity, Monitor, Users, Bug, Dices, History, RefreshCcw, Gamepad2, TrendingUp, LayoutDashboard, ChevronUp, ChevronDown, Rss } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import EVENTS from '../../socketEvents.json';
import { useAuth } from '../context/AuthContext';
import ApiCachesTab from '../components/admin/ApiCachesTab';
import ActivityLogTab from '../components/admin/ActivityLogTab';
import ServerRoomsTab from '../components/admin/ServerRoomsTab';
import UserManagementTab from '../components/admin/UserManagementTab';
import TeamMappingsTab from '../components/admin/TeamMappingsTab';
import ErrorLogsTab from '../components/admin/ErrorLogsTab';
import SystemLogsTab from '../components/admin/SystemLogsTab';
import BetsManagementTab from '../components/admin/BetsManagementTab';
import AuditLogsTab from '../components/admin/AuditLogsTab';
import GameHighscoresTab from '../components/admin/GameHighscoresTab';
import ScratchcardPacksTab from '../components/admin/ScratchcardPacksTab';

const POKEMON_TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

const Admin = ({ socket }) => {
    const navigate = useNavigate();
    const { token: authToken, user } = useAuth();
    const sessionToken = sessionStorage.getItem('admin_token');
    const activeToken = (user?.is_superadmin ? authToken : null) || sessionToken;
    


    const adminTokenRef = useRef(activeToken);

    useEffect(() => {
        adminTokenRef.current = activeToken;
    }, [activeToken]);

    // UI state
    const [activeTab, setActiveTab] = useState('mappings');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [collapsedSections, setCollapsedSections] = useState({
        'Superadmins': false,
        'Regular Users': false,
        '👻 Ghost / Guest Accounts': true
    });

    // Data state
    const [mappings, setMappings] = useState([]);
    const [cacheStatus, setCacheStatus] = useState(null);
    const [activity, setActivity] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [errorLogs, setErrorLogs] = useState([]);
    const [betsList, setBetsList] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [scratchcardPacks, setScratchcardPacks] = useState([]);
    const [isEditingPack, setIsEditingPack] = useState(null); // id or 'new'
    const [packForm, setPackForm] = useState({
        name: '', region_label: '', scope: 'Regional', price: 1000, 
        win_chance: 0.25, reward_amount: 5000, is_weighted: false, 
        max_daily_limit: 0, is_active: true, is_special: false
    });
    const [packTeams, setPackTeams] = useState([]); // List of team codes for the current pack
    const [globalMessage, setGlobalMessage] = useState('');
    const [navbarSettings, setNavbarSettings] = useState([]);
    const [logs, setLogs] = useState([]);
    const [systemLogs, setSystemLogs] = useState([]); // [NEW]
    const [pokemonConfigs, setPokemonConfigs] = useState({ settings: { contrast_threshold: '0.6' }, colors: {} });
    const [polymarketSettings, setPolymarketSettings] = useState({ allowUsersToAdd: false });
    const [rssFeeds, setRssFeeds] = useState([]);
    const [rssArticles, setRssArticles] = useState([]);
    const [rssStats, setRssStats] = useState([]);
    const [refreshingRss, setRefreshingRss] = useState(false);
    const [newNavbarItem, setNewNavbarItem] = useState({ key: '', label: '', path: '', category: 'Tools', icon: '' });
    const [wordleDictionary, setWordleDictionary] = useState([]);
    const [wordleSearch, setWordleSearch] = useState('');
    const [wordleFilterNoDef, setWordleFilterNoDef] = useState(false);
    const [wordleFilterNoQuote, setWordleFilterNoQuote] = useState(false);
    const [wordleFilterUsed, setWordleFilterUsed] = useState(false);
    const [wordleFilterUnused, setWordleFilterUnused] = useState(false);
    const [bulkMetadataInput, setBulkMetadataInput] = useState('');
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [showWordleImportExport, setShowWordleImportExport] = useState(false);
    const [editingWordId, setEditingWordId] = useState(null);
    const [editWordDef, setEditWordDef] = useState('');
    const [editWordQuote, setEditWordQuote] = useState('');

    // --- Daily Fortune Cookie ---
    const [fortunesDictionary, setFortunesDictionary] = useState([]);
    const [fortunesBulkInput, setFortunesBulkInput] = useState('');
    const [isImportingFortunes, setIsImportingFortunes] = useState(false);
    const [fortuneSearch, setFortuneSearch] = useState('');
    const [fortuneFilterUsed, setFortuneFilterUsed] = useState(false);
    const [fortuneFilterUnused, setFortuneFilterUnused] = useState(false);
    const [fortuneDisplayLimit, setFortuneDisplayLimit] = useState(50);

    const handleFetchNavbarSettings = async () => {
    
        try {
            const res = await axios.get('/api/admin/navbar-settings', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setNavbarSettings(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            // Error logged silently or handled by UI
        }

    };

    const handleSaveNavbarSettings = async () => {
        try {
            // Normalize sort orders before saving to ensure sequential numbers (1, 2, 3...)
            const normalizedSettings = navbarSettings.map((item, index) => ({
                ...item,
                sortOrder: index + 1
            }));

            await axios.post('/api/admin/navbar-settings', { settings: normalizedSettings }, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            
            // Update local state with normalized values to keep UI in sync
            setNavbarSettings(normalizedSettings);
            addLog('Success', 'Navbar settings saved and normalized.', 'success');
        } catch (err) {
            console.error('[Admin API Debug] Save failed for Navbar Settings:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
            addLog('Error', 'Failed to save navbar settings.', 'error');
        }
    };

    const handleFetchPokemonConfigs = async () => {
    
        try {
            const res = await axios.get('/api/admin/pokemon-configs', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setPokemonConfigs(res.data);
        } catch (err) {
            // Error handled by UI
        }

    };

    const handleFetchPolymarketSettings = async () => {
        try {
            const res = await axios.get('/api/admin/polymarket/settings', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setPolymarketSettings(res.data);
        } catch (err) {
            console.error('[Admin API Debug] Request failed for Polymarket Settings:', err);
        }
    };

    const handleTogglePolymarketAdd = async () => {
        try {
            const newValue = !polymarketSettings.allowUsersToAdd;
            await axios.put('/api/admin/polymarket/settings', { allowUsersToAdd: newValue }, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setPolymarketSettings({ allowUsersToAdd: newValue });
            addLog('Success', `Polymarket permissions updated: Users can ${newValue ? 'now' : 'no longer'} add bets.`, 'success');
        } catch (err) {
            console.error('[Admin API Debug] Update failed for Polymarket Settings:', err);
            addLog('Error', 'Failed to update Polymarket permissions.', 'error');
        }
    };

    const handleSavePokemonConfigs = async () => {
    
        try {
            await axios.post('/api/admin/pokemon-configs/update', pokemonConfigs, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', 'Pokémon configurations saved.', 'success');
        } catch (err) {
            console.error('[Admin API Debug] Save failed for Pokemon Configs:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
            addLog('Error', 'Failed to save Pokémon configurations.', 'error');
        }
    };

    const handleFetchPacks = async () => {
    
        try {
            const res = await axios.get('/api/admin/scratchcards/packs', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setScratchcardPacks(res.data);
        } catch (err) {
            console.error('[Admin API Debug] Request failed for Scratchcard Packs:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
        }
    };

    const handleSavePack = async () => {
    
        try {
            const payload = {
                pack: {
                    ...packForm,
                    price: parseInt(packForm.price),
                    win_chance: parseFloat(packForm.win_chance) / 100,
                    reward_amount: parseInt(packForm.reward_amount),
                    is_weighted: !!packForm.is_weighted,
                    max_daily_limit: parseInt(packForm.max_daily_limit) || 0,
                    is_active: !!packForm.is_active,
                    is_special: !!packForm.is_special
                },
                teams: packTeams
            };

            if (isEditingPack === 'new') {
                await axios.post('/api/admin/scratchcards/packs', payload, {
                    headers: { 'Authorization': `Bearer ${globalToken}` }
                });
                addLog('Success', 'Scratchcard pack created.', 'success');
            } else {
                await axios.put(`/api/admin/scratchcards/packs/${isEditingPack}`, payload, {
                    headers: { 'Authorization': `Bearer ${globalToken}` }
                });
                addLog('Success', 'Scratchcard pack updated.', 'success');
            }
            setIsEditingPack(null);
            handleFetchPacks();
        } catch (err) {
            console.error('[Admin API Debug] Save failed for Scratchcard Pack:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
            addLog('Error', 'Failed to save pack.', 'error');
        }
    };

    const handleDeletePack = async (id) => {
        if (!window.confirm("Are you sure you want to delete this pack?")) return;
    
        try {
            await axios.delete(`/api/admin/scratchcards/packs/${id}`, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', 'Pack deleted.', 'success');
            handleFetchPacks();
        } catch (err) {
            // Quiet fail
        }

    };

    const handleFetchRssFeeds = async () => {
        try {
            const res = await axios.get('/api/admin/rss/feeds', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setRssFeeds(Array.isArray(res.data) ? res.data : []);
            
            // Trigger fetch for stats and articles as well
            handleFetchRssStats();
            handleFetchRssArticles();
        } catch (err) {
            console.error('[Admin RSS] Fetch failed:', err);
        }
    };

    const handleFetchRssStats = async () => {
        try {
            const res = await axios.get('/api/admin/rss/stats', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setRssStats(res.data);
        } catch (err) {
            console.error('[Admin RSS] Failed to fetch stats:', err);
        }
    };

    const handleFetchRssArticles = async () => {
        try {
            const res = await axios.get('/api/admin/rss/articles?limit=50', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setRssArticles(res.data);
        } catch (err) {
            console.error('[Admin RSS] Failed to fetch articles:', err);
        }
    };

    const handleDeleteRssArticle = async (id) => {
        try {
            await axios.delete(`/api/admin/rss/articles/${id}`, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            handleFetchRssArticles();
            handleFetchRssStats();
        } catch (err) {
            addLog('Error', 'Failed to delete article.', 'error');
        }
    };

    const handlePurgeRssCache = async (hours = 0) => {
        const msg = hours > 0 ? `Wirklich alle Artikel löschen, die älter als ${hours} Stunden sind?` : "Wirklich den gesamten RSS-Artikel-Cache leeren?";
        if (!window.confirm(msg)) return;
        
        try {
            await axios.post('/api/admin/rss/purge', { hours }, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', 'RSS Cache gepurged.', 'success');
            handleFetchRssArticles();
            handleFetchRssStats();
        } catch (err) {
            addLog('Error', 'Purge failed.', 'error');
        }
    };

    const handleManualRssRefresh = async () => {
        setRefreshingRss(true);
        try {
            const res = await axios.post('/api/admin/rss/refresh', {}, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            const { stats } = res.data;
            addLog('Success', `RSS Refresh abgeschlossen: ${stats.success} erfolgreich, ${stats.failed} fehlgeschlagen.`, 'success');
            handleFetchRssArticles();
            handleFetchRssStats();
        } catch (err) {
            addLog('Error', 'Manual refresh failed.', 'error');
        } finally {
            setRefreshingRss(false);
        }
    };

    const handleAddRssFeed = async (name, url, icon) => {
        try {
            await axios.post('/api/admin/rss/feeds', { name, url, icon }, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', `RSS Feed "${name}" hinzugefügt.`, 'success');
            handleFetchRssFeeds();
        } catch (err) {
            addLog('Error', 'Fehler beim Hinzufügen des Feeds.', 'error');
        }
    };

    const handleUpdateRssFeed = async (id, name, url, icon) => {
        try {
            await axios.put(`/api/admin/rss/feeds/${id}`, { name, url, icon }, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', `RSS Feed updated.`, 'success');
            handleFetchRssFeeds();
        } catch (err) {
            addLog('Error', 'Fehler beim Updaten des Feeds.', 'error');
        }
    };

    const handleDeleteRssFeed = async (id) => {
        if (!window.confirm("Feed wirklich löschen?")) return;
        try {
            await axios.delete(`/api/admin/rss/feeds/${id}`, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', 'RSS Feed gelöscht.', 'success');
            handleFetchRssFeeds();
        } catch (err) {
            addLog('Error', 'Fehler beim Löschen des Feeds.', 'error');
        }
    };

    const handleEditPack = async (id) => {
    
        try {
            const res = await axios.get(`/api/admin/scratchcards/packs/${id}`, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            const { pack, teams } = res.data;
            setPackForm({
                name: pack.name,
                region_label: pack.region_label || '',
                scope: pack.scope,
                price: pack.price,
                win_chance: (pack.win_chance * 100).toString(),
                reward_amount: pack.reward_amount || 0,
                is_weighted: !!pack.is_weighted,
                max_daily_limit: pack.max_daily_limit || 0,
                is_active: !!pack.is_active,
                is_special: !!pack.is_special
            });
            setPackTeams(teams.map(t => t.team_code));
            setIsEditingPack(id);
        } catch (err) {
            console.error(`[Admin API Debug] Request failed for Scratchcard Pack details (${id}):`, {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
        }
    };
    const handleBroadcastMessage = () => {
        if (!globalMessage.trim()) return;
        socket.emit('ADMIN_BROADCAST_MESSAGE', { token: globalToken, message: globalMessage });
        setGlobalMessage('');
        addLog('Broadcast', 'Global message sent to all users.', 'success');
    };

    const handleFetchWordleDictionary = async () => {
        try {
            const res = await axios.get('/api/admin/wordle/dictionary', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setWordleDictionary(res.data);
        } catch (err) {
            console.error('[Admin Wordle] Fetch failed:', err);
        }
    };

    const handleAddWordleWord = async (word) => {
        try {
            await axios.post('/api/admin/wordle/dictionary', { word }, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', `Word "${word}" added to Wordle dictionary.`, 'success');
            handleFetchWordleDictionary();
        } catch (err) {
            addLog('Error', err.response?.data?.error || 'Failed to add word.', 'error');
        }
    };

    const handleDeleteWordleWord = async (id) => {
        if (!window.confirm("Delete this word?")) return;
        try {
            await axios.delete(`/api/admin/wordle/dictionary/${id}`, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', 'Word deleted.', 'success');
            handleFetchWordleDictionary();
        } catch (err) {
            addLog('Error', err.response?.data?.error || 'Delete failed.', 'error');
        }
    };

    const handleUpdateWordMetadata = async (id) => {
        try {
            await axios.patch(`/api/admin/wordle/dictionary/${id}`, {
                definition: editWordDef,
                funny_quote: editWordQuote
            }, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', 'Word metadata updated.', 'success');
            setEditingWordId(null);
            handleFetchWordleDictionary();
        } catch (err) {
            addLog('Error', err.response?.data?.error || 'Update failed.', 'error');
        }
    };

    const handleBulkUpdateWordleMetadata = async () => {
        if (!bulkMetadataInput.trim()) return;
        setIsBulkUpdating(true);
        try {
            const json = JSON.parse(bulkMetadataInput);
            const res = await axios.post('/api/admin/wordle/bulk-update', json, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', `Bulk update complete. ${res.data.updatedCount} words updated.`, 'success');
            setBulkMetadataInput('');
            handleFetchWordleDictionary();
        } catch (err) {
            addLog('Error', 'Invalid JSON or update failed.', 'error');
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleFetchFortunes = async () => {
        try {
            const res = await axios.get('/api/admin/fortunes/dictionary', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            setFortunesDictionary(res.data);
        } catch (err) {
            console.error('[Admin Fortune] Fetch failed:', err);
        }
    };

    const handleBulkImportFortunes = async () => {
        if (!fortunesBulkInput.trim()) return;
        setIsImportingFortunes(true);
        try {
            const data = JSON.parse(fortunesBulkInput.trim());
            const res = await axios.post('/api/admin/fortunes/bulk-import', data, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            addLog('Success', `Import complete. ${res.data.importedCount} new fortunes added.`, 'success');
            setFortunesBulkInput('');
            handleFetchFortunes();
        } catch (err) {
            addLog('Error', err.response?.data?.error || 'Invalid JSON or import failed. Ensure it is an array of strings.', 'error');
        } finally {
            setIsImportingFortunes(false);
        }
    };

    const handleDeleteFortune = async (id) => {
        if (!window.confirm('Möchtest du diesen Spruch wirklich löschen? Er wird aus dem Wörterbuch entfernt (Historie bleibt erhalten).')) return;
        try {
            await axios.delete(`/api/admin/fortunes/${id}`, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            handleFetchFortunes();
            addLog('Success', 'Fortune deleted.', 'success');
        } catch (err) {
            addLog('Error', err.response?.data?.error || 'Fehler beim Löschen.', 'error');
        }
    };

    const moveTeam = (index, direction) => {
        const newTeams = [...packTeams];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= newTeams.length) return;
        [newTeams[index], newTeams[newIndex]] = [newTeams[newIndex], newTeams[index]];
        setPackTeams(newTeams);
    };
    const addLog = (title, message, status) => {
        const id = Math.random().toString(36).substr(2, 9);
        setLogs(prev => [{ id, title, message, status, timestamp: Date.now() }, ...prev].slice(0, 50));
    };

    const globalToken = activeToken;

    // Forms
    const [originalCode, setOriginalCode] = useState('');
    const [polymarketCode, setPolymarketCode] = useState('');
    const [availableTeams, setAvailableTeams] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [esportsLastUpdated, setEsportsLastUpdated] = useState(null);

    // Scratchcard Pool Admin States
    const [poolSearchInput, setPoolSearchInput] = useState('');
    const [activePoolDropdown, setActivePoolDropdown] = useState(null);

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
    const [achievementRewardMultiplier, setAchievementRewardMultiplier] = useState(2.5);
    const [achievementRewardMultiplierStr, setAchievementRewardMultiplierStr] = useState('2.5');
    const [koalaFlapPayoutEnabled, setKoalaFlapPayoutEnabled] = useState(true);

    useEffect(() => {
        if (!activeToken) {
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
                if (baseline.achievement_reward_multiplier !== undefined) {
                    setAchievementRewardMultiplier(baseline.achievement_reward_multiplier);
                    setAchievementRewardMultiplierStr(baseline.achievement_reward_multiplier.toString());
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
                if (baseline.achievement_reward_multiplier !== undefined) {
                    setAchievementRewardMultiplier(baseline.achievement_reward_multiplier);
                    setAchievementRewardMultiplierStr(baseline.achievement_reward_multiplier.toString());
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
                    socket.emit('ADMIN_GET_KOALA_TRANSACTIONS', { token: globalToken, userId: expandedUserFriends });
                }
            } else {
                addLog('Error', `Failed to adjust coins: ${error}`, 'error');
            }
        });

        const fetchAll = () => {

            socket.emit(EVENTS.GET_ADMIN_MAPPINGS, { token: globalToken });

            socket.emit(EVENTS.GET_ADMIN_CACHE, { token: globalToken });

            socket.emit(EVENTS.GET_ADMIN_ACTIVITY, { token: globalToken });

            socket.emit(EVENTS.GET_ADMIN_ROOMS, { token: globalToken });

            socket.emit(EVENTS.GET_DB_ESPORTS_TEAMS);

            socket.emit('ADMIN_GET_ERRORS', { token: globalToken });

            socket.emit('ADMIN_GET_SYSTEM_LOGS', { token: globalToken });

            socket.emit('ADMIN_GET_KOALA_BASELINE', { token: globalToken });

            socket.emit('GET_ADMIN_SCRATCHCARD_POOLS', { token: globalToken });

            socket.emit('GET_ADMIN_SCRATCHCARD_ECONOMY', { token: globalToken });

            socket.emit('GET_PUBLIC_NAVBAR_SETTINGS', { token: globalToken });

            socket.emit('ADMIN_GET_NAVBAR_SETTINGS', { token: globalToken });

            socket.emit('GET_SCRATCHCARD_PACKS', { token: globalToken });
            handleFetchPokemonConfigs();
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
    }, [activeToken, navigate, socket, expandedUserFriends]); // Added expandedUserFriends to dependencies for refreshing transactions
    useEffect(() => {
        if (activeTab === 'users' && usersList.length === 0) {
        
            setLoading(true);
            fetch('/api/auth/users', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            })
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (Array.isArray(data)) setUsersList(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('[Admin API Debug] Request failed for User List:', {
                        message: err.message
                    });
                    setLoading(false);
                });
        }
    }, [activeTab, globalToken, usersList.length]);

    useEffect(() => {
        if (activeTab === 'errors' && errorLogs.length === 0) {
            handleFetchErrorLogs();
        }
        if (activeTab === 'system_logs' && systemLogs.length === 0) {
            handleFetchSystemLogs();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'bets' && betsList.length === 0) {
            handleFetchBets();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'scratchcards') {
            handleFetchPacks();
        }
        if (activeTab === 'navbar') {
            handleFetchNavbarSettings();
        }
        if (activeTab === 'pokemon') {
            handleFetchPokemonConfigs();
        }
        if (activeTab === 'mappings') {
            handleFetchPolymarketSettings();
        }
        if (activeTab === 'rss') {
            handleFetchRssFeeds();
        }
        if (activeTab === 'wordle') {
            handleFetchWordleDictionary();
        }
        if (activeTab === 'fortunes') {
            handleFetchFortunes();
        }
    }, [activeTab]);

    const handleFetchBets = () => {
    
        setLoading(true);
        fetch('/api/admin/bets', {
            headers: { 'Authorization': `Bearer ${globalToken}` }
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setBetsList(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('[Admin API Debug] Request failed for Bets:', {
                    message: err.message
                });
                setLoading(false);
            });
    };

    const handleFetchAuditLogs = () => {
    
        setLoading(true);
        fetch('/api/admin/actions', {
            headers: { 'Authorization': `Bearer ${globalToken}` }
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setAuditLogs(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('[Admin API Debug] Request failed for Audit Logs:', {
                    message: err.message
                });
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
            if (res.ok) {
                const summary = `Resolver beendet: ${data.message}\n\n` +
                                `- Offene Wetten gefunden: ${data.unresolvedFound || 0}\n` +
                                `- Verarbeitete Paarungen: ${data.matchesProcessed || 0}\n` +
                                `- Erfolgreich aufgelöst: ${data.betsResolved || 0}`;
                alert(summary);
            } else {
                alert(data.error || "Fehler beim Starten des Resolvers");
            }
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
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setErrorLogs(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('[Admin API Debug] Request failed for Error Logs:', {
                    message: err.message
                });
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

    const handleFetchSystemLogs = () => {
    
        setLoading(true);
        fetch('/api/admin/system-logs', {
            headers: { 'Authorization': `Bearer ${globalToken}` }
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setSystemLogs(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('[Admin API Debug] Request failed for System Logs:', {
                    message: err.message
                });
                setLoading(false);
            });
    };

    const handleClearSystemLogs = () => {
        if (!window.confirm("Bist du sicher, dass du ALLE System-Logs löschen möchtest?")) return;
        fetch('/api/admin/system-logs', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${globalToken}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setSystemLogs([]);
                    addLog('Success', 'All system logs cleared.', 'success');
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
        socket.emit(EVENTS.ADD_ADMIN_MAPPING, { token: globalToken, originalCode, polymarketCode });
        setOriginalCode('');
        setPolymarketCode('');
    };

    const handleDeleteMapping = (id) => {
        setLoading(true);
        socket.emit(EVENTS.DELETE_ADMIN_MAPPING, { token: globalToken, id });
    };

    // Cache actions
    const handleFlushCache = (target) => {
        setLoading(true);
        socket.emit(EVENTS.FLUSH_ADMIN_CACHE, { token: globalToken, target });
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
    const regularUsers = sortUsers(usersList.filter(u => !u.is_superadmin && !u.is_guest));
    const guestUsers = sortUsers(usersList.filter(u => u.is_guest));

    // Activity actions
    const handleDeleteActivity = (id) => {
        if (window.confirm("Are you sure you want to delete this activity log?")) {
            setLoading(true);
            socket.emit(EVENTS.DELETE_ADMIN_ACTIVITY, { token: globalToken, id });
        }
    };

    const handleDeleteRoom = (id) => {
        if (window.confirm("WARNING: This will delete the room and disconnect anyone inside. Proceed?")) {
            setLoading(true);
            socket.emit(EVENTS.DELETE_ADMIN_ROOM, { token: globalToken, id });
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
        socket.emit(EVENTS.EDIT_ADMIN_ROOM, { token: globalToken, id, newName, defaultRole });
    };

    const toggleSuperadmin = async (userId, currentStatus) => {
        try {
            await fetch(`/api/auth/users/${userId}/superadmin`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalToken}`
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
                    'Authorization': `Bearer ${globalToken}`
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
            token: globalToken,
            userId,
            amountCents,
            reason
        });
        // Refresh transactions
        socket.emit('ADMIN_GET_KOALA_TRANSACTIONS', { token: globalToken, userId });
    };

    const handleViewKoalaCoins = (userId) => {
        if (expandedKoalaUser === userId) {
            setExpandedKoalaUser(null);
            return;
        }
        setExpandedKoalaUser(userId);
        socket.emit('ADMIN_GET_KOALA_TRANSACTIONS', { token: globalToken, userId });
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

        console.log(`[Admin API Debug] Fetching Friends for user ${userId} with token...`);
        setExpandedUserFriends(userId);
        setFriendsLoading(true);
        socket.emit('ADMIN_GET_KOALA_TRANSACTIONS', { token: globalToken, userId });

        try {
            const res = await fetch(`/api/auth/users/${userId}/friends`, {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setUserFriendsList(data);
        } catch (err) {
            console.error(`[Admin API Debug] Request failed for Friends (User ${userId}):`, {
                message: err.message
            });
            setExpandedUserFriends(null);
        } finally {
            setFriendsLoading(false);
        }
    };

    const handleDeleteUserAccount = async (userId, username) => {
        if (!window.confirm(`CRITICAL WARNING: Are you sure you want to completely delete "${username || userId}" and all their associated data (Friends, Timer Events, Rooms)? This action is irreversible.`)) {
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
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });

            if (res.ok) {
                alert(`User ${username || userId} deleted successfully.`);
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
                    'Authorization': `Bearer ${globalToken}`
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
                headers: { 'Authorization': `Bearer ${globalToken}` }
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
                    className={activeTab === 'system_logs' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('system_logs')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Activity size={16} /> System Logs
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
                <button
                    className={activeTab === 'scratchcards' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('scratchcards')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Dices size={16} /> Scratchcard Pools
                </button>
                <button
                    className={activeTab === 'navbar' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('navbar')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <LayoutDashboard size={16} /> Sidebar Settings
                </button>
                <button
                    className={activeTab === 'pokemon' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setActiveTab('pokemon')}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Dices size={16} /> Pokémon Config
                </button>
                <button
                    className={activeTab === 'rss' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => { setActiveTab('rss'); handleFetchRssFeeds(); }}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <LucideIcons.Rss size={16} /> RSS Feeds
                </button>
                <button
                    className={activeTab === 'wordle' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => { setActiveTab('wordle'); handleFetchWordleDictionary(); }}
                    style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <LucideIcons.Gamepad2 size={16} /> Wordle Dictionary
                </button>
                <button
                    className={activeTab === 'fortunes' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => { setActiveTab('fortunes'); handleFetchFortunes(); }}
                    style={{ flexShrink: 1, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <LucideIcons.Cookie size={16} /> Fortune Cookies
                </button>
            </div>

            {/* TAB: TEAM MAPPINGS */}
            {activeTab === 'mappings' && (
                <TeamMappingsTab 
                    mappings={mappings}
                    originalCode={originalCode}
                    onOriginalCodeChange={setOriginalCode}
                    polymarketCode={polymarketCode}
                    onPolymarketCodeChange={setPolymarketCode}
                    onAddMapping={handleAddMapping}
                    onDeleteMapping={handleDeleteMapping}
                    polymarketSettings={polymarketSettings}
                    onTogglePolymarketAdd={handleTogglePolymarketAdd}
                />
            )}

            {/* TAB: CACHE STATUS */}
            {activeTab === 'cache' && (
                <ApiCachesTab 
                    cacheStatus={cacheStatus}
                    availableTeams={availableTeams}
                    esportsLastUpdated={esportsLastUpdated}
                    formatCacheAge={formatCacheAge}
                    onFlush={handleFlushCache}
                    onRefreshTeams={() => { 
                        setLoading(true); 
                        socket.emit(EVENTS.TRIGGER_FETCH_ALL_TEAMS, { token: globalToken }); 
                    }}
                />
            )}

            {/* TAB: RSS FEEDS MANAGEMENT */}
            {activeTab === 'rss' && (
                <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>RSS Feed Quellen</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Verwalte die globalen News-Quellen für alle User.</p>
                        </div>
                        <button className="btn-primary" onClick={() => {
                            const name = prompt("Name des Feeds (z.B. BBC News):");
                            const url = prompt("RSS URL:");
                            const icon = prompt("Icon URL (optional):");
                            if (name && url) handleAddRssFeed(name, url, icon);
                        }}>
                           <Plus size={18} /> Feed hinzufügen
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '48px' }}>
                        {!Array.isArray(rssFeeds) || rssFeeds.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Keine RSS-Feeds konfiguriert oder Fehler beim Laden.</div>
                        ) : (
                            rssFeeds.map(feed => (
                                <div key={feed?.id || Math.random()} className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ width: '48px', height: '48px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                            {(() => {
                                                const iconUrl = feed?.icon || (feed?.url ? `https://www.google.com/s2/favicons?domain=${new URL(feed.url).hostname}&sz=64` : null);
                                                return iconUrl ? (
                                                    <img 
                                                        src={iconUrl} 
                                                        alt="" 
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                        onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.fallback-rss-icon').style.display = 'block'; }}
                                                    />
                                                ) : null;
                                            })()}
                                            <div className="fallback-rss-icon" style={{ display: feed?.icon || feed?.url ? 'none' : 'block' }}>
                                                <LucideIcons.Rss size={24} color="var(--text-muted)" />
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{feed?.name || 'Unbenannter Feed'} {feed?.is_default ? <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>DEFAULT</span> : null}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>{feed?.url || 'Keine URL'}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
                                                {rssStats.find(s => s.id === feed.id)?.articleCount || 0} Artikel im Cache
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button className="btn-secondary" style={{ padding: '8px 16px' }} onClick={() => {
                                            const name = prompt("Name:", feed?.name || '');
                                            const url = prompt("URL:", feed?.url || '');
                                            const icon = prompt("Icon URL:", feed?.icon || '');
                                            if (name && url) handleUpdateRssFeed(feed?.id, name, url, icon);
                                        }}>Edit</button>
                                        {!feed?.is_default && (
                                            <button className="btn-ghost" style={{ padding: '8px 16px', color: '#ef4444' }} onClick={() => handleDeleteRssFeed(feed?.id)}>
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* NEW SECTION: RSS ARTICLE DATABASE */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '48px', marginTop: '48px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>News Artikel-Datenbank</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                                    Hier werden alle geladenen Artikel persistiert. Automatischer Cleanup erfolgt alle 7 Tage.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn-secondary" onClick={handleManualRssRefresh} disabled={refreshingRss}>
                                    <LucideIcons.RefreshCw className={refreshingRss ? "spinning" : ""} size={16} style={{ marginRight: '8px' }} />
                                    {refreshingRss ? "Aktualisiere..." : "Vollständiger Feed-Refresh"}
                                </button>
                                <button className="btn-ghost" style={{ color: '#ef4444', border: '1px solid #ef444420' }} onClick={handlePurgeRssCache}>
                                    Alles leeren (Purge)
                                </button>
                                <button className="btn-ghost" style={{ color: '#f59e0b', border: '1px solid #f59e0b20' }} onClick={() => handlePurgeRssCache(24)}>
                                    Alles &gt; 24h löschen
                                </button>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', padding: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Quelle</th>
                                        <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Titel</th>
                                        <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Cached am</th>
                                        <th style={{ padding: '16px', textAlign: 'right', color: 'var(--text-muted)' }}>Aktion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rssArticles.length === 0 ? (
                                        <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Keine Artikel in der Datenbank.</td></tr>
                                    ) : (
                                        rssArticles.map(art => (
                                            <tr key={art.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <td style={{ padding: '16px' }}>
                                                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>{art.feedName}</span>
                                                </td>
                                                <td style={{ padding: '16px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <a href={art.link} target="_blank" rel="noreferrer" style={{ color: 'var(--text-main)', textDecoration: 'none' }}>{art.title}</a>
                                                </td>
                                                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{new Date(art.cachedAt).toLocaleString()}</td>
                                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                                    <button className="btn-ghost" style={{ color: '#ef4444', padding: '4px' }} onClick={() => handleDeleteRssArticle(art.id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: ACTIVITY LOG */}
            {activeTab === 'activity' && (
                <ActivityLogTab 
                    activity={activity}
                    formatDate={formatDate}
                    onDelete={handleDeleteActivity}
                />
            )}

            {/* TAB: ROOMS OVERVIEW */}
            {activeTab === 'rooms' && (
                <ServerRoomsTab 
                    rooms={rooms}
                    formatDate={formatDate}
                    onEdit={handleEditRoom}
                    onDelete={handleDeleteRoom}
                />
            )}

            {/* TAB: USER MANAGEMENT */}
            {activeTab === 'users' && (
                <UserManagementTab 
                    usersList={usersList}
                    sortConfig={sortConfig}
                    onSortChange={handleSortChange}
                    superadminUsers={superadminUsers}
                    regularUsers={regularUsers}
                    guestUsers={guestUsers}
                    collapsedSections={collapsedSections}
                    onToggleSection={(title) => setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }))}
                    expandedUserFriends={expandedUserFriends}
                    onViewFriends={handleViewFriends}
                    friendsLoading={friendsLoading}
                    userFriendsList={userFriendsList}
                    expandedKoalaUser={expandedKoalaUser}
                    onViewKoalaCoins={handleViewKoalaCoins}
                    koalaTransactions={koalaTransactions}
                    onAdjustKoalaCoins={handleAdjustKoalaCoins}
                    onToggleSuperadmin={toggleSuperadmin}
                    onPasswordChange={handlePasswordChange}
                    onBanUser={handleBanUser}
                    onUnbanUser={handleUnbanUser}
                    onDeleteUser={handleDeleteUserAccount}
                    koalaBaseline={koalaBaseline}
                    koalaBaselineStr={koalaBaselineStr}
                    onKoalaBaselineStrChange={setKoalaBaselineStr}
                    onKoalaBaselineChange={setKoalaBaseline}
                    koalaStartCoins={koalaStartCoins}
                    koalaStartCoinsStr={koalaStartCoinsStr}
                    onKoalaStartCoinsStrChange={setKoalaStartCoinsStr}
                    onKoalaStartCoinsChange={setKoalaStartCoins}
                    koalaCoinRate={koalaCoinRate}
                    koalaCoinRateStr={koalaCoinRateStr}
                    onKoalaCoinRateStrChange={setKoalaCoinRateStr}
                    onKoalaCoinRateChange={setKoalaCoinRate}
                    koalaDailyMissionMultiplier={koalaDailyMissionMultiplier}
                    koalaDailyMissionMultiplierStr={koalaDailyMissionMultiplierStr}
                    onKoalaDailyMissionMultiplierStrChange={setKoalaDailyMissionMultiplierStr}
                    onKoalaDailyMissionMultiplierChange={setKoalaDailyMissionMultiplier}
                    achievementRewardMultiplier={achievementRewardMultiplier}
                    achievementRewardMultiplierStr={achievementRewardMultiplierStr}
                    onAchievementRewardMultiplierStrChange={setAchievementRewardMultiplierStr}
                    onAchievementRewardMultiplierChange={setAchievementRewardMultiplier}
                    koalaFlapPayoutEnabled={koalaFlapPayoutEnabled}
                    onToggleFlapPayout={() => setKoalaFlapPayoutEnabled(!koalaFlapPayoutEnabled)}
                    onSaveKoalaConfig={() => socket.emit('ADMIN_UPDATE_KOALA_BASELINE', { 
                        token: globalToken, 
                        baseline: { 
                            koala_points_per_hour: koalaBaseline, 
                            koala_start_coins: koalaStartCoins, 
                            koala_coin_conversion_rate: koalaCoinRate, 
                            koala_daily_mission_multiplier: koalaDailyMissionMultiplier, 
                            achievement_reward_multiplier: achievementRewardMultiplier, 
                            game_koalaflap_payout_enabled: koalaFlapPayoutEnabled.toString() 
                        } 
                    })}
                />
            )}

            {/* TAB: ERROR LOGS */}
            {activeTab === 'errors' && (
                <ErrorLogsTab 
                    errorLogs={errorLogs}
                    onFetch={handleFetchErrorLogs}
                    onClear={handleClearErrorLogs}
                    onDelete={handleDeleteErrorLog}
                    formatDate={formatDate}
                />
            )}

            {/* TAB: SYSTEM LOGS */}
            {activeTab === 'system_logs' && (
                <SystemLogsTab 
                    systemLogs={systemLogs}
                    onFetch={handleFetchSystemLogs}
                    onClear={handleClearSystemLogs}
                    formatDate={formatDate}
                />
            )}

            {/* TAB: BETS (WETT-VERWALTUNG) */}
            {activeTab === 'bets' && (
                <BetsManagementTab 
                    betsList={betsList}
                    onFetch={handleFetchBets}
                    onTriggerResolver={handleTriggerResolver}
                    onUpdateStatus={handleUpdateBetStatus}
                    formatDate={formatDate}
                />
            )}
            {/* TAB: AUDIT LOGS */}
            {activeTab === 'audit' && (
                <AuditLogsTab 
                    auditLogs={auditLogs}
                    onFetch={handleFetchAuditLogs}
                    formatDate={formatDate}
                />
            )}

            {/* TAB: GAME HIGHSCORES */}
            {activeTab === 'game_scores' && (
                <GameHighscoresTab 
                    gameScores={gameScores}
                    onFetch={handleFetchGameScores}
                    onDelete={handleDeleteGameScore}
                    formatDate={formatDate}
                />
            )}

            {/* TAB: SCRATCHCARD POOLS */}
            {activeTab === 'scratchcards' && (
                <ScratchcardPacksTab 
                    scratchcardPacks={scratchcardPacks}
                    isEditingPack={isEditingPack}
                    onSetIsEditingPack={setIsEditingPack}
                    packForm={packForm}
                    onSetPackForm={setPackForm}
                    packTeams={packTeams}
                    onSetPackTeams={setPackTeams}
                    poolSearchInput={poolSearchInput}
                    onSetPoolSearchInput={setPoolSearchInput}
                    activePoolDropdown={activePoolDropdown}
                    onSetActivePoolDropdown={setActivePoolDropdown}
                    availableTeams={availableTeams}
                    onSavePack={handleSavePack}
                    onEditPack={handleEditPack}
                    onDeletePack={handleDeletePack}
                    onMoveTeam={moveTeam}
                />
            )}
            {activeTab === 'navbar' && (
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div>
                            <h2 style={{ margin: 0 }}>Navigation Settings</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Steuere die Sichtbarkeit und Reihenfolge der Links in der Sidebar.</p>
                        </div>
                        <button className="btn-primary" onClick={handleSaveNavbarSettings} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <LucideIcons.Save size={18} /> Save Changes
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {/* Navigation List organized by Categories */}

                        {['Timers', 'Esports', 'Games', 'Social', 'Tools', 'System', 'Other', ...new Set(navbarSettings.map(n => n.category).filter(c => !['Timers', 'Esports', 'Games', 'Social', 'Tools', 'System', 'Other'].includes(c)))].map(category => {
                            const categoryItems = navbarSettings.filter(item => item.category === category);
                            if (categoryItems.length === 0) return null;

                            return (
                                <div key={category} className="glass-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '8px', height: '24px', background: 'var(--accent-primary)', borderRadius: '4px' }}></div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '0.02em' }}>{category}</h3>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{categoryItems.length} Links</span>
                                    </div>

                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Label</th>
                                                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Icon</th>
                                                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</th>
                                                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Path</th>
                                                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Badge</th>
                                                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                            <LucideIcons.Lock size={12} /> Lock
                                                        </div>
                                                    </th>
                                                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Visible</th>
                                                    <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Order</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {categoryItems.map((item, nestedIndex) => {
                                                    const globalIndex = navbarSettings.findIndex(n => n.key === item.key);
                                                    const isFirst = nestedIndex === 0;
                                                    const isLast = nestedIndex === categoryItems.length - 1;

                                                    return (
                                                        <tr key={item.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                                            <td style={{ padding: '14px 24px', fontWeight: 600 }}>
                                                                <input 
                                                                    type="text" 
                                                                    value={item.label} 
                                                                    style={{ width: '130px', padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-color)', color: 'inherit', borderRadius: '4px' }}
                                                                    onChange={(e) => {
                                                                        const newSettings = [...navbarSettings];
                                                                        const idx = newSettings.findIndex(n => n.key === item.key);
                                                                        newSettings[idx].label = e.target.value;
                                                                        setNavbarSettings(newSettings);
                                                                    }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                    <div style={{ padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex' }}>
                                                                        {(() => {
                                                                            const IconComp = LucideIcons[item.icon];
                                                                            return IconComp ? <IconComp size={16} /> : <LucideIcons.HelpCircle size={16} opacity={0.3} />;
                                                                        })()}
                                                                    </div>
                                                                    <input 
                                                                        type="text"
                                                                        value={item.icon || ''}
                                                                        placeholder="Icon Name"
                                                                        style={{ width: '80px', fontSize: '0.7rem', padding: '2px 4px', background: 'transparent', border: '1px solid var(--border-color)', color: 'inherit', borderRadius: '4px' }}
                                                                        onChange={(e) => {
                                                                            const newSettings = [...navbarSettings];
                                                                            const idx = newSettings.findIndex(n => n.key === item.key);
                                                                            newSettings[idx].icon = e.target.value;
                                                                            setNavbarSettings(newSettings);
                                                                        }}
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '14px 24px' }}>
                                                                <select 
                                                                    value={item.category || 'Other'} 
                                                                    className="input-primary"
                                                                    style={{ width: '130px', padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer' }}
                                                                    onChange={(e) => {
                                                                        const newSettings = [...navbarSettings];
                                                                        const idx = newSettings.findIndex(n => n.key === item.key);
                                                                        newSettings[idx].category = e.target.value;
                                                                        newSettings.sort((a,b) => a.sortOrder - b.sortOrder);
                                                                        setNavbarSettings(newSettings);
                                                                    }}
                                                                >
                                                                    <option value="Timers">Timers</option>
                                                                    <option value="Esports">Esports</option>
                                                                    <option value="Games">Games</option>
                                                                    <option value="Social">Social</option>
                                                                    <option value="Tools">Tools</option>
                                                                    <option value="System">System</option>
                                                                    <option value="Other">Other</option>
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '14px 24px', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.path}</td>
                                                            <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={!!item.has_daily_badge} 
                                                                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                                    onChange={(e) => {
                                                                        const newSettings = [...navbarSettings];
                                                                        const idx = newSettings.findIndex(n => n.key === item.key);
                                                                        newSettings[idx].has_daily_badge = e.target.checked ? 1 : 0;
                                                                        setNavbarSettings(newSettings);
                                                                    }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={!!item.isLocked} 
                                                                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                                    onChange={(e) => {
                                                                        const newSettings = [...navbarSettings];
                                                                        const idx = newSettings.findIndex(n => n.key === item.key);
                                                                        newSettings[idx].isLocked = e.target.checked ? 1 : 0;
                                                                        setNavbarSettings(newSettings);
                                                                    }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                                                                {item.key === 'admin' ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={true} 
                                                                            disabled={true}
                                                                            style={{ transform: 'scale(1.2)', opacity: 0.5, cursor: 'not-allowed' }}
                                                                        />
                                                                        <span style={{ fontSize: '0.65rem', color: '#a855f7', fontWeight: 700 }}>Superadmin only</span>
                                                                    </div>
                                                                ) : (
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={!!item.isVisible} 
                                                                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                                        onChange={(e) => {
                                                                            const newSettings = [...navbarSettings];
                                                                            const idx = newSettings.findIndex(n => n.key === item.key);
                                                                            newSettings[idx].isVisible = e.target.checked ? 1 : 0;
                                                                            setNavbarSettings(newSettings);
                                                                        }}
                                                                    />
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                    <button 
                                                                        className="btn-ghost" 
                                                                        style={{ padding: '6px', opacity: isFirst ? 0.2 : 1 }}
                                                                        disabled={isFirst}
                                                                        title="Move Up"
                                                                        onClick={() => {
                                                                            setNavbarSettings(prev => {
                                                                                const newSettings = [...prev];
                                                                                const currentCategoryItems = newSettings.filter(n => n.category === category);
                                                                                const neighbor = currentCategoryItems[nestedIndex - 1];
                                                                                
                                                                                if (!neighbor) return prev;

                                                                                const idxSelf = newSettings.findIndex(n => n.key === item.key);
                                                                                const idxNeighbor = newSettings.findIndex(n => n.key === neighbor.key);
                                                                                
                                                                                if (idxSelf === -1 || idxNeighbor === -1) return prev;

                                                                                const tempOrder = newSettings[idxSelf].sortOrder;
                                                                                newSettings[idxSelf].sortOrder = newSettings[idxNeighbor].sortOrder;
                                                                                newSettings[idxNeighbor].sortOrder = tempOrder;
                                                                                
                                                                                return [...newSettings].sort((a,b) => a.sortOrder - b.sortOrder);
                                                                            });
                                                                        }}
                                                                    >
                                                                        <LucideIcons.ChevronUp size={16} />
                                                                    </button>

                                                                    <button 
                                                                        className="btn-ghost" 
                                                                        style={{ padding: '6px', opacity: isLast ? 0.2 : 1 }}
                                                                        disabled={isLast}
                                                                        title="Move Down"
                                                                        onClick={() => {
                                                                            setNavbarSettings(prev => {
                                                                                const newSettings = [...prev];
                                                                                const currentCategoryItems = newSettings.filter(n => n.category === category);
                                                                                const neighbor = currentCategoryItems[nestedIndex + 1];
                                                                                
                                                                                if (!neighbor) return prev;

                                                                                const idxSelf = newSettings.findIndex(n => n.key === item.key);
                                                                                const idxNeighbor = newSettings.findIndex(n => n.key === neighbor.key);
                                                                                
                                                                                if (idxSelf === -1 || idxNeighbor === -1) return prev;

                                                                                const tempOrder = newSettings[idxSelf].sortOrder;
                                                                                newSettings[idxSelf].sortOrder = newSettings[idxNeighbor].sortOrder;
                                                                                newSettings[idxNeighbor].sortOrder = tempOrder;
                                                                                
                                                                                return [...newSettings].sort((a,b) => a.sortOrder - b.sortOrder);
                                                                            });
                                                                        }}
                                                                    >
                                                                        <LucideIcons.ChevronDown size={16} />
                                                                    </button>

                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB: POKEMON CONFIG */}
            {activeTab === 'pokemon' && (
                <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ margin: 0 }}>Pokémon System Configuration</h3>
                        <button className="btn-primary" onClick={handleSavePokemonConfigs} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <LucideIcons.Save size={18} /> Save Changes
                        </button>
                    </div>

                    <div style={{ marginBottom: '32px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--accent-primary)' }}>Global Settings</h4>
                        <div style={{ maxWidth: '400px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Contrast Threshold (0.0 - 1.0)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.01" 
                                    style={{ flex: 1 }}
                                    value={pokemonConfigs.settings?.contrast_threshold || 0.6}
                                    onChange={(e) => setPokemonConfigs(prev => ({ 
                                        ...prev, 
                                        settings: { ...prev.settings, contrast_threshold: e.target.value } 
                                    }))}
                                />
                                <span style={{ fontWeight: 'bold', minWidth: '40px' }}>{pokemonConfigs.settings?.contrast_threshold || 0.6}</span>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                Higher value = Pokémon needs to be "lighter" to trigger Light Mode. Default: 0.6.
                            </p>
                        </div>
                    </div>

                    <h4 style={{ marginBottom: '16px' }}>Type Color Mapping</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                        {POKEMON_TYPES.map(type => (
                            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ 
                                    width: '24px', height: '24px', borderRadius: '50%', 
                                    background: pokemonConfigs.colors?.[type] || '#333',
                                    border: '2px solid rgba(255,255,255,0.2)'
                                }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>{type}</div>
                                    <input 
                                        type="text" 
                                        className="input-primary" 
                                        style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                        value={pokemonConfigs.colors?.[type] || ''}
                                        onChange={(e) => setPokemonConfigs(prev => ({
                                            ...prev,
                                            colors: { ...prev.colors, [type]: e.target.value }
                                        }))}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB: WORDLE DICTIONARY */}
            {activeTab === 'wordle' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* Bulk Actions Section */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setShowWordleImportExport(!showWordleImportExport)}
                        >
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <LucideIcons.ArrowLeftRight size={20} color="var(--accent-primary)" />
                                Bulk Import / Export
                            </h3>
                            <button className="btn-ghost" style={{ padding: '4px' }}>
                                {showWordleImportExport ? <LucideIcons.ChevronUp size={24} /> : <LucideIcons.ChevronDown size={24} />}
                            </button>
                        </div>

                        {showWordleImportExport && (
                            <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '20px', marginTop: '24px' }}>
                                <div style={{ padding: '24px', background: 'rgba(16, 185, 129, 0.03)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <LucideIcons.FileJson size={20} color="#10b981" />
                                        Bulk Import / Upsert
                                    </h4>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                                        Paste JSON to update definitions and quotes. Existing words will be updated.
                                    </p>
                                    <textarea
                                        className="input-primary"
                                        style={{ width: '100%', minHeight: '160px', fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '16px', padding: '16px', color: '#10b981' }}
                                        placeholder='[{"word": "APPLE", "definition": "A fruit", "funny_quote": "Keep doctors away"}]'
                                        value={bulkMetadataInput}
                                        onChange={(e) => setBulkMetadataInput(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button 
                                            className="btn-primary" 
                                            style={{ flex: 1, justifyContent: 'center' }}
                                            disabled={isBulkUpdating || !bulkMetadataInput.trim()}
                                            onClick={handleBulkUpdateWordleMetadata}
                                        >
                                            {isBulkUpdating ? 'Processing...' : 'Run Bulk Upsert'}
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => setBulkMetadataInput('')}
                                            style={{ padding: '0 16px' }}
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div style={{ padding: '24px', background: 'rgba(59, 130, 246, 0.03)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)', display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <LucideIcons.Download size={20} color="#3b82f6" />
                                        Dictionary Export
                                    </h4>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                                        Download JSON for local enrichment with <code>scripts/wordle_enricher.py</code>.
                                    </p>
                                    
                                    <button 
                                        className="btn-secondary" 
                                        style={{ 
                                            width: '100%', 
                                            justifyContent: 'center', 
                                            background: 'rgba(59, 130, 246, 0.1)', 
                                            color: '#3b82f6', 
                                            border: 'none', 
                                            padding: '12px', 
                                            borderRadius: '8px', 
                                            cursor: 'pointer', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '12px',
                                            fontWeight: 700,
                                            marginTop: 'auto'
                                        }}
                                        onClick={async () => {
                                            try {
                                                const res = await axios.get('/api/admin/wordle/export', {
                                                    headers: { 'Authorization': `Bearer ${globalToken}` }
                                                });
                                                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `wordle_dictionary_export_${new Date().toISOString().split('T')[0]}.json`;
                                                a.click();
                                                addLog('Success', 'Full dictionary exported.', 'success');
                                            } catch (err) {
                                                addLog('Error', 'Export failed.', 'error');
                                            }
                                        }}
                                    >
                                        <LucideIcons.Download size={18} />
                                        Download JSON
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dictionary Management Section */}
                    <div className="glass-card" style={{ padding: '32px', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                            <h3 style={{ margin: 0 }}>Wordle Dictionary ({wordleDictionary.length} words)</h3>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                                    <button 
                                        className={wordleFilterNoDef ? 'btn-primary' : 'btn-ghost'} 
                                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                        onClick={() => setWordleFilterNoDef(!wordleFilterNoDef)}
                                    >
                                        No Def
                                    </button>
                                    <button 
                                        className={wordleFilterNoQuote ? 'btn-primary' : 'btn-ghost'} 
                                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                        onClick={() => setWordleFilterNoQuote(!wordleFilterNoQuote)}
                                    >
                                        No Quote
                                    </button>
                                    <button 
                                        className={wordleFilterUsed ? 'btn-primary' : 'btn-ghost'} 
                                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                        onClick={() => {
                                            setWordleFilterUsed(!wordleFilterUsed);
                                            if (!wordleFilterUsed) setWordleFilterUnused(false);
                                        }}
                                    >
                                        Used
                                    </button>
                                    <button 
                                        className={wordleFilterUnused ? 'btn-primary' : 'btn-ghost'} 
                                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                        onClick={() => {
                                            setWordleFilterUnused(!wordleFilterUnused);
                                            if (!wordleFilterUnused) setWordleFilterUsed(false);
                                        }}
                                    >
                                        Unused
                                    </button>
                                </div>
                                <input 
                                    type="text" 
                                    className="input-primary" 
                                    placeholder="Search word..." 
                                    style={{ width: '160px' }}
                                    value={wordleSearch}
                                    onChange={(e) => setWordleSearch(e.target.value.toUpperCase())}
                                />
                                <button className="btn-primary" onClick={() => {
                                    const word = prompt("Enter 5-letter word:");
                                    if (word) handleAddWordleWord(word.toUpperCase());
                                }}>
                                    <LucideIcons.Plus size={18} /> Add Word
                                </button>
                            </div>
                        </div>

                        <div style={{ width: '100%', overflowX: 'auto' }}>
                            <table className="admin-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '100px' }}>Word</th>
                                        <th style={{ width: '80px' }}>Used?</th>
                                        <th>Definition</th>
                                        <th>Funny Quote</th>
                                        <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wordleDictionary
                                        .filter(w => !wordleSearch || w.word.includes(wordleSearch))
                                        .filter(w => !wordleFilterNoDef || !w.definition)
                                        .filter(w => !wordleFilterNoQuote || !w.funny_quote)
                                        .filter(w => !wordleFilterUsed || w.is_used === 1)
                                        .filter(w => !wordleFilterUnused || w.is_used === 0)
                                        .slice(0, 50) 
                                        .map(w => {
                                            const isEditing = editingWordId === w.id;
                                            return (
                                                <tr key={w.id}>
                                                    <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{w.word}</td>
                                                    <td>
                                                        <span style={{ 
                                                            padding: '2px 6px', 
                                                            borderRadius: '4px', 
                                                            fontSize: '0.75rem',
                                                            background: w.is_used ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                                            color: w.is_used ? '#10b981' : 'var(--text-muted)'
                                                        }}>
                                                            {w.is_used ? 'Yes' : 'No'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {isEditing ? (
                                                            <input 
                                                                className="input-primary"
                                                                style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                                                                value={editWordDef}
                                                                onChange={(e) => setEditWordDef(e.target.value)}
                                                                placeholder="Enter definition..."
                                                            />
                                                        ) : (
                                                            <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {w.definition || <span style={{ opacity: 0.3 }}>- none -</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {isEditing ? (
                                                            <input 
                                                                className="input-primary"
                                                                style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                                                                value={editWordQuote}
                                                                onChange={(e) => setEditWordQuote(e.target.value)}
                                                                placeholder="Enter funny quote..."
                                                            />
                                                        ) : (
                                                            <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {w.funny_quote || <span style={{ opacity: 0.3 }}>- none -</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            {isEditing ? (
                                                                <>
                                                                    <button 
                                                                        className="btn-ghost" 
                                                                        style={{ color: '#10b981' }}
                                                                        onClick={() => handleUpdateWordMetadata(w.id)}
                                                                    >
                                                                        <LucideIcons.Check size={18} />
                                                                    </button>
                                                                    <button 
                                                                        className="btn-ghost" 
                                                                        style={{ color: 'var(--text-muted)' }}
                                                                        onClick={() => setEditingWordId(null)}
                                                                    >
                                                                        <LucideIcons.X size={18} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button 
                                                                        className="btn-ghost" 
                                                                        style={{ color: 'var(--accent-primary)' }}
                                                                        onClick={() => {
                                                                            setEditingWordId(w.id);
                                                                            setEditWordDef(w.definition || '');
                                                                            setEditWordQuote(w.funny_quote || '');
                                                                        }}
                                                                    >
                                                                        <LucideIcons.Edit2 size={16} />
                                                                    </button>
                                                                    <button 
                                                                        className="btn-ghost" 
                                                                        style={{ color: '#ef4444' }}
                                                                        onClick={() => handleDeleteWordleWord(w.id)}
                                                                    >
                                                                        <LucideIcons.Trash2 size={16} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: FORTUNE COOKIES */}
            {activeTab === 'fortunes' && (
                <div className="animate-fade-in">
                    <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                                        <LucideIcons.Cookie size={24} color="#f59e0b" />
                                    </div>
                                    Daily Fortune Cookie Management ({fortunesDictionary.length})
                                </h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
                                    Import and manage sarcastic slogans for the daily login feature.
                                </p>
                            </div>
                            <button className="btn-secondary" onClick={handleFetchFortunes}>
                                <LucideIcons.RefreshCcw size={16} style={{ marginRight: '8px' }} /> Refresh
                            </button>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 600 }}>Bulk Import (AI Generated JSON)</h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                        Paste the JSON array from the Python script here. New entries will be added instantly.
                                    </p>
                                    <textarea 
                                        className="input-primary"
                                        style={{ width: '100%', minHeight: '100px', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '12px', resize: 'vertical' }}
                                        placeholder='["Spruch 1", "Spruch 2", ...]'
                                        value={fortunesBulkInput}
                                        onChange={(e) => setFortunesBulkInput(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button 
                                            className="btn-primary" 
                                            onClick={handleBulkImportFortunes}
                                            disabled={isImportingFortunes || !fortunesBulkInput.trim()}
                                            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '10px 24px', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)' }}
                                        >
                                            {isImportingFortunes ? 'Importing...' : 'Start Bulk Import'}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ width: '280px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <h5 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventory Stats</h5>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Total Pool:</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{fortunesDictionary.length}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Ever Opened:</span>
                                            <span style={{ fontWeight: 700, color: '#3b82f6' }}>{fortunesDictionary.filter(f => f.usage_count > 0).length}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Never Used:</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{fortunesDictionary.filter(f => f.usage_count === 0).length}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                                    <button 
                                        className={!fortuneFilterUsed && !fortuneFilterUnused ? 'btn-primary' : 'btn-ghost'} 
                                        style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px' }}
                                        onClick={() => { setFortuneFilterUsed(false); setFortuneFilterUnused(false); }}
                                    >
                                        All
                                    </button>
                                    <button 
                                        className={fortuneFilterUsed ? 'btn-primary' : 'btn-ghost'} 
                                        style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px' }}
                                        onClick={() => { setFortuneFilterUsed(true); setFortuneFilterUnused(false); }}
                                    >
                                        Used
                                    </button>
                                    <button 
                                        className={fortuneFilterUnused ? 'btn-primary' : 'btn-ghost'} 
                                        style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px' }}
                                        onClick={() => { setFortuneFilterUnused(true); setFortuneFilterUsed(false); }}
                                    >
                                        Unused
                                    </button>
                                </div>
                            </div>

                            <div style={{ position: 'relative', width: '350px' }}>
                                <LucideIcons.Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input 
                                    type="text" 
                                    className="input-primary" 
                                    placeholder="Suche Sprüche oder Keywords..." 
                                    style={{ width: '100%', paddingLeft: '44px', borderRadius: '10px' }}
                                    value={fortuneSearch}
                                    onChange={(e) => setFortuneSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ width: '100%', overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                            <table className="admin-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                        <th style={{ width: '80px', padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>ID</th>
                                        <th style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>Slogan Text</th>
                                        <th style={{ width: '140px', padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Öffnungen</th>
                                        <th style={{ width: '100px', padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const filtered = fortunesDictionary
                                            .filter(f => !fortuneSearch || f.text.toLowerCase().includes(fortuneSearch.toLowerCase()))
                                            .filter(f => !fortuneFilterUsed || f.usage_count > 0)
                                            .filter(f => !fortuneFilterUnused || f.usage_count === 0);
                                        
                                        const displayed = filtered.slice(0, fortuneDisplayLimit);

                                        return (
                                            <>
                                                {displayed.map(f => (
                                                    <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                        <td style={{ padding: '16px', opacity: 0.4, fontSize: '0.8rem', fontFamily: 'monospace' }}>#{f.id}</td>
                                                        <td style={{ padding: '16px', fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.5, color: '#f1f5f9' }}>{f.text}</td>
                                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                                            <span style={{ 
                                                                padding: '4px 12px', 
                                                                borderRadius: '20px', 
                                                                fontSize: '0.75rem',
                                                                fontWeight: 800,
                                                                letterSpacing: '0.02em',
                                                                background: f.usage_count > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                                                                color: f.usage_count > 0 ? '#3b82f6' : 'var(--text-muted)',
                                                                border: f.usage_count > 0 ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent'
                                                            }}>
                                                                {f.usage_count} Openings
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                                            <button 
                                                                className="btn-ghost" 
                                                                style={{ color: '#ef4444', padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.05)' }}
                                                                title="Delete Slogan"
                                                                onClick={() => handleDeleteFortune(f.id)}
                                                            >
                                                                <LucideIcons.Trash2 size={18} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {filtered.length > fortuneDisplayLimit && (
                                                    <tr>
                                                        <td colSpan="4" style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                                                            <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                                Zeige {fortuneDisplayLimit} von {filtered.length} Ergebnissen
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                                                <button 
                                                                    className="btn-secondary" 
                                                                    style={{ padding: '8px 24px' }}
                                                                    onClick={() => setFortuneDisplayLimit(prev => prev + 100)}
                                                                >
                                                                    + 100 weitere laden
                                                                </button>
                                                                <button 
                                                                    className="btn-ghost" 
                                                                    style={{ padding: '8px 24px', color: 'var(--accent-primary)' }}
                                                                    onClick={() => setFortuneDisplayLimit(filtered.length)}
                                                                >
                                                                    Alle anzeigen
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                {filtered.length === 0 && (
                                                    <tr>
                                                        <td colSpan="4" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                            <div style={{ opacity: 0.1, marginBottom: '16px' }}>
                                                                <LucideIcons.Cookie size={64} />
                                                            </div>
                                                            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Keine passenden Sprüche gefunden.</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
