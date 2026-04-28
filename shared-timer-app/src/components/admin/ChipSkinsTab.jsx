import React, { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

const CHIP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000];
const RARITIES = ['common', 'rare', 'epic', 'legendary', 'limited', 'exclusive'];
const STATUSES = ['draft', 'public', 'restricted', 'disabled'];

const labelStyle = {
    display: 'block',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginBottom: '8px',
    textTransform: 'uppercase',
    fontWeight: 700
};

const fieldStyle = { width: '100%' };

const getAsset = (skin, value) => {
    return skin?.assets?.[value] || skin?.assets?.[String(value)] || null;
};

const getUserLabel = (user) => {
    return user?.username || user?.displayName || user?.id || 'Unknown user';
};

const ChipSkinsTab = ({
    skins,
    users,
    form,
    selectedSkinId,
    grants,
    onFormChange,
    onSelectSkin,
    onCreateNew,
    onSave,
    onUploadAsset,
    onFetchGrants,
    onGrant,
    onRevoke,
}) => {
    const [grantUserId, setGrantUserId] = useState('');
    const [pendingUploads, setPendingUploads] = useState({});

    const selectedSkin = useMemo(
        () => skins.find((skin) => Number(skin.id) === Number(selectedSkinId)),
        [skins, selectedSkinId]
    );

    useEffect(() => {
        setPendingUploads({});
        setGrantUserId('');
        if (selectedSkinId) {
            onFetchGrants(selectedSkinId);
        }
    }, [selectedSkinId]);

    const availableGrantUsers = useMemo(() => {
        const grantedIds = new Set((grants || []).map((grant) => String(grant.user_id)));
        return (users || []).filter((user) => !grantedIds.has(String(user.id)));
    }, [grants, users]);

    const handleAssetFile = async (value, file) => {
        if (!file || !selectedSkinId) return;

        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const uploaded = await onUploadAsset(selectedSkinId, value, file.name, dataUrl);
        if (uploaded) {
            setPendingUploads((prev) => ({
                ...prev,
                [`${selectedSkinId}:${value}`]: dataUrl,
            }));
        }
    };

    const handleGrant = async () => {
        if (!selectedSkin?.id || !grantUserId) return;
        await onGrant(selectedSkin.id, grantUserId);
        setGrantUserId('');
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={24} color="var(--accent-primary)" />
                        Chip-Skins
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Manage casino chip skin metadata, PNG assets, release status, and restricted user grants.
                    </p>
                </div>
                <button type="button" className="btn-primary" onClick={onCreateNew}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    New Skin
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(360px, 1.4fr)', gap: '24px', alignItems: 'start' }}>
                <div className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0 }}>Skins ({skins.length})</h4>
                    </div>
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {skins.map((skin) => {
                            const isSelected = Number(selectedSkinId) === Number(skin.id);
                            return (
                                <button
                                    key={skin.id}
                                    type="button"
                                    className={isSelected ? 'btn-primary' : 'btn-secondary'}
                                    onClick={() => {
                                        onSelectSkin(skin);
                                    }}
                                    style={{ textAlign: 'left', display: 'grid', gap: '6px', justifyItems: 'stretch' }}
                                >
                                    <span style={{ fontWeight: 800 }}>{skin.name}</span>
                                    <span style={{ fontSize: '0.75rem', opacity: isSelected ? 0.95 : 0.75 }}>
                                        {skin.slug} · {skin.status} · {skin.rarity}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', opacity: isSelected ? 0.95 : 0.75 }}>
                                        Release: {skin.release_date ? new Date(skin.release_date).toLocaleString() : 'Not set'} · Assets: {skin.asset_count || Object.keys(skin.assets || {}).length}/8
                                    </span>
                                </button>
                            );
                        })}
                        {skins.length === 0 && (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                                No chip skins yet.
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gap: '20px' }}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h4 style={{ margin: '0 0 20px' }}>{form.id ? 'Edit Skin' : 'Create Skin'}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Name</label>
                                <input className="input-primary" style={fieldStyle} value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Slug</label>
                                <input className="input-primary" style={fieldStyle} value={form.slug} onChange={(e) => onFormChange({ ...form, slug: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Status</label>
                                <select className="input-primary" style={fieldStyle} value={form.status} onChange={(e) => onFormChange({ ...form, status: e.target.value })}>
                                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Rarity</label>
                                <select className="input-primary" style={fieldStyle} value={form.rarity} onChange={(e) => onFormChange({ ...form, rarity: e.target.value })}>
                                    {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Release Date</label>
                                <input className="input-primary" style={fieldStyle} type="datetime-local" value={form.release_date} onChange={(e) => onFormChange({ ...form, release_date: e.target.value })} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Description</label>
                                <textarea
                                    className="input-primary"
                                    style={{ ...fieldStyle, minHeight: '92px', resize: 'vertical' }}
                                    value={form.description}
                                    onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                                />
                            </div>
                        </div>
                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button type="button" className="btn-primary" onClick={onSave}>Save Skin</button>
                        </div>
                    </div>

                    {selectedSkin && (
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h4 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ImagePlus size={20} color="var(--accent-primary)" />
                                PNG Assets
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                                {CHIP_VALUES.map((value) => {
                                    const asset = getAsset(selectedSkin, value);
                                    const previewSrc = pendingUploads[`${selectedSkinId}:${value}`] || asset?.url;
                                    return (
                                        <label key={value} style={{ display: 'grid', gap: '10px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                                            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{value} KC</span>
                                            <div style={{ height: '58px', display: 'grid', placeItems: 'center', borderRadius: '8px', background: 'rgba(0,0,0,0.18)' }}>
                                                {previewSrc ? (
                                                    <img src={previewSrc} alt={`${value} KC chip preview`} style={{ maxWidth: '52px', maxHeight: '52px', objectFit: 'contain' }} />
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Missing</span>
                                                )}
                                            </div>
                                            <input type="file" accept="image/png" onChange={(e) => handleAssetFile(value, e.target.files?.[0])} style={{ fontSize: '0.75rem', maxWidth: '100%' }} />
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {selectedSkin && (
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                                <h4 style={{ margin: 0 }}>Restricted Grants</h4>
                                <button type="button" className="btn-ghost" onClick={() => onFetchGrants(selectedSkin.id)}>
                                    <RefreshCw size={16} style={{ marginRight: '8px' }} />
                                    Refresh
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                <select className="input-primary" style={{ flex: '1 1 240px' }} value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)}>
                                    <option value="">Select user</option>
                                    {availableGrantUsers.map((user) => (
                                        <option key={user.id} value={user.id}>{getUserLabel(user)}</option>
                                    ))}
                                </select>
                                <button type="button" className="btn-secondary" onClick={handleGrant} disabled={!grantUserId}>Grant</button>
                            </div>
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {grants.map((grant) => (
                                    <div key={grant.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{grant.username || grant.displayName || grant.user_id}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{grant.user_id}</div>
                                        </div>
                                        <button type="button" className="btn-ghost" style={{ color: '#ef4444' }} onClick={() => onRevoke(selectedSkin.id, grant.user_id)}>
                                            <Trash2 size={16} style={{ marginRight: '8px' }} />
                                            Revoke
                                        </button>
                                    </div>
                                ))}
                                {grants.length === 0 && (
                                    <div style={{ padding: '16px', color: 'var(--text-muted)', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                                        No restricted grants for this skin.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChipSkinsTab;
