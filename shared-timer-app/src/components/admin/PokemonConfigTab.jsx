import React from 'react';
import * as LucideIcons from 'lucide-react';

const PokemonConfigTab = ({
    pokemonConfigs,
    onSetPokemonConfigs,
    onSave,
    pokemonTypes
}) => {
    return (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0 }}>Pokémon System Configuration</h3>
                <button className="btn-primary" onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                            onChange={(e) => onSetPokemonConfigs(prev => ({ 
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
                {pokemonTypes.map(type => (
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
                                onChange={(e) => onSetPokemonConfigs(prev => ({
                                    ...prev,
                                    colors: { ...prev.colors, [type]: e.target.value }
                                }))}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PokemonConfigTab;
