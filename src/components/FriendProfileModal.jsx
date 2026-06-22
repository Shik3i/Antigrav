import React, { useState, useEffect } from 'react';
import { X, User, Clock, Shield, UserPlus, UserMinus, UserX, Loader2 } from 'lucide-react';

const FriendProfileModal = ({ userId, onClose, onAddFriend, onRemoveFriend, onBlockUser, onUnblockUser }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const token = localStorage.getItem('timerToken');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch(`/api/users/profile/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                } else {
                    setError('Failed to load profile');
                }
            } catch (err) {
                setError('Error loading profile');
                console.error('Profile error:', err);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchProfile();
        }
    }, [userId]);

    const handleAction = async (actionType) => {
        if (!profile) return;

        setActionLoading(true);
        try {
            switch (actionType) {
                case 'add':
                    await onAddFriend(profile.id);
                    break;
                case 'remove':
                    await onRemoveFriend(profile.id);
                    break;
                case 'block':
                    await onBlockUser(profile.id);
                    break;
                case 'unblock':
                    await onUnblockUser(profile.id);
                    break;
            }

            // Refresh profile after action
            const res = await fetch(`/api/users/profile/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            }
        } catch (err) {
            console.error('Action error:', err);
        } finally {
            setActionLoading(false);
        }
    };

    if (!userId) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        }}>
            <div className="glass-card" style={{
                width: '100%',
                maxWidth: '500px',
                padding: '24px',
                borderRadius: '12px',
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <button
                    onClick={onClose}
                    className="btn-ghost"
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        padding: '8px',
                        borderRadius: '50%'
                    }}
                >
                    <X size={20} />
                </button>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px' }}>
                        <Loader2 size={32} className="spin" />
                        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading profile...</p>
                    </div>
                ) : error ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#ef4444' }}>
                        <p>{error}</p>
                        <button onClick={onClose} className="btn-primary" style={{ marginTop: '16px' }}>
                            Close
                        </button>
                    </div>
                ) : profile ? (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                background: 'var(--accent-primary)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px',
                                color: 'white',
                                fontSize: '32px',
                                fontWeight: 'bold'
                            }}>
                                {profile.displayName.charAt(0).toUpperCase()}
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{profile.displayName}</h2>
                            <p style={{ color: 'var(--text-muted)', margin: '4px 0' }}>@{profile.username}</p>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--text-muted)' }}>
                                <Clock size={16} />
                                <span style={{ fontSize: '0.9rem' }}>Last Active: {profile.lastActive ? new Date(profile.lastActive).toLocaleString() : 'Never'}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Friendship Status</h4>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)'
                            }}>
                                {profile.friendStatus === 'accepted' ? (
                                    <>
                                        <UserCheck size={16} color="#10b981" />
                                        <span>You are friends</span>
                                    </>
                                ) : profile.friendStatus === 'pending' ? (
                                    <>
                                        {profile.isRequester ? (
                                            <>
                                                <Clock size={16} color="#f59e0b" />
                                                <span>Friend request sent</span>
                                            </>
                                        ) : (
                                            <>
                                                <Clock size={16} color="#f59e0b" />
                                                <span>Pending friend request</span>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <User size={16} color="var(--text-muted)" />
                                        <span>Not friends</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {profile.isBlocked ? (
                                    <button
                                        onClick={() => handleAction('unblock')}
                                        className="btn-secondary"
                                        disabled={actionLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                                    >
                                        {actionLoading ? <Loader2 size={16} className="spin" /> : <Shield size={16} />}
                                        Unblock User
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleAction('block')}
                                        className="btn-secondary"
                                        disabled={actionLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                                    >
                                        {actionLoading ? <Loader2 size={16} className="spin" /> : <UserX size={16} />}
                                        Block User
                                    </button>
                                )}

                                {profile.friendStatus === 'accepted' ? (
                                    <button
                                        onClick={() => handleAction('remove')}
                                        className="btn-secondary"
                                        disabled={actionLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                                    >
                                        {actionLoading ? <Loader2 size={16} className="spin" /> : <UserMinus size={16} />}
                                        Remove Friend
                                    </button>
                                ) : profile.friendStatus === 'pending' && profile.isRequester ? (
                                    <button
                                        onClick={() => handleAction('remove')}
                                        className="btn-secondary"
                                        disabled={actionLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                                    >
                                        {actionLoading ? <Loader2 size={16} className="spin" /> : <UserX size={16} />}
                                        Cancel Request
                                    </button>
                                ) : profile.friendStatus === 'pending' && !profile.isRequester ? (
                                    <button
                                        onClick={() => handleAction('add')}
                                        className="btn-primary"
                                        disabled={actionLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                                    >
                                        {actionLoading ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
                                        Accept Friend Request
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleAction('add')}
                                        className="btn-primary"
                                        disabled={actionLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                                    >
                                        {actionLoading ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
                                        Add Friend
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default FriendProfileModal;