import threeReelSlotV1 from '../ThreeReelSlotScene.js?raw';
import rouletteV1 from '../RouletteScene.js?raw';
import quickieDropV1 from '../QuickieDropScene.v1.0.js?raw';
import quickieDropV1_1 from '../QuickieDropScene.js?raw';
import slotGameV1 from '../SlotGameScene.js?raw';

export const templates = {
    'slots-3reel': [
        {
            version: '1.0',
            label: 'v1.0 — Egyptian Treasures',
            source: threeReelSlotV1,
            changes: [
                'Initial release',
                '3-reel slot with Egyptian theme',
                '9 symbols with weighted payouts',
                'Free spins and wild symbol support',
                '4-tier jackpot system (Mini, Minor, Major, Grand)',
                'Animated reel spinning with particle effects',
                'Paytable overlay'
            ]
        }
    ],
    'table-roulette': [
        {
            version: '1.0',
            label: 'v1.0 — Classic Roulette',
            source: rouletteV1,
            changes: [
                'Initial release',
                'European-style roulette wheel (0-36)',
                'Full betting board with inside and outside bets',
                'Animated wheel spin and ball physics',
                'Win highlighting and payout display'
            ]
        }
    ],
    'quickie-drop': [
        {
            version: '1.0',
            label: 'v1.0 — Quickie Drop',
            source: quickieDropV1,
            changes: [
                'Initial release',
                'Plinko-style drop mechanic',
                'Physics-based ball movement',
                'Configurable multiplier zones',
                'Auto-play support'
            ]
        },
        {
            version: '1.1',
            label: 'v1.1 — Quickie Drop',
            source: quickieDropV1_1,
            changes: [
                'Added defaultSrc to getUsedAssets() for Images panel display',
                'Assets panel now shows actual sticker images instead of emoji glyphs',
                'Image dimensions and file size visible for all assets',
                'Fixed image stretching — _drawImg now preserves aspect ratio'
            ]
        }
    ],
    'slots-5reel': [
        {
            version: '1.0',
            label: 'v1.0 — 5-Reel Slots',
            source: slotGameV1,
            changes: [
                'Initial release',
                '5-reel video slot layout',
                'Multiple payline support',
                'Basic symbol set with wilds'
            ]
        }
    ],
};

export function getLatestTemplate(gameType) {
    const versions = templates[gameType];
    if (!versions || versions.length === 0) return null;
    return versions[versions.length - 1];
}

export function getTemplate(gameType, version) {
    const versions = templates[gameType];
    if (!versions) return null;
    return versions.find(t => t.version === version) || null;
}

export function getTemplateVersions(gameType) {
    return templates[gameType] || [];
}
