import { useState, useEffect } from 'react';

export function SavedGamesPanel({ currentConfig, onSelect, activeSaveId }) {
    const [savedGames, setSavedGames] = useState([]);

    useEffect(() => {
        const load = () => {
            const saved = JSON.parse(localStorage.getItem('qtm_saved_games') || '[]');
            setSavedGames(saved);
        };
        load();
        window.addEventListener('storage', load);
        return () => window.removeEventListener('storage', load);
    }, []);

    const handleDelete = (id) => {
        const updated = savedGames.filter(g => g.id !== id);
        localStorage.setItem('qtm_saved_games', JSON.stringify(updated));
        setSavedGames(updated);
    };

    return (
        <div className="saved-games-panel">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Library
            </h3>

            <div className="saved-list">
                {savedGames.length === 0 ? (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                        No saved games yet.
                    </div>
                ) : (
                    savedGames.map(game => (
                        <div key={game.id} className="saved-item" style={{
                            background: game.id === activeSaveId ? 'rgba(212, 175, 55, 0.1)' : 'var(--bg-panel)',
                            border: game.id === activeSaveId ? '1px solid var(--primary)' : '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '1rem',
                            marginBottom: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            boxShadow: game.id === activeSaveId ? '0 0 10px rgba(212, 175, 55, 0.2)' : 'none'
                        }}
                            onClick={() => onSelect(game)}
                        >
                            <div className="font-bold text-sm" style={{ color: game.id === activeSaveId ? 'var(--primary)' : 'var(--text)' }}>
                                {game.name} {game.id === activeSaveId && '●'}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                                {game.config.gameType.replace('slots-', '')}-reel | {game.timestamp}
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(game.id);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-dim)',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
