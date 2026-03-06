
// European Roulette - fully self-contained scene
// Shares NO code with ThreeReelSlotScene

const WHEEL_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const CHIP_DENOMS = [
    { value: 1, color: '#FFFFFF', label: '1' },
    { value: 5, color: '#E74C3C', label: '5' },
    { value: 10, color: '#3498DB', label: '10' },
    { value: 25, color: '#2ECC71', label: '25' },
    { value: 100, color: '#111111', label: '100' },
];

const PAYOUTS = {
    straight: 35, split: 17, street: 11, corner: 8,
    sixline: 5, column: 2, dozen: 2, evenmoney: 1
};

function numberColor(n) {
    if (n === 0) return 'green';
    return RED_NUMBERS.has(n) ? 'red' : 'black';
}

export class RouletteScene {
    audioManager = null;

    setAudioManager(am) { this.audioManager = am; }

    constructor(config) {
        this.config = config || {};
        this.state = 'BETTING'; // BETTING | SPINNING | RESULT
        this.bets = [];
        this.betHistory = [];
        this.history = [];
        this.balance = 1000;
        this.selectedChip = 5;
        this.totalBet = 0;
        this.lastWin = 0;
        this.winCounter = 0;
        this.winningNumber = -1;
        this.winningBets = [];

        // Wheel animation
        this.wheelAngle = 0;
        this.wheelIdleSpeed = 0.003;
        this.wheelSpinSpeed = 0;
        this.ballAngle = 0;
        this.ballRadius = 0;
        this.ballPhase = 'NONE'; // NONE | ORBIT | FALLING | BOUNCING | SETTLED
        this.ballAngularVel = 0;
        this.ballBounceCount = 0;
        this.ballTargetAngle = 0;
        this.ballTargetRadius = 0;
        this.settleTimer = 0;

        // Particles
        this.particles = [];
        this.ambientParticles = [];
        this.screenShake = 0;
        this.bigWinActive = false;

        // Cached wheel canvas
        this.wheelCache = null;
        this.wheelCacheSize = 0;

        this.assetCache = new Map();

        this.initAmbientParticles();
    }

    async loadAsset(id, url) {
        if (this.assetCache.has(id)) return this.assetCache.get(id);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { this.assetCache.set(id, img); resolve(img); };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }

    initAmbientParticles() {
        this.ambientParticles = [];
        for (let i = 0; i < 25; i++) {
            this.ambientParticles.push({
                x: Math.random() * 2000, y: Math.random() * 2000,
                s: 1 + Math.random() * 2, v: 0.2 + Math.random() * 0.4
            });
        }
    }

    enter(game) {
        this.game = game;
        this.inputDownHandler = (mouse) => this.handleClick(mouse);
        this.game.input.on('down', this.inputDownHandler);
    }

    exit() {}

    // ── Layout helpers ──

    getLayout() {
        const { width, height } = this.game.renderer;
        const portrait = height > width || width < 500;
        const compact = !portrait && width < 700;

        if (portrait) {
            const scale = width / 450;
            const wheelR = Math.min(width * 0.28, height * 0.14);
            const wheelCX = width / 2;
            const wheelCY = wheelR + 20 * scale;
            const historyY = wheelCY + wheelR + 15 * scale;
            const tableTop = historyY + 22 * scale;
            const tableH = height * 0.42;
            const tableW = width - 20 * scale;
            const tableLeft = (width - tableW) / 2;
            const chipStripY = tableTop + tableH + 8 * scale;
            const bottomY = height - 50 * scale;
            return { portrait: true, compact: false, scale, width, height,
                wheelCX, wheelCY, wheelR, historyY,
                tableLeft, tableTop, tableW, tableH,
                chipStripY, bottomY };
        }

        const scale = compact ? Math.min(width / 750, height / 450) : Math.min(width / 900, height / 600);
        const wheelR = Math.min(width * 0.15, height * 0.28);
        const wheelCX = wheelR + 30 * scale;
        const wheelCY = height * 0.42;
        const historyY = wheelCY + wheelR + 20 * scale;
        const tableLeft = wheelCX + wheelR + 25 * scale;
        const tableTop = 20 * scale;
        const tableW = width - tableLeft - 15 * scale;
        const tableH = height - 90 * scale;
        const chipStripY = height - 65 * scale;
        const bottomY = height - 25 * scale;
        return { portrait: false, compact, scale, width, height,
            wheelCX, wheelCY, wheelR, historyY,
            tableLeft, tableTop, tableW, tableH,
            chipStripY, bottomY };
    }

