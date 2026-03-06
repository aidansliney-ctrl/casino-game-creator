import React, { useState, useEffect } from 'react';

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

function useGeneratedImages() {
    const [images, setImages] = useState(() => {
        return JSON.parse(localStorage.getItem('qtm_generated_images') || '[]');
    });

    useEffect(() => {
        const handleStorage = () => {
            setImages(JSON.parse(localStorage.getItem('qtm_generated_images') || '[]'));
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return images;
}

export function AssetPickerModal({ isOpen, onClose, onSelect, assetId, assetName }) {
    const [tab, setTab] = useState('stickers');
    const generatedImages = useGeneratedImages();

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target.className === 'modal-overlay') onClose();
    };

    const handleDeleteGenerated = (imageId) => {
        const saved = JSON.parse(localStorage.getItem('qtm_generated_images') || '[]');
        const updated = saved.filter(img => img.id !== imageId);
        localStorage.setItem('qtm_generated_images', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
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
                                background: tab === 'generated' ? 'var(--primary)' : 'var(--bg-input)',
                                color: tab === 'generated' ? 'black' : 'var(--text-dim)',
                            }}
                            onClick={() => setTab('generated')}
                        >
                            Generated ({generatedImages.length})
                        </button>
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

                    {tab === 'generated' && (
                        generatedImages.length === 0 ? (
                            <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontStyle: 'italic', padding: '2rem 0', textAlign: 'center' }}>
                                No generated images yet. Use Nano Banana on the Images tab to generate some!
                            </div>
                        ) : (
                            <div className="asset-picker-grid">
                                {generatedImages.map((img) => (
                                    <div
                                        key={img.id}
                                        className="picker-option"
                                        title={img.name}
                                        style={{ padding: '0.25rem', position: 'relative' }}
                                    >
                                        <img
                                            src={img.src}
                                            alt={img.name}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'contain',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => {
                                                onSelect(img.src);
                                                onClose();
                                            }}
                                        />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteGenerated(img.id);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '2px',
                                                right: '2px',
                                                background: 'rgba(0,0,0,0.7)',
                                                color: 'var(--accent)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '18px',
                                                height: '18px',
                                                fontSize: '10px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                lineHeight: 1,
                                            }}
                                            title="Delete this image"
                                        >
                                            &times;
                                        </button>
                                        <div style={{
                                            fontSize: '0.6rem',
                                            color: 'var(--text-dim)',
                                            textAlign: 'center',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            marginTop: '2px',
                                        }}>
                                            {img.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

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
