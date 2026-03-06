// VERSIONED BASE TEMPLATE — Read engine/VERSIONING.md before editing this file.
// Changes to this file affect all new games. Follow the versioning process to avoid breaking saved games.

export class ThreeReelSlotScene {
    audioManager = null;

    setAudioManager(am) {
        this.audioManager = am;
    }

    constructor(config) {
        this.config = config || {
            gameType: 'slots-3reel',
            rtp: 96,
            volatility: 'medium',
            bet: 10,
        };

        this.reelState = 'IDLE';
        // Base sizes for desktop (will be scaled)
        this.baseReelWidth = 160;
        this.baseReelHeight = 420;
        this.baseSymbolSize = 130;

        // Final calculated sizes
        this.reelWidth = 160;
        this.reelHeight = 420;
        this.symbolSize = 130;
        this.visibleSymbols = 3;

        this.balance = 1000;
        this.currentBet = this.config.bet || 10;
        this.lastWin = 0;
        this.winCounter = 0;
        this.particles = [];
        this.ambientParticles = [];
        this.showPaytable = false;
        this.bigWinActive = false;
        this.screenShake = 0;

        // Hierarchical Symbols (Egyptian Theme)
        this.symbols = [
            // Low Value
            { id: 'J', name: 'Jack', color: '#3498db', value: 5, weight: 15, type: 'low' },
            { id: 'Q', name: 'Queen', color: '#9b59b6', value: 10, weight: 12, type: 'low' },
            { id: 'K', name: 'King', color: '#e67e22', value: 15, weight: 10, type: 'low' },
            { id: 'A', name: 'Ace', color: '#e74c3c', value: 20, weight: 8, type: 'low' },
            // Medium Value
            { id: 'ankh', name: 'Holy Ankh', color: '#1abc9c', value: 50, weight: 5, type: 'med', glyph: '☥' },
            { id: 'eye', name: 'Eye of Horus', color: '#2ecc71', value: 75, weight: 4, type: 'med', glyph: '👁' },
            { id: 'scarab', name: 'Jewelled Scarab', color: '#f1c40f', value: 150, weight: 3, type: 'med', glyph: '𓆣' },
            // High Value
            { id: 'pharaoh', name: 'Gold Pharaoh', color: '#f39c12', value: 500, weight: 1.5, type: 'high', glyph: '𓂀' },
            // Special
            { id: 'wild', name: 'WILD', color: '#f1c40f', value: 1000, weight: 1, type: 'wild', glyph: 'WILD' }
        ];

        this.jackpots = {
            mini: 500,
            minor: 2500,
            major: 10000,
            grand: 50000
        };

        this.initAmbientParticles();
        this.assetCache = new Map();
    }

    async loadAsset(id, url) {
        if (this.assetCache.has(id)) return this.assetCache.get(id);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.assetCache.set(id, img);
                resolve(img);
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }

    enter(game) {
        this.game = game;
        this.initReels();

        this.inputDownHandler = (mouse) => {
            // Big win overlay: click to dismiss
            if (this.bigWinActive) {
                this.bigWinActive = false;
                this.particles = [];
                return;
            }
            if (this.showPaytable) {
                this.showPaytable = false;
                return;
            }

            const { width, height } = this.game.renderer;
            const isMobile = width < 500;
            const scale = isMobile ? width / 450 : 1;

            // Spin Button
            const spinX = width / 2;
            const spinY = height - (isMobile ? 120 : 100);
            const spinRadius = (isMobile ? 55 : 45) * scale;
            const dist = Math.sqrt((mouse.x - spinX) ** 2 + (mouse.y - spinY) ** 2);
            if (dist < spinRadius) {
                // If there's a pending win display, clear it first then spin
                if (this.lastWin > 0 && this.reelState === 'IDLE') {
                    this.lastWin = 0;
                    this.winCounter = 0;
                    this.particles = [];
                }
                this.spin();
            }

            // Bet Controls
            const betY = height - (isMobile ? 60 : 40);
            if (mouse.y > betY - 30 && mouse.y < betY + 30) {
                // Adjusting bet collision based on layout
                if (isMobile) {
                    // Mobile bet controls are centered
                    if (mouse.x > width / 2 - 140 && mouse.x < width / 2 - 80) this.adjustBet(-5);
                    if (mouse.x > width / 2 + 80 && mouse.x < width / 2 + 140) this.adjustBet(5);
                } else {
                    if (mouse.x > width - 150 && mouse.x < width - 110) this.adjustBet(-5);
                    if (mouse.x > width - 60 && mouse.x < width - 20) this.adjustBet(5);
                }
            }

            // Paytable
            const paytableSize = isMobile ? 80 : 100;
            if (mouse.x > 10 && mouse.x < 10 + paytableSize && mouse.y > 10 && mouse.y < 50) {
                this.showPaytable = !this.showPaytable;
            }
        };
        this.game.input.on('down', this.inputDownHandler);
    }

