import React, { useRef, useState, useEffect } from 'react';
import { AudioManager } from '../engine/AudioManager';

const CATEGORY_COLORS = {
    gameplay: { bg: 'rgba(52, 152, 219, 0.15)', border: '#3498db', text: '#5dade2' },
    feedback: { bg: 'rgba(46, 204, 113, 0.15)', border: '#2ecc71', text: '#58d68d' },
    ui: { bg: 'rgba(155, 89, 182, 0.15)', border: '#9b59b6', text: '#bb8fce' },
    ambience: { bg: 'rgba(241, 196, 15, 0.15)', border: '#f1c40f', text: '#f9e79f' },
};

const AVAILABLE_SOUNDS = [
    { name: 'Money (Safe)', src: '/sounds/money.mp3' },
    { name: 'Ack (Bomb)', src: '/sounds/ack.mp3' },
    { name: 'Bomb (Mega)', src: '/sounds/bomb.mp3' },
    { name: 'Yay (Win)', src: '/sounds/yay.mp3' },
    { name: 'Lose Some', src: '/sounds/lose-some.mp3' },
    { name: 'Funny Money', src: '/sounds/funny-money.mp3' },
];

function useGeneratedAudio() {
    const [audio, setAudio] = useState(() => {
        return JSON.parse(localStorage.getItem('qtm_generated_audio') || '[]');
    });

    useEffect(() => {
        const handleStorage = () => {
            setAudio(JSON.parse(localStorage.getItem('qtm_generated_audio') || '[]'));
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return audio;
}

function SlotAudioGenerator({ slot, onGenerated }) {
    const [input, setInput] = useState('');
    const [duration, setDuration] = useState(String(slot.duration || 1));
    const [status, setStatus] = useState(null);

    const handleGenerate = async () => {
        if (!input.trim()) return;
        const prompt = input.trim();
        setStatus({ type: 'loading', content: 'Generating...' });

        try {
            const body = { prompt };
            const dur = parseFloat(duration);
            if (dur > 0) {
                body.duration = dur;
            }

            const response = await fetch('/api/audio-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.audioDataUrl) {
                // Save to generated audio library
                const savedAudio = JSON.parse(localStorage.getItem('qtm_generated_audio') || '[]');
                savedAudio.push({
                    id: Date.now() + '_audio',
                    name: slot.name + ' (' + prompt.slice(0, 30) + ')',
                    src: data.audioDataUrl,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem('qtm_generated_audio', JSON.stringify(savedAudio));
                window.dispatchEvent(new Event('storage'));
                // Also assign directly to this slot
                onGenerated(slot.id, data.audioDataUrl);
                setStatus({ type: 'success', content: 'Audio generated & assigned!' });
                setInput('');
            } else {
                setStatus({ type: 'error', content: data.message || 'Could not generate audio.' });
            }
        } catch {
            setStatus({ type: 'error', content: 'Failed to connect to audio service.' });
        }
    };

    return (
        <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleGenerate();
                        }
                    }}
                    placeholder={`Describe sound for ${slot.name}...`}
                    disabled={status?.type === 'loading'}
                    style={{
                        flex: 1,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.75rem',
                        fontFamily: 'inherit',
                    }}
                />
                <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    title="Duration (seconds)"
                    min="0.5"
                    max="22"
                    step="0.5"
                    style={{
                        width: '42px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                        padding: '0.3rem 0.25rem',
                        fontSize: '0.7rem',
                        fontFamily: 'inherit',
                        textAlign: 'center',
                    }}
                />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>s</span>
                <button
                    onClick={handleGenerate}
                    disabled={status?.type === 'loading' || !input.trim()}
                    className="btn btn-sm"
                    style={{
                        fontSize: '0.7rem',
                        padding: '0.3rem 0.5rem',
                        whiteSpace: 'nowrap',
                        background: status?.type === 'loading' || !input.trim() ? 'var(--bg-input)' : 'var(--primary)',
                        color: status?.type === 'loading' || !input.trim() ? 'var(--text-dim)' : 'black',
                    }}
                >
                    {status?.type === 'loading' ? '...' : 'Generate'}
                </button>
            </div>
            {status && status.type !== 'loading' && (
                <div style={{
                    fontSize: '0.7rem',
                    marginTop: '0.25rem',
                    color: status.type === 'error' ? 'var(--accent)' : 'var(--primary)',
                }}>
                    {status.type === 'success' ? '\u2705' : '\u26A0\uFE0F'} {status.content}
                </div>
            )}
            {status?.type === 'loading' && (
                <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', color: 'var(--text-dim)' }}>
                    <span className="typing-indicator">\u25CF\u25CF\u25CF</span> Generating audio...
                </div>
            )}
        </div>
    );
}

export function AudioPanel({ audioManager, onAudioChange, gameType }) {
    const fileInputRefs = useRef({});
    const [playingId, setPlayingId] = useState(null);
    const [volume, setVolume] = useState(audioManager?.volume ?? 0.5);
    const [muted, setMuted] = useState(audioManager?.muted ?? false);
    const [pickerOpen, setPickerOpen] = useState(null); // soundId or null
    const [pickerTab, setPickerTab] = useState('generated');
    const [previewingSrc, setPreviewingSrc] = useState(null);
    const generatedAudio = useGeneratedAudio();

    const soundSlots = AudioManager.getSoundSlots(gameType);

    const handlePreview = async (soundId) => {
        if (!audioManager) return;
        setPlayingId(soundId);
        await audioManager.play(soundId);
        setTimeout(() => setPlayingId(null), 800);
    };

    const handleUpload = (soundId, event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            if (audioManager) {
                audioManager.setCustomAudio(soundId, dataUrl);
            }
            if (onAudioChange) {
                onAudioChange(soundId, dataUrl);
            }
        };
        reader.readAsDataURL(file);
    };

    const handlePickAudio = (soundId, src) => {
        if (audioManager) {
            audioManager.setCustomAudio(soundId, src);
        }
        if (onAudioChange) {
            onAudioChange(soundId, src);
        }
        setPickerOpen(null);
    };

    const handlePreviewSound = async (src) => {
        setPreviewingSrc(src);
        try {
            const audio = new Audio(src);
            audio.volume = volume;
            await audio.play();
        } catch (e) { /* silent */ }
        setTimeout(() => setPreviewingSrc(null), 800);
    };

    const handleReset = (soundId) => {
        if (audioManager) {
            audioManager.clearCustomAudio(soundId);
        }
        if (onAudioChange) {
            onAudioChange(soundId, null);
        }
    };

    const handleVolumeChange = (e) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (audioManager) {
            audioManager.setVolume(v);
        }
    };

    const handleMuteToggle = () => {
        const newMuted = !muted;
        setMuted(newMuted);
        if (audioManager) {
            audioManager.setMuted(newMuted);
        }
    };

    const hasCustom = (soundId) => {
        return audioManager?.customAudio?.[soundId] != null;
    };

    return (
        <div className="audio-panel">
            <h3 className="config-label" style={{ marginBottom: '0.75rem' }}>
                Audio Settings
            </h3>

            {/* Master Controls */}
            <div className="audio-master-controls">
                <div className="audio-volume-row">
                    <button
                        className="audio-mute-btn"
                        onClick={handleMuteToggle}
                        title={muted ? 'Unmute' : 'Mute'}
                    >
                        {muted ? '🔇' : volume > 0.5 ? '🔊' : volume > 0 ? '🔉' : '🔈'}
                    </button>
                    <input
                        type="range"
                        className="audio-volume-slider"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        disabled={muted}
                    />
                    <span className="audio-volume-label">
                        {muted ? 'Muted' : `${Math.round(volume * 100)}%`}
                    </span>
                </div>
            </div>

            {/* Sound Slots */}
            <div className="audio-slots-list">
                {soundSlots.map((slot) => {
                    const catColor = CATEGORY_COLORS[slot.category] || CATEGORY_COLORS.gameplay;
                    const isPlaying = playingId === slot.id;
                    const isCustom = hasCustom(slot.id);

                    return (
                        <div
                            key={slot.id}
                            className={`audio-slot-item ${isPlaying ? 'playing' : ''}`}
                        >
                            <div className="audio-slot-header">
                                <div className="audio-slot-icon">{slot.icon}</div>
                                <div className="audio-slot-info">
                                    <div className="audio-slot-name">
                                        {slot.name}
                                        {isCustom && (
                                            <span className="audio-custom-badge">Custom</span>
                                        )}
                                    </div>
                                    <div
                                        className="audio-slot-category"
                                        style={{
                                            background: catColor.bg,
                                            borderColor: catColor.border,
                                            color: catColor.text,
                                        }}
                                    >
                                        {slot.category}
                                    </div>
                                </div>
                            </div>

                            <div className="audio-slot-description">
                                {slot.description}
                            </div>

                            {/* Waveform Preview Indicator */}
                            <div className={`audio-waveform ${isPlaying ? 'active' : ''}`}>
                                {Array.from({ length: 16 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="audio-waveform-bar"
                                        style={{ animationDelay: `${i * 0.05}s` }}
                                    />
                                ))}
                            </div>

                            <div className="audio-slot-actions">
                                <button
                                    className="audio-play-btn"
                                    onClick={() => handlePreview(slot.id)}
                                    disabled={isPlaying}
                                >
                                    {isPlaying ? '⏹' : '▶'} Preview
                                </button>

                                <button
                                    className="audio-play-btn"
                                    onClick={() => setPickerOpen(slot.id)}
                                >
                                    🎵 Pick Audio
                                </button>

                                <label className="audio-upload-btn">
                                    📤 Upload
                                    <input
                                        type="file"
                                        hidden
                                        accept="audio/*"
                                        ref={(el) => (fileInputRefs.current[slot.id] = el)}
                                        onChange={(e) => handleUpload(slot.id, e)}
                                    />
                                </label>

                                {isCustom && (
                                    <button
                                        className="audio-reset-btn"
                                        onClick={() => handleReset(slot.id)}
                                    >
                                        ↩ Reset
                                    </button>
                                )}
                            </div>

                            <SlotAudioGenerator
                                slot={slot}
                                onGenerated={(soundId, src) => {
                                    if (audioManager) {
                                        audioManager.setCustomAudio(soundId, src);
                                    }
                                    if (onAudioChange) {
                                        onAudioChange(soundId, src);
                                    }
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Audio Picker Modal */}
            {pickerOpen && (
                <div
                    className="modal-overlay"
                    onClick={(e) => { if (e.target.className === 'modal-overlay') setPickerOpen(null); }}
                >
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Pick Audio: {soundSlots.find(s => s.id === pickerOpen)?.name}</h2>
                            <button className="modal-close" onClick={() => setPickerOpen(null)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <p className="settings-description">
                                Select a sound to use for this slot.
                            </p>

                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <button
                                    className="btn btn-sm"
                                    style={{
                                        background: pickerTab === 'generated' ? 'var(--primary)' : 'var(--bg-input)',
                                        color: pickerTab === 'generated' ? 'black' : 'var(--text-dim)',
                                    }}
                                    onClick={() => setPickerTab('generated')}
                                >
                                    Generated ({generatedAudio.length})
                                </button>
                                <button
                                    className="btn btn-sm"
                                    style={{
                                        background: pickerTab === 'builtin' ? 'var(--primary)' : 'var(--bg-input)',
                                        color: pickerTab === 'builtin' ? 'black' : 'var(--text-dim)',
                                    }}
                                    onClick={() => setPickerTab('builtin')}
                                >
                                    Built-in Sounds
                                </button>
                            </div>

                            {pickerTab === 'generated' && (
                                generatedAudio.length === 0 ? (
                                    <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontStyle: 'italic', padding: '2rem 0', textAlign: 'center' }}>
                                        No generated audio yet. Use the Generate button on any sound slot to create some!
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {generatedAudio.map((item) => (
                                            <div
                                                key={item.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    padding: '0.625rem 0.75rem',
                                                    background: 'var(--bg-dark)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                                    e.currentTarget.style.background = 'var(--bg-input)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--border)';
                                                    e.currentTarget.style.background = 'var(--bg-dark)';
                                                }}
                                            >
                                                <button
                                                    className="audio-play-btn"
                                                    style={{ flexShrink: 0, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePreviewSound(item.src);
                                                    }}
                                                    disabled={previewingSrc === item.src}
                                                >
                                                    {previewingSrc === item.src ? '\u23F9' : '\u25B6'}
                                                </button>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {item.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                                                        {new Date(item.timestamp).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ background: 'var(--primary)', color: 'black', flexShrink: 0 }}
                                                    onClick={() => handlePickAudio(pickerOpen, item.src)}
                                                >
                                                    Use
                                                </button>
                                                <button
                                                    style={{
                                                        background: 'rgba(0,0,0,0.5)',
                                                        color: 'var(--accent)',
                                                        border: 'none',
                                                        borderRadius: '50%',
                                                        width: '22px',
                                                        height: '22px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                    }}
                                                    title="Delete this audio"
                                                    onClick={() => {
                                                        const saved = JSON.parse(localStorage.getItem('qtm_generated_audio') || '[]');
                                                        const updated = saved.filter(a => a.id !== item.id);
                                                        localStorage.setItem('qtm_generated_audio', JSON.stringify(updated));
                                                        window.dispatchEvent(new Event('storage'));
                                                    }}
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {pickerTab === 'builtin' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {AVAILABLE_SOUNDS.map((sound) => (
                                        <div
                                            key={sound.src}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.625rem 0.75rem',
                                                background: 'var(--bg-dark)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                e.currentTarget.style.background = 'var(--bg-input)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                e.currentTarget.style.background = 'var(--bg-dark)';
                                            }}
                                        >
                                            <button
                                                className="audio-play-btn"
                                                style={{ flexShrink: 0, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePreviewSound(sound.src);
                                                }}
                                                disabled={previewingSrc === sound.src}
                                            >
                                                {previewingSrc === sound.src ? '\u23F9' : '\u25B6'}
                                            </button>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {sound.name}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                                    {sound.src}
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-sm"
                                                style={{ background: 'var(--primary)', color: 'black', flexShrink: 0 }}
                                                onClick={() => handlePickAudio(pickerOpen, sound.src)}
                                            >
                                                Use
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
