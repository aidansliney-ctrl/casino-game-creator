import React, { useState } from 'react';

const STICKER_IMAGES = [
    { name: 'Diamond', src: '/icons/diamond-sticker.png' },
    { name: 'Diamond 2', src: '/icons/diamond-sticker-1.png' },
    { name: 'Crown', src: '/icons/crown-sticker.png' },
    { name: '7', src: '/icons/7-sticker.png' },
    { name: 'Cherries', src: '/icons/cherries-sticker.png' },
    { name: 'Clover', src: '/icons/clover-sticker.png' },
    { name: 'Lightning', src: '/icons/lightning-sticker.png' },
    { name: 'Lightning Bolt', src: '/icons/lightning-bolt-sticker.png' },
    { name: 'X Face', src: '/icons/x-face-sticker.png' },
    { name: 'Sad', src: '/icons/sad-sticker.png' },
    { name: 'Smile', src: '/icons/smile-sticker.png' },
    { name: 'Flame', src: '/icons/flame-sticker.png' },
    { name: 'Heart', src: '/icons/heart-sticker.png' },
    { name: 'Heart 2', src: '/icons/heart-sticker-1.png' },
    { name: 'Lemon', src: '/icons/lemon-sticker.png' },
    { name: 'Flower', src: '/icons/flower-sticker.png' },
    { name: 'Hand', src: '/icons/hand-sticker.png' },
    { name: 'Ring Bell', src: '/icons/ringbell-sticker.png' },
    { name: 'Club', src: '/icons/club-sticker.png' },
    { name: 'Complete', src: '/icons/complete-sticker.png' },
    { name: 'Bingo Pink', src: '/icons/bingo-ball-pink.png' },
    { name: 'Bingo Yellow', src: '/icons/bingo-ball-yellow.png' },
    { name: 'Bingo Green', src: '/icons/bingo-ball-green.png' },
    { name: 'Bingo Blue', src: '/icons/bingo-ball-blue.png' },
];

const EGYPTIAN_ICONS = [
    '☥', '👁', '𓆣', '𓂀', '𓋹', '𓇽', '𓃭', '𓏠',
    '𓀀', '𓁐', '𓃠', '𓅓', '𓆗', '𓋴', '𓍯', '𓐍'
];

export function AssetPickerModal({ isOpen, onClose, onSelect, assetId, assetName }) {
    const [tab, setTab] = useState('stickers');

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target.className === 'modal-overlay') onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Select Icon: {assetName}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <p className="settings-description">
                        Select an icon to use for this asset, or use the upload button on the previous screen to use a custom image.
                    </p>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <button
                            className="btn btn-sm"
                            style={{
                                background: tab === 'stickers' ? 'var(--primary)' : 'var(--bg-input)',
                                color: tab === 'stickers' ? 'black' : 'var(--text-dim)',
                            }}
                            onClick={() => setTab('stickers')}
                        >
                            Sticker Images
                        </button>
                        <button
                            className="btn btn-sm"
                            style={{
                                background: tab === 'glyphs' ? 'var(--primary)' : 'var(--bg-input)',
                                color: tab === 'glyphs' ? 'black' : 'var(--text-dim)',
                            }}
                            onClick={() => setTab('glyphs')}
                        >
                            Egyptian Glyphs
                        </button>
                    </div>

                    {tab === 'stickers' && (
                        <div className="asset-picker-grid">
                            {STICKER_IMAGES.map((img, idx) => (
                                <div
                                    key={idx}
                                    className="picker-option"
                                    title={img.name}
                                    onClick={() => {
                                        onSelect(img.src);
                                        onClose();
                                    }}
                                    style={{ padding: '0.5rem' }}
                                >
                                    <img
                                        src={img.src}
                                        alt={img.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'glyphs' && (
                        <div className="asset-picker-grid">
                            {EGYPTIAN_ICONS.map((icon, idx) => (
                                <div
                                    key={idx}
                                    className="picker-option"
                                    onClick={() => {
                                        onSelect(icon);
                                        onClose();
                                    }}
                                >
                                    {icon}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
