import React from 'react';
import { Trash2, Activity, Dices } from 'lucide-react';

const UserManagementTab = ({
    usersList,
    sortConfig,
    onSortChange,
    superadminUsers,
    regularUsers,
    guestUsers,
    collapsedSections,
    onToggleSection,
    expandedUserFriends,
    onViewFriends,
    friendsLoading,
    userFriendsList,
    expandedKoalaUser,
    onViewKoalaCoins,
    koalaTransactions,
    onAdjustKoalaCoins,
    onToggleSuperadmin,
    onPasswordChange,
    onBanUser,
    onUnbanUser,
    onDeleteUser,
    koalaBaseline,
    koalaBaselineStr,
    onKoalaBaselineStrChange,
    onKoalaBaselineChange,
    koalaStartCoins,
    koalaStartCoinsStr,
    onKoalaStartCoinsStrChange,
    onKoalaStartCoinsChange,
    koalaCoinRate,
    koalaCoinRateStr,
    onKoalaCoinRateStrChange,
    onKoalaCoinRateChange,
    koalaDailyMissionMultiplier,
    koalaDailyMissionMultiplierStr,
    onKoalaDailyMissionMultiplierStrChange,
    onKoalaDailyMissionMultiplierChange,
    achievementRewardMultiplier,
    achievementRewardMultiplierStr,
    onAchievementRewardMultiplierStrChange,
    onAchievementRewardMultiplierChange,
    koalaFlapPayoutEnabled,
    onToggleFlapPayout,
    onSaveKoalaConfig
}) => {
    return (
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
                            onClick={() => onSortChange(key)}
                        >
                            {key === 'username' ? 'Name' : key === 'createdAt' ? 'Joined' : 'Last Active'}
                            {sortConfig.key === key && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        </button>
                    ))}
                </div>
            </div>

            {[
                { title: 'Superadmins', count: superadminUsers.length, list: superadminUsers, color: 'var(--accent-primary)' },
                { title: 'Regular Users', count: regularUsers.length, list: regularUsers, color: 'var(--text-muted)' },
                { title: '👻 Ghost / Guest Accounts', count: guestUsers.length, list: guestUsers, color: '#f97316' }
            ].map(section => (
                <div key={section.title} style={{ marginBottom: '32px' }}>
                    <h4 
                        style={{ 
                            marginBottom: '16px', 
                            color: section.color, 
                            borderBottom: `1px solid ${section.color}40`, 
                            paddingBottom: '8px',
                            display: 'space-between',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            userSelect: 'none',
                            display: 'flex'
                        }}
                        onClick={() => onToggleSection(section.title)}
                    >
                        <span>{section.title} ({section.count})</span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                            {collapsedSections[section.title] ? 'Show [ + ]' : 'Hide [ − ]'}
                        </span>
                    </h4>
                    {!collapsedSections[section.title] && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {section.list.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No users found in this category.</div>
                        ) : section.list.map(u => (
                            <div key={u.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: u.is_banned ? '1px solid #ef4444' : '1px solid var(--border-color)', opacity: u.is_banned ? 0.7 : 1 }}>
                                <div style={{ flex: '1 1 250px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ textDecoration: u.is_banned ? 'line-through' : 'none' }}>{u.username || u.displayName || u.id}</span>
                                        {u.is_guest ? <span style={{ fontSize: '0.65rem', background: '#f97316', color: 'white', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Guest</span> : null}
                                        {u.is_banned ? <span style={{ fontSize: '0.65rem', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Banned</span> : null}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Display Name: {u.displayName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>ID: {u.id}</div>
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
                                        onClick={() => onViewFriends(u.id)}
                                    >
                                        {expandedUserFriends === u.id ? 'Hide Friends' : 'See Friends'}
                                    </button>
                                    <button
                                        className="btn-ghost"
                                        style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
                                        onClick={() => onViewKoalaCoins(u.id)}
                                    >
                                        {expandedKoalaUser === u.id ? '⬆ KoalaCoins' : '💰 KoalaCoins'}
                                    </button>
                                    <button
                                        className={u.is_superadmin ? 'btn-primary' : 'btn-ghost'}
                                        style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '8px', background: u.is_superadmin ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)' }}
                                        onClick={() => onToggleSuperadmin(u.id, u.is_superadmin)}
                                    >
                                        {u.is_superadmin ? 'Superadmin' : 'Make Superadmin'}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                        onClick={() => onPasswordChange(u.id)}
                                    >
                                        Change Password
                                    </button>
                                    {u.is_banned ? (
                                        <button
                                            className="btn-primary"
                                            style={{ padding: '8px 16px', fontSize: '0.85rem', background: '#3b82f6', color: 'white' }}
                                            onClick={() => onUnbanUser(u.id)}
                                        >
                                            Unban
                                        </button>
                                    ) : (
                                        <button
                                            className="btn-ghost"
                                            style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}
                                            onClick={() => onBanUser(u.id, u.username)}
                                        >
                                            Ban
                                        </button>
                                    )}
                                    <button
                                        className="btn-ghost"
                                        style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
                                        onClick={() => onDeleteUser(u.id, u.username)}
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
                                                onAdjustKoalaCoins(u.id, Math.abs(amt), reason);
                                            }}>+ Add</button>
                                            <button className="btn-ghost" style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }} onClick={() => {
                                                const amt = parseInt(document.getElementById(`koala-amount-${u.id}`).value) || 0;
                                                const reason = document.getElementById(`koala-reason-${u.id}`).value || 'Admin adjustment';
                                                onAdjustKoalaCoins(u.id, -Math.abs(amt), reason);
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
                    )}
                </div>
            ))}

            {/* KoalaCoins Config inside Users tab */}
            <div className="glass-card animate-fade-in" style={{ padding: '32px', marginTop: '32px', border: '1px solid rgba(251,191,36,0.3)' }}>
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                    <Dices size={24} color="#fbbf24" /> KoalaCoins Global Configuration
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
                                onKoalaBaselineStrChange(e.target.value);
                                const parsed = parseFloat(e.target.value);
                                if (!isNaN(parsed)) onKoalaBaselineChange(Math.round(parsed * 100));
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
                                onKoalaStartCoinsStrChange(e.target.value);
                                const parsed = parseFloat(e.target.value);
                                if (!isNaN(parsed)) onKoalaStartCoinsChange(Math.round(parsed * 100));
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
                                onKoalaCoinRateStrChange(e.target.value);
                                const parsed = parseFloat(e.target.value);
                                if (!isNaN(parsed)) onKoalaCoinRateChange(parsed);
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
                                onKoalaDailyMissionMultiplierStrChange(e.target.value);
                                const parsed = parseFloat(e.target.value);
                                if (!isNaN(parsed)) onKoalaDailyMissionMultiplierChange(parsed);
                            }}
                            min="0"
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: '200px', maxWidth: '180px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Achievement Multiplier</label>
                        <div style={{ fontSize: '0.75rem', color: '#a855f7', marginBottom: '8px' }}>Val: {achievementRewardMultiplierStr}x Stunden</div>
                        <input
                            type="number"
                            step="0.1"
                            className="input-primary"
                            style={{ width: '100%' }}
                            value={achievementRewardMultiplierStr}
                            onChange={(e) => {
                                onAchievementRewardMultiplierStrChange(e.target.value);
                                const parsed = parseFloat(e.target.value);
                                if (!isNaN(parsed)) onAchievementRewardMultiplierChange(parsed);
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
                            onClick={onToggleFlapPayout}
                        >
                            {koalaFlapPayoutEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>
                    <button className="btn-primary" style={{ padding: '10px 24px', whiteSpace: 'nowrap' }} onClick={onSaveKoalaConfig}>
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserManagementTab;
