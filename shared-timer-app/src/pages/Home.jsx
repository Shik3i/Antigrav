import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Users, Clock, Plus, UserCheck } from 'lucide-react';
import EVENTS from '../socketEvents';
import { generateRandomRoomName } from '../utils/randomNames';

const Home = ({ user, globalSocket }) => {
    const [activeRooms, setActiveRooms] = useState([]);
    const [friendsList, setFriendsList] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isPublicSelection, setIsPublicSelection] = useState(localStorage.getItem('timer_room_isPublic') || 'on');
    const navigate = useNavigate();

    useEffect(() => {
        if (!showCreateModal) {
            setIsPublicSelection(localStorage.getItem('timer_room_isPublic') || 'on'); // Reset on close
        }
    }, [showCreateModal]);

    useEffect(() => {
        // Fetch initial list immediately so it shows up before any socket events trigger
        fetch('/api/rooms', {
            headers: localStorage.getItem('timerToken') ? {
                'Authorization': `Bearer ${localStorage.getItem('timerToken')}`
            } : {}
        })
            .then(res => res.json())
            .then(data => {
                // Only set if we haven't received a socket update yet
                setActiveRooms(prev => prev.length === 0 ? data : prev);
            })
            .catch(console.error);

        // Fetch user's friends to cross-reference later
        if (localStorage.getItem('timerToken')) {
            fetch('/api/friends', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('timerToken')}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setFriendsList(data.filter(f => f.status === 'accepted').map(f => f.id));
                    }
                })
                .catch(console.error);
        }

        if (!globalSocket) return;

        globalSocket.on(EVENTS.ACTIVE_ROOMS, (rooms) => {
            setActiveRooms(rooms);
        });

        // Cleanup if unmounting
        return () => {
            globalSocket.off(EVENTS.ACTIVE_ROOMS);
        };
    }, [globalSocket]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const useName = fd.get('name');
        const isPublic = isPublicSelection === 'on';
        const visibleToFriends = fd.get('visibleToFriends') === 'on';
        const defaultRole = fd.get('defaultRole') || 'read';
        const duration = parseFloat(fd.get('duration')) || 20;

        // Save preferences
        localStorage.setItem('timer_room_isPublic', isPublicSelection);
        localStorage.setItem('timer_room_visibleToFriends', visibleToFriends);
        localStorage.setItem('timer_room_defaultRole', defaultRole);
        localStorage.setItem('timer_room_duration', duration);

        const roomId = Math.random().toString(36).substr(2, 6); // simple short ID

        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: roomId,
                    name: useName || generateRandomRoomName(),
                    isPublic,
                    defaultRole,
                    defaultDurationMinutes: duration,
                    ownerId: user.id,
                    visibleToFriends
                })
            });
            const data = await res.json();

            // Navigate to room with token
            navigate(`/room/${roomId}?token=${data.writeToken}`);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 0' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Active Timers</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Join a public room or start your own collaborative timer.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={20} />
                    Create Room
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {activeRooms.length === 0 ? (
                    <div className="glass-card" style={{ padding: '40px', textAlign: 'center', gridColumn: '1 / -1', color: 'var(--text-muted)' }}>
                        No active public rooms at the moment. Be the first to start one!
                    </div>
                ) : (
                    activeRooms.map((room) => {
                        const isFriendRoom = friendsList.includes(room.ownerId);

                        return (
                            <div key={room.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: isFriendRoom ? '1px solid var(--accent-primary)' : undefined }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isFriendRoom && <UserCheck size={18} color="var(--accent-primary)" title="Friend's Room" />}
                                        <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{room.name}</h3>
                                    </div>
                                    {room.isRunning && (
                                        <span style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-primary)', borderRadius: '12px', fontWeight: 600 }}>RUNNING</span>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> {room.activeUsers} Active</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16} /> {room.defaultDurationMinutes}m</span>
                                </div>

                                <button
                                    className="btn-ghost"
                                    style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.05)', justifyContent: 'center' }}
                                    onClick={() => navigate(`/room/${room.id}`)}
                                >
                                    Join Room
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {showCreateModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                    <div className="glass-card" style={{ width: '400px', padding: '32px' }}>
                        <h2 style={{ marginBottom: '24px' }}>Create New Timer</h2>

                        <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Room Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    className="input-primary"
                                    placeholder={generateRandomRoomName()}
                                    defaultValue={generateRandomRoomName()}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Duration (Minutes)</label>
                                <input type="number" name="duration" className="input-primary" defaultValue={localStorage.getItem('timer_room_duration') || 20} min={0.01} step="any" max={120} required />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Room Visibility</label>
                                <select
                                    name="isPublic"
                                    className="input-primary"
                                    value={isPublicSelection}
                                    onChange={(e) => setIsPublicSelection(e.target.value)}
                                >
                                    <option value="on">Public (Visible on Home Screen)</option>
                                    <option value="off">Private (Hidden, needs Invite Link)</option>
                                </select>
                            </div>

                            {isPublicSelection === 'on' ? (
                                <div className="animate-fade-in">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Default Permissions for Public Joiners</label>
                                    <select name="defaultRole" className="input-primary" defaultValue={localStorage.getItem('timer_room_defaultRole') || 'read'}>
                                        <option value="read">Read-only (Recommended)</option>
                                        <option value="write">Admin (Everyone can control timer)</option>
                                    </select>
                                </div>
                            ) : (
                                <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" name="visibleToFriends" id="visibleToFriends" defaultChecked={localStorage.getItem('timer_room_visibleToFriends') === 'true'} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                                    <label htmlFor="visibleToFriends" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>Visible to my Friends</label>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Start Timer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Home;
