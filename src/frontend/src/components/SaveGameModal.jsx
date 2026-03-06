import { useState } from 'react';

export function SaveGameModal({ isOpen, onClose, onSave }) {
    const [name, setName] = useState('');

    if (!isOpen) return null;

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
            setName('');
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>💾 Save New Game</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body p-6">
                    <p className="mb-4 text-sm" style={{ color: 'var(--text-dim)' }}>
                        Enter a descriptive name for your current slot machine configuration.
                    </p>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Pharaoh's Curse - High Stakes"
                        className="config-input w-full"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    />
                    <div className="flex gap-2 mt-6">
                        <button className="btn flex-1" style={{ background: 'var(--bg-input)', color: 'white' }} onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="btn flex-1"
                            style={{ background: 'var(--primary)', color: 'black' }}
                            onClick={handleSave}
                            disabled={!name.trim()}
                        >
                            Save Game
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