    // ── Table geometry ──

    getTableGeometry(layout) {
        // 12 columns (numbers 1-36), 3 rows + zero + outside bets
        const { tableLeft, tableTop, tableW, tableH, scale } = layout;
        const cols = 12;
        const rows = 3;
        const zeroW = tableW * 0.07;
        const gridW = tableW - zeroW - tableW * 0.08; // leave room for column bets
        const colBetW = tableW * 0.08;
        const numberH = tableH * 0.55;
        const outsideH = tableH * 0.18;
        const cellW = gridW / cols;
        const cellH = numberH / rows;
        return { tableLeft, tableTop, tableW, tableH, cols, rows,
            zeroW, gridW, colBetW, numberH, outsideH, cellW, cellH, scale };
    }

    // Map grid col/row to number: row 0 = top (3,6,9,...,36), row 2 = bottom (1,4,7,...,34)
    gridToNumber(col, row) {
        // row 0 -> 3rd row of table (3,6,...), row 1 -> 2nd row, row 2 -> 1st row
        return (col) * 3 + (3 - row);
    }

    // ── Click handling ──

    handleClick(mouse) {
        if (this.bigWinActive) {
            this.bigWinActive = false;
            this.particles = [];
            return;
        }

        const layout = this.getLayout();
        const tg = this.getTableGeometry(layout);

        // Check UI buttons first
        if (this.handleUIClick(mouse, layout, tg)) return;

        if (this.state !== 'BETTING') return;

        // Check chip selector
        if (this.handleChipClick(mouse, layout)) return;

        // Check table bets
        this.handleTableClick(mouse, layout, tg);
    }

    handleUIClick(mouse, layout, tg) {
        const { scale, width, height, bottomY } = layout;

        // Spin button
        const spinBtnW = 90 * scale;
        const spinBtnH = 36 * scale;
        const spinX = width / 2;
        const spinY = layout.portrait ? bottomY - 5 * scale : bottomY;
        if (mouse.x > spinX - spinBtnW / 2 && mouse.x < spinX + spinBtnW / 2 &&
            mouse.y > spinY - spinBtnH / 2 && mouse.y < spinY + spinBtnH / 2) {
            if (this.state === 'BETTING') this.spin();
            return true;
        }

        // Clear button
        const clearX = spinX - spinBtnW / 2 - 60 * scale;
        const btnSize = 32 * scale;
        if (mouse.x > clearX - btnSize / 2 && mouse.x < clearX + btnSize / 2 &&
            mouse.y > spinY - btnSize / 2 && mouse.y < spinY + btnSize / 2) {
            if (this.state === 'BETTING') this.clearBets();
            return true;
        }

        // Undo button
        const undoX = spinX + spinBtnW / 2 + 60 * scale;
        if (mouse.x > undoX - btnSize / 2 && mouse.x < undoX + btnSize / 2 &&
            mouse.y > spinY - btnSize / 2 && mouse.y < spinY + btnSize / 2) {
            if (this.state === 'BETTING') this.undoBet();
            return true;
        }

        return false;
    }

    handleChipClick(mouse, layout) {
        const { scale, width, chipStripY } = layout;
        const chipR = 18 * scale;
        const gap = 50 * scale;
        const startX = width / 2 - (CHIP_DENOMS.length - 1) * gap / 2;
        for (let i = 0; i < CHIP_DENOMS.length; i++) {
            const cx = startX + i * gap;
            const cy = chipStripY;
            const dx = mouse.x - cx;
            const dy = mouse.y - cy;
            if (dx * dx + dy * dy < (chipR + 5) * (chipR + 5)) {
                this.selectedChip = CHIP_DENOMS[i].value;
                if (this.audioManager) this.audioManager.play('buttonClick');
                return true;
            }
        }
        return false;
    }

