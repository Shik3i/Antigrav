import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Dices } from 'lucide-react';

const ScratchcardPacksTab = ({
    scratchcardPacks,
    isEditingPack,
    onSetIsEditingPack,
    packForm,
    onSetPackForm,
    packTeams,
    onSetPackTeams,
    poolSearchInput,
    onSetPoolSearchInput,
    activePoolDropdown,
    onSetActivePoolDropdown,
    availableTeams,
    onSavePack,
    onEditPack,
    onDeletePack,
    onMoveTeam
}) => {
    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Dices size={24} color="var(--accent-primary)" />
                        Dynamic Scratchcard Packs
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Manage entire scratchcard sets, their teams, and win conditions.
                    </p>
                </div>
                <button className="btn-primary" onClick={() => {
                    onSetPackForm({ name: '', region_label: '', scope: 'Regional', price: 1000, win_chance: '25', reward_amount: 5000, is_weighted: false, max_daily_limit: 0, is_active: true, is_special: false });
                    onSetPackTeams([]);
                    onSetIsEditingPack('new');
                }}>
                    <LucideIcons.Plus size={18} style={{ marginRight: '8px' }} /> Create New Pack
                </button>
            </div>

            {isEditingPack && (
                <div className="glass-card" style={{ padding: '32px', marginBottom: '32px', border: '2px solid var(--accent-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h4 style={{ margin: 0 }}>{isEditingPack === 'new' ? 'Create New Scratchcard Pack' : 'Edit Pack'}</h4>
                        <button className="btn-ghost" onClick={() => onSetIsEditingPack(null)}>Cancel</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Pack Name (e.g. "LEC WINTER")</label>
                            <input type="text" className="input-primary" style={{ width: '100%' }} value={packForm.name} onChange={e => onSetPackForm({...packForm, name: e.target.value})} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Region Label (e.g. "Europe")</label>
                            <input type="text" className="input-primary" style={{ width: '100%' }} value={packForm.region_label} onChange={e => onSetPackForm({...packForm, region_label: e.target.value})} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Scope</label>
                            <select className="input-primary" style={{ width: '100%' }} value={packForm.scope} onChange={e => onSetPackForm({...packForm, scope: e.target.value})}>
                                <option value="Regional">Classic (Blue Theme)</option>
                                <option value="International">Premium (Gold Theme)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Price (KC)</label>
                            <input type="number" className="input-primary" style={{ width: '100%' }} value={packForm.price} onChange={e => onSetPackForm({...packForm, price: e.target.value})} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Win Chance (%)</label>
                            <input type="number" className="input-primary" style={{ width: '100%' }} value={packForm.win_chance} onChange={e => onSetPackForm({...packForm, win_chance: e.target.value})} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{packForm.is_weighted ? 'Weighted Rewards (Rank Based)' : 'Fixed Win Amount (KC)'}</label>
                            {packForm.is_weighted ? (
                                <div style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                    Jackpot: <span style={{ color: '#fbbf24', fontWeight: 700 }}>20.0x</span> Preis. Verwendet biquadratische Formel (Potenz 4) für faire Gewichtung. Letzter Platz gibt 2.0x (Geld verdoppelt).
                                </div>
                            ) : (
                                <input type="number" className="input-primary" style={{ width: '100%' }} value={packForm.reward_amount} onChange={e => onSetPackForm({...packForm, reward_amount: e.target.value})} />
                            )}
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Max. tägliches Limit pro User (0 = unbegrenzt)</label>
                            <input type="number" className="input-primary" style={{ width: '100%' }} value={packForm.max_daily_limit} onChange={e => onSetPackForm({...packForm, max_daily_limit: e.target.value})} />
                        </div>
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={packForm.is_weighted} onChange={e => onSetPackForm({...packForm, is_weighted: e.target.checked})} />
                                Weighted Rewards
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={packForm.is_active} onChange={e => onSetPackForm({...packForm, is_active: e.target.checked})} />
                                Active
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ec4899' }}>
                                <input type="checkbox" checked={packForm.is_special} onChange={e => onSetPackForm({...packForm, is_special: e.target.checked})} />
                                ✨ Special (Pink)
                            </label>
                        </div>
                    </div>

                    <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h5 style={{ margin: 0 }}>Team Pool ({packTeams.length})</h5>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{packForm.is_weighted ? 'Top = highest multiplier, Bottom = 1.0x' : 'All equal chance'}</p>
                            </div>
                            <div style={{ position: 'relative', marginBottom: '16px' }}>
                                <input
                                    type="text"
                                    className="input-primary"
                                    style={{ width: '100%', fontSize: '0.85rem' }}
                                    value={poolSearchInput}
                                    onChange={(e) => {
                                        onSetPoolSearchInput(e.target.value);
                                        onSetActivePoolDropdown('current');
                                    }}
                                    onFocus={() => onSetActivePoolDropdown('current')}
                                    onBlur={() => setTimeout(() => onSetActivePoolDropdown(null), 200)}
                                    placeholder="Search team to add..."
                                    autoComplete="off"
                                />
                                {activePoolDropdown === 'current' && poolSearchInput && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                        background: '#1a1b26', border: '1px solid var(--border-color)', borderRadius: '8px',
                                        maxHeight: '180px', overflowY: 'auto', marginTop: '4px', boxShadow: '0 8px 16px rgba(0,0,0,0.6)'
                                    }}>
                                        {availableTeams
                                            .filter(t => t.name?.toLowerCase().includes(poolSearchInput.toLowerCase()) || t.code?.toLowerCase().includes(poolSearchInput.toLowerCase()))
                                            .filter(t => !packTeams.includes(t.code))
                                            .slice(0, 8)
                                            .map(team => (
                                                <div
                                                    key={team.code}
                                                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                    onClick={() => {
                                                        onSetPackTeams([...packTeams, team.code]);
                                                        onSetPoolSearchInput('');
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.08)'}
                                                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {team.image && <img src={team.image} alt="" width="16" height="16" loading="lazy" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />}
                                                        <span style={{ color: 'white', fontSize: '0.85rem' }}>{team.name}</span>
                                                    </div>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>{team.code}</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto', padding: '4px' }}>
                                {packTeams.map((code, idx) => {
                                    const team = availableTeams.find(t => t.code === code) || { name: code, code };
                                    return (
                                        <div key={code} style={{ 
                                            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', 
                                            background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', minWidth: '24px' }}>#{idx + 1}</span>
                                            {team.image && <img src={team.image} alt="" width="20" height="20" loading="lazy" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{team.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{team.code}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button className="btn-ghost" style={{ padding: '4px' }} disabled={idx === 0} onClick={() => onMoveTeam(idx, -1)}>↑</button>
                                                <button className="btn-ghost" style={{ padding: '4px' }} disabled={idx === packTeams.length - 1} onClick={() => onMoveTeam(idx, 1)}>↓</button>
                                                <button className="btn-ghost" style={{ padding: '4px', color: '#ef4444' }} onClick={() => onSetPackTeams(packTeams.filter(c => c !== code))}>
                                                    <LucideIcons.Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {packTeams.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No teams added yet.</div>}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <h5 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <LucideIcons.TrendingUp size={18} color="var(--accent-primary)" />
                                Economy Balancing Tool
                            </h5>
                            
                            {packForm.is_weighted && packTeams.length > 1 ? (() => {
                                const N = packTeams.length;
                                let sumMultipliers = 0;
                                for (let r = 1; r <= N; r++) {
                                    const multiplier = 2 + 18 * Math.pow((N - r) / (N - 1), 4);
                                    sumMultipliers += multiplier;
                                }
                                const avgMultiplier = sumMultipliers / N;
                                const recommendedWinChance = (0.80 / avgMultiplier) * 100;
                                
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Durchschnittlicher Gewinn:</span>
                                            <span style={{ fontWeight: 700, color: 'white' }}>{avgMultiplier.toFixed(2)}-fach</span>
                                        </div>
                                        <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                            <div style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>Empfohlene Gewinnchance (80% RTP)</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>~ {recommendedWinChance.toFixed(1)}%</div>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                                            Basierend auf biquadratischer Formel (Potenz 4) und {N} Teams. Min 2.0x, Max 20.0x. Ein RTP von 80% sorgt für eine stabile Economy.
                                        </p>
                                    </div>
                                );
                            })() : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                                    Füge mindestens 2 Teams hinzu und aktiviere "Weighted Rewards" für die Analyse.
                                </div>
                            )}

                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <button className="btn-primary" style={{ padding: '12px 32px' }} onClick={onSavePack}>
                                    <LucideIcons.Save size={18} style={{ marginRight: '8px' }} /> {isEditingPack === 'new' ? 'Create' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {scratchcardPacks.map(pack => (
                    <div key={pack.id} className="glass-card" style={{ padding: '24px', border: pack.is_active ? '1px solid var(--border-color)' : '1px dashed rgba(255,0,0,0.3)', opacity: pack.is_active ? 1 : 0.7 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <h4 style={{ margin: 0 }}>{pack.name}</h4>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{pack.region_label || 'No Region'} • {pack.scope === 'International' ? 'Premium' : 'Classic'}{pack.is_special ? ' • ✨ Special' : ''}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-ghost" style={{ padding: '6px' }} onClick={() => onEditPack(pack.id)} title="Edit Pack">
                                    <LucideIcons.Monitor size={16} />
                                </button>
                                <button className="btn-ghost" style={{ padding: '6px', color: '#ef4444' }} onClick={() => onDeletePack(pack.id)} title="Delete Pack">
                                    <LucideIcons.Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Price:</span> {pack.price} KC
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Win:</span> {(pack.win_chance * 100).toFixed(1)}%
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Type:</span> {pack.is_weighted ? 'Weighted' : 'Fixed'}
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Limit:</span> {pack.max_daily_limit > 0 ? pack.max_daily_limit : 'None'}
                            </div>
                            <div style={{ color: pack.is_active ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                                {pack.is_active ? 'Active' : 'Inactive'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ScratchcardPacksTab;
