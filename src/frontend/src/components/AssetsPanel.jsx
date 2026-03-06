import React, { useState } from 'react';
import { AssetPickerModal } from './AssetPickerModal';

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

    if (!assets || assets.length === 0) {
        return (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                No assets in use yet. Update your game configuration to see assets.
            </div>
        );
    }

    return (
        <div className="assets-panel">
            <h3 className="config-label mb-4">
                Assets in Use ({assets.length})
            </h3>

            <div className="assets-list">
                {assets.map((asset) => (
                    <div key={asset.id} className="asset-item">
                        <div className="asset-header">
                            <div className="asset-preview-box">
                                {asset.current && (asset.current.startsWith('data:') || asset.current.length > 20) ? (
                                    <img src={asset.current} alt={asset.name} />
                                ) : (
                                    <span className="glyph" style={{ color: asset.color }}>
                                        {asset.current || asset.glyph || '?'}
                                    </span>
                                )}
                            </div>
                            <div className="asset-details">
                                <div className="asset-name">{asset.name}</div>
                                <div className="asset-type">{asset.type}</div>
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
                    </div>
                ))}
            </div>

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
