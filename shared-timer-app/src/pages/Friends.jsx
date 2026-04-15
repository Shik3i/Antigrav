import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Check, X, Circle, Trash2, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import EVENTS from '../socketEvents';

const Friends = ({ socket, embedded }) => {
    const { user, isGuest } = useAuth();
    const globalToken = localStorage.getItem('timerToken');

    const [isExpanded, setIsExpanded] = useState(!embedded);
    const [friends, setFriends] = useState([]);
    const [onlineStatuses, setOnlineStatuses] = useState(new Map());
    const [newFriendName, setNewFriendName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchFriends = async () => {
        try {
            const res = await fetch('/api/friends', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFriends(data);
            }
        } catch (err) {
            console.error("Failed to fetch friends", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isGuest || !globalToken) {
            setLoading(false);
            return;
        }

        fetchFriends();

        if (socket) {
            const handleFriendsStatus = (data) => {
                setOnlineStatuses(prev => {
                    const next = new Map(prev);
                    if (Array.isArray(data)) {
                        data.forEach(s => next.set(s.userId, s.isOnline));
                    } else if (data && data.userId) {
                        next.set(data.userId, data.isOnline);
                    }
                    return next;
                });
            };

            socket.on(EVENTS.FRIENDS_STATUS, handleFriendsStatus);
            if (socket.connected) {
                socket.emit(EVENTS.GET_FRIENDS_STATUS);
            }

            return () => {
                socket.off(EVENTS.FRIENDS_STATUS, handleFriendsStatus);
            };
        }
    }, [isGuest, globalToken, socket]);

    const sendRequest = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!newFriendName.trim()) return;

        try {
            const res = await fetch('/api/friends/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalToken}`
                },
                body: JSON.stringify({ friendUsername: newFriendName })
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess('Friend request sent!');
                setNewFriendName('');
                fetchFriends();
            } else {
                setError(data.error || 'Failed to send request');
            }
        } catch (err) {
            setError('Error sending friend request');
        }
    };

    const handleAccept = async (friendId) => {
        try {
            const res = await fetch('/api/friends/accept', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalToken}`
                },
                body: JSON.stringify({ friendId })
            });
            if (res.ok) {
                fetchFriends();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRemove = async (friendId) => {
        if (!window.confirm("Are you sure you want to remove this friend or cancel the request?")) return;
        try {
            const res = await fetch('/api/friends/remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalToken}`
                },
                body: JSON.stringify({ friendId })
            });
            if (res.ok) {
                fetchFriends();
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (isGuest) {
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 0', textAlign: 'center' }}>
                <div className="glass-card" style={{ padding: '48px', color: 'var(--text-muted)' }}>
                    <Users size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h2 style={{ color: 'white' }}>Friends Feature Locked</h2>
                    <p style={{ marginTop: '8px' }}>You must be a registered user to add and manage friends.</p>
                </div>
            </div>
        );
    }

    const pendingRequests = friends.filter(f => f.status === 'pending');
    const incomingCount = friends.filter(f => f.status === 'pending' && f.direction === 'incoming').length;
    const acceptedFriends = friends.filter(f => f.status === 'accepted');

    return (
        <div className="animate-fade-in" style={embedded ? { width: '100%', marginTop: '16px' } : { maxWidth: '800px', margin: '0 auto', padding: '24px 0', paddingBottom: '100px' }}>

            {!embedded ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                    <Users size={32} color="var(--accent-primary)" />
                    <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Friends List</h1>
                </div>
            ) : (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={20} />
                        <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>Manage Friends</span>
                    </div>
                    {incomingCount > 0 && (
                        <div style={{ background: '#ef4444', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {incomingCount}
                        </div>
                    )}
                </button>
            )}

            {isExpanded && (
                <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: embedded ? '1fr' : '1fr', md: { gridTemplateColumns: embedded ? '1fr' : 'minmax(300px, 1fr) 2fr' } }}>

                    {/* Add Friend Panel */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={18} /> Add a Friend
                        </h3>
                        <form onSubmit={sendRequest} style={{ display: 'flex', gap: '12px' }}>
                            <input
                                type="text"
                                className="input-primary"
                                style={{ flex: 1 }}
                                placeholder="Enter username"
                                value={newFriendName}
                                onChange={(e) => setNewFriendName(e.target.value)}
                            />
                            <button type="submit" className="btn-primary">Add</button>
                        </form>
                        {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '12px' }}>{error}</p>}
                        {success && <p style={{ color: '#10b981', fontSize: '0.85rem', marginTop: '12px' }}>{success}</p>}
                    </div>

                    {/* Friends List */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '24px' }}>My Friends</h3>

                        {loading ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>Loading your network...</div>
                        ) : (
                            <>
                                {pendingRequests.length > 0 && (
                                    <div style={{ marginBottom: '32px' }}>
                                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Pending Requests ({pendingRequests.length})</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {pendingRequests.map(req => (
                                                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <Clock size={16} color="var(--text-muted)" />
                                                        <span style={{ fontWeight: 500 }}>{req.displayName}</span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({req.username})</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {req.direction === 'incoming' && (
                                                            <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => handleAccept(req.id)}>
                                                                <Check size={16} /> Accept
                                                            </button>
                                                        )}
                                                        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => handleRemove(req.id)}>
                                                            <X size={16} /> {req.direction === 'incoming' ? 'Decline' : 'Cancel'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Accepted ({acceptedFriends.length})</h4>
                                    {acceptedFriends.length === 0 ? (
                                        <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '6px', fontWeight: 600 }}>
                                                Your friends list is still empty.
                                            </div>
                                            <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                                                Search for a username above to send your first request. Sobald jemand annimmt, siehst du hier direkt den Online-Status.
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {acceptedFriends.map(friend => {
                                                const isOnline = onlineStatuses.get(friend.id);
                                                return (
                                                    <div key={friend.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Circle size={10} fill={isOnline ? '#10b981' : 'transparent'} color={isOnline ? '#10b981' : 'var(--text-muted)'} />
                                                                <span style={{ fontWeight: 500 }}>{friend.displayName}</span>
                                                            </div>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{friend.username}</span>
                                                        </div>
                                                        <button className="btn-ghost" style={{ padding: '6px', color: '#ef4444' }} onClick={() => handleRemove(friend.id)} title="Remove Friend">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Friends;
