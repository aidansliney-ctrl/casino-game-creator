import React, { useState, useEffect } from 'react';
import { AssetPickerModal } from './AssetPickerModal';

function ImageInfo({ src }) {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        if (!src) { setInfo(null); return; }
        // Skip short strings that are glyphs/emojis
        if (!src.startsWith('data:') && !src.startsWith('/') && !src.startsWith('http') && src.length < 20) {
            setInfo(null);
            return;
        }

        const img = new Image();
        img.onload = () => {
            let sizeBytes = 0;
            if (src.startsWith('data:')) {
                const base64 = src.split(',')[1] || '';
                sizeBytes = Math.round(base64.length * 3 / 4);
            }
            setInfo({ width: img.naturalWidth, height: img.naturalHeight, sizeBytes });
        };
        img.onerror = () => setInfo(null);
        img.src = src;
    }, [src]);

    if (!info) return null;

    const formatSize = (bytes) => {
        if (bytes === 0) return null;
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    return (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            <div>{info.width} x {info.height}px</div>
            {info.sizeBytes > 0 && <div>{formatSize(info.sizeBytes)}</div>}
        </div>
    );
}

const STYLE_OPTIONS = [
    { id: 'match', label: 'Match Current', hint: 'match the visual style of this reference image' },
    { id: 'sticker', label: 'Sticker', hint: 'sticker style with bold outlines and die-cut edges' },
    { id: 'simple', label: 'Simple', hint: 'simple flat design with no small details and no text' },
];

function StyleChips({ selected, onToggle }) {
    return (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
            {STYLE_OPTIONS.map((opt) => (
                <button
                    key={opt.id}
                    onClick={() => onToggle(opt.id)}
                    className="btn btn-sm"
                    style={{
                        fontSize: '0.65rem',
                        padding: '0.15rem 0.4rem',
                        background: selected.includes(opt.id) ? 'var(--primary)' : 'var(--bg-input)',
                        color: selected.includes(opt.id) ? 'black' : 'var(--text-dim)',
                        border: '1px solid var(--border)',
                    }}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function toggleStyle(styles, id) {
    return styles.includes(id) ? styles.filter(s => s !== id) : [...styles, id];
}

function buildStyleHints(selectedStyles) {
    return STYLE_OPTIONS.filter(o => selectedStyles.includes(o.id)).map(o => o.hint);
}

function imgSrcToDataUrl(src) {
    if (!src) return Promise.resolve(null);
    if (src.startsWith('data:')) return Promise.resolve(src);
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function AssetGenerator({ asset, onAssetChange }) {
    const [input, setInput] = useState('');
    const [styles, setStyles] = useState(['match', 'sticker', 'simple']);
    const [status, setStatus] = useState(null);

    const handleGenerate = async () => {
        if (!input.trim()) return;
        const userMessage = input.trim();
        setStatus({ type: 'loading', content: 'Generating...' });

        try {
            let referenceImage = null;
            if (styles.includes('match')) {
                referenceImage = await imgSrcToDataUrl(asset.current || asset.defaultSrc);
            }

            const response = await fetch('/api/nano-banana', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    assets: [asset],
                    history: [],
                    styleHints: buildStyleHints(styles),
                    referenceImage
                })
            });

            const data = await response.json();

            if (data.generatedAssets) {
                const savedImages = JSON.parse(localStorage.getItem('qtm_generated_images') || '[]');
                for (const [assetId, imageUrl] of Object.entries(data.generatedAssets)) {
                    onAssetChange(assetId, imageUrl);
                    savedImages.push({
                        id: Date.now() + '_' + assetId,
                        name: asset.name + ' (' + userMessage.slice(0, 30) + ')',
                        src: imageUrl,
                        timestamp: new Date().toISOString()
                    });
                }
                localStorage.setItem('qtm_generated_images', JSON.stringify(savedImages));
                window.dispatchEvent(new Event('storage'));
                setStatus({ type: 'success', content: 'Image generated!' });
                setInput('');
            } else {
                setStatus({ type: 'error', content: data.message || 'Could not generate image.' });
            }
        } catch {
            setStatus({ type: 'error', content: 'Failed to connect to image service.' });
        }
    };

    return (
        <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
            <StyleChips selected={styles} onToggle={(id) => setStyles(s => toggleStyle(s, id))} />
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
                    placeholder={`Describe style for ${asset.name}...`}
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
                    {status.type === 'success' ? '✅' : '⚠️'} {status.content}
                </div>
            )}
            {status?.type === 'loading' && (
                <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', color: 'var(--text-dim)' }}>
                    <span className="typing-indicator">●●●</span> Generating image...
                </div>
            )}
        </div>
    );
}

function AllAssetsGenerator({ assets, onAssetChange }) {
    const [input, setInput] = useState('');
    const [styles, setStyles] = useState(['match', 'sticker', 'simple']);
    const [status, setStatus] = useState(null);

    const handleGenerate = async () => {
        if (!input.trim() || !assets || assets.length === 0) return;
        const userMessage = input.trim();
        setStatus({ type: 'loading', content: `Generating ${assets.length} image(s)...` });

        try {
            const response = await fetch('/api/nano-banana', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    assets: assets,
                    history: [],
                    styleHints: buildStyleHints(styles)
                })
            });

            const data = await response.json();

            if (data.generatedAssets) {
                const savedImages = JSON.parse(localStorage.getItem('qtm_generated_images') || '[]');
                for (const [assetId, imageUrl] of Object.entries(data.generatedAssets)) {
                    onAssetChange(assetId, imageUrl);
                    const asset = (assets || []).find(a => String(a.id) === String(assetId));
                    const name = asset ? asset.name : assetId;
                    savedImages.push({
                        id: Date.now() + '_' + assetId,
                        name: name + ' (' + userMessage.slice(0, 30) + ')',
                        src: imageUrl,
                        timestamp: new Date().toISOString()
                    });
                }
                localStorage.setItem('qtm_generated_images', JSON.stringify(savedImages));
                window.dispatchEvent(new Event('storage'));
                setStatus({ type: 'success', content: data.message || `Generated ${Object.keys(data.generatedAssets).length} image(s)!` });
                setInput('');
            } else {
                setStatus({ type: 'error', content: data.message || 'Could not generate images.' });
            }
        } catch {
            setStatus({ type: 'error', content: 'Failed to connect to image service.' });
        }
    };

    return (
        <div style={{
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '1rem'
        }}>
            <h3 className="font-bold flex items-center gap-2" style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                Nano Banana — Generate All
            </h3>
            <StyleChips selected={styles} onToggle={(id) => setStyles(s => toggleStyle(s, id))} />
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                    }
                }}
                placeholder="Describe the image style you want for all assets..."
                disabled={status?.type === 'loading'}
                rows={4}
                style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    padding: '0.5rem',
                    fontSize: '0.8rem',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    minHeight: '80px'
                }}
            />
            <button
                onClick={handleGenerate}
                disabled={status?.type === 'loading' || !input.trim()}
                className="btn btn-sm"
                style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    background: status?.type === 'loading' || !input.trim() ? 'var(--bg-input)' : 'var(--primary)',
                    color: status?.type === 'loading' || !input.trim() ? 'var(--text-dim)' : 'black'
                }}
            >
                {status?.type === 'loading' ? 'Generating...' : 'Generate All Images'}
            </button>
            {status && status.type !== 'loading' && (
                <div style={{
                    fontSize: '0.75rem',
                    marginTop: '0.25rem',
                    color: status.type === 'error' ? 'var(--accent)' : 'var(--primary)',
                }}>
                    {status.type === 'success' ? '✅' : '⚠️'} {status.content}
                </div>
            )}
            {status?.type === 'loading' && (
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-dim)' }}>
                    <span className="typing-indicator">●●●</span> {status.content}
                </div>
            )}
        </div>
    );
}

