import React from 'react';
import * as LucideIcons from 'lucide-react';

const WordleDictionaryTab = ({
    wordleDictionary,
    showWordleImportExport,
    onToggleShowImportExport,
    bulkMetadataInput,
    onSetBulkMetadataInput,
    isBulkUpdating,
    onBulkUpdate,
    onExport,
    wordleFilterNoDef,
    onSetWordleFilterNoDef,
    wordleFilterNoQuote,
    onSetWordleFilterNoQuote,
    wordleFilterUsed,
    onSetWordleFilterUsed,
    wordleFilterUnused,
    onSetWordleFilterUnused,
    wordleSearch,
    onSetWordleSearch,
    onAddWord,
    editingWordId,
    onSetEditingWordId,
    editWordDef,
    onSetEditWordDef,
    editWordQuote,
    onSetEditWordQuote,
    onUpdateMetadata,
    onDeleteWord
}) => {
    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Bulk Actions Section */}
            <div className="glass-card" style={{ padding: '24px' }}>
                <div 
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={onToggleShowImportExport}
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
                                onChange={(e) => onSetBulkMetadataInput(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button 
                                    className="btn-primary" 
                                    style={{ flex: 1, justifyContent: 'center' }}
                                    disabled={isBulkUpdating || !bulkMetadataInput.trim()}
                                    onClick={onBulkUpdate}
                                >
                                    {isBulkUpdating ? 'Processing...' : 'Run Bulk Upsert'}
                                </button>
                                <button
                                    className="btn-secondary"
                                    onClick={() => onSetBulkMetadataInput('')}
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
                                onClick={onExport}
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
                                onClick={() => onSetWordleFilterNoDef(!wordleFilterNoDef)}
                            >
                                No Def
                            </button>
                            <button 
                                className={wordleFilterNoQuote ? 'btn-primary' : 'btn-ghost'} 
                                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                onClick={() => onSetWordleFilterNoQuote(!wordleFilterNoQuote)}
                            >
                                No Quote
                            </button>
                            <button 
                                className={wordleFilterUsed ? 'btn-primary' : 'btn-ghost'} 
                                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                onClick={() => {
                                    onSetWordleFilterUsed(!wordleFilterUsed);
                                    if (!wordleFilterUsed) onSetWordleFilterUnused(false);
                                }}
                            >
                                Used
                            </button>
                            <button 
                                className={wordleFilterUnused ? 'btn-primary' : 'btn-ghost'} 
                                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                onClick={() => {
                                    onSetWordleFilterUnused(!wordleFilterUnused);
                                    if (!wordleFilterUnused) onSetWordleFilterUsed(false);
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
                            onChange={(e) => onSetWordleSearch(e.target.value.toUpperCase())}
                        />
                        <button className="btn-primary" onClick={() => {
                            const word = prompt("Enter 5-letter word:");
                            if (word) onAddWord(word.toUpperCase());
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
                                                        onChange={(e) => onSetEditWordDef(e.target.value)}
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
                                                        onChange={(e) => onSetEditWordQuote(e.target.value)}
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
                                                                onClick={() => onUpdateMetadata(w.id)}
                                                            >
                                                                <LucideIcons.Check size={18} />
                                                            </button>
                                                            <button 
                                                                className="btn-ghost" 
                                                                style={{ color: 'var(--text-muted)' }}
                                                                onClick={() => onSetEditingWordId(null)}
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
                                                                    onSetEditingWordId(w.id);
                                                                    onSetEditWordDef(w.definition || '');
                                                                    onSetEditWordQuote(w.funny_quote || '');
                                                                }}
                                                            >
                                                                <LucideIcons.Edit2 size={16} />
                                                            </button>
                                                            <button 
                                                                className="btn-ghost" 
                                                                style={{ color: '#ef4444' }}
                                                                onClick={() => onDeleteWord(w.id)}
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
    );
};

export default WordleDictionaryTab;
