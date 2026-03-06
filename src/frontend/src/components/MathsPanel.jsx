export function MathsPanel({ config, onChange, onUpdate, hasChanges }) {
    return (
        <div className="game-config">
            {/* Math Model Settings */}
            <div className="config-section">
                <label className="config-label">Math Model</label>

                <div className="config-field">
                    <label>RTP (%)</label>
                    <input
                        type="number"
                        min="85"
                        max="98"
                        step="0.1"
                        value={config.rtp || 96}
                        onChange={(e) => onChange({ ...config, rtp: parseFloat(e.target.value) })}
                        className="config-input"
                    />
                </div>

                <div className="config-field">
                    <label>Volatility</label>
                    <select
                        value={config.volatility || 'medium'}
                        onChange={(e) => onChange({ ...config, volatility: e.target.value })}
                        className="config-input"
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>

                <div className="config-field">
                    <label>Max Win (x Bet)</label>
                    <input
                        type="number"
                        min="100"
                        max="50000"
                        step="100"
                        value={config.maxWin || 5000}
                        onChange={(e) => onChange({ ...config, maxWin: parseInt(e.target.value) })}
                        className="config-input"
                    />
                </div>

                <div className="config-field">
                    <label>Default Bet ($)</label>
                    <input
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        value={config.bet || 10}
                        onChange={(e) => onChange({ ...config, bet: parseInt(e.target.value) })}
                        className="config-input"
                    />
                </div>
            </div>

            {/* Bonus Features (for slots) */}
            {config.gameType?.startsWith('slots') && (
                <div className="config-section">
                    <label className="config-label">Bonus Features</label>

                    <label className="config-checkbox">
                        <input
                            type="checkbox"
                            checked={config.features?.freeSpins || false}
                            onChange={(e) => onChange({
                                ...config,
                                features: { ...config.features, freeSpins: e.target.checked }
                            })}
                        />
                        <span>Free Spins</span>
                    </label>

                    <label className="config-checkbox">
                        <input
                            type="checkbox"
                            checked={config.features?.multipliers || false}
                            onChange={(e) => onChange({
                                ...config,
                                features: { ...config.features, multipliers: e.target.checked }
                            })}
                        />
                        <span>Multipliers</span>
                    </label>

                    <label className="config-checkbox">
                        <input
                            type="checkbox"
                            checked={config.features?.wilds || false}
                            onChange={(e) => onChange({
                                ...config,
                                features: { ...config.features, wilds: e.target.checked }
                            })}
                        />
                        <span>Wild Symbols</span>
                    </label>

                    <label className="config-checkbox">
                        <input
                            type="checkbox"
                            checked={config.features?.bonus || false}
                            onChange={(e) => onChange({
                                ...config,
                                features: { ...config.features, bonus: e.target.checked }
                            })}
                        />
                        <span>Bonus Round</span>
                    </label>
                </div>
            )}

            {/* Jackpot Tiers */}
            {config.gameType === 'slots-3reel' && (
                <div className="config-section">
                    <label className="config-label">Jackpot Tiers</label>
                    <div className="flex flex-wrap gap-2">
                        {['mini', 'minor', 'major', 'grand'].map(tier => (
                            <label key={tier} className="config-checkbox" style={{ minWidth: '80px' }}>
                                <input
                                    type="checkbox"
                                    checked={config.jackpots?.[tier] !== false}
                                    onChange={(e) => onChange({
                                        ...config,
                                        jackpots: { ...config.jackpots, [tier]: e.target.checked }
                                    })}
                                />
                                <span style={{ textTransform: 'capitalize' }}>{tier}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

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
                    {hasChanges ? 'Update Game' : 'Up to Date'}
                </button>
            </div>
        </div>
    );
}
