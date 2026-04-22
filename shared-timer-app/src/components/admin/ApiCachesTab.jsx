import React from 'react';

const ApiCachesTab = ({ 
    cacheStatus, 
    availableTeams, 
    esportsLastUpdated, 
    formatCacheAge, 
    onFlush, 
    onRefreshTeams 
}) => {
    if (!cacheStatus) return null;

    return (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0 }}>Polymarket API (Esports)</h3>
                    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', background: cacheStatus.polymarketEsports.isCached ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: cacheStatus.polymarketEsports.isCached ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                        {cacheStatus.polymarketEsports.isCached ? 'CACHED' : 'EMPTY'}
                    </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Events cached:</span>
                        <strong>{cacheStatus.polymarketEsports.items} events</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Cache age:</span>
                        <strong>{formatCacheAge(cacheStatus.polymarketEsports.ageSeconds)}</strong>
                    </div>
                </div>
                <button className="btn-secondary" onClick={() => onFlush('polymarket')} style={{ marginTop: 'auto', padding: '12px', borderColor: '#ef4444', color: '#ef4444' }}>Polymarket (Esports) Cache leeren</button>
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
                <button className="btn-secondary" onClick={() => onFlush('oddsapi')} style={{ marginTop: 'auto', padding: '12px', borderColor: '#ef4444', color: '#ef4444' }}>The Odds API Cache leeren</button>
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
                <button className="btn-secondary" onClick={onRefreshTeams} style={{ marginTop: 'auto', padding: '12px', borderColor: '#ef4444', color: '#ef4444' }}>Esports Teams DB aktualisieren</button>
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
                <button className="btn-secondary" onClick={() => onFlush('lolesports')} style={{ marginTop: 'auto', padding: '12px', borderColor: '#ef4444', color: '#ef4444' }}>LoLEsports Schedule Cache leeren</button>
            </div>

            <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0 }}>Polymarket API (General Resolution)</h3>
                    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', background: cacheStatus.polymarketGeneral.isCached ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: cacheStatus.polymarketGeneral.isCached ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                        {cacheStatus.polymarketGeneral.isCached ? 'CACHED' : 'EMPTY'}
                    </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Active General Bets:</span>
                        <strong>{cacheStatus.polymarketGeneral.items} events</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Cache age:</span>
                        <strong>{formatCacheAge(cacheStatus.polymarketGeneral.ageSeconds)}</strong>
                    </div>
                </div>
                <button className="btn-secondary" onClick={() => onFlush('polymarket')} style={{ marginTop: 'auto', padding: '12px', borderColor: '#ef4444', color: '#ef4444' }}>Polymarket (General) Cache leeren</button>
            </div>

            <button className="btn-primary" onClick={() => onFlush('all')} style={{ gridColumn: '1 / -1', background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderColor: '#ef4444' }}>Purge All Server Caches</button>
        </div>
    );
};

export default ApiCachesTab;
