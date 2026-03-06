export function GameConfig({ config, onChange, onUpdate, hasChanges }) {
    const gameTypes = [
        { id: 'slots-3reel', name: '3-Reel Slots', category: 'Slots' },
        { id: 'slots-5reel', name: '5-Reel Video Slots', category: 'Slots' },
        { id: 'slots-cascade', name: 'Cascading Reels', category: 'Slots' },
        { id: 'slots-cluster', name: 'Cluster Pays', category: 'Slots' },
        { id: 'table-blackjack', name: 'Blackjack', category: 'Table Games' },
        { id: 'table-roulette', name: 'Roulette', category: 'Table Games' },
        { id: 'table-baccarat', name: 'Baccarat', category: 'Table Games' },
        { id: 'instant-scratch', name: 'Scratch Cards', category: 'Instant Win' },
        { id: 'instant-wheel', name: 'Wheel Spinner', category: 'Instant Win' },
        { id: 'quickie-drop', name: 'Quickie Drop', category: 'Quickies' },
    ];

    const groupedTypes = gameTypes.reduce((acc, type) => {
        if (!acc[type.category]) acc[type.category] = [];
        acc[type.category].push(type);
        return acc;
    }, {});

    // Order: Slots first, then others
    const orderedCategories = ['Slots', 'Table Games', 'Instant Win', 'Quickies'];

    return (
        <div className="game-config">
            {/* Game Type Selection */}
            <div className="config-section">
                <label className="config-label">Game Type</label>
                {orderedCategories.map(category => (
                    <div key={category} className="config-group">
                        <div className="config-group-title">{category}</div>
                        {groupedTypes[category]?.map(type => (
                            <div
                                key={type.id}
                                className={`config-option ${config.gameType === type.id ? 'active' : ''}`}
                                onClick={() => onChange({ ...config, gameType: type.id })}
                            >
                                {type.name}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Update Button */}
            <div className="config-section">
                <button
                    className="btn"
                    style={{
                        width: '100%',
                        opacity: hasChanges ? 1 : 0.5,
                        cursor: hasChanges ? 'pointer' : 'not-allowed'
                    }}
                    onClick={onUpdate}
                    disabled={!hasChanges}
                >
                    {hasChanges ? '🎮 Update Game' : '✓ Up to Date'}
                </button>
            </div>
        </div>
    );
}
