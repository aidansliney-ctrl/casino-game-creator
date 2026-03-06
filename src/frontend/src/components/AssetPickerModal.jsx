import React from 'react';

export function AssetPickerModal({ isOpen, onClose, onSelect, assetId, assetName }) {
    if (!isOpen) return null;

    const egyptianIcons = [
        '☥', '👁', '𓆣', '𓂀', '𓋹', '𓇽', '𓃭', '𓏠',
        '𓀀', '𓁐', '𓃠', '𓅓', '𓆗', '𓋴', '𓍯', '𓐍'
    ];

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
                        Select a thematic icon to use as the base for this symbol, or use the upload button on the previous screen to use a custom image.
                    </p>
                    <div className="asset-picker-grid">
                        {egyptianIcons.map((icon, idx) => (
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
                </div>
            </div>
        </div>
    );
}
