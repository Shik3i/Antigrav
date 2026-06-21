import React from 'react';
import * as LucideIcons from 'lucide-react';

const SidebarSettingsTab = ({
    navbarSettings,
    onSetNavbarSettings,
    onSave
}) => {
    const categories = ['Timers', 'Esports', 'Games', 'Social', 'Tools', 'System', 'Other', ...new Set(navbarSettings.map(n => n.category).filter(c => !['Timers', 'Esports', 'Games', 'Social', 'Tools', 'System', 'Other'].includes(c)))];

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ margin: 0 }}>Navigation Settings</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Steuere die Sichtbarkeit und Reihenfolge der Links in der Sidebar.</p>
                </div>
                <button className="btn-primary" onClick={onSave} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <LucideIcons.Save size={18} /> Save Changes
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {categories.map(category => {
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
                                                                onSetNavbarSettings(newSettings);
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
                                                                    onSetNavbarSettings(newSettings);
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
                                                                onSetNavbarSettings(newSettings);
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
                                                                onSetNavbarSettings(newSettings);
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
                                                                onSetNavbarSettings(newSettings);
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
                                                                    onSetNavbarSettings(newSettings);
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
                                                                    const newSettings = [...navbarSettings];
                                                                    const currentCategoryItems = newSettings.filter(n => n.category === category);
                                                                    const neighbor = currentCategoryItems[nestedIndex - 1];
                                                                    if (!neighbor) return;
                                                                    const idxSelf = newSettings.findIndex(n => n.key === item.key);
                                                                    const idxNeighbor = newSettings.findIndex(n => n.key === neighbor.key);
                                                                    const tempOrder = newSettings[idxSelf].sortOrder;
                                                                    newSettings[idxSelf].sortOrder = newSettings[idxNeighbor].sortOrder;
                                                                    newSettings[idxNeighbor].sortOrder = tempOrder;
                                                                    onSetNavbarSettings([...newSettings].sort((a,b) => a.sortOrder - b.sortOrder));
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
                                                                    const newSettings = [...navbarSettings];
                                                                    const currentCategoryItems = newSettings.filter(n => n.category === category);
                                                                    const neighbor = currentCategoryItems[nestedIndex + 1];
                                                                    if (!neighbor) return;
                                                                    const idxSelf = newSettings.findIndex(n => n.key === item.key);
                                                                    const idxNeighbor = newSettings.findIndex(n => n.key === neighbor.key);
                                                                    const tempOrder = newSettings[idxSelf].sortOrder;
                                                                    newSettings[idxSelf].sortOrder = newSettings[idxNeighbor].sortOrder;
                                                                    newSettings[idxNeighbor].sortOrder = tempOrder;
                                                                    onSetNavbarSettings([...newSettings].sort((a,b) => a.sortOrder - b.sortOrder));
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
    );
};

export default SidebarSettingsTab;