    exit() {
        // cleanup would go here
    }

    initReels() {
        this.reels = [];
        this.stoppedCount = 0;
        for (let i = 0; i < 3; i++) {
            this.reels.push({
                index: i,
                offset: 0,
                speed: 0,
                targetOffset: 0,
                stopping: false,
                bounceOffset: 0,
                symbols: this.generateReelStrip(40),
                blur: 0
            });
        }
    }

    initAmbientParticles() {
        this.ambientParticles = [];
        for (let i = 0; i < 30; i++) {
            this.ambientParticles.push({
                x: Math.random() * 2000,
                y: Math.random() * 2000,
                s: 1 + Math.random() * 2,
                v: 0.2 + Math.random() * 0.5
            });
        }
    }

    generateReelStrip(count) {
        const strip = [];
        for (let i = 0; i < count; i++) {
            strip.push({ ...this.getRandomSymbol() });
        }
        return strip;
    }

    getRandomSymbol() {
        const total = this.symbols.reduce((sum, s) => sum + s.weight, 0);
        let r = Math.random() * total;
        for (const s of this.symbols) {
            if (r < s.weight) return s;
            r -= s.weight;
        }
        return this.symbols[0];
    }

    adjustBet(amt) {
        if (this.reelState !== 'IDLE') return;
        this.currentBet = Math.max(5, Math.min(500, this.currentBet + amt));
        if (this.audioManager) this.audioManager.play('buttonClick');
    }

    spin() {
        if (this.reelState !== 'IDLE') return;
        if (this.balance < this.currentBet) return;

        this.balance -= this.currentBet;
        this.reelState = 'SPINNING';
        this.lastWin = 0;
        this.winCounter = 0;
        this.stoppedCount = 0;

        // Play spin sound
        if (this.audioManager) this.audioManager.play('spin');

        this.reels.forEach((reel, i) => {
            reel.speed = 25 + Math.random() * 5;
            reel.stopping = false;
            reel.bounceOffset = 0;
        });

        setTimeout(() => this.stopSpin(), 1500);
    }

    stopSpin() {
        if (this.reelState !== 'SPINNING') return;
        this.reelState = 'STOPPING';

        this.reels.forEach((reel, i) => {
            setTimeout(() => {
                reel.stopping = true;
                const currentRel = Math.floor(reel.offset / this.symbolSize);
                reel.targetOffset = (currentRel + 12) * this.symbolSize;
                // checkWins() is called from update() once all 3 reels have snapped.
            }, i * 350);
        });
    }

    checkWins() {
        this.reelState = 'IDLE';
        // Use the same index calculation as drawReel so the visual center row matches
        const centerLine = this.reels.map(r => {
            const symIdx = Math.floor(r.offset / this.symbolSize) + 1;
            const actualIdx = (symIdx % r.symbols.length + r.symbols.length) % r.symbols.length;
            return r.symbols[actualIdx];
        });

        const s1 = centerLine[0], s2 = centerLine[1], s3 = centerLine[2];
        let win = 0;

        if ((s1.id === s2.id || s2.id === 'wild' || s1.id === 'wild') &&
            (s2.id === s3.id || s3.id === 'wild' || s2.id === 'wild')) {
            const baseSymbol = s1.id === 'wild' ? (s2.id === 'wild' ? s3 : s2) : s1;
            win = baseSymbol.value * (this.currentBet / 10);
        }

        if (win > 0) {
            this.lastWin = win;
            this.balance += win;
            this.triggerWinEffect(win);

            // Play win sound
            if (this.audioManager) {
                const isBig = win >= this.currentBet * 20;
                this.audioManager.play(isBig ? 'bigWin' : 'win');
            }
        }
    }

