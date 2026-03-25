import React, { useState, useEffect, useMemo } from 'react';
import { 
    Lightbulb, ThumbsUp, ThumbsDown, Plus, Trash2, CheckCircle, 
    Clock, Construction, AlertCircle, XCircle, Filter, ArrowUpDown, MessageSquare, Download, Bug, Sparkles 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const FeatureRequests = () => {
    const { user, token, isGuest } = useAuth();
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [featureType, setFeatureType] = useState('Feature');
    
    // Sort & Filter State
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterType, setFilterType] = useState('All'); // 'All', 'Bug', 'Feature'
    const [sortBy, setSortBy] = useState('votes'); // 'votes' or 'newest'
    
    // Admin Comment State
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [adminCommentText, setAdminCommentText] = useState('');


    // Guest Voting State
    const [guestId, setGuestId] = useState(() => {
        let gid = localStorage.getItem('feature_guest_id');
        if (!gid) {
            gid = 'guest_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('feature_guest_id', gid);
        }
        return gid;
    });

    const [votedFeatures, setVotedFeatures] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('voted_features') || '{}');
        } catch (e) {
            return {};
        }
    });

    useEffect(() => {
        fetchFeatures();
    }, []);

    const fetchFeatures = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/features', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setFeatures(data);
            } else {
                setError(data.error || 'Failed to fetch feature requests');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            const res = await fetch('/api/features', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, description, type: featureType })
            });

            if (res.ok) {
                setTitle('');
                setDescription('');
                setFeatureType('Feature');
                setShowForm(false);
                fetchFeatures();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to submit feature');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    const handleVote = async (id, value) => {
        // If logged in, use standard flow. If guest, use guestId.
        const isUserLoggedIn = !isGuest;
        
        // Anti-spam check for guests
        if (!isUserLoggedIn && votedFeatures[id] !== undefined) {
             // Optional: Allow changing vote, but for simplicity let's just 
             // follow the "one vote per user" rule if the backend supports it.
             // Actually, the toggle in DB handles it.
        }

        try {
            const res = await fetch(`/api/features/${id}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': isUserLoggedIn ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ 
                    value, 
                    guestId: isUserLoggedIn ? null : guestId 
                })
            });

            if (res.ok) {
                if (!isUserLoggedIn) {
                    const newVotes = { ...votedFeatures, [id]: value };
                    setVotedFeatures(newVotes);
                    localStorage.setItem('voted_features', JSON.stringify(newVotes));
                }
                fetchFeatures();
            } else {
                const data = await res.json();
                alert(data.error || 'Vote failed');
            }
        } catch (err) {
            console.error('Vote error:', err);
        }
    };

    const handleExportAI = () => {
        const date = new Date().toLocaleDateString();
        let content = `### ANTIGRAVITY FEATURE ROADMAP EXPORT - ${date} ###\n`;
        content += `Filter: ${filterStatus} | Sort: ${sortBy}\n`;
        content += `--------------------------------------------------\n\n`;

        filteredAndSortedFeatures.forEach(f => {
            content += `[Status: ${f.status}] | Votes: ${f.score || 0}\n`;
            content += `Title: ${f.title}\n`;
            content += `Description: ${f.description || 'No description provided.'}\n`;
            content += `Admin Response: ${f.adminComment || 'None'}\n`;
            content += `--------------------------------------------------\n\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roadmap_export_ai_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const aiPrompt = `Im Anhang findest du eine .txt-Datei mit gesammelten Feature-Requests und Votes aus unserer Community. 

Deine Aufgabe als technischer Projektmanager ist es, diese Liste zu analysieren und daraus einen perfekten, hochdetaillierten Arbeits-Prompt für unseren autonomen Coding-Agenten "Antigravity" zu schreiben.

Schreibe den Prompt aus meiner Perspektive an den Agenten, sodass ich deinen Text einfach nur kopieren und bei Antigravity einfügen muss.

Der von dir generierte Prompt MUSS zwingend folgende Elemente enthalten:
1. Eine klare, logisch strukturierte Zusammenfassung der umzusetzenden Features aus der angehängten Datei (ignoriere unwichtigen Quatsch, fokussiere dich auf die Top-Features).
2. Die strikte Anweisung an den Agenten: "Erstelle IMMER zuerst einen detaillierten, schrittweisen Implementierungsplan, bevor du anfängst zu programmieren oder Dateien zu ändern."
3. Die strikte Anweisung an den Agenten: "Bevor du vorgenommene Code-Änderungen testest, musst du zwingend das Skript 'restart_server.bat' ausführen, um den Server neu zu starten und sicherzugehen, dass die Änderungen aktiv sind."
4. Den Hinweis an den Agenten: "Die Anwendung läuft lokal auf Port 3001. Alle Tests müssen über diesen Port erfolgen."`;

        navigator.clipboard.writeText(aiPrompt).then(() => {
            console.log("AI-Prompt in die Zwischenablage kopiert.");
        }).catch(err => {
            console.error('Fehler beim Kopieren in die Zwischenablage:', err);
        });
    };

    const handleStatusUpdate = async (id, status) => {
        if (!user?.is_superadmin) return;

        try {
            const res = await fetch(`/api/features/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                fetchFeatures();
            }
        } catch (err) {
            console.error('Status update error:', err);
        }
    };

    const handleCommentUpdate = async (id) => {
        if (!user?.is_superadmin) return;

        try {
            const res = await fetch(`/api/features/${id}/comment`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ comment: adminCommentText })
            });

            if (res.ok) {
                setEditingCommentId(null);
                setAdminCommentText('');
                fetchFeatures();
            }
        } catch (err) {
            console.error('Comment update error:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!user?.is_superadmin) return;
        if (!window.confirm('Are you sure you want to delete this feature request?')) return;

        try {
            const res = await fetch(`/api/features/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                fetchFeatures();
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const filteredAndSortedFeatures = useMemo(() => {
        let result = [...features];
        
        // Filter by status
        if (filterStatus !== 'All') {
            result = result.filter(f => f.status === filterStatus);
        }
        
        // Filter by type
        if (filterType !== 'All') {
            result = result.filter(f => (f.type || 'Feature') === filterType);
        }
        
        // Sort
        result.sort((a, b) => {
            if (sortBy === 'votes') {
                return (b.score || 0) - (a.score || 0);
            } else if (sortBy === 'newest') {
                return new Date(b.createdAt) - new Date(a.createdAt);
            } else if (sortBy === 'oldest') {
                return new Date(a.createdAt) - new Date(b.createdAt);
            }
            return 0;
        });
        
        return result;
    }, [features, filterStatus, filterType, sortBy]);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed': return <CheckCircle size={18} color="#22c55e" />;
            case 'In Progress': return <Construction size={18} color="#f59e0b" />;
            case 'Planned': return <Clock size={18} color="#3b82f6" />;
            case 'Rejected': return <XCircle size={18} color="#ef4444" />;
            default: return <AlertCircle size={18} color="var(--text-muted)" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed': return 'rgba(34,197,94,0.1)';
            case 'In Progress': return 'rgba(245,158,11,0.1)';
            case 'Planned': return 'rgba(59,130,246,0.1)';
            case 'Rejected': return 'rgba(239,68,68,0.1)';
            default: return 'rgba(255,255,255,0.05)';
        }
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 0', paddingBottom: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Lightbulb size={32} color="#fbbf24" />
                    <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Feature Roadmap</h1>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {user?.is_superadmin && (
                        <button className="btn-secondary" onClick={handleExportAI} title="Export for AI Analysis">
                            <Download size={18} style={{ marginRight: '8px' }} /> Export for AI
                        </button>
                    )}
                    {user && !isGuest && (
                        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                            <Plus size={18} style={{ marginRight: '8px' }} /> Propose Feature
                        </button>
                    )}
                </div>
            </div>

            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                Suggest and vote on upcoming features. Help us prioritize what to build next!
            </p>

            {showForm && (
                <div className="glass-card zoom-in" style={{ padding: '24px', marginBottom: '32px', borderLeft: '4px solid #fbbf24' }}>
                    <h3 style={{ margin: '0 0 16px 0' }}>Request a Feature</h3>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Feature Title</label>
                            <input 
                                type="text" 
                                className="input-primary" 
                                style={{ width: '100%' }}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Dark Mode for the entire app"
                                required
                            />
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Description (optional)</label>
                            <textarea 
                                className="input-primary" 
                                style={{ width: '100%', minHeight: '80px', paddingTop: '10px' }}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Explain why this feature would be useful..."
                            />
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Type</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', background: featureType === 'Feature' ? 'rgba(251, 191, 36, 0.15)' : 'transparent', border: featureType === 'Feature' ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid rgba(255,255,255,0.1)' }} onClick={() => setFeatureType('Feature')}>
                                    <Sparkles size={14} color="#fbbf24" /> Feature
                                </button>
                                <button type="button" className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', background: featureType === 'Bug' ? 'rgba(239, 68, 68, 0.15)' : 'transparent', border: featureType === 'Bug' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.1)' }} onClick={() => setFeatureType('Bug')}>
                                    <Bug size={14} color="#ef4444" /> Bug
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                            <button type="submit" className="btn-primary">Submit Proposal</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter & Sort Bar */}
            <div className="glass-card" style={{ 
                padding: '12px 20px', marginBottom: '24px', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={16} color="var(--text-muted)" />
                    <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
                        {['All', 'Pending Review', 'Planned', 'In Progress', 'Completed', 'Rejected'].map(status => (
                            <button 
                                key={status}
                                className={`btn-ghost ${filterStatus === status ? 'active' : ''}`}
                                style={{ 
                                    padding: '4px 10px', fontSize: '0.75rem', 
                                    whiteSpace: 'nowrap',
                                    background: filterStatus === status ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    border: filterStatus === status ? '1px solid var(--border-color)' : '1px solid transparent'
                                }}
                                onClick={() => setFilterStatus(status)}
                            >
                                {status === 'Pending Review' ? 'Pending' : status}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Type Filter */}
                    <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '12px' }}>
                        {['All', 'Feature', 'Bug'].map(type => (
                            <button 
                                key={type}
                                className={`btn-ghost ${filterType === type ? 'active' : ''}`}
                                style={{ 
                                    padding: '4px 10px', fontSize: '0.75rem', 
                                    whiteSpace: 'nowrap',
                                    background: filterType === type ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    border: filterType === type ? '1px solid var(--border-color)' : '1px solid transparent',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                                onClick={() => setFilterType(type)}
                            >
                                {type === 'Bug' && <Bug size={12} color="#ef4444" />}
                                {type === 'Feature' && <Sparkles size={12} color="#fbbf24" />}
                                {type}
                            </button>
                        ))}
                    </div>

                    <ArrowUpDown size={16} color="var(--text-muted)" />
                    <select 
                        className="btn-ghost" 
                        style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white' }}
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="votes" style={{ background: '#0f172a' }}>Top Voted</option>
                        <option value="newest" style={{ background: '#0f172a' }}>Newest First</option>
                        <option value="oldest" style={{ background: '#0f172a' }}>Oldest First</option>
                    </select>
                </div>
            </div>

            {(() => {
                const activeFeatures = filteredAndSortedFeatures.filter(f => f.status !== 'Completed' && f.status !== 'Rejected');
                const archivedFeatures = filteredAndSortedFeatures.filter(f => f.status === 'Completed' || f.status === 'Rejected');
                
                const renderFeatureCard = (feature) => (
                        <div key={feature.id} className="glass-card slide-up" style={{ padding: '24px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '40px' }}>
                                <button 
                                    className="btn-ghost" 
                                    style={{ padding: '6px', color: (votedFeatures[feature.id] === 1) ? '#22c55e' : 'var(--text-muted)' }}
                                    onClick={() => handleVote(feature.id, 1)}
                                >
                                    <ThumbsUp size={22} fill={votedFeatures[feature.id] === 1 ? 'currentColor' : 'none'} />
                                </button>
                                <span style={{ fontWeight: 800, fontSize: '1.25rem', color: feature.score >= 0 ? 'white' : '#ef4444' }}>
                                    {feature.score || 0}
                                </span>
                                <button 
                                    className="btn-ghost" 
                                    style={{ padding: '6px', color: (votedFeatures[feature.id] === -1) ? '#ef4444' : 'var(--text-muted)' }}
                                    onClick={() => handleVote(feature.id, -1)}
                                >
                                    <ThumbsDown size={22} fill={votedFeatures[feature.id] === -1 ? 'currentColor' : 'none'} />
                                </button>
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600 }}>{feature.title}</h3>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Proposed by {feature.userName} on {new Date(feature.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ 
                                            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', 
                                            borderRadius: '12px', 
                                            background: (feature.type || 'Feature') === 'Bug' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                                            border: (feature.type || 'Feature') === 'Bug' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(251, 191, 36, 0.2)',
                                            fontSize: '0.7rem', fontWeight: 700
                                        }}>
                                            {(feature.type || 'Feature') === 'Bug' ? <Bug size={12} color="#ef4444" /> : <Sparkles size={12} color="#fbbf24" />}
                                            <span style={{ color: (feature.type || 'Feature') === 'Bug' ? '#ef4444' : '#fbbf24' }}>{feature.type || 'Feature'}</span>
                                        </div>
                                        <div style={{ 
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', 
                                            borderRadius: '20px', background: getStatusColor(feature.status),
                                            fontSize: '0.8rem', fontWeight: 600
                                        }}>
                                            {getStatusIcon(feature.status)}
                                            {feature.status}
                                        </div>
                                    </div>
                                </div>
                                
                                <p style={{ margin: '16px 0', color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.6 }}>
                                    {feature.description || 'No description provided.'}
                                </p>

                                {/* Admin Comment (Blue Post) - Collapsible */}
                                {feature.adminComment && (
                                    <details style={{ marginTop: '20px' }}>
                                        <summary style={{ 
                                            cursor: 'pointer', color: '#3b82f6', fontSize: '0.85rem', 
                                            fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                                            outline: 'none', listStyle: 'none'
                                        }}>
                                            <div style={{ 
                                                background: '#3b82f6', color: 'white', padding: '2px 8px', 
                                                borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700,
                                                textTransform: 'uppercase', letterSpacing: '0.5px',
                                                display: 'flex', alignItems: 'center', gap: '4px'
                                            }}>
                                                <MessageSquare size={12} /> Developer Response
                                            </div>
                                            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>(Click to expand)</span>
                                        </summary>
                                        <div style={{ 
                                            marginTop: '12px', padding: '16px', borderRadius: '12px',
                                            background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)',
                                            borderLeft: '4px solid #3b82f6'
                                        }}>
                                            <p style={{ margin: 0, color: '#93c5fd', fontSize: '0.9rem', lineHeight: 1.5, fontStyle: 'italic' }}>
                                                {feature.adminComment}
                                            </p>
                                        </div>
                                    </details>
                                )}

                                {user?.is_superadmin && (
                                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '8px' }}>Status:</span>
                                            {['Pending Review', 'Planned', 'In Progress', 'Completed', 'Rejected'].map(status => (
                                                <button 
                                                    key={status}
                                                    className="btn-ghost"
                                                    style={{ 
                                                        padding: '4px 8px', fontSize: '0.7rem', 
                                                        background: feature.status === status ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                        border: feature.status === status ? '1px solid var(--border-color)' : 'none'
                                                    }}
                                                    onClick={() => handleStatusUpdate(feature.id, status)}
                                                >
                                                    {status === 'Pending Review' ? 'Pending' : status}
                                                </button>
                                            ))}
                                            
                                            <button 
                                                className="btn-ghost" 
                                                style={{ padding: '4px 10px', fontSize: '0.7rem', color: 'var(--accent-primary)', marginLeft: '8px' }}
                                                onClick={() => {
                                                    setEditingCommentId(feature.id);
                                                    setAdminCommentText(feature.adminComment || '');
                                                }}
                                            >
                                                <MessageSquare size={14} style={{ marginRight: '6px' }} />
                                                {feature.adminComment ? 'Edit Response' : 'Add Response'}
                                            </button>

                                            <button 
                                                className="btn-ghost" 
                                                style={{ marginLeft: 'auto', color: '#ef4444' }}
                                                onClick={() => handleDelete(feature.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {editingCommentId === feature.id && (
                                            <div className="zoom-in" style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                <textarea 
                                                    className="input-primary"
                                                    style={{ width: '100%', minHeight: '80px', fontSize: '0.9rem', marginBottom: '12px' }}
                                                    value={adminCommentText}
                                                    onChange={(e) => setAdminCommentText(e.target.value)}
                                                    placeholder="Write an official developer response..."
                                                />
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setEditingCommentId(null)}>Cancel</button>
                                                    <button className="btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleCommentUpdate(feature.id)}>Save Comment</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                );

                return (
                    <>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>Loading features...</div>
                        ) : filteredAndSortedFeatures.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px' }} className="glass-card">
                                <p style={{ color: 'var(--text-muted)' }}>No feature requests match your criteria.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                {/* Active Features */}
                                {activeFeatures.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {activeFeatures.map(renderFeatureCard)}
                                    </div>
                                )}

                                {/* Archived Features */}
                                {archivedFeatures.length > 0 && (
                                    <details className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                                        <summary style={{ 
                                            cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', 
                                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                                            outline: 'none', listStyle: 'none'
                                        }}>
                                            Archived Features (Completed / Rejected) - {archivedFeatures.length}
                                        </summary>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                            {archivedFeatures.map(renderFeatureCard)}
                                        </div>
                                    </details>
                                )}
                            </div>
                        )}
                    </>
                );
            })()}
        </div>
    );
};

export default FeatureRequests;
