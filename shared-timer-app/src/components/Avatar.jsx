import React, { useState, useEffect } from 'react';

// Global cache for esports teams to avoid refetching on every Avatar mount
let cachedTeams = null;
let fetchingPromise = null;

const fetchTeams = () => {
    if (cachedTeams) return Promise.resolve(cachedTeams);
    if (fetchingPromise) return fetchingPromise;
    fetchingPromise = fetch('/api/esports/teams').then(r => r.json()).then(data => {
        cachedTeams = data;
        return data;
    });
    return fetchingPromise;
};

const Avatar = ({ user, size = 32, style = {} }) => {
    const [teamImage, setTeamImage] = useState(null);
    const fanTeam = user?.preferences?.fanTeam;

    useEffect(() => {
        if (!fanTeam) {
            setTeamImage(null);
            return;
        }
        fetchTeams().then(teams => {
            if (Array.isArray(teams)) {
                const team = teams.find(t => t.code === fanTeam);
                if (team && team.image) {
                    setTeamImage(team.image.replace(/^http:\/\//, 'https://'));
                }
            }
        });
    }, [fanTeam]);

    const initial = (user?.displayName || '?').charAt(0).toUpperCase();

    const baseStyle = {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${size * 0.45}px`,
        fontWeight: 600,
        color: 'white',
        flexShrink: 0,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        ...style
    };

    if (teamImage) {
        return (
            <div style={{ ...baseStyle, background: 'rgba(255,255,255,0.1)' }}>
                <img src={teamImage} alt={fanTeam || 'Fan Team'} style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
            </div>
        );
    }

    return (
        <div style={baseStyle}>
            {initial}
        </div>
    );
};

export default Avatar;