    triggerWinEffect(amount) {
        const isBig = amount >= this.currentBet * 20;
        this.bigWinActive = isBig;
        if (isBig) this.screenShake = 20;

        // Spawn particles
        for (let i = 0; i < (isBig ? 150 : 50); i++) {
            this.particles.push({
                x: this.game.renderer.width / 2,
                y: this.game.renderer.height / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20 - 5,
                life: 1.0,
                color: Math.random() > 0.3 ? '#f1c40f' : '#FFF'
            });
        }
    }

    update(dt) {
        // Reels
        this.reels.forEach(reel => {
            if (reel.speed > 0 || reel.stopping) {
                if (reel.stopping) {
                    const dist = reel.targetOffset - reel.offset;
                    if (dist < 1) {
                        // Snap to exact target — keep offset clean at a symbol boundary
                        reel.offset = reel.targetOffset;
                        reel.speed = 0;
                        reel.stopping = false;
                        // Play reel stop sound exactly when the reel snaps to rest
                        if (this.audioManager) this.audioManager.play('reelStop');
                        // Bounce via a separate field so reel.offset stays clean
                        reel.bounceOffset = 8;
                        setTimeout(() => { reel.bounceOffset = 0; }, 100);
                        // Count how many reels have now truly stopped
                        this.stoppedCount = (this.stoppedCount || 0) + 1;
                        if (this.stoppedCount === 3) {
                            this.checkWins();
                        }
                    } else {
                        reel.speed = dist * 0.18;
                        reel.offset += reel.speed;
                    }
                } else {
                    reel.offset += reel.speed;
                }
            }
        });

        // Numerical roll up
        if (this.winCounter < this.lastWin) {
            const step = Math.ceil(this.lastWin / 60);
            this.winCounter = Math.min(this.lastWin, this.winCounter + step);
        }

        // Particles
        this.particles.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.5; p.life -= 0.015;
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        // Ambient
        this.ambientParticles.forEach(p => {
            p.y -= p.v;
            if (p.y < 0) p.y = 2000;
        });

        // Shake
        if (this.screenShake > 0) this.screenShake *= 0.9;

        // Jackpots simulate slight movement
        Object.keys(this.jackpots).forEach(k => {
            this.jackpots[k] += Math.random() * 0.01;
        });
    }

