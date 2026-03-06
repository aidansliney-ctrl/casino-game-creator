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

            {/* Quickie Drop Maths */}
            {config.gameType === 'quickie-drop' && (
                <div className="config-section">
                    <label className="config-label">Quickie Drop Settings</label>

                    <div className="config-field">
                        <label>Grid Columns</label>
                        <input
                            type="number"
                            min="3"
                            max="8"
                            step="1"
                            value={config.quickieMaths?.gridCols || 5}
                            onChange={(e) => onChange({
                                ...config,
                                quickieMaths: { ...config.quickieMaths, gridCols: parseInt(e.target.value) }
                            })}
                            className="config-input"
                        />
                    </div>

                    <div className="config-field">
                        <label>Grid Rows</label>
                        <input
                            type="number"
                            min="3"
                            max="8"
                            step="1"
                            value={config.quickieMaths?.gridRows || 5}
                            onChange={(e) => onChange({
                                ...config,
                                quickieMaths: { ...config.quickieMaths, gridRows: parseInt(e.target.value) }
                            })}
                            className="config-input"
                        />
                    </div>

                    <div className="config-field">
                        <label>Bomb Count</label>
                        <input
                            type="number"
                            min="1"
                            max="15"
                            step="1"
                            value={config.quickieMaths?.bombCount || 6}
                            onChange={(e) => onChange({
                                ...config,
                                quickieMaths: { ...config.quickieMaths, bombCount: parseInt(e.target.value) }
                            })}
                            className="config-input"
                        />
                    </div>

                    <div className="config-field">
                        <label>Max Picks</label>
                        <input
                            type="number"
                            min="3"
                            max="20"
                            step="1"
                            value={config.quickieMaths?.maxPicks || 10}
                            onChange={(e) => onChange({
                                ...config,
                                quickieMaths: { ...config.quickieMaths, maxPicks: parseInt(e.target.value) }
                            })}
                            className="config-input"
                        />
                    </div>

                    <div className="config-field">
                        <label>Min Prize (£)</label>
                        <input
                            type="number"
                            min="10"
                            max="10000"
                            step="10"
                            value={config.quickieMaths?.minPrize || 100}
                            onChange={(e) => onChange({
                                ...config,
                                quickieMaths: { ...config.quickieMaths, minPrize: parseInt(e.target.value) }
                            })}
                            className="config-input"
                        />
                    </div>

                    <div className="config-field">
                        <label>Max Prize (£)</label>
                        <input
                            type="number"
                            min="50"
                            max="50000"
                            step="50"
                            value={config.quickieMaths?.maxPrize || 500}
                            onChange={(e) => onChange({
                                ...config,
                                quickieMaths: { ...config.quickieMaths, maxPrize: parseInt(e.target.value) }
                            })}
                            className="config-input"
                        />
                    </div>

                    <div className="config-field">
                        <label>Bomb Penalty (%)</label>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            step="1"
                            value={Math.round((config.quickieMaths?.bombPenalty || 0.10) * 100)}
                            onChange={(e) => onChange({
                                ...config,
                                quickieMaths: { ...config.quickieMaths, bombPenalty: parseInt(e.target.value) / 100 }
                            })}
                            className="config-input"
                        />
                    </div>

                    <div className="config-field">
                        <label>Mega Bomb Last N Picks</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            step="1"
                            value={config.quickieMaths?.megaBombLastPicks || 3}
                            onChange={(e) => onChange({
                                ...config,
                                quickieMaths: { ...config.quickieMaths, megaBombLastPicks: parseInt(e.target.value) }
                            })}
                            className="config-input"
                        />
                    </div>

                    <div className="config-field">
                        <label>Mega Bomb Chance (%)</label>
                        <input
                            type="number"
                            min="5"
                            max="100"
                            step="5"
                            value={Math.round((config.quickieMaths?.megaBombChance || 0.5) * 100)}
                            onChange={(e) => onChange({
                                ...config,
                                quickieMaths: { ...config.quickieMaths, megaBombChance: parseInt(e.target.value) / 100 }
                            })}
                            className="config-input"
                        />
                    </div>
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
