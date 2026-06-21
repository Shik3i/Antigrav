import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { UserPlus, UserCircle, X } from 'lucide-react';

const UserContextMenu = ({ username, userId, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const triggerRef = useRef(null);
    const navigate = useNavigate();

    const toggleMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Try to keep it inside the viewport
            let x = rect.left;
            let y = rect.bottom + window.scrollY;
            if (x + 180 > window.innerWidth) {
                x = window.innerWidth - 180 - 16;
            }
            setCoords({ x, y });
        }
        setIsOpen(!isOpen);
    };

    const closeMenu = () => setIsOpen(false);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest('.user-context-menu')) {
                closeMenu();
            }
        };
        // Use a small delay before attaching the listener to avoid the triggering click closing it immediately
        setTimeout(() => {
            window.addEventListener('click', handleClickOutside);
        }, 10);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isOpen]);

    const handleAddFriend = async (e) => {
        e.stopPropagation();
        try {
            const tk = localStorage.getItem('timerToken');
            const res = await fetch('/api/friends/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tk}` },
                body: JSON.stringify({ friendUsername: username })
            });
            if (res.ok) alert('Friend request sent!');
            else {
                const data = await res.json();
                alert(data.error || 'Failed to send request');
            }
        } catch(err) {
            alert('Error adding friend');
        }
        closeMenu();
    };

    const handleViewProfile = (e) => {
        e.stopPropagation();
        closeMenu();
        navigate(`/profile/${username}`);
    };

    return (
        <>
            <div ref={triggerRef} onClick={toggleMenu} style={{ display: 'inline-flex', cursor: 'pointer', alignItems: 'center' }}>
                {children}
            </div>
            {isOpen && createPortal(
                <div 
                    className="user-context-menu animate-fade-in glass-panel" 
                    style={{ 
                        position: 'absolute', 
                        top: coords.y + 8, 
                        left: coords.x, 
                        zIndex: 999999, 
                        padding: '8px', 
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        minWidth: '180px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(16px)'
                    }}
                >
                    <div style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{username}</span>
                        <button className="btn-ghost" style={{ padding: 2, height: 'auto' }} onClick={(e) => { e.stopPropagation(); closeMenu(); }}><X size={12} /></button>
                    </div>
                    <button className="btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.85rem', padding: '8px 12px' }} onClick={handleViewProfile}>
                        <UserCircle size={16} color="var(--accent-primary)" /> View Profile
                    </button>
                    <button className="btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.85rem', padding: '8px 12px' }} onClick={handleAddFriend}>
                        <UserPlus size={16} color="#10b981" /> Add Friend
                    </button>
                </div>,
                document.body
            )}
        </>
    );
};

export default UserContextMenu;