    render(ctx) {
        const { width, height } = this.game.renderer;
        const isMobile = width < 500;

        // Calculate dynamic scaling
        const targetW = isMobile ? width * 0.9 : 540;
        const scale = targetW / 540;

        this.reelWidth = this.baseReelWidth * scale;
        this.symbolSize = this.baseSymbolSize * scale;
        this.reelHeight = this.symbolSize * 3 + 30;

        ctx.save();
        if (this.screenShake > 1) {
            ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }

        // 1. Lux Egyptian Background
        const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
        grad.addColorStop(0, '#2c3e50');
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Ambient particles (clamp to view)
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        this.ambientParticles.forEach(p => {
            if (p.x < width && p.y < height) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // 3. Main Frame
        const frameW = this.reelWidth * 3 + 40 * scale;
        const frameH = this.reelHeight + 40 * scale;
        const fx = (width - frameW) / 2;
        const fy = isMobile ? (height * 0.55 - frameH / 2) : (height / 2 - frameH / 2 - 20);

        this.drawOrnateFrame(ctx, fx, fy, frameW, frameH, scale);

        // 4. Reels
        ctx.save();
        ctx.beginPath();
        ctx.rect(fx + 20 * scale, fy + 20 * scale, frameW - 40 * scale, frameH - 40 * scale);
        ctx.clip();

        this.reels.forEach((reel, i) => {
            const rx = fx + 20 * scale + i * this.reelWidth;
            this.drawReel(ctx, reel, rx, fy + 20 * scale, scale);
        });
        ctx.restore();

        // 2. Jackpot Display (Moved here to ensure it draws on top of anything it overlaps)
        this.renderJackpots(ctx, width, height, isMobile, scale);

        // 5. Payline Visualization
        if (this.reelState === 'IDLE') {
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.3)';
            ctx.lineWidth = 2 * scale;
            ctx.setLineDash([10 * scale, 5 * scale]);
            ctx.strokeRect(fx + 20 * scale, fy + 20 * scale + this.symbolSize, frameW - 40 * scale, this.symbolSize);
            ctx.setLineDash([]);
        }

        // 6. UI
        this.renderUI(ctx, width, height, isMobile, scale);

        // 7. Overlays
        if (this.bigWinActive) this.renderBigWin(ctx, width, height, isMobile, scale);
        if (this.showPaytable) this.renderPaytable(ctx, width, height, isMobile, scale);

        this.renderVignette(ctx, width, height);
        ctx.restore();
    }

    drawOrnateFrame(ctx, x, y, w, h, scale) {
        // Shadow
        ctx.shadowColor = 'black'; ctx.shadowBlur = 40 * scale;

        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#d35400'); g.addColorStop(0.3, '#f1c40f'); g.addColorStop(0.7, '#f39c12'); g.addColorStop(1, '#d35400');

        ctx.fillStyle = '#111';
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = g;
        ctx.lineWidth = 15 * scale;
        ctx.strokeRect(x, y, w, h);
        ctx.shadowBlur = 0;

        // Corners
        ctx.fillStyle = g;
        const cs = 20 * scale;
        [[x, y], [x + w - cs, y], [x, y + h - cs], [x + w - cs, y + h - cs]].forEach(p => {
            ctx.fillRect(p[0], p[1], cs, cs);
        });
    }

    drawReel(ctx, reel, x, y, scale = 1) {
        const blur = reel.speed > 5 ? Math.min(20, reel.speed) : 0;
        const fy = isFinite(y) ? y : 0; // Guard
        const centerY = fy + this.reelHeight / 2;
        // Use bounceOffset separately so scroll position (offset) stays at a clean
        // symbol boundary and checkWins always reads the correct stopped symbol.
        const displayOffset = reel.offset + (reel.bounceOffset || 0);

        for (let j = -2; j < this.visibleSymbols + 2; j++) {
            const symIdx = Math.floor(displayOffset / this.symbolSize) + j;
            const actualIdx = (symIdx % reel.symbols.length + reel.symbols.length) % reel.symbols.length;
            const symbol = reel.symbols[actualIdx];
            const dy = y + (j * this.symbolSize) - (displayOffset % this.symbolSize);

            // 3D Curvature Effect
            const distFromCenter = dy + this.symbolSize / 2 - centerY;
            const curveFactor = 1000 * scale;
            const curveOffset = (distFromCenter * distFromCenter) / curveFactor;
            const curveScale = 1 - (Math.abs(distFromCenter) / (600 * scale));

            ctx.save();
            ctx.translate(0, curveOffset);
            ctx.translate(x + this.reelWidth / 2, dy + this.symbolSize / 2);
            ctx.scale(curveScale, curveScale);
            ctx.translate(-(x + this.reelWidth / 2), -(dy + this.symbolSize / 2));

            this.drawSymbol(ctx, symbol, x + 15 * scale, dy + 15 * scale, blur, scale);
            ctx.restore();
        }
    }

    drawSymbol(ctx, symbol, x, y, blur, scale) {
        const size = this.symbolSize - 30 * scale;

        // Idle Animation (Breathing)
        let idleScale = 1;
        if (this.reelState === 'IDLE') {
            idleScale = 1 + Math.sin(Date.now() / 400 + x) * 0.03;
        }

        const cx = x + size / 2;
        const cy = y + size / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(idleScale, idleScale);
        ctx.translate(-cx, -cy);

        if (blur > 0) {
            ctx.filter = `blur(${blur / 2}px)`;
        }

        // Luxury Tile
        const g = ctx.createLinearGradient(x, y, x + size, y + size);
        g.addColorStop(0, '#34495e'); g.addColorStop(1, '#2c3e50');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.roundRect(x, y, size, size, 10 * scale); ctx.fill();

        // Border
        ctx.strokeStyle = symbol.color;
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        // Check for Custom Image or Glyph Override
        const customAsset = this.config.customAssets?.[symbol.id];
        if (customAsset) {
            // Very basic check: if it looks like a URL/DataURL, treat as image
            if (customAsset.length > 10 || customAsset.startsWith('data:')) {
                const img = this.assetCache.get(symbol.id);
                if (img) {
                    ctx.drawImage(img, x + 5 * scale, y + 5 * scale, size - 10 * scale, size - 10 * scale);
                } else {
                    this.loadAsset(symbol.id, customAsset);
                    this.drawGlyph(ctx, symbol, cx, cy, size);
                }
            } else {
                // Treat as glyph override
                this.drawGlyph(ctx, symbol, cx, cy, size, customAsset);
            }
        } else {
            this.drawGlyph(ctx, symbol, cx, cy, size);
        }

        // Shine
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.fill();
        ctx.globalAlpha = 1;

        ctx.filter = 'none';
        ctx.restore();
    }

    drawGlyph(ctx, symbol, cx, cy, size, override) {
        ctx.fillStyle = symbol.color;
        ctx.font = `bold ${size / 2}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const display = override || symbol.glyph || symbol.id;
        ctx.fillText(display, cx, cy);
    }

    renderJackpots(ctx, width, height, isMobile, scale) {
        // Logo
        ctx.fillStyle = 'white';
        ctx.font = `bold ${24 * scale}px serif`;
        ctx.textAlign = 'center';

        const logoY = isMobile ? height * 0.15 : 110;
        ctx.fillText('QTM EGYPTIAN', width / 2, logoY);
        ctx.font = `${12 * scale}px Inter`;
        ctx.fillText('TREASURES', width / 2, logoY + 15 * scale);

        const allTiers = [
            { id: 'mini', color: '#3498db' },
            { id: 'minor', color: '#2ecc71' },
            { id: 'major', color: '#f1c40f' },
            { id: 'grand', color: '#e74c3c' }
        ];

        // Filter active tiers
        const activeTiers = allTiers.filter(t => this.config.jackpots?.[t.id] !== false);
        if (activeTiers.length === 0) return;

        const w = 180 * scale;
        const h = 50 * scale;
        const gutter = 20 * scale;
        const totalW = activeTiers.length * w + (activeTiers.length - 1) * gutter;

        // Multi-line for mobile if too many jackpots
        const isMultiLine = isMobile && activeTiers.length > 2;
        const startX = (width - (isMultiLine ? (w * 2 + gutter) : totalW)) / 2;
        const startY = isMobile ? (logoY + 40 * scale) : 20;

        activeTiers.forEach((t, i) => {
            let x, y;
            if (isMultiLine) {
                x = startX + (i % 2) * (w + gutter);
                y = startY + Math.floor(i / 2) * (h + 10);
            } else {
                x = startX + i * (w + gutter);
                y = startY;
            }

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.roundRect(x, y, w, h, 5 * scale); ctx.fill();
            ctx.lineWidth = 1; ctx.strokeStyle = t.color; ctx.stroke();

            ctx.fillStyle = t.color;
            ctx.font = `${12 * scale}px Inter`; ctx.textAlign = 'center';
            ctx.fillText(t.id.toUpperCase(), x + w / 2, y + 15 * scale);

            ctx.fillStyle = 'white';
            ctx.font = `bold ${16 * scale}px monospace`;
            ctx.fillText(`$${this.jackpots[t.id].toFixed(2)}`, x + w / 2, y + 38 * scale);
        });
    }

    renderUI(ctx, width, height, isMobile, scale) {
        // Spin Button (Cicular)
        const spinX = width / 2;
        const spinY = height - (isMobile ? 120 : 100);
        const baseRadius = isMobile ? 55 : 45;
        const s = baseRadius * scale;

        const g = ctx.createRadialGradient(spinX, spinY, 0, spinX, spinY, s);
        g.addColorStop(0, '#f1c40f'); g.addColorStop(1, '#d35400');

        ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = this.reelState === 'IDLE' ? 15 : 0;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(spinX, spinY, s, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'black'; ctx.font = `bold ${18 * scale}px Inter`;
        const spinLabel = (this.config.customLabels && this.config.customLabels.spinButton) || 'SPIN';
        ctx.fillText(spinLabel, spinX, spinY + 7 * scale);

        // Stats
        const statsY = height - (isMobile ? 30 : 40);
        ctx.textAlign = isMobile ? 'center' : 'left';
        ctx.fillStyle = '#f1c40f';
        ctx.font = `${isMobile ? 16 : 20}px Inter`;

        if (isMobile) {
            ctx.fillText(`BAL: $${this.balance.toFixed(0)}`, width / 2, statsY);
            ctx.textAlign = 'center';
            ctx.fillText(`BET: $${this.currentBet}`, width / 2, statsY - 25);

            // Bet Controls for Mobile (Plus/Minus around the bet)
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Inter';
            ctx.fillText('-', width / 2 - 110, statsY - 25);
            ctx.fillText('+', width / 2 + 110, statsY - 25);
        } else {
            ctx.fillText(`BALANCE: $${this.balance}`, 30, statsY);
            ctx.textAlign = 'right';
            ctx.fillText(`BET: $${this.currentBet}`, width - 180, statsY);

            // Bet Controls
            ctx.fillStyle = 'white';
            ctx.fillText('-', width - 130, statsY);
            ctx.fillText('+', width - 40, statsY);
        }

        // Win
        if (this.winCounter > 0) {
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.font = `bold ${36 * scale}px Inter`;
            ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 10 * scale;
            ctx.fillText(`WIN: $${this.winCounter}`, width / 2, fy - 40 * scale);
            ctx.shadowBlur = 0;
        }
        // Draw the winning line if active
        if (this.lastWin > 0 && this.reelState === 'IDLE') {
            this.drawWinLine(ctx, width, height);
        }
    }

    renderBigWin(ctx, width, height) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, width, height);

        const s = 1 + Math.sin(Date.now() / 150) * 0.15; // Faster pulse
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(s, s);

        ctx.shadowColor = 'white'; ctx.shadowBlur = 30;
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 90px serif';
        ctx.textAlign = 'center';
        ctx.fillText('BIG WIN!', 0, -60);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 130px monospace';
        ctx.fillText(`$${this.winCounter}`, 0, 90);
        ctx.restore();

        // Particles...
        this.particles.forEach(p => {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
            ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    drawWinLine(ctx, width, height, scale = 1) {
        const frameW = this.reelWidth * 3 + 40 * scale;
        const fx = (width - frameW) / 2;
        // Find centerY of reels
        const fy = width < 500 ? (height * 0.45 - (this.reelHeight + 40 * scale) / 2) : (height / 2 - (this.reelHeight + 40 * scale) / 2 - 20);
        const y = fy + 20 * scale + this.reelHeight / 2;

        ctx.save();
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 4 * scale;
        ctx.shadowColor = 'white'; ctx.shadowBlur = 10 * scale;

        // Animated line drawing
        const progress = (Date.now() % 1000) / 1000;
        ctx.beginPath();
        ctx.moveTo(fx + 20 * scale, y);
        ctx.lineTo(fx + 20 * scale + (frameW - 40 * scale) * progress, y);
        ctx.stroke();
        ctx.restore();
    }

    renderPaytable(ctx, width, height) {
        ctx.fillStyle = 'rgba(15, 15, 27, 0.95)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 32px serif'; ctx.textAlign = 'center';
        ctx.fillText('EGYPTIAN TREASURES PAYTABLE', width / 2, 100);

        this.symbols.sort((a, b) => b.value - a.value).forEach((s, i) => {
            const x = width / 2 - 200;
            const y = 180 + i * 50;
            ctx.fillStyle = s.color;
            ctx.font = '24px serif'; ctx.textAlign = 'left';
            ctx.fillText(s.name, x, y);
            ctx.textAlign = 'right';
            ctx.fillText(`x3: $${(s.value * (this.currentBet / 10)).toFixed(0)}`, x + 400, y);
        });

        ctx.fillStyle = 'white'; ctx.font = 'italic 18px Inter';
        ctx.textAlign = 'center'; ctx.fillText('Click anywhere to return', width / 2, height - 50);
    }

    renderVignette(ctx, width, height) {
        const v = ctx.createRadialGradient(width / 2, height / 2, width * 0.3, width / 2, height / 2, width * 0.8);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, width, height);
    }

    getUsedAssets() {
        const assets = [
            { type: 'background', id: 'bg', name: 'Egyptian Tomb', color: '#2c3e50', current: null }
        ];

        this.symbols.forEach(s => {
            assets.push({
                type: 'symbol',
                id: s.id,
                name: s.name,
                color: s.color,
                glyph: s.glyph,
                current: this.config.customAssets?.[s.id] || null
            });
        });

        return assets;
    }
}