    handleTableClick(mouse, layout, tg) {
        const { tableLeft, tableTop, zeroW, gridW, colBetW, numberH, outsideH, cellW, cellH, cols, rows } = tg;
        const mx = mouse.x;
        const my = mouse.y;

        const gridLeft = tableLeft + zeroW;
        const gridRight = gridLeft + gridW;
        const gridBottom = tableTop + numberH;

        // Zero
        if (mx >= tableLeft && mx < tableLeft + zeroW && my >= tableTop && my < gridBottom) {
            this.placeBet('straight', [0], mx, my);
            return;
        }

        // Number grid - check corners and splits first, then straight
        if (mx >= gridLeft && mx < gridRight && my >= tableTop && my < gridBottom) {
            const relX = mx - gridLeft;
            const relY = my - tableTop;
            const col = Math.floor(relX / cellW);
            const row = Math.floor(relY / cellH);
            const inCellX = relX - col * cellW;
            const inCellY = relY - row * cellH;
            const edge = 8 * tg.scale;

            // Corner bets (intersection of 4 cells)
            if (inCellX < edge && inCellY < edge && col > 0 && row > 0) {
                const nums = [
                    this.gridToNumber(col - 1, row - 1), this.gridToNumber(col, row - 1),
                    this.gridToNumber(col - 1, row), this.gridToNumber(col, row)
                ];
                this.placeBet('corner', nums, mx, my);
                return;
            }

            // Horizontal split (top edge of cell, between this row and row above)
            if (inCellY < edge && row > 0) {
                const nums = [this.gridToNumber(col, row - 1), this.gridToNumber(col, row)];
                this.placeBet('split', nums, mx, my);
                return;
            }

            // Vertical split (left edge of cell, between this col and col to left)
            if (inCellX < edge && col > 0) {
                const nums = [this.gridToNumber(col - 1, row), this.gridToNumber(col, row)];
                this.placeBet('split', nums, mx, my);
                return;
            }

            // Street (left edge of first column, row)
            if (col === 0 && inCellX < edge) {
                const base = row;
                const nums = [this.gridToNumber(0, base)];
                // Actually street = 3 numbers in a row: e.g. 1,2,3
                const n = this.gridToNumber(col, row);
                const streetBase = Math.floor((n - 1) / 3) * 3 + 1;
                this.placeBet('street', [streetBase, streetBase + 1, streetBase + 2], mx, my);
                return;
            }

            // Straight up
            const num = this.gridToNumber(col, row);
            this.placeBet('straight', [num], mx, my);
            return;
        }

        // Column bets (rightmost strip)
        const colBetLeft = gridRight;
        if (mx >= colBetLeft && mx < colBetLeft + colBetW && my >= tableTop && my < gridBottom) {
            const row = Math.floor((my - tableTop) / cellH);
            const colNums = [];
            for (let c = 0; c < 12; c++) colNums.push(this.gridToNumber(c, row));
            this.placeBet('column', colNums, mx, my);
            return;
        }

        // Dozen bets
        const dozenY = gridBottom;
        const dozenH = outsideH / 2;
        if (my >= dozenY && my < dozenY + dozenH && mx >= gridLeft && mx < gridRight) {
            const third = Math.floor((mx - gridLeft) / (gridW / 3));
            const start = third * 12 + 1;
            const nums = [];
            for (let i = start; i < start + 12; i++) nums.push(i);
            this.placeBet('dozen', nums, mx, my);
            return;
        }

        // Even-money bets (bottom row: 1-18, Even, Red, Black, Odd, 19-36)
        const evenY = dozenY + dozenH;
        if (my >= evenY && my < evenY + dozenH && mx >= gridLeft && mx < gridRight) {
            const sixth = Math.floor((mx - gridLeft) / (gridW / 6));
            let nums = [];
            switch (sixth) {
                case 0: for (let i = 1; i <= 18; i++) nums.push(i); break;
                case 1: for (let i = 1; i <= 36; i++) if (i % 2 === 0) nums.push(i); break;
                case 2: nums = [...RED_NUMBERS]; break;
                case 3: for (let i = 1; i <= 36; i++) if (!RED_NUMBERS.has(i) && i !== 0) nums.push(i); break;
                case 4: for (let i = 1; i <= 36; i++) if (i % 2 === 1) nums.push(i); break;
                case 5: for (let i = 19; i <= 36; i++) nums.push(i); break;
            }
            this.placeBet('evenmoney', nums, mx, my);
            return;
        }
    }

    placeBet(type, numbers, gx, gy) {
        if (this.balance < this.selectedChip) return;
        this.balance -= this.selectedChip;
        const bet = { type, numbers, amount: this.selectedChip, gridX: gx, gridY: gy };
        this.bets.push(bet);
        this.betHistory.push(bet);
        this.totalBet += this.selectedChip;
        if (this.audioManager) this.audioManager.play('buttonClick');
    }

    clearBets() {
        const refund = this.bets.reduce((s, b) => s + b.amount, 0);
        this.balance += refund;
        this.bets = [];
        this.betHistory = [];
        this.totalBet = 0;
        if (this.audioManager) this.audioManager.play('buttonClick');
    }

