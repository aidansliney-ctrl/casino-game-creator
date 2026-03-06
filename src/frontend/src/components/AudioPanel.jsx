import React, { useRef, useState } from 'react';
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

export function AudioPanel({ audioManager, onAudioChange, gameType }) {
    const fileInputRefs = useRef({});
    const [playingId, setPlayingId] = useState(null);
    const [volume, setVolume] = useState(audioManager?.volume ?? 0.5);
    const [muted, setMuted] = useState(audioManager?.muted ?? false);
    const [pickerOpen, setPickerOpen] = useState(null); // soundId or null
    const [previewingSrc, setPreviewingSrc] = useState(null);

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
                                Select a built-in sound to use for this slot.
                            </p>
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
                                            {previewingSrc === sound.src ? '⏹' : '▶'}
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
