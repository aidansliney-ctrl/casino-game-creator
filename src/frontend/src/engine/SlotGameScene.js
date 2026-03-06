// VERSIONED BASE TEMPLATE — Read engine/VERSIONING.md before editing this file.
// Changes to this file affect all new games. Follow the versioning process to avoid breaking saved games.

import { Sprite } from './entities/Sprite';

export class SlotGameScene {
    constructor(config) {
        this.config = config;
        this.children = [];
        this.reels = [];
        this.symbols = [];
        this.usedAssets = []; // Track assets for display
    }

    enter(game) {
        this.game = game;
        console.log('[SlotGameScene] Creating slot game with config:', this.config);

        const { width, height } = game.renderer;

        // Determine reel count based on game type
        const reelCount = this.config.gameType === 'slots-3reel' ? 3 : 5;
        const symbolsPerReel = 3;

        // Symbol colors (representing different symbols)
        const symbolColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe', '#fd79a8'];

        // Calculate layout
        const symbolSize = 80;
        const symbolGap = 10;
        const reelWidth = symbolSize + symbolGap;
        const totalWidth = reelCount * reelWidth - symbolGap;
        const totalHeight = symbolsPerReel * (symbolSize + symbolGap) - symbolGap;

        const startX = (width - totalWidth) / 2;
        const startY = (height - totalHeight) / 2;

        // Create reels
        for (let reelIndex = 0; reelIndex < reelCount; reelIndex++) {
            const reel = [];

            for (let symbolIndex = 0; symbolIndex < symbolsPerReel; symbolIndex++) {
                const x = startX + reelIndex * reelWidth + symbolSize / 2;
                const y = startY + symbolIndex * (symbolSize + symbolGap) + symbolSize / 2;

                // Random symbol color
                const color = symbolColors[Math.floor(Math.random() * symbolColors.length)];

                const symbol = new Sprite(color, x, y);
                symbol.width = symbolSize;
                symbol.height = symbolSize;
                symbol.rotation = 0;

                reel.push(symbol);
                this.children.push(symbol);
                this.symbols.push(symbol);

                // Track asset
                if (!this.usedAssets.find(a => a.color === color)) {
                    this.usedAssets.push({
                        type: 'symbol',
                        color: color,
                        name: `Symbol ${this.usedAssets.length + 1}`
                    });
                }
            }

            this.reels.push(reel);
        }

        // Add wild symbol if enabled
        if (this.config.features?.wilds) {
            const wildSymbol = new Sprite('#ffd700', width / 2, height - 100);
            wildSymbol.width = 60;
            wildSymbol.height = 60;
            this.children.push(wildSymbol);

            this.usedAssets.push({
                type: 'wild',
                color: '#ffd700',
                name: 'Wild Symbol'
            });
        }

        // Add background
        this.usedAssets.push({
            type: 'background',
            color: '#1a1a2e',
            name: 'Game Background'
        });

        console.log('[SlotGameScene] Created', this.symbols.length, 'symbols across', reelCount, 'reels');
        console.log('[SlotGameScene] Used assets:', this.usedAssets.length);
    }

    exit() {
        this.children = [];
        this.reels = [];
        this.symbols = [];
    }

    update(dt) {
        // Gentle floating animation for symbols
        this.symbols.forEach((symbol, index) => {
            symbol.y += Math.sin(Date.now() / 1000 + index) * 0.2;
        });
    }

    render(ctx) {
        // Render background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.game.renderer.width, this.game.renderer.height);

        // Render all symbols
        this.children.forEach(child => child.render(ctx));

        // Render game info
        ctx.fillStyle = 'white';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${this.config.gameType.toUpperCase()} | RTP: ${this.config.rtp}% | Volatility: ${this.config.volatility}`,
            this.game.renderer.width / 2,
            30
        );
    }

    getUsedAssets() {
        return this.usedAssets;
    }
}
