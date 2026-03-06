import { useState, useEffect } from 'react';

export function SettingsModal({ isOpen, onClose, geminiKey, anthropicKey, provider, onSave }) {
    const [inputGemini, setInputGemini] = useState(geminiKey || '');
    const [inputAnthropic, setInputAnthropic] = useState(anthropicKey || '');
    const [selectedProvider, setSelectedProvider] = useState(provider || 'gemini');
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setInputGemini(geminiKey || '');
            setInputAnthropic(anthropicKey || '');
            setSelectedProvider(provider || 'gemini');
        }
    }, [isOpen, geminiKey, anthropicKey, provider]);

    const handleSave = () => {
        onSave(inputGemini, inputAnthropic, selectedProvider);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>⚙️ AI Settings</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="settings-section">
                        <h3>Active Provider</h3>
                        <div className="settings-field">
                            <select
                                value={selectedProvider}
                                onChange={(e) => setSelectedProvider(e.target.value)}
                                className="settings-select"
                                style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="claude">Anthropic Claude</option>
                            </select>
                        </div>

                        <h3>API Keys</h3>

                        <div className="settings-field" style={{ marginBottom: '1rem' }}>
                            <label>Google Gemini API Key</label>
                            <input
                                type="password"
                                value={inputGemini}
                                onChange={(e) => setInputGemini(e.target.value)}
                                placeholder="Enter Gemini API Key..."
                                className="settings-input"
                            />
                            <div className="text-xs text-dim" style={{ marginTop: '0.25rem' }}>
                                Get key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>
                            </div>
                        </div>

                        <div className="settings-field">
                            <label>Anthropic Claude API Key</label>
                            <input
                                type="password"
                                value={inputAnthropic}
                                onChange={(e) => setInputAnthropic(e.target.value)}
                                placeholder="Enter Anthropic API Key..."
                                className="settings-input"
                            />
                            <div className="text-xs text-dim" style={{ marginTop: '0.25rem' }}>
                                Get key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">Anthropic Console</a>
                            </div>
                        </div>

                        <div className="settings-actions" style={{ marginTop: '2rem' }}>
                            <button
                                className="btn"
                                onClick={handleSave}
                            >
                                {isSaved ? '✓ Saved!' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