export function AssetsPanel({ assets, onAssetChange }) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [activeAsset, setActiveAsset] = useState(null);

    const handleFileUpload = (assetId, event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                onAssetChange(assetId, e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSelectIcon = (icon) => {
        if (activeAsset) {
            onAssetChange(activeAsset.id, null, icon);
        }
    };

    return (
        <div className="assets-panel">
            {assets && assets.length > 0 && (
                <AllAssetsGenerator assets={assets} onAssetChange={onAssetChange} />
            )}

            {/* Assets List */}
            {(!assets || assets.length === 0) ? (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                    No assets in use yet. Update your game configuration to see assets.
                </div>
            ) : (
            <>
            <h3 className="config-label mb-4">
                Images in Use ({assets.length})
            </h3>

            <div className="assets-list">
                {assets.map((asset) => (
                    <div key={asset.id} className="asset-item">
                        <div className="asset-header">
                            <div className="asset-preview-box">
                                {(() => {
                                    const displaySrc = asset.current || asset.defaultSrc;
                                    if (displaySrc && (displaySrc.startsWith('data:') || displaySrc.startsWith('/') || displaySrc.startsWith('http') || displaySrc.length > 20)) {
                                        return <img src={displaySrc} alt={asset.name} />;
                                    }
                                    return (
                                        <span className="glyph" style={{ color: asset.color }}>
                                            {asset.current || asset.glyph || '?'}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="asset-details">
                                <div className="asset-name">{asset.name}</div>
                                <div className="asset-type">{asset.type}</div>
                                <ImageInfo src={asset.current || asset.defaultSrc} />
                            </div>
                        </div>

                        <div className="asset-actions">
                            <button
                                className="asset-edit-btn"
                                onClick={() => {
                                    setActiveAsset(asset);
                                    setPickerOpen(true);
                                }}
                            >
                                🗺️ Pick Icon
                            </button>

                            <label className="asset-upload-label">
                                📤 Upload
                                <input
                                    type="file"
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(asset.id, e)}
                                />
                            </label>

                            {asset.current && (
                                <button
                                    className="asset-edit-btn"
                                    style={{ color: 'var(--accent)' }}
                                    onClick={() => onAssetChange(asset.id, null)}
                                >
                                    🗑️ Reset
                                </button>
                            )}
                        </div>

                        <AssetGenerator asset={asset} onAssetChange={onAssetChange} />
                    </div>
                ))}
            </div>
            </>
            )}

            <AssetPickerModal
                isOpen={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSelect={handleSelectIcon}
                assetId={activeAsset?.id}
                assetName={activeAsset?.name}
            />
        </div>
    );
}
