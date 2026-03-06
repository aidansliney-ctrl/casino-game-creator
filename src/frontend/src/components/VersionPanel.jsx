import { getTemplateVersions } from '../engine/templates';

export function VersionPanel({ gameType, currentVersion, onVersionSelect }) {
    const versions = getTemplateVersions(gameType);

    if (versions.length === 0) {
        return (
            <div>
                <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Template Versions
                </h3>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                    No versioned templates available for this game type.
                </div>
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Template Versions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {versions.map((tmpl) => {
                    const isActive = tmpl.version === currentVersion;
                    return (
                        <div
                            key={tmpl.version}
                            onClick={() => onVersionSelect(tmpl.version)}
                            style={{
                                padding: '0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                                background: isActive ? 'rgba(241, 196, 15, 0.08)' : 'var(--bg-input)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '0.875rem', color: isActive ? 'var(--primary)' : 'var(--text)' }}>
                                    {tmpl.label}
                                </span>
                                {isActive && (
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '4px',
                                        background: 'var(--primary)',
                                        color: 'black',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}>
                                        Active
                                    </span>
                                )}
                            </div>
                            {tmpl.changes && tmpl.changes.length > 0 && (
                                <ul style={{
                                    margin: 0,
                                    paddingLeft: '1.2rem',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-dim)',
                                    lineHeight: '1.5'
                                }}>
                                    {tmpl.changes.map((change, i) => (
                                        <li key={i}>{change}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
