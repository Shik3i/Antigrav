import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Check, X, Circle, Trash2, Clock, Search, Filter, ArrowUpDown, Shield, UserX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import EVENTS from '../../socketEvents.json';
import UserSearch from '../components/UserSearch';
import FriendProfileModal from '../components/FriendProfileModal';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState('name');
    const [selectedUser, setSelectedUser] = useState(null);
    const [profileModalUser, setProfileModalUser] = useState(null);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [showBlocked, setShowBlocked] = useState(false);
    const [notifications, setNotifications] = useState([]);

    // Auto-dismiss notifications after 5 seconds
    useEffect(() => {
        if (notifications.length > 0) {
            const timer = setTimeout(() => {
                setNotifications(prev => prev.slice(1));
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notifications]);
<task_progress>
- [x] Problem identifizieren: Welche Einladungen? (Freundesanfragen)
- [x] Freundesanfragen-Logik untersuchen
- [x] Room-Einladungs-Logik untersuchen
- [x] Socket Events prüfen
- [ ] Problem beheben
</task_progress>

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
        fetchBlockedUsers();

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

            // Friend request event handlers
            const handleFriendRequestReceived = (data) => {
                const newNotification = {
                    id: Date.now(),
                    type: 'success',
                    message: `${data.fromDisplayName} has sent you a friend request!`,
                    timestamp: new Date()
                };
                setNotifications(prev => [...prev, newNotification]);
                fetchFriends();
            };

            const handleFriendRequestAccepted = (data) => {
                const newNotification = {
                    id: Date.now(),
                    type: 'success',
                    message: `${data.fromDisplayName} has accepted your friend request!`,
                    timestamp: new Date()
                };
                setNotifications(prev => [...prev, newNotification]);
                fetchFriends();
            };

            const handleFriendRequestRejected = (data) => {
                const newNotification = {
                    id: Date.now(),
                    type: 'error',
                    message: `${data.fromDisplayName} has rejected your friend request.`,
                    timestamp: new Date()
                };
                setNotifications(prev => [...prev, newNotification]);
                fetchFriends();
            };

            const handleFriendRemoved = (data) => {
                const newNotification = {
                    id: Date.now(),
                    type: 'error',
                    message: `${data.fromDisplayName} has removed you as a friend.`,
                    timestamp: new Date()
                };
                setNotifications(prev => [...prev, newNotification]);
                fetchFriends();
            };

            socket.on(EVENTS.FRIEND_REQUEST_RECEIVED, handleFriendRequestReceived);
            socket.on(EVENTS.FRIEND_REQUEST_ACCEPTED, handleFriendRequestAccepted);
            socket.on(EVENTS.FRIEND_REQUEST_REJECTED, handleFriendRequestRejected);
            socket.on(EVENTS.FRIEND_REMOVED, handleFriendRemoved);

            if (socket.connected) {
                socket.emit(EVENTS.GET_FRIENDS_STATUS);
            }

            return () => {
                socket.off(EVENTS.FRIENDS_STATUS, handleFriendsStatus);
                socket.off(EVENTS.FRIEND_REQUEST_RECEIVED, handleFriendRequestReceived);
                socket.off(EVENTS.FRIEND_REQUEST_ACCEPTED, handleFriendRequestAccepted);
                socket.off(EVENTS.FRIEND_REQUEST_REJECTED, handleFriendRequestRejected);
                socket.off(EVENTS.FRIEND_REMOVED, handleFriendRemoved);
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

    // Filter and sort friends
    const filteredFriends = acceptedFriends.filter(friend => {
        const matchesSearch = searchQuery.toLowerCase() === '' ||
            friend.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            friend.username.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesFilter = filterStatus === 'all' ||
            (filterStatus === 'online' && onlineStatuses.get(friend.id)) ||
            (filterStatus === 'offline' && !onlineStatuses.get(friend.id));

        return matchesSearch && matchesFilter;
    });

    const sortedFriends = [...filteredFriends].sort((a, b) => {
        if (sortBy === 'name') {
            return a.displayName.localeCompare(b.displayName);
        } else if (sortBy === 'username') {
            return a.username.localeCompare(b.username);
        } else if (sortBy === 'status') {
            const aOnline = onlineStatuses.get(a.id);
            const bOnline = onlineStatuses.get(b.id);
            return bOnline - aOnline;
        }
        return 0;
    });

    // Friend actions
    const handleAddFriend = async (friendId) => {
        try {
            const res = await fetch('/api/friends/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalToken}`
                },
                body: JSON.stringify({ friendUsername: friends.find(f => f.id === friendId)?.username || '' })
            });
            if (res.ok) {
                fetchFriends();
                return true;
            }
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const handleRemoveFriend = async (friendId) => {
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
                return true;
            }
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const handleBlockUser = async (friendId) => {
        try {
            const res = await fetch('/api/friends/block', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalToken}`
                },
                body: JSON.stringify({ blockedId: friendId })
            });
            if (res.ok) {
                fetchFriends();
                fetchBlockedUsers();
                return true;
            }
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const handleUnblockUser = async (friendId) => {
        try {
            const res = await fetch('/api/friends/unblock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalToken}`
                },
                body: JSON.stringify({ blockedId: friendId })
            });
            if (res.ok) {
                fetchBlockedUsers();
                return true;
            }
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const fetchBlockedUsers = async () => {
        try {
            const res = await fetch('/api/friends/blocked', {
                headers: { 'Authorization': `Bearer ${globalToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBlockedUsers(data);
            }
        } catch (err) {
            console.error('Failed to fetch blocked users:', err);
        }
    };

    return (
        <div className="animate-fade-in" style={embedded ? { width: '100%', marginTop: '16px' } : { maxWidth: '800px', margin: '0 auto', padding: '24px 0', paddingBottom: '100px' }}>
            {/* Friend Profile Modal */}
            {profileModalUser && (
                <FriendProfileModal
                    userId={profileModalUser}
                    onClose={() => setProfileModalUser(null)}
                    onAddFriend={handleAddFriend}
                    onRemoveFriend={handleRemoveFriend}
                    onBlockUser={handleBlockUser}
                    onUnblockUser={handleUnblockUser}
                />
            )}

            {/* Notification Toasts */}
            {notifications.map(notification => (
                <div key={notification.id} style={{
                    position: 'fixed',
                    top: `${20 + (notifications.indexOf(notification) * 80)}px`,
                    right: '20px',
                    background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    padding: '16px 24px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    animation: 'fadeIn 0.3s ease-out',
                    maxWidth: '400px',
                    transform: 'translateY(0)',
                    opacity: 1,
                    transition: 'all 0.3s ease-out'
                }}>
                    {notification.type === 'success' ? (
                        <Check size={20} />
                    ) : (
                        <X size={20} />
                    )}
                    <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{notification.message}</span>
                </div>
            ))}

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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0 }}>My Friends</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setShowBlocked(!showBlocked)}
                                    className="btn-ghost"
                                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Shield size={16} />
                                    {showBlocked ? 'Friends' : 'Blocked'}
                                </button>
                            </div>
                        </div>

                        {/* Controls */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        className="input-primary"
                                        placeholder="Search friends..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ paddingLeft: '36px' }}
                                    />
                                    <Search
                                        size={16}
                                        color="var(--text-muted)"
                                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    className="input-primary"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    style={{ padding: '8px 12px' }}
                                >
                                    <option value="all">All</option>
                                    <option value="online">Online</option>
                                    <option value="offline">Offline</option>
                                </select>

                                <select
                                    className="input-primary"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{ padding: '8px 12px' }}
                                >
                                    <option value="name">Name</option>
                                    <option value="username">Username</option>
                                    <option value="status">Online Status</option>
                                </select>
                            </div>
                        </div>

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

                                {!showBlocked ? (
                                    <>
                                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Accepted ({sortedFriends.length})</h4>
                                        {sortedFriends.length === 0 ? (
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
                                                {sortedFriends.map(friend => {
                                                    const isOnline = onlineStatuses.get(friend.id);
                                                    return (
                                                        <div key={friend.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setProfileModalUser(friend.id)}>
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
                                    </>
                                ) : (
                                    <>
                                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Blocked Users ({blockedUsers.length})</h4>
                                        {blockedUsers.length === 0 ? (
                                            <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                                                <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '6px', fontWeight: 600 }}>
                                                    No blocked users
                                                </div>
                                                <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                                                    Blocked users will appear here.
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {blockedUsers.map(blocked => (
                                                    <div key={blocked.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Shield size={16} color="#ef4444" />
                                                                <span style={{ fontWeight: 500 }}>{blocked.displayName}</span>
                                                            </div>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{blocked.username}</span>
                                                        </div>
                                                        <button
                                                            className="btn-ghost"
                                                            style={{ padding: '6px', color: '#10b981' }}
                                                            onClick={() => handleUnblockUser(blocked.id)}
                                                            title="Unblock User"
                                                        >
                                                            <UserX size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Friends;
