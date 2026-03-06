import React, { useRef, useState } from 'react';
import { AudioManager } from '../engine/AudioManager';

const CATEGORY_COLORS = {
    gameplay: { bg: 'rgba(52, 152, 219, 0.15)', border: '#3498db', text: '#5dade2' },
    feedback: { bg: 'rgba(46, 204, 113, 0.15)', border: '#2ecc71', text: '#58d68d' },
    ui: { bg: 'rgba(155, 89, 182, 0.15)', border: '#9b59b6', text: '#bb8fce' },
    ambience: { bg: 'rgba(241, 196, 15, 0.15)', border: '#f1c40f', text: '#f9e79f' },
};

export function AudioPanel({ audioManager, onAudioChange }) {
    const fileInputRefs = useRef({});
    const [playingId, setPlayingId] = useState(null);
    const [volume, setVolume] = useState(audioManager?.volume ?? 0.5);
    const [muted, setMuted] = useState(audioManager?.muted ?? false);

    const soundSlots = AudioManager.getSoundSlots();

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
                🎧 Audio Settings
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
        </div>
    );
}
