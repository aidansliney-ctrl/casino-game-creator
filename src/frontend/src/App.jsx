import { useEffect, useRef, useState } from 'react';
import { Game } from './engine/Game';
import { TestScene } from './engine/TestScene';
import { SlotGameScene } from './engine/SlotGameScene';
import { ChatPanel } from './components/ChatPanel';
import { GameConfig } from './components/GameConfig';
import { AssetsPanel } from './components/AssetsPanel';
import { AudioPanel } from './components/AudioPanel';
import { SettingsModal } from './components/SettingsModal';
import { SavedGamesPanel } from './components/SavedGamesPanel';
import { SaveGameModal } from './components/SaveGameModal';
import { MathsPanel } from './components/MathsPanel';
import { AudioManager } from './engine/AudioManager';
import logo from './assets/logo.png';
import { ThreeReelSlotScene } from './engine/ThreeReelSlotScene';
import { RouletteScene } from './engine/RouletteScene';
import { QuickieDropScene } from './engine/QuickieDropScene';

function App() {
    const canvasRef = useRef(null);
    const gameRef = useRef(null);
    const audioManagerRef = useRef(null);
    const [backendStatus, setBackendStatus] = useState('Checking');
    const [activeTab, setActiveTab] = useState('saved'); // Start on saved as requested (before config)
    const [gameConfig, setGameConfig] = useState({
        gameType: 'slots-3reel',
        rtp: 96,
        volatility: 'medium',
        features: {
            freeSpins: true,
            multipliers: false,
            wilds: true,
            bonus: false
        },
        jackpots: {
            mini: true,
            minor: true,
            major: true,
            grand: true
        }
    });
    const [appliedConfig, setAppliedConfig] = useState(null);
    const [currentSaveId, setCurrentSaveId] = useState(null); // Track loaded save
    const [usedAssets, setUsedAssets] = useState([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState('mobile'); // desktop or mobile


    // AI Settings State
    const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
    const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
    const [provider, setProvider] = useState(() => localStorage.getItem('ai_provider') || 'gemini');

    const handleSaveSettings = (newGeminiKey, newAnthropicKey, newProvider) => {
        setGeminiKey(newGeminiKey);
        localStorage.setItem('gemini_api_key', newGeminiKey);

        setAnthropicKey(newAnthropicKey);
        localStorage.setItem('anthropic_api_key', newAnthropicKey);

        setProvider(newProvider);
        localStorage.setItem('ai_provider', newProvider);
    };

    // Check if config has changed
    const hasChanges = JSON.stringify(gameConfig) !== JSON.stringify(appliedConfig);

    const updateGame = () => {
        if (!gameRef.current) return;

        console.log('[App] Updating game with config:', gameConfig);

        // Ensure AudioManager exists
        if (!audioManagerRef.current) {
            audioManagerRef.current = new AudioManager();
        }

        // Create appropriate scene based on game type
        let scene;
        if (gameConfig.gameType === 'slots-3reel') {
            scene = new ThreeReelSlotScene(gameConfig);
        } else if (gameConfig.gameType === 'table-roulette') {
            scene = new RouletteScene(gameConfig);
        } else if (gameConfig.gameType === 'quickie-drop') {
            scene = new QuickieDropScene(gameConfig);
        } else if (gameConfig.gameType.startsWith('slots')) {
            scene = new SlotGameScene(gameConfig);
        } else {
            // Fallback to test scene for other game types
            scene = new TestScene();
        }

        // Attach audio manager to scene
        if (scene.setAudioManager) {
            scene.setAudioManager(audioManagerRef.current);
        }

        gameRef.current.setScene(scene);
        setAppliedConfig({ ...gameConfig });

        // Update used assets after scene is created
        setTimeout(() => {
            if (scene.getUsedAssets) {
                setUsedAssets(scene.getUsedAssets());
            }
        }, 100);
    };

    const handleAssetChange = (assetId, imageUrl, newGlyph) => {
        setGameConfig(prev => {
            const next = {
                ...prev,
                customAssets: {
                    ...(prev.customAssets || {}),
                    [assetId]: imageUrl || newGlyph // Store either the image URL or the new glyph
                }
            };
            return next;
        });
    };

    // Auto-update when assets or game type changes
    useEffect(() => {
        if (gameRef.current) {
            updateGame();
        }
    }, [gameConfig.gameType, gameConfig.customAssets]);

    // Force resize when switching view modes
    useEffect(() => {
        if (gameRef.current) {
            // Wait for CSS transition to settle slightly or trigger multiple times
            gameRef.current.renderer.resize();
            const timeout = setTimeout(() => {
                gameRef.current.renderer.resize();
            }, 500); // After transition finishes
            return () => clearTimeout(timeout);
        }
    }, [viewMode]);

    useEffect(() => {
        const checkHealth = () => {
            fetch('/api/health')
                .then(res => res.json())
                .then(data => setBackendStatus(data.status === 'UP' ? 'Online' : 'Error'))
                .catch(() => setBackendStatus('Offline'));
        };

        // Initial check
        checkHealth();

        // Poll every 30 seconds
        const interval = setInterval(checkHealth, 30000);

        // Initialize Game Engine
        if (canvasRef.current && !gameRef.current) {
            const game = new Game(canvasRef.current);
            game.start();

            // Create AudioManager
            if (!audioManagerRef.current) {
                audioManagerRef.current = new AudioManager();
            }

            let initialScene;
            if (gameConfig.gameType === 'slots-3reel') {
                initialScene = new ThreeReelSlotScene(gameConfig);
            } else {
                initialScene = new SlotGameScene(gameConfig);
            }

            // Attach audio manager
            if (initialScene.setAudioManager) {
                initialScene.setAudioManager(audioManagerRef.current);
            }

            game.setScene(initialScene);
            gameRef.current = game;
            setAppliedConfig({ ...gameConfig });

            // Set initial assets
            setTimeout(() => {
                if (initialScene.getUsedAssets) {
                    setUsedAssets(initialScene.getUsedAssets());
                }
            }, 100);
        }

        return () => {
            clearInterval(interval);
            if (gameRef.current) {
                gameRef.current.stop();
                gameRef.current.renderer.destroy();
                gameRef.current = null;
            }
            if (audioManagerRef.current) {
                audioManagerRef.current.destroy();
                audioManagerRef.current = null;
            }
        }
    }, []);

    return (
        <div className="app-container">
            {/* Header */}
            <header className="header">
                <div className="flex items-center gap-8">
                    <img src={logo} alt="MrQ Logo" style={{ height: '32px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
                    <h1>QTM Game Creator</h1>
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>v0.1.0</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`status-badge ${backendStatus.toLowerCase()}`}>
                        {backendStatus}
                    </span>
                    <button
                        className="btn btn-sm"
                        style={{ background: 'var(--primary)', color: 'black' }}
                        onClick={() => {
                            if (currentSaveId) {
                                // Direct Overwrite
                                const saved = JSON.parse(localStorage.getItem('qtm_saved_games') || '[]');
                                const idx = saved.findIndex(g => g.id === currentSaveId);
                                if (idx !== -1) {
                                    saved[idx].config = { ...gameConfig };
                                    saved[idx].timestamp = new Date().toLocaleString() + ' (Updated)';
                                    localStorage.setItem('qtm_saved_games', JSON.stringify(saved));
                                    window.dispatchEvent(new Event('storage'));
                                    alert(`Changes saved to "${saved[idx].name}"`);
                                    return;
                                }
                            }
                            // Otherwise open naming modal
                            setSaveModalOpen(true);
                        }}
                    >
                        💾 {currentSaveId ? 'Save Over' : 'Save New'}
                    </button>
                    <button
                        className="btn btn-sm"
                        style={{ background: 'var(--bg-input)' }}
                        onClick={() => setSettingsOpen(true)}
                    >
                        ⚙️ Settings
                    </button>
                    <div className="view-toggle">
                        <button className={viewMode === 'desktop' ? 'active' : ''} onClick={() => setViewMode('desktop')}>🖥️ Desktop</button>
                        <button className={viewMode === 'mobile' ? 'active' : ''} onClick={() => setViewMode('mobile')}>📱 Mobile</button>
                    </div>
                    <button className="btn btn-sm">▶ Run</button>
                    <button className="btn btn-sm" style={{ background: 'var(--bg-input)' }}>
                        ↑ Export
                    </button>
                    <button className="btn btn-sm" style={{ border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent' }}>
                        ✓ Submit for Certification
                    </button>
                </div>
            </header>

            {/* Main Layout */}
            <div className="main-layout">

                {/* Left Sidebar - Config First */}
                <aside className="sidebar-left flex flex-col">
                    <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
                        <TabButton label="Saved" active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} />
                        <TabButton label="Game Type" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
                        <TabButton label="Maths" active={activeTab === 'maths'} onClick={() => setActiveTab('maths')} />
                        <TabButton label="Assets" active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} />
                        <TabButton label="Audio" active={activeTab === 'audio'} onClick={() => setActiveTab('audio')} />
                        <TabButton label="Theme" active={activeTab === 'theme'} onClick={() => setActiveTab('theme')} />
                    </div>

                    <div className="p-4 grow" style={{ overflowY: 'auto' }}>
                        {activeTab === 'saved' && (
                            <SavedGamesPanel
                                currentConfig={gameConfig}
                                activeSaveId={currentSaveId}
                                onSelect={(game) => {
                                    setGameConfig(game.config);
                                    setCurrentSaveId(game.id);
                                    setTimeout(() => updateGame(), 0);
                                }}
                            />
                        )}
                        {activeTab === 'config' && (
                            <GameConfig
                                config={gameConfig}
                                onChange={setGameConfig}
                                onUpdate={updateGame}
                                hasChanges={hasChanges}
                            />
                        )}
                        {activeTab === 'maths' && (
                            <MathsPanel
                                config={gameConfig}
                                onChange={setGameConfig}
                                onUpdate={updateGame}
                                hasChanges={hasChanges}
                            />
                        )}
                        {activeTab === 'assets' && (
                            <AssetsPanel
                                assets={usedAssets}
                                onAssetChange={handleAssetChange}
                            />
                        )}
                        {activeTab === 'audio' && (
                            <AudioPanel
                                audioManager={audioManagerRef.current}
                                gameType={gameConfig.gameType}
                                onAudioChange={(soundId, url) => {
                                    setGameConfig(prev => ({
                                        ...prev,
                                        customAudio: {
                                            ...(prev.customAudio || {}),
                                            [soundId]: url
                                        }
                                    }));
                                }}
                            />
                        )}
                        {activeTab === 'theme' && (
                            <>
                                <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Visual Theme
                                </h3>
                                <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                    Theme customization coming soon...
                                </div>
                            </>
                        )}
                    </div>
                </aside>

                {/* Center: Canvas */}
                <div className={`canvas-area ${viewMode === 'mobile' ? 'mobile-view' : ''}`}>
                    <div className="viewport-container">
                        <div className="phone-frame">
                            <div className="phone-notch"></div>
                            <div className="phone-button volume"></div>
                            <div className="phone-button power"></div>
                            <div className="phone-screen">
                                <canvas ref={canvasRef} />
                            </div>
                        </div>
                    </div>

                    <div style={{
                        position: 'absolute',
                        bottom: '1rem',
                        right: '1rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-dim)',
                        background: 'var(--bg-panel)',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        opacity: 0.5
                    }}>
                        100% Zoom
                    </div>
                </div>

                {/* Right Sidebar */}
                <aside className="sidebar-right flex flex-col">
                    <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
                        <h3 className="font-bold flex items-center gap-2">
                            <span style={{ color: 'var(--accent)' }}>💬</span> AI Assistant
                        </h3>
                    </div>
                    <ChatPanel
                        provider={provider}
                        apiKey={provider === 'gemini' ? geminiKey : anthropicKey}
                    />
                </aside>

            </div>

            {/* Settings Modal */}
            <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                geminiKey={geminiKey}
                anthropicKey={anthropicKey}
                provider={provider}
                onSave={handleSaveSettings}
            />

            {/* Save Game Modal */}
            <SaveGameModal
                isOpen={saveModalOpen}
                onClose={() => setSaveModalOpen(false)}
                onSave={(name) => {
                    const saved = JSON.parse(localStorage.getItem('qtm_saved_games') || '[]');
                    const newSave = {
                        id: Date.now(),
                        name: name,
                        config: { ...gameConfig },
                        timestamp: new Date().toLocaleString()
                    };
                    localStorage.setItem('qtm_saved_games', JSON.stringify([newSave, ...saved]));
                    setCurrentSaveId(newSave.id);
                    window.dispatchEvent(new Event('storage'));
                }}
            />
        </div>
    )
}

function TabButton({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex-1 p-3 flex flex-col items-center gap-1 text-xs"
            style={{
                color: active ? 'var(--primary)' : 'var(--text-dim)',
                background: active ? 'var(--bg-dark)' : 'transparent',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
            }}
        >
            <span>{label}</span>
        </button>
    )
}

export default App