    undoBet() {
        if (this.bets.length === 0) return;
        const last = this.bets.pop();
        this.balance += last.amount;
        this.totalBet -= last.amount;
        if (this.audioManager) this.audioManager.play('buttonClick');
    }

    // ── Spin ──

    spin() {
        if (this.bets.length === 0) return;
        this.state = 'SPINNING';
        this.lastWin = 0;
        this.winCounter = 0;
        this.winningBets = [];

        // Predetermine result
        this.winningNumber = WHEEL_NUMBERS[Math.floor(Math.random() * 37)];

        // Start wheel spin
        this.wheelSpinSpeed = 0.35 + Math.random() * 0.1;

        // Start ball
        this.ballPhase = 'ORBIT';
        this.ballAngularVel = -0.35; // opposite direction
        this.ballAngle = Math.random() * Math.PI * 2;
        this.ballRadius = 1.0; // normalized: 1.0 = outer track
        this.ballBounceCount = 0;
        this.orbitTimer = 0;

        if (this.audioManager) this.audioManager.play('spin');
    }

    resolveResult() {
        this.state = 'RESULT';
        const n = this.winningNumber;
        const col = numberColor(n);
        this.history.unshift({ number: n, color: col });
        if (this.history.length > 10) this.history.pop();

        // Calculate wins
        let totalWin = 0;
        this.winningBets = [];
        for (const bet of this.bets) {
            if (bet.numbers.includes(n)) {
                const payout = bet.amount * PAYOUTS[bet.type] + bet.amount;
                totalWin += payout;
                this.winningBets.push(bet);
            }
        }

        if (totalWin > 0) {
            this.lastWin = totalWin;
            this.balance += totalWin;
            if (this.audioManager) {
                this.audioManager.play(totalWin >= this.totalBet * 10 ? 'bigWin' : 'win');
            }
            if (totalWin >= this.totalBet * 10) {
                this.bigWinActive = true;
                this.screenShake = 20;
                for (let i = 0; i < 120; i++) {
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
        }

        // Auto-return to betting after delay
        this.settleTimer = 150; // ~2.5s at 60fps
    }

    // ── Update ──

    update(dt) {
        // Wheel rotation
        if (this.state === 'SPINNING') {
            this.wheelSpinSpeed *= 0.995;
            this.wheelAngle += this.wheelSpinSpeed;
        } else {
            this.wheelAngle += this.wheelIdleSpeed;
        }

        // Ball physics
        if (this.ballPhase === 'ORBIT') {
            this.orbitTimer++;
            this.ballAngle += this.ballAngularVel;
            this.ballAngularVel *= 0.993;
            if (this.orbitTimer > 150) { // ~2.5s
                this.ballPhase = 'FALLING';
                this.fallTimer = 0;
            }
        } else if (this.ballPhase === 'FALLING') {
            this.fallTimer++;
            this.ballAngle += this.ballAngularVel;
            this.ballAngularVel *= 0.97;
            this.ballRadius = 1.0 - (this.fallTimer / 30) * 0.35;
            if (this.fallTimer > 30) {
                this.ballPhase = 'BOUNCING';
                this.ballBounceCount = 0;
                this.bounceTimer = 0;
            }
        } else if (this.ballPhase === 'BOUNCING') {
            this.bounceTimer++;
            this.ballAngle += this.ballAngularVel;
            this.ballAngularVel *= 0.96;

            // Small bounces
            if (this.bounceTimer % 12 === 0 && this.ballBounceCount < 4) {
                this.ballBounceCount++;
                this.ballRadius += 0.04 / this.ballBounceCount;
                if (this.audioManager) this.audioManager.play('reelStop');
            }
            this.ballRadius *= 0.99;
            if (this.ballRadius < 0.62) this.ballRadius = 0.62;

            if (this.bounceTimer > 50) {
                this.ballPhase = 'SETTLED';
                // Snap ball to winning pocket
                const idx = WHEEL_NUMBERS.indexOf(this.winningNumber);
                const sectorAngle = (Math.PI * 2) / 37;
                this.ballAngle = idx * sectorAngle + sectorAngle / 2 + this.wheelAngle;
                this.ballRadius = 0.62;
                this.wheelSpinSpeed = 0;
                this.resolveResult();
            }
        } else if (this.ballPhase === 'SETTLED') {
            // Keep ball locked to pocket as wheel slowly turns
            const idx = WHEEL_NUMBERS.indexOf(this.winningNumber);
            const sectorAngle = (Math.PI * 2) / 37;
            this.ballAngle = idx * sectorAngle + sectorAngle / 2 + this.wheelAngle;
        }

        // Result timer
        if (this.state === 'RESULT') {
            this.settleTimer--;
            if (this.settleTimer <= 0 && !this.bigWinActive) {
                this.state = 'BETTING';
                this.bets = [];
                this.betHistory = [];
                this.totalBet = 0;
                this.ballPhase = 'NONE';
                this.winningBets = [];
            }
        }

        // Win counter roll-up
        if (this.winCounter < this.lastWin) {
            const step = Math.ceil(this.lastWin / 60);
            this.winCounter = Math.min(this.lastWin, this.winCounter + step);
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.5; p.life -= 0.015;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Ambient
        this.ambientParticles.forEach(p => {
            p.y -= p.v;
            if (p.y < 0) p.y = 2000;
        });

        if (this.screenShake > 0) this.screenShake *= 0.9;
    }

    // ── Render ──

    render(ctx) {
        const { width, height } = this.game.renderer;
        const layout = this.getLayout();
        const tg = this.getTableGeometry(layout);

        ctx.save();
        if (this.screenShake > 1) {
            ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }

        this.drawBackground(ctx, width, height);
        this.drawWheel(ctx, layout);
        this.drawBall(ctx, layout);
        this.drawTable(ctx, layout, tg);
        this.drawPlacedChips(ctx, tg);
        this.drawWinHighlights(ctx, layout, tg);
        this.drawHistory(ctx, layout);
        this.drawChipSelector(ctx, layout);
        this.drawUI(ctx, layout);

        if (this.bigWinActive) this.drawBigWin(ctx, width, height);

        this.drawVignette(ctx, width, height);
        ctx.restore();
    }

    drawBackground(ctx, w, h) {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
        grad.addColorStop(0, '#1a3a2a');
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
        this.ambientParticles.forEach(p => {
            if (p.x < w && p.y < h) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    drawWheel(ctx, layout) {
        const { wheelCX, wheelCY, wheelR } = layout;
        const size = Math.floor(wheelR * 2 + 20);

        // Rebuild cache if size changed
        if (!this.wheelCache || this.wheelCacheSize !== size) {
            this.wheelCacheSize = size;
            this.wheelCache = document.createElement('canvas');
            this.wheelCache.width = size;
            this.wheelCache.height = size;
            this.renderWheelToCache(this.wheelCache.getContext('2d'), size / 2, wheelR);
        }

        ctx.save();
        ctx.translate(wheelCX, wheelCY);
        ctx.rotate(this.wheelAngle);
        ctx.drawImage(this.wheelCache, -size / 2, -size / 2);
        ctx.restore();

        // Outer ring (static)
        ctx.beginPath();
        ctx.arc(wheelCX, wheelCY, wheelR + 4, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#C9A84C';
        ctx.stroke();

        // Ball track indicator (top pointer)
        ctx.fillStyle = '#C9A84C';
        ctx.beginPath();
        ctx.moveTo(wheelCX, wheelCY - wheelR - 8);
        ctx.lineTo(wheelCX - 6, wheelCY - wheelR - 18);
        ctx.lineTo(wheelCX + 6, wheelCY - wheelR - 18);
        ctx.closePath();
        ctx.fill();
    }

    renderWheelToCache(ctx, center, R) {
        const sectorAngle = (Math.PI * 2) / 37;

        for (let i = 0; i < 37; i++) {
            const num = WHEEL_NUMBERS[i];
            const startA = i * sectorAngle - Math.PI / 2;
            const endA = startA + sectorAngle;
            const col = numberColor(num);

            // Sector
            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, R * 0.88, startA, endA);
            ctx.closePath();
            ctx.fillStyle = col === 'red' ? '#C0392B' : col === 'green' ? '#27AE60' : '#1a1a1a';
            ctx.fill();

            // Fret line
            ctx.strokeStyle = '#C9A84C';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(center + Math.cos(startA) * R * 0.55, center + Math.sin(startA) * R * 0.55);
            ctx.lineTo(center + Math.cos(startA) * R * 0.88, center + Math.sin(startA) * R * 0.88);
            ctx.stroke();

            // Number label
            const midA = startA + sectorAngle / 2;
            const labelR = R * 0.75;
            ctx.save();
            ctx.translate(center + Math.cos(midA) * labelR, center + Math.sin(midA) * labelR);
            ctx.rotate(midA + Math.PI / 2);
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(8, R * 0.09)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(num), 0, 0);
            ctx.restore();
        }

        // Inner rings
        ctx.beginPath();
        ctx.arc(center, center, R * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = '#2C3E50';
        ctx.fill();
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center hub
        const hubGrad = ctx.createRadialGradient(center, center, 0, center, center, R * 0.3);
        hubGrad.addColorStop(0, '#C9A84C');
        hubGrad.addColorStop(0.5, '#8B6914');
        hubGrad.addColorStop(1, '#5D4E37');
        ctx.beginPath();
        ctx.arc(center, center, R * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = hubGrad;
        ctx.fill();

        // Outer track ring
        ctx.beginPath();
        ctx.arc(center, center, R * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(center, center, R, 0, Math.PI * 2);
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    drawBall(ctx, layout) {
        if (this.ballPhase === 'NONE') return;
        const { wheelCX, wheelCY, wheelR } = layout;
        const r = this.ballRadius * wheelR * 0.88;
        const bx = wheelCX + Math.cos(this.ballAngle) * r;
        const by = wheelCY + Math.sin(this.ballAngle) * r;
        const ballSize = Math.max(3, wheelR * 0.05);

        ctx.save();
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#EEEEEE';
        ctx.beginPath();
        ctx.arc(bx, by, ballSize, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(bx - ballSize * 0.2, by - ballSize * 0.2, ballSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawTable(ctx, layout, tg) {
        const { tableLeft, tableTop, tableW, tableH, zeroW, gridW, colBetW, numberH, outsideH, cellW, cellH, cols, rows, scale } = tg;
        const gridLeft = tableLeft + zeroW;
        const gridBottom = tableTop + numberH;

        // Felt background
        ctx.fillStyle = '#0B6623';
        ctx.beginPath();
        ctx.roundRect(tableLeft - 4, tableTop - 4, tableW + 8, tableH + 8, 6 * scale);
        ctx.fill();
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        // Zero cell
        ctx.fillStyle = '#27AE60';
        ctx.fillRect(tableLeft, tableTop, zeroW, numberH);
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 1;
        ctx.strokeRect(tableLeft, tableTop, zeroW, numberH);
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.max(10, 14 * scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('0', tableLeft + zeroW / 2, tableTop + numberH / 2);

        // Number cells
        for (let col = 0; col < cols; col++) {
            for (let row = 0; row < rows; row++) {
                const num = this.gridToNumber(col, row);
                const x = gridLeft + col * cellW;
                const y = tableTop + row * cellH;
                const col2 = numberColor(num);

                ctx.fillStyle = col2 === 'red' ? '#C0392B' : '#1a1a1a';
                ctx.fillRect(x, y, cellW, cellH);
                ctx.strokeStyle = '#C9A84C';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, cellW, cellH);

                ctx.fillStyle = 'white';
                ctx.font = `bold ${Math.max(8, 12 * scale)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(num), x + cellW / 2, y + cellH / 2);
            }
        }

        // Column bets (2:1)
        const colBetLeft = gridLeft + gridW;
        for (let row = 0; row < 3; row++) {
            const y = tableTop + row * cellH;
            ctx.fillStyle = '#0B6623';
            ctx.fillRect(colBetLeft, y, colBetW, cellH);
            ctx.strokeStyle = '#C9A84C';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(colBetLeft, y, colBetW, cellH);
            ctx.fillStyle = 'white';
            ctx.font = `${Math.max(7, 10 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('2:1', colBetLeft + colBetW / 2, y + cellH / 2);
        }

        // Dozen bets
        const dozenH = outsideH / 2;
        const dozenLabels = ['1st 12', '2nd 12', '3rd 12'];
        for (let i = 0; i < 3; i++) {
            const x = gridLeft + i * (gridW / 3);
            const w = gridW / 3;
            ctx.fillStyle = '#0B6623';
            ctx.fillRect(x, gridBottom, w, dozenH);
            ctx.strokeStyle = '#C9A84C';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, gridBottom, w, dozenH);
            ctx.fillStyle = 'white';
            ctx.font = `${Math.max(7, 10 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(dozenLabels[i], x + w / 2, gridBottom + dozenH / 2);
        }

        // Even-money bets
        const evenY = gridBottom + dozenH;
        const evenLabels = ['1-18', 'EVEN', 'RED', 'BLK', 'ODD', '19-36'];
        const evenColors = ['#0B6623', '#0B6623', '#C0392B', '#1a1a1a', '#0B6623', '#0B6623'];
        for (let i = 0; i < 6; i++) {
            const x = gridLeft + i * (gridW / 6);
            const w = gridW / 6;
            ctx.fillStyle = evenColors[i];
            ctx.fillRect(x, evenY, w, dozenH);
            ctx.strokeStyle = '#C9A84C';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, evenY, w, dozenH);
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(7, 9 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(evenLabels[i], x + w / 2, evenY + dozenH / 2);
        }
    }

    drawPlacedChips(ctx, tg) {
        for (const bet of this.bets) {
            this.drawChip(ctx, bet.gridX, bet.gridY, bet.amount, tg.scale);
        }
    }

    drawChip(ctx, x, y, amount, scale) {
        const r = 10 * scale;
        const denom = CHIP_DENOMS.find(d => d.value === amount) || CHIP_DENOMS[0];

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;

        // Chip body
        ctx.fillStyle = denom.color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Edge
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = denom.color === '#FFFFFF' || denom.color === '#2ECC71' ? '#000' : '#FFF';
        ctx.font = `bold ${Math.max(6, 8 * scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(amount), x, y);
        ctx.restore();
    }

    drawWinHighlights(ctx, layout, tg) {
        if (this.state !== 'RESULT') return;

        const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.3;

        // Highlight winning number on table
        const { tableLeft, tableTop, zeroW, cellW, cellH, scale } = tg;
        const gridLeft = tableLeft + zeroW;
        const n = this.winningNumber;

        if (n === 0) {
            ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
            ctx.fillRect(tableLeft, tableTop, zeroW, tg.numberH);
        } else {
            const col = Math.floor((n - 1) / 3);
            const row = 2 - ((n - 1) % 3);
            const x = gridLeft + col * cellW;
            const y = tableTop + row * cellH;
            ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
            ctx.fillRect(x, y, cellW, cellH);
        }

        // Highlight winning bets
        for (const bet of this.winningBets) {
            ctx.strokeStyle = `rgba(255, 215, 0, ${pulse + 0.2})`;
            ctx.lineWidth = 3 * scale;
            ctx.beginPath();
            ctx.arc(bet.gridX, bet.gridY, 14 * scale, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Highlight winning number on wheel
        const { wheelCX, wheelCY, wheelR } = layout;
        const idx = WHEEL_NUMBERS.indexOf(n);
        const sectorAngle = (Math.PI * 2) / 37;
        const startA = idx * sectorAngle - Math.PI / 2 + this.wheelAngle;
        const endA = startA + sectorAngle;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(wheelCX, wheelCY);
        ctx.arc(wheelCX, wheelCY, wheelR * 0.88, startA, endA);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawHistory(ctx, layout) {
        const { scale, width, historyY, portrait } = layout;
        const r = 10 * scale;
        const gap = 24 * scale;
        const count = Math.min(this.history.length, 10);
        const startX = portrait ? width / 2 - (count - 1) * gap / 2 : layout.wheelCX - (count - 1) * gap / 2;

        for (let i = 0; i < count; i++) {
            const h = this.history[i];
            const x = startX + i * gap;
            ctx.fillStyle = h.color === 'red' ? '#C0392B' : h.color === 'green' ? '#27AE60' : '#1a1a1a';
            ctx.beginPath();
            ctx.arc(x, historyY, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#C9A84C';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(7, 8 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(h.number), x, historyY);
        }
    }

    drawChipSelector(ctx, layout) {
        const { scale, width, chipStripY } = layout;
        const chipR = 18 * scale;
        const gap = 50 * scale;
        const startX = width / 2 - (CHIP_DENOMS.length - 1) * gap / 2;

        for (let i = 0; i < CHIP_DENOMS.length; i++) {
            const d = CHIP_DENOMS[i];
            const cx = startX + i * gap;
            const cy = chipStripY;
            const selected = d.value === this.selectedChip;

            ctx.save();
            if (selected) {
                ctx.shadowColor = '#f1c40f';
                ctx.shadowBlur = 12;
            }

            // Chip circle
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.arc(cx, cy, chipR, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = selected ? '#f1c40f' : '#888';
            ctx.lineWidth = selected ? 3 : 1;
            ctx.stroke();

            // Edge notches
            for (let n = 0; n < 8; n++) {
                const a = (n / 8) * Math.PI * 2;
                ctx.fillStyle = selected ? '#f1c40f' : '#AAA';
                ctx.beginPath();
                ctx.arc(cx + Math.cos(a) * (chipR - 3), cy + Math.sin(a) * (chipR - 3), 2 * scale, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.shadowBlur = 0;
            ctx.fillStyle = d.color === '#FFFFFF' || d.color === '#2ECC71' ? '#000' : '#FFF';
            ctx.font = `bold ${Math.max(9, 12 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(d.label, cx, cy);
            ctx.restore();
        }
    }

    drawUI(ctx, layout) {
        const { scale, width, height, bottomY, portrait } = layout;

        // Spin button
        const spinBtnW = 90 * scale;
        const spinBtnH = 36 * scale;
        const spinX = width / 2;
        const spinY = portrait ? bottomY - 5 * scale : bottomY;

        const canSpin = this.state === 'BETTING' && this.bets.length > 0;
        const g = ctx.createLinearGradient(spinX - spinBtnW / 2, spinY, spinX + spinBtnW / 2, spinY);
        g.addColorStop(0, canSpin ? '#f1c40f' : '#555');
        g.addColorStop(1, canSpin ? '#d35400' : '#333');

        if (canSpin) {
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 10;
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(spinX - spinBtnW / 2, spinY - spinBtnH / 2, spinBtnW, spinBtnH, 8 * scale);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = canSpin ? '#000' : '#888';
        ctx.font = `bold ${14 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.state === 'SPINNING' ? 'SPINNING...' : 'SPIN', spinX, spinY);

        // Clear button
        const clearX = spinX - spinBtnW / 2 - 60 * scale;
        const btnSize = 32 * scale;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(clearX - btnSize / 2, spinY - btnSize / 2, btnSize, btnSize, 4 * scale);
        ctx.fill();
        ctx.fillStyle = '#CCC';
        ctx.font = `${10 * scale}px Arial`;
        ctx.fillText('CLR', clearX, spinY);

        // Undo button
        const undoX = spinX + spinBtnW / 2 + 60 * scale;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(undoX - btnSize / 2, spinY - btnSize / 2, btnSize, btnSize, 4 * scale);
        ctx.fill();
        ctx.fillStyle = '#CCC';
        ctx.fillText('UNDO', undoX, spinY);

        // Balance
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f1c40f';
        ctx.font = `bold ${14 * scale}px Arial`;
        const balY = portrait ? bottomY + 20 * scale : spinY;
        ctx.fillText(`BAL: $${this.balance}`, 12 * scale, balY);

        // Total bet
        ctx.textAlign = 'right';
        ctx.fillStyle = '#CCC';
        ctx.font = `${12 * scale}px Arial`;
        ctx.fillText(`BET: $${this.totalBet}`, width - 12 * scale, balY);

        // Win display
        if (this.winCounter > 0) {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f1c40f';
            ctx.font = `bold ${22 * scale}px Arial`;
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 10;
            const winY = portrait ? layout.chipStripY - 20 * scale : layout.chipStripY - 30 * scale;
            ctx.fillText(`WIN: $${this.winCounter}`, width / 2, winY);
            ctx.shadowBlur = 0;
        }

        // Winning number callout during RESULT
        if (this.state === 'RESULT') {
            const n = this.winningNumber;
            const col = numberColor(n);
            ctx.textAlign = 'center';
            ctx.font = `bold ${18 * scale}px Arial`;
            ctx.fillStyle = col === 'red' ? '#E74C3C' : col === 'green' ? '#2ECC71' : '#FFF';
            const callY = portrait ? layout.historyY - 18 * scale : layout.wheelCY - layout.wheelR - 30 * scale;
            ctx.fillText(`${n} ${col.toUpperCase()}`, layout.wheelCX || width / 2, callY);
        }
    }

    drawBigWin(ctx, width, height) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, width, height);

        const s = 1 + Math.sin(Date.now() / 150) * 0.15;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(s, s);

        ctx.shadowColor = 'white';
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 70px serif';
        ctx.textAlign = 'center';
        ctx.fillText('BIG WIN!', 0, -50);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 100px monospace';
        ctx.fillText(`$${this.winCounter}`, 0, 70);
        ctx.restore();

        this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    drawVignette(ctx, w, h) {
        const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, w, h);
    }

    getUsedAssets() {
        return [
            { type: 'background', id: 'roulette-felt', name: 'Table Felt', color: '#0B6623', current: this.config.customAssets?.['roulette-felt'] || null },
            { type: 'decoration', id: 'roulette-ball', name: 'Ball', color: '#EEEEEE', current: this.config.customAssets?.['roulette-ball'] || null },
        ];
    }
}
