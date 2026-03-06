// VERSIONED BASE TEMPLATE — Read engine/VERSIONING.md before editing this file.
// Changes to this file affect all new games. Follow the versioning process to avoid breaking saved games.

// European Roulette - fully self-contained scene
// Shares NO code with ThreeReelSlotScene

// ── Constants ──

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

const CALL_BETS = {
    voisins: { label: 'Voisins', numbers: [0,2,3,4,7,12,15,18,19,21,22,25,26,28,29,32,35] },
    tiers:   { label: 'Tiers', numbers: [5,8,10,11,13,16,23,24,27,30,33,36] },
    orphelins: { label: 'Orphelins', numbers: [1,6,9,14,17,20,31,34] },
    jeu_zero: { label: 'Zero', numbers: [0,3,12,15,26,32,35] },
};

// ── Utilities ──

function numberColor(n) {
    if (n === 0) return 'green';
    return RED_NUMBERS.has(n) ? 'red' : 'black';
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function numberToGrid(n) {
    if (n === 0) return null;
    const col = Math.floor((n - 1) / 3);
    const row = 2 - ((n - 1) % 3);
    return { col, row };
}

function makeBetKey(type, numbers) {
    return `${type}:${[...numbers].sort((a, b) => a - b).join(',')}`;
}

// ── RouletteScene ──

export class RouletteScene {
    audioManager = null;

    setAudioManager(am) { this.audioManager = am; }

    constructor(config) {
        this.config = config || {};
        this.state = 'BETTING'; // BETTING | SPINNING | RESULT
        this.bets = new Map(); // key -> { type, numbers, amount, displayX, displayY }
        this.undoStack = []; // { key, amount } for undo
        this.lastRoundBets = null; // Map snapshot for rebet
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
        this.ballPhase = 'NONE'; // NONE | ORBIT | FALLING | BOUNCING | SETTLING | SETTLED
        this.ballAngularVel = 0;
        this.ballBounceCount = 0;
        this.settleTimer = 0;
        this.orbitTimer = 0;
        this.fallTimer = 0;
        this.bounceTimer = 0;
        this.settlingTimer = 0;
        this.settlingFrom = { angle: 0, radius: 0 };
        this.settlingTo = { angle: 0, radius: 0 };

        // Ball trail
        this.ballTrail = [];

        // Particles & effects
        this.particles = [];
        this.ambientParticles = [];
        this.screenShake = 0;
        this.bigWinActive = false;

        // Chip placement animations
        this.chipAnimations = [];

        // Win collection animations
        this.winCollectAnimations = [];

        // Result banner
        this.resultBanner = null;

        // Winning sector flash
        this.sectorFlash = 0;

        // Hover state
        this.hoveredZone = null;

        // Racetrack overlay
        this.showRacetrack = false;

        // Stats panel
        this.showStats = false;

        // Cached canvases
        this.wheelCache = null;
        this.wheelCacheSize = 0;
        this.feltCache = null;
        this.feltCacheW = 0;
        this.feltCacheH = 0;

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

    // ── Scene Interface ──

    enter(game) {
        this.game = game;
        this._inputDown = (mouse) => this.handleClick(mouse);
        this._inputMove = (mouse) => this.handleMove(mouse);
        this.game.input.on('down', this._inputDown);
        this.game.input.on('move', this._inputMove);
    }

    exit() {
        if (this.game) {
            this.game.input.off('down', this._inputDown);
            this.game.input.off('move', this._inputMove);
        }
    }

    getUsedAssets() {
        return [
            { type: 'background', id: 'roulette-felt', name: 'Table Felt', color: '#0B6623', current: this.config.customAssets?.['roulette-felt'] || null },
            { type: 'decoration', id: 'roulette-ball', name: 'Ball', color: '#EEEEEE', current: this.config.customAssets?.['roulette-ball'] || null },
        ];
    }

    // ── Layout System ──

    getLayout() {
        const { width, height } = this.game.renderer;
        const portrait = height > width || width < 500;
        const compact = !portrait && width < 700;
        const minTouch = 44;

        if (portrait) {
            const scale = width / 450;
            const wheelR = Math.min(width * 0.28, height * 0.14);
            const wheelCX = width / 2;
            const wheelCY = wheelR + 24 * scale;
            const historyY = wheelCY + wheelR + 18 * scale;
            const tableTop = historyY + 24 * scale;
            const tableH = height * 0.40;
            const tableW = width - 20 * scale;
            const tableLeft = (width - tableW) / 2;
            const chipStripY = tableTop + tableH + 10 * scale;
            const bottomY = height - 52 * scale;
            return { portrait: true, compact: false, scale, width, height, minTouch,
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
        return { portrait: false, compact, scale, width, height, minTouch,
            wheelCX, wheelCY, wheelR, historyY,
            tableLeft, tableTop, tableW, tableH,
            chipStripY, bottomY };
    }

    getTableGeometry(layout) {
        const { tableLeft, tableTop, tableW, tableH, scale } = layout;
        const cols = 12;
        const rows = 3;
        const zeroW = tableW * 0.07;
        const gridW = tableW - zeroW - tableW * 0.08;
        const colBetW = tableW * 0.08;
        const numberH = tableH * 0.55;
        const outsideH = tableH * 0.18;
        const cellW = gridW / cols;
        const cellH = numberH / rows;
        return { tableLeft, tableTop, tableW, tableH, cols, rows,
            zeroW, gridW, colBetW, numberH, outsideH, cellW, cellH, scale };
    }

    gridToNumber(col, row) {
        return (col) * 3 + (3 - row);
    }

    getBetDisplayPos(type, numbers, tg) {
        const { tableLeft, tableTop, zeroW, cellW, cellH, scale } = tg;
        const gridLeft = tableLeft + zeroW;
        const gridBottom = tableTop + tg.numberH;

        if (type === 'straight') {
            const n = numbers[0];
            if (n === 0) return { x: tableLeft + zeroW / 2, y: tableTop + tg.numberH / 2 };
            const g = numberToGrid(n);
            return { x: gridLeft + g.col * cellW + cellW / 2, y: tableTop + g.row * cellH + cellH / 2 };
        }
        if (type === 'split') {
            const g1 = numberToGrid(numbers[0]);
            const g2 = numberToGrid(numbers[1]);
            if (!g1 || !g2) return { x: gridLeft, y: tableTop };
            return {
                x: gridLeft + (g1.col + g2.col) / 2 * cellW + cellW / 2,
                y: tableTop + (g1.row + g2.row) / 2 * cellH + cellH / 2
            };
        }
        if (type === 'corner') {
            const grids = numbers.map(n => numberToGrid(n)).filter(Boolean);
            const avgCol = grids.reduce((s, g) => s + g.col, 0) / grids.length;
            const avgRow = grids.reduce((s, g) => s + g.row, 0) / grids.length;
            return { x: gridLeft + avgCol * cellW + cellW / 2, y: tableTop + avgRow * cellH + cellH / 2 };
        }
        if (type === 'street') {
            const g = numberToGrid(numbers[1]);
            if (!g) return { x: gridLeft, y: tableTop };
            return { x: gridLeft + g.col * cellW, y: tableTop + cellH * 1.5 };
        }
        if (type === 'sixline') {
            const g1 = numberToGrid(numbers[0]);
            const g2 = numberToGrid(numbers[3]);
            if (!g1 || !g2) return { x: gridLeft, y: gridBottom };
            return { x: gridLeft + (g1.col + g2.col) / 2 * cellW + cellW / 2, y: tableTop + cellH * 1.5 };
        }
        if (type === 'column') {
            const row = numbers.includes(3) ? 0 : numbers.includes(2) ? 1 : 2;
            return { x: gridLeft + tg.gridW + tg.colBetW / 2, y: tableTop + row * cellH + cellH / 2 };
        }
        if (type === 'dozen') {
            const minN = Math.min(...numbers);
            const third = Math.floor((minN - 1) / 12);
            const w = tg.gridW / 3;
            return { x: gridLeft + third * w + w / 2, y: gridBottom + tg.outsideH / 4 };
        }
        if (type === 'evenmoney') {
            const dozenH = tg.outsideH / 2;
            const evenY = gridBottom + dozenH;
            const w = tg.gridW / 6;
            let idx = 0;
            if (numbers.length === 18 && numbers[0] === 1 && numbers[17] === 18) idx = 0;
            else if (numbers.every(n => n % 2 === 0)) idx = 1;
            else if (numbers.length === 18 && numbers.every(n => RED_NUMBERS.has(n))) idx = 2;
            else if (numbers.length === 18 && numbers.every(n => !RED_NUMBERS.has(n) && n !== 0)) idx = 3;
            else if (numbers.every(n => n % 2 === 1)) idx = 4;
            else idx = 5;
            return { x: gridLeft + idx * w + w / 2, y: evenY + dozenH / 2 };
        }
        return { x: tableLeft + tg.tableW / 2, y: tableTop + tg.tableH / 2 };
    }

    // ── Bet Logic ──

    placeBet(type, numbers, fromX, fromY) {
        if (this.balance < this.selectedChip) return;
        this.balance -= this.selectedChip;

        const key = makeBetKey(type, numbers);
        const layout = this.getLayout();
        const tg = this.getTableGeometry(layout);
        const displayPos = this.getBetDisplayPos(type, numbers, tg);

        if (this.bets.has(key)) {
            const bet = this.bets.get(key);
            bet.amount += this.selectedChip;
        } else {
            this.bets.set(key, { type, numbers: [...numbers], amount: this.selectedChip, displayX: displayPos.x, displayY: displayPos.y });
        }

        this.undoStack.push({ key, amount: this.selectedChip });
        this.totalBet += this.selectedChip;

        // Chip fly animation
        this.chipAnimations.push({
            fromX: fromX ?? displayPos.x,
            fromY: fromY ?? displayPos.y,
            toX: displayPos.x,
            toY: displayPos.y,
            progress: 0,
            duration: 14,
            amount: this.selectedChip
        });

        if (this.audioManager) this.audioManager.play('buttonClick');
    }

    clearBets() {
        let refund = 0;
        for (const bet of this.bets.values()) refund += bet.amount;
        this.balance += refund;
        this.bets.clear();
        this.undoStack = [];
        this.totalBet = 0;
        if (this.audioManager) this.audioManager.play('buttonClick');
    }

    undoBet() {
        if (this.undoStack.length === 0) return;
        const { key, amount } = this.undoStack.pop();
        const bet = this.bets.get(key);
        if (!bet) return;
        bet.amount -= amount;
        this.balance += amount;
        this.totalBet -= amount;
        if (bet.amount <= 0) this.bets.delete(key);
        if (this.audioManager) this.audioManager.play('buttonClick');
    }

    rebetLast() {
        if (!this.lastRoundBets || this.state !== 'BETTING') return;
        let totalNeeded = 0;
        for (const bet of this.lastRoundBets.values()) totalNeeded += bet.amount;
        if (this.balance < totalNeeded) return;

        this.clearBets();
        for (const [key, bet] of this.lastRoundBets) {
            this.balance -= bet.amount;
            this.bets.set(key, { ...bet });
            this.totalBet += bet.amount;
            this.undoStack.push({ key, amount: bet.amount });
        }
        if (this.audioManager) this.audioManager.play('buttonClick');
    }

    doubleBets() {
        if (this.state !== 'BETTING' || this.bets.size === 0) return;
        let totalNeeded = 0;
        for (const bet of this.bets.values()) totalNeeded += bet.amount;
        if (this.balance < totalNeeded) return;

        this.balance -= totalNeeded;
        this.totalBet += totalNeeded;
        for (const [key, bet] of this.bets) {
            this.undoStack.push({ key, amount: bet.amount });
            bet.amount *= 2;
        }
        if (this.audioManager) this.audioManager.play('buttonClick');
    }

    // ── Input Handling ──

    handleMove(mouse) {
        if (this.state !== 'BETTING') { this.hoveredZone = null; return; }
        if (this.showRacetrack) {
            this.hoveredZone = this.hitTestRacetrack(mouse);
            if (this.hoveredZone) return;
        }
        this.hoveredZone = this.hitTestTable(mouse);
    }

    handleClick(mouse) {
        if (this.bigWinActive) {
            this.bigWinActive = false;
            this.particles = [];
            return;
        }

        const layout = this.getLayout();
        const tg = this.getTableGeometry(layout);

        if (this.handleUIClick(mouse, layout, tg)) return;
        if (this.state !== 'BETTING') return;
        if (this.handleChipClick(mouse, layout)) return;

        if (this.showRacetrack) {
            if (this.handleRacetrackClick(mouse, layout)) return;
        }

        this.handleTableClick(mouse, layout, tg);
    }

    handleUIClick(mouse, layout, tg) {
        const { scale, width, bottomY, portrait } = layout;
        const spinY = portrait ? bottomY - 5 * scale : bottomY;

        // Button layout: CLR | UNDO | SPIN | REBET | 2x
        const spinBtnW = 80 * scale;
        const spinBtnH = Math.max(36 * scale, layout.minTouch);
        const spinX = width / 2;
        const btnSize = Math.max(32 * scale, layout.minTouch);
        const btnGap = 8 * scale;

        // Spin button
        if (mouse.x > spinX - spinBtnW / 2 && mouse.x < spinX + spinBtnW / 2 &&
            mouse.y > spinY - spinBtnH / 2 && mouse.y < spinY + spinBtnH / 2) {
            if (this.state === 'BETTING') this.spin();
            return true;
        }

        // CLR button
        const clrX = spinX - spinBtnW / 2 - btnGap - btnSize;
        if (mouse.x > clrX && mouse.x < clrX + btnSize &&
            mouse.y > spinY - btnSize / 2 && mouse.y < spinY + btnSize / 2) {
            if (this.state === 'BETTING') this.clearBets();
            return true;
        }

        // UNDO button
        const undoX = clrX - btnGap - btnSize;
        if (mouse.x > undoX && mouse.x < undoX + btnSize &&
            mouse.y > spinY - btnSize / 2 && mouse.y < spinY + btnSize / 2) {
            if (this.state === 'BETTING') this.undoBet();
            return true;
        }

        // REBET button
        const rebetX = spinX + spinBtnW / 2 + btnGap;
        if (mouse.x > rebetX && mouse.x < rebetX + btnSize &&
            mouse.y > spinY - btnSize / 2 && mouse.y < spinY + btnSize / 2) {
            if (this.state === 'BETTING') this.rebetLast();
            return true;
        }

        // 2x button
        const doubleX = rebetX + btnSize + btnGap;
        if (mouse.x > doubleX && mouse.x < doubleX + btnSize &&
            mouse.y > spinY - btnSize / 2 && mouse.y < spinY + btnSize / 2) {
            if (this.state === 'BETTING') this.doubleBets();
            return true;
        }

        // Racetrack toggle (small icon near history)
        const rtBtnSize = Math.max(24 * scale, layout.minTouch);
        const rtX = portrait ? width - 30 * scale : layout.wheelCX + layout.wheelR - 10 * scale;
        const rtY = layout.historyY;
        if (mouse.x > rtX - rtBtnSize / 2 && mouse.x < rtX + rtBtnSize / 2 &&
            mouse.y > rtY - rtBtnSize / 2 && mouse.y < rtY + rtBtnSize / 2) {
            this.showRacetrack = !this.showRacetrack;
            if (this.audioManager) this.audioManager.play('buttonClick');
            return true;
        }

        // Stats toggle
        const stX = portrait ? width - 60 * scale : layout.wheelCX - layout.wheelR + 10 * scale;
        if (mouse.x > stX - rtBtnSize / 2 && mouse.x < stX + rtBtnSize / 2 &&
            mouse.y > rtY - rtBtnSize / 2 && mouse.y < rtY + rtBtnSize / 2) {
            this.showStats = !this.showStats;
            if (this.audioManager) this.audioManager.play('buttonClick');
            return true;
        }

        return false;
    }

    handleChipClick(mouse, layout) {
        const { scale, width, chipStripY } = layout;
        const chipR = Math.max(18 * scale, layout.minTouch / 2);
        const gap = Math.max(50 * scale, layout.minTouch + 6);
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
        const chipLayout = this.getLayout();
        const chipR = Math.max(18 * chipLayout.scale, chipLayout.minTouch / 2);
        const chipGap = Math.max(50 * chipLayout.scale, chipLayout.minTouch + 6);
        const chipStartX = chipLayout.width / 2 - (CHIP_DENOMS.length - 1) * chipGap / 2;
        const selectedIdx = CHIP_DENOMS.findIndex(d => d.value === this.selectedChip);
        const chipFromX = chipStartX + selectedIdx * chipGap;
        const chipFromY = chipLayout.chipStripY;

        // Zero
        if (mx >= tableLeft && mx < tableLeft + zeroW && my >= tableTop && my < gridBottom) {
            this.placeBet('straight', [0], chipFromX, chipFromY);
            return;
        }

        // Number grid
        if (mx >= gridLeft && mx < gridRight && my >= tableTop && my < gridBottom) {
            const relX = mx - gridLeft;
            const relY = my - tableTop;
            const col = Math.floor(relX / cellW);
            const row = Math.floor(relY / cellH);
            const inCellX = relX - col * cellW;
            const inCellY = relY - row * cellH;
            const edge = 8 * tg.scale;

            // Corner bets
            if (inCellX < edge && inCellY < edge && col > 0 && row > 0) {
                const nums = [
                    this.gridToNumber(col - 1, row - 1), this.gridToNumber(col, row - 1),
                    this.gridToNumber(col - 1, row), this.gridToNumber(col, row)
                ];
                this.placeBet('corner', nums, chipFromX, chipFromY);
                return;
            }

            // Sixline (bottom edge between two columns)
            if (inCellX < edge && row === 2 && inCellY > cellH - edge && col > 0) {
                const nums = [];
                for (let r = 0; r < 3; r++) {
                    nums.push(this.gridToNumber(col - 1, r));
                    nums.push(this.gridToNumber(col, r));
                }
                this.placeBet('sixline', nums, chipFromX, chipFromY);
                return;
            }

            // Horizontal split
            if (inCellY < edge && row > 0) {
                const nums = [this.gridToNumber(col, row - 1), this.gridToNumber(col, row)];
                this.placeBet('split', nums, chipFromX, chipFromY);
                return;
            }

            // Vertical split
            if (inCellX < edge && col > 0) {
                const nums = [this.gridToNumber(col - 1, row), this.gridToNumber(col, row)];
                this.placeBet('split', nums, chipFromX, chipFromY);
                return;
            }

            // Street (left edge of first column)
            if (col === 0 && inCellX < edge) {
                const n = this.gridToNumber(0, row);
                const streetBase = Math.floor((n - 1) / 3) * 3 + 1;
                this.placeBet('street', [streetBase, streetBase + 1, streetBase + 2], chipFromX, chipFromY);
                return;
            }

            // Straight up
            const num = this.gridToNumber(col, row);
            this.placeBet('straight', [num], chipFromX, chipFromY);
            return;
        }

        // Column bets
        const colBetLeft = gridRight;
        if (mx >= colBetLeft && mx < colBetLeft + colBetW && my >= tableTop && my < gridBottom) {
            const row = Math.floor((my - tableTop) / cellH);
            const colNums = [];
            for (let c = 0; c < 12; c++) colNums.push(this.gridToNumber(c, row));
            this.placeBet('column', colNums, chipFromX, chipFromY);
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
            this.placeBet('dozen', nums, chipFromX, chipFromY);
            return;
        }

        // Even-money bets
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
            this.placeBet('evenmoney', nums, chipFromX, chipFromY);
            return;
        }
    }

    hitTestTable(mouse) {
        const layout = this.getLayout();
        const tg = this.getTableGeometry(layout);
        const { tableLeft, tableTop, zeroW, gridW, colBetW, numberH, outsideH, cellW, cellH, cols, rows } = tg;
        const mx = mouse.x, my = mouse.y;
        const gridLeft = tableLeft + zeroW;
        const gridRight = gridLeft + gridW;
        const gridBottom = tableTop + numberH;

        if (mx >= tableLeft && mx < tableLeft + zeroW && my >= tableTop && my < gridBottom) {
            return { type: 'straight', numbers: [0], rect: { x: tableLeft, y: tableTop, w: zeroW, h: numberH } };
        }

        if (mx >= gridLeft && mx < gridRight && my >= tableTop && my < gridBottom) {
            const relX = mx - gridLeft;
            const relY = my - tableTop;
            const col = Math.floor(relX / cellW);
            const row = Math.floor(relY / cellH);
            const x = gridLeft + col * cellW;
            const y = tableTop + row * cellH;
            return { type: 'straight', numbers: [this.gridToNumber(col, row)], rect: { x, y, w: cellW, h: cellH } };
        }

        if (mx >= gridRight && mx < gridRight + colBetW && my >= tableTop && my < gridBottom) {
            const row = Math.floor((my - tableTop) / cellH);
            return { type: 'column', numbers: [], rect: { x: gridRight, y: tableTop + row * cellH, w: colBetW, h: cellH } };
        }

        const dozenH = outsideH / 2;
        if (my >= gridBottom && my < gridBottom + dozenH && mx >= gridLeft && mx < gridRight) {
            const third = Math.floor((mx - gridLeft) / (gridW / 3));
            const w = gridW / 3;
            return { type: 'dozen', numbers: [], rect: { x: gridLeft + third * w, y: gridBottom, w, h: dozenH } };
        }

        const evenY = gridBottom + dozenH;
        if (my >= evenY && my < evenY + dozenH && mx >= gridLeft && mx < gridRight) {
            const sixth = Math.floor((mx - gridLeft) / (gridW / 6));
            const w = gridW / 6;
            return { type: 'evenmoney', numbers: [], rect: { x: gridLeft + sixth * w, y: evenY, w, h: dozenH } };
        }

        return null;
    }

    // ── Racetrack ──

    getRacetrackLayout(layout) {
        const { width, height, scale, portrait } = layout;
        const cx = portrait ? width / 2 : layout.wheelCX;
        const cy = portrait ? layout.wheelCY : layout.wheelCY;
        const rx = Math.min(width * 0.35, 180 * scale);
        const ry = Math.min(height * 0.12, 70 * scale);
        const offsetY = portrait ? 0 : 0;
        return { cx, cy: cy + offsetY, rx, ry, scale };
    }

    hitTestRacetrack(mouse) {
        const layout = this.getLayout();
        const rt = this.getRacetrackLayout(layout);
        const dx = (mouse.x - rt.cx) / rt.rx;
        const dy = (mouse.y - rt.cy) / rt.ry;
        if (dx * dx + dy * dy > 1.3 * 1.3 || dx * dx + dy * dy < 0.5 * 0.5) return null;

        // Find which sector
        const angle = Math.atan2(dy * rt.rx, dx * rt.ry);
        const sectorAngle = (Math.PI * 2) / 37;
        let idx = Math.floor(((angle + Math.PI) % (Math.PI * 2)) / sectorAngle);
        idx = clamp(idx, 0, 36);
        return { type: 'racetrack', number: WHEEL_NUMBERS[idx], idx };
    }

    handleRacetrackClick(mouse, layout) {
        const hit = this.hitTestRacetrack(mouse);
        if (!hit) return false;

        // Place neighbour bet: the clicked number + 2 neighbours each side
        const idx = WHEEL_NUMBERS.indexOf(hit.number);
        const neighbours = 2;
        for (let i = -neighbours; i <= neighbours; i++) {
            const ni = (idx + i + 37) % 37;
            this.placeBet('straight', [WHEEL_NUMBERS[ni]]);
        }
        return true;
    }

    // ── Spin & Resolve ──

    spin() {
        if (this.bets.size === 0) return;
        this.state = 'SPINNING';
        this.lastWin = 0;
        this.winCounter = 0;
        this.winningBets = [];
        this.resultBanner = null;
        this.sectorFlash = 0;
        this.showRacetrack = false;
        this.showStats = false;

        this.winningNumber = WHEEL_NUMBERS[Math.floor(Math.random() * 37)];

        this.wheelSpinSpeed = 0.35 + Math.random() * 0.1;
        this.ballPhase = 'ORBIT';
        this.ballAngularVel = -0.35;
        this.ballAngle = Math.random() * Math.PI * 2;
        this.ballRadius = 1.0;
        this.ballBounceCount = 0;
        this.orbitTimer = 0;
        this.ballTrail = [];

        if (this.audioManager) this.audioManager.play('spin');
    }

    resolveResult() {
        this.state = 'RESULT';
        const n = this.winningNumber;
        const col = numberColor(n);
        this.history.unshift({ number: n, color: col });
        if (this.history.length > 100) this.history.pop();

        // Sector flash
        this.sectorFlash = 1.0;

        // Result banner
        this.resultBanner = { number: n, color: col, timer: 0, maxTimer: 120 };

        // Save bets for rebet before clearing
        this.lastRoundBets = new Map();
        for (const [key, bet] of this.bets) {
            this.lastRoundBets.set(key, { ...bet });
        }

        // Calculate wins
        let totalWin = 0;
        this.winningBets = [];
        for (const [key, bet] of this.bets) {
            if (bet.numbers.includes(n)) {
                const payout = bet.amount * PAYOUTS[bet.type] + bet.amount;
                totalWin += payout;
                this.winningBets.push(bet);
            }
        }

        if (totalWin > 0) {
            this.lastWin = totalWin;
            this.balance += totalWin;

            const isBig = totalWin >= this.totalBet * 10;
            if (this.audioManager) {
                this.audioManager.play(isBig ? 'bigWin' : 'win');
            }
            if (isBig) {
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

            // Win collection animations
            for (const bet of this.winningBets) {
                this.winCollectAnimations.push({
                    x: bet.displayX, y: bet.displayY,
                    targetX: 60, targetY: this.getLayout().bottomY,
                    progress: 0, duration: 50,
                    amount: bet.amount
                });
            }
        }

        this.settleTimer = 180;
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
        this.updateBall();

        // Result timer
        if (this.state === 'RESULT') {
            this.settleTimer--;
            if (this.settleTimer <= 0 && !this.bigWinActive) {
                this.state = 'BETTING';
                this.bets.clear();
                this.undoStack = [];
                this.totalBet = 0;
                // Keep ball in pocket (SETTLED) until next spin
                this.winningBets = [];
                this.resultBanner = null;
            }
        }

        // Win counter roll-up
        if (this.winCounter < this.lastWin) {
            const step = Math.ceil(this.lastWin / 60);
            this.winCounter = Math.min(this.lastWin, this.winCounter + step);
        }

        // Sector flash decay
        if (this.sectorFlash > 0) this.sectorFlash *= 0.96;

        // Result banner
        if (this.resultBanner) {
            this.resultBanner.timer++;
            if (this.resultBanner.timer > this.resultBanner.maxTimer) this.resultBanner = null;
        }

        // Chip animations
        for (let i = this.chipAnimations.length - 1; i >= 0; i--) {
            const a = this.chipAnimations[i];
            a.progress += 1 / a.duration;
            if (a.progress >= 1) this.chipAnimations.splice(i, 1);
        }

        // Win collection animations
        for (let i = this.winCollectAnimations.length - 1; i >= 0; i--) {
            const a = this.winCollectAnimations[i];
            a.progress += 1 / a.duration;
            if (a.progress >= 1) this.winCollectAnimations.splice(i, 1);
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

    updateBall() {
        if (this.ballPhase === 'ORBIT') {
            this.orbitTimer++;
            this.ballAngle += this.ballAngularVel;
            this.ballAngularVel *= 0.993;
            // Trail
            this.updateBallTrail();
            if (this.orbitTimer > 150) {
                this.ballPhase = 'FALLING';
                this.fallTimer = 0;
            }
        } else if (this.ballPhase === 'FALLING') {
            this.fallTimer++;
            this.ballAngle += this.ballAngularVel;
            this.ballAngularVel *= 0.97;
            this.ballRadius = 1.0 - (this.fallTimer / 30) * 0.35;
            this.updateBallTrail();
            if (this.fallTimer > 30) {
                this.ballPhase = 'BOUNCING';
                this.ballBounceCount = 0;
                this.bounceTimer = 0;
            }
        } else if (this.ballPhase === 'BOUNCING') {
            this.bounceTimer++;
            this.ballAngle += this.ballAngularVel;
            this.ballAngularVel *= 0.96;
            this.updateBallTrail();

            if (this.bounceTimer % 12 === 0 && this.ballBounceCount < 4) {
                this.ballBounceCount++;
                this.ballRadius += 0.04 / this.ballBounceCount;
                if (this.audioManager) this.audioManager.play('reelStop');
            }
            this.ballRadius *= 0.99;
            if (this.ballRadius < 0.62) this.ballRadius = 0.62;

            if (this.bounceTimer > 50) {
                // Transition to SETTLING - smooth interpolation into winning pocket
                this.ballPhase = 'SETTLING';
                this.settlingTimer = 0;

                // Record where ball currently is
                this.settlingFrom = { angle: this.ballAngle, radius: this.ballRadius };

                // Compute target: center of winning pocket in world space
                // Wheel cache draws sector i starting at (i * sectorAngle - PI/2)
                // so pocket center = i * sectorAngle - PI/2 + sectorAngle/2
                // In world space, add wheelAngle rotation
                const idx = WHEEL_NUMBERS.indexOf(this.winningNumber);
                const sectorAngle = (Math.PI * 2) / 37;
                const pocketAngle = idx * sectorAngle - Math.PI / 2 + sectorAngle / 2 + this.wheelAngle;

                // Find shortest angular path to pocket
                let angleDiff = pocketAngle - this.ballAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                this.settlingTo = { angle: this.ballAngle + angleDiff, radius: 0.62 };

                // Stop wheel spin (wheel is frozen during settling)
                this.wheelSpinSpeed = 0;
                this.ballTrail = [];
            }
        } else if (this.ballPhase === 'SETTLING') {
            this.settlingTimer++;
            const duration = 45; // ~0.75s at 60fps
            const t = Math.min(this.settlingTimer / duration, 1);
            const ease = easeOutCubic(t);

            // Simple lerp from current position to pocket (wheel is frozen so target doesn't move)
            this.ballAngle = lerp(this.settlingFrom.angle, this.settlingTo.angle, ease);
            this.ballRadius = lerp(this.settlingFrom.radius, this.settlingTo.radius, ease);

            if (t >= 1) {
                this.ballPhase = 'SETTLED';
                this.ballRadius = 0.62;
                if (this.audioManager) this.audioManager.play('reelStop');
                this.resolveResult();
            }
        } else if (this.ballPhase === 'SETTLED') {
            // Keep ball locked to winning pocket as wheel slowly rotates
            const idx = WHEEL_NUMBERS.indexOf(this.winningNumber);
            const sectorAngle = (Math.PI * 2) / 37;
            this.ballAngle = idx * sectorAngle - Math.PI / 2 + sectorAngle / 2 + this.wheelAngle;
            this.ballRadius = 0.62;
        }
    }

    updateBallTrail() {
        const layout = this.getLayout();
        const { wheelCX, wheelCY, wheelR } = layout;
        const r = this.ballRadius * wheelR * 0.88;
        const bx = wheelCX + Math.cos(this.ballAngle) * r;
        const by = wheelCY + Math.sin(this.ballAngle) * r;
        this.ballTrail.push({ x: bx, y: by });
        if (this.ballTrail.length > 10) this.ballTrail.shift();
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
        this.drawBallTrail(ctx, layout);
        this.drawBall(ctx, layout);
        this.drawTable(ctx, layout, tg);
        this.drawHoverHighlight(ctx);
        this.drawPlacedChips(ctx, tg);
        this.drawChipAnimations(ctx, tg);
        this.drawWinHighlights(ctx, layout, tg);
        this.drawWinCollectAnimations(ctx);
        this.drawHistory(ctx, layout);
        this.drawChipSelector(ctx, layout);
        this.drawUI(ctx, layout);
        this.drawResultBanner(ctx, layout);

        if (this.showRacetrack) this.drawRacetrack(ctx, layout);
        if (this.showStats) this.drawStatsPanel(ctx, layout);
        if (this.bigWinActive) this.drawBigWin(ctx, width, height);

        this.drawVignette(ctx, width, height);
        ctx.restore();
    }

    // ── Background ──

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

    // ── Wheel Rendering ──

    drawWheel(ctx, layout) {
        const { wheelCX, wheelCY, wheelR } = layout;
        const size = Math.floor(wheelR * 2 + 40);

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

        // Winning sector flash
        if (this.sectorFlash > 0.01 && this.state === 'RESULT') {
            const idx = WHEEL_NUMBERS.indexOf(this.winningNumber);
            const sectorAngle = (Math.PI * 2) / 37;
            const startA = idx * sectorAngle - Math.PI / 2 + this.wheelAngle;
            const endA = startA + sectorAngle;
            ctx.save();
            ctx.globalAlpha = this.sectorFlash * 0.6;
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.moveTo(wheelCX, wheelCY);
            ctx.arc(wheelCX, wheelCY, wheelR * 0.88, startA, endA);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Static outer ring with metallic effect
        const rimGrad = ctx.createLinearGradient(wheelCX - wheelR, wheelCY, wheelCX + wheelR, wheelCY);
        rimGrad.addColorStop(0, '#8B7536');
        rimGrad.addColorStop(0.3, '#E8D48B');
        rimGrad.addColorStop(0.5, '#C9A84C');
        rimGrad.addColorStop(0.7, '#E8D48B');
        rimGrad.addColorStop(1, '#8B7536');
        ctx.beginPath();
        ctx.arc(wheelCX, wheelCY, wheelR + 5, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = rimGrad;
        ctx.stroke();

        // Diamond deflectors on ball track
        const deflectorCount = 8;
        for (let i = 0; i < deflectorCount; i++) {
            const a = (i / deflectorCount) * Math.PI * 2;
            const dx = wheelCX + Math.cos(a) * (wheelR * 0.94);
            const dy = wheelCY + Math.sin(a) * (wheelR * 0.94);
            const ds = Math.max(3, wheelR * 0.035);
            ctx.save();
            ctx.translate(dx, dy);
            ctx.rotate(a);
            ctx.fillStyle = '#C9A84C';
            ctx.beginPath();
            ctx.moveTo(0, -ds);
            ctx.lineTo(ds * 0.5, 0);
            ctx.lineTo(0, ds);
            ctx.lineTo(-ds * 0.5, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Ball track pointer
        ctx.fillStyle = '#C9A84C';
        ctx.beginPath();
        ctx.moveTo(wheelCX, wheelCY - wheelR - 10);
        ctx.lineTo(wheelCX - 7, wheelCY - wheelR - 22);
        ctx.lineTo(wheelCX + 7, wheelCY - wheelR - 22);
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

            // Sector with depth gradient
            const midA = startA + sectorAngle / 2;
            const sectorGrad = ctx.createRadialGradient(center, center, R * 0.55, center, center, R * 0.88);
            if (col === 'red') {
                sectorGrad.addColorStop(0, '#8B1A1A');
                sectorGrad.addColorStop(0.5, '#C0392B');
                sectorGrad.addColorStop(1, '#A93226');
            } else if (col === 'green') {
                sectorGrad.addColorStop(0, '#145A32');
                sectorGrad.addColorStop(0.5, '#27AE60');
                sectorGrad.addColorStop(1, '#1E8449');
            } else {
                sectorGrad.addColorStop(0, '#0D0D0D');
                sectorGrad.addColorStop(0.5, '#1a1a1a');
                sectorGrad.addColorStop(1, '#111');
            }

            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, R * 0.88, startA, endA);
            ctx.closePath();
            ctx.fillStyle = sectorGrad;
            ctx.fill();

            // Fret line
            ctx.strokeStyle = '#C9A84C';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(center + Math.cos(startA) * R * 0.55, center + Math.sin(startA) * R * 0.55);
            ctx.lineTo(center + Math.cos(startA) * R * 0.88, center + Math.sin(startA) * R * 0.88);
            ctx.stroke();

            // Number label
            const labelR = R * 0.75;
            ctx.save();
            ctx.translate(center + Math.cos(midA) * labelR, center + Math.sin(midA) * labelR);
            ctx.rotate(midA + Math.PI / 2);
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(8, R * 0.09)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 2;
            ctx.fillText(String(num), 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Inner ring
        ctx.beginPath();
        ctx.arc(center, center, R * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = '#2C3E50';
        ctx.fill();
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center hub with enhanced gradient
        const hubGrad = ctx.createRadialGradient(center - R * 0.05, center - R * 0.05, 0, center, center, R * 0.3);
        hubGrad.addColorStop(0, '#E8D48B');
        hubGrad.addColorStop(0.4, '#C9A84C');
        hubGrad.addColorStop(0.7, '#8B6914');
        hubGrad.addColorStop(1, '#5D4E37');
        ctx.beginPath();
        ctx.arc(center, center, R * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = hubGrad;
        ctx.fill();

        // Hub edge ring
        ctx.beginPath();
        ctx.arc(center, center, R * 0.3, 0, Math.PI * 2);
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Outer track ring
        ctx.beginPath();
        ctx.arc(center, center, R * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Ball track background ring
        ctx.beginPath();
        ctx.arc(center, center, R, 0, Math.PI * 2);
        const trackGrad = ctx.createRadialGradient(center, center, R * 0.88, center, center, R);
        trackGrad.addColorStop(0, '#3D3D3D');
        trackGrad.addColorStop(0.5, '#555');
        trackGrad.addColorStop(1, '#3D3D3D');
        ctx.strokeStyle = trackGrad;
        ctx.lineWidth = R * 0.12;
        ctx.stroke();

        // Outer edge
        ctx.beginPath();
        ctx.arc(center, center, R + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    drawBallTrail(ctx, layout) {
        if (this.ballTrail.length < 2) return;
        const len = this.ballTrail.length;
        for (let i = 0; i < len - 1; i++) {
            const p = this.ballTrail[i];
            const alpha = (i / len) * 0.4;
            const size = Math.max(1, (i / len) * 3);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawBall(ctx, layout) {
        if (this.ballPhase === 'NONE') return;
        const { wheelCX, wheelCY, wheelR } = layout;
        const r = this.ballRadius * wheelR * 0.88;
        const bx = wheelCX + Math.cos(this.ballAngle) * r;
        const by = wheelCY + Math.sin(this.ballAngle) * r;
        const ballSize = Math.max(3, wheelR * 0.05);

        ctx.save();
        // Ball glow
        ctx.shadowColor = 'rgba(255,255,255,0.9)';
        ctx.shadowBlur = 10;

        // Ball body with metallic gradient
        const ballGrad = ctx.createRadialGradient(bx - ballSize * 0.3, by - ballSize * 0.3, 0, bx, by, ballSize);
        ballGrad.addColorStop(0, '#FFFFFF');
        ballGrad.addColorStop(0.6, '#DDDDDD');
        ballGrad.addColorStop(1, '#AAAAAA');
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(bx, by, ballSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ── Table Rendering ──

    drawTable(ctx, layout, tg) {
        const { tableLeft, tableTop, tableW, tableH, zeroW, gridW, colBetW, numberH, outsideH, cellW, cellH, cols, rows, scale } = tg;
        const gridLeft = tableLeft + zeroW;
        const gridBottom = tableTop + numberH;

        // Felt background with subtle texture
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(tableLeft - 4, tableTop - 4, tableW + 8, tableH + 8, 6 * scale);
        ctx.clip();

        // Base felt color
        ctx.fillStyle = '#0B6623';
        ctx.fillRect(tableLeft - 4, tableTop - 4, tableW + 8, tableH + 8);

        // Subtle felt texture overlay
        this.drawFeltTexture(ctx, tableLeft - 4, tableTop - 4, tableW + 8, tableH + 8);

        ctx.restore();

        // Border
        ctx.beginPath();
        ctx.roundRect(tableLeft - 4, tableTop - 4, tableW + 8, tableH + 8, 6 * scale);
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
                const numCol = numberColor(num);

                // Cell with subtle gradient
                const cellGrad = ctx.createLinearGradient(x, y, x, y + cellH);
                if (numCol === 'red') {
                    cellGrad.addColorStop(0, '#C0392B');
                    cellGrad.addColorStop(1, '#A93226');
                } else {
                    cellGrad.addColorStop(0, '#1a1a1a');
                    cellGrad.addColorStop(1, '#111');
                }
                ctx.fillStyle = cellGrad;
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
        const evenLabels = ['1-18', 'EVEN', '◆', '◆', 'ODD', '19-36'];
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
            if (i === 2) {
                ctx.fillText('RED', x + w / 2, evenY + dozenH / 2);
            } else if (i === 3) {
                ctx.fillText('BLK', x + w / 2, evenY + dozenH / 2);
            } else {
                ctx.fillText(evenLabels[i], x + w / 2, evenY + dozenH / 2);
            }
        }
    }

    drawFeltTexture(ctx, x, y, w, h) {
        // Cache felt texture
        const cacheW = 100;
        const cacheH = 100;
        if (!this.feltCache || this.feltCacheW !== cacheW) {
            this.feltCacheW = cacheW;
            this.feltCacheH = cacheH;
            this.feltCache = document.createElement('canvas');
            this.feltCache.width = cacheW;
            this.feltCache.height = cacheH;
            const fctx = this.feltCache.getContext('2d');
            fctx.fillStyle = 'rgba(0,0,0,0)';
            fctx.fillRect(0, 0, cacheW, cacheH);
            // Subtle noise
            for (let i = 0; i < 200; i++) {
                const px = Math.random() * cacheW;
                const py = Math.random() * cacheH;
                const brightness = Math.random() > 0.5 ? 255 : 0;
                const alpha = 0.02 + Math.random() * 0.03;
                fctx.fillStyle = `rgba(${brightness},${brightness},${brightness},${alpha})`;
                fctx.fillRect(px, py, 1, 1);
            }
        }
        const pattern = ctx.createPattern(this.feltCache, 'repeat');
        if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(x, y, w, h);
        }
    }

    drawHoverHighlight(ctx) {
        if (!this.hoveredZone || !this.hoveredZone.rect) return;
        const r = this.hoveredZone.rect;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
    }

    // ── Chip Rendering ──

    drawPlacedChips(ctx, tg) {
        for (const bet of this.bets.values()) {
            this.drawChipStack(ctx, bet.displayX, bet.displayY, bet.amount, tg.scale);
        }
    }

    drawChipStack(ctx, x, y, totalAmount, scale) {
        // Determine stack visual from total amount
        const minChip = 1;
        const stackCount = Math.min(Math.ceil(totalAmount / Math.max(this.selectedChip, 5)), 5);
        const offset = 2 * scale;

        // Find best chip denomination for display
        let displayDenom = CHIP_DENOMS[0];
        for (const d of CHIP_DENOMS) {
            if (d.value <= totalAmount) displayDenom = d;
        }

        for (let i = 0; i < stackCount; i++) {
            this.drawChip(ctx, x, y - i * offset, displayDenom, scale, i === stackCount - 1);
        }

        // Amount label on top
        if (totalAmount > 0) {
            ctx.fillStyle = '#FFF';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.font = `bold ${Math.max(6, 8 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labelY = y - stackCount * offset - 6 * scale;
            ctx.strokeText(String(totalAmount), x, labelY);
            ctx.fillText(String(totalAmount), x, labelY);
        }
    }

    drawChip(ctx, x, y, denom, scale, isTop) {
        const r = 10 * scale;

        ctx.save();
        if (isTop) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
        }

        // Chip body
        ctx.fillStyle = denom.color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Edge ring
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Edge notches
        if (isTop) {
            for (let n = 0; n < 8; n++) {
                const a = (n / 8) * Math.PI * 2;
                ctx.fillStyle = '#AAA';
                ctx.beginPath();
                ctx.arc(x + Math.cos(a) * (r - 2.5), y + Math.sin(a) * (r - 2.5), 1.5 * scale, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawChipAnimations(ctx, tg) {
        for (const a of this.chipAnimations) {
            const t = easeOutCubic(clamp(a.progress, 0, 1));
            const x = lerp(a.fromX, a.toX, t);
            const y = lerp(a.fromY, a.toY, t) - Math.sin(t * Math.PI) * 30;
            const denom = CHIP_DENOMS.find(d => d.value === a.amount) || CHIP_DENOMS[0];
            this.drawChip(ctx, x, y, denom, tg.scale, true);
        }
    }

    drawWinCollectAnimations(ctx) {
        for (const a of this.winCollectAnimations) {
            const t = easeOutCubic(clamp(a.progress, 0, 1));
            const x = lerp(a.x, a.targetX, t);
            const y = lerp(a.y, a.targetY, t) - Math.sin(t * Math.PI) * 50;
            ctx.globalAlpha = 1 - t * 0.5;
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // ── Win Highlights ──

    drawWinHighlights(ctx, layout, tg) {
        if (this.state !== 'RESULT') return;
        const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.3;
        const { tableLeft, tableTop, zeroW, cellW, cellH, scale } = tg;
        const gridLeft = tableLeft + zeroW;
        const n = this.winningNumber;

        // Highlight winning number on table
        if (n === 0) {
            ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
            ctx.fillRect(tableLeft, tableTop, zeroW, tg.numberH);
        } else {
            const g = numberToGrid(n);
            if (g) {
                const x = gridLeft + g.col * cellW;
                const y = tableTop + g.row * cellH;
                ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
                ctx.fillRect(x, y, cellW, cellH);
            }
        }

        // Highlight winning bet chips
        for (const bet of this.winningBets) {
            ctx.strokeStyle = `rgba(255, 215, 0, ${pulse + 0.2})`;
            ctx.lineWidth = 3 * scale;
            ctx.beginPath();
            ctx.arc(bet.displayX, bet.displayY, 14 * scale, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Highlight on wheel
        const { wheelCX, wheelCY, wheelR } = layout;
        const idx = WHEEL_NUMBERS.indexOf(n);
        const sectorAngle = (Math.PI * 2) / 37;
        const startA = idx * sectorAngle - Math.PI / 2 + this.wheelAngle;
        const endA = startA + sectorAngle;
        ctx.save();
        ctx.globalAlpha = pulse * 0.5;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(wheelCX, wheelCY);
        ctx.arc(wheelCX, wheelCY, wheelR * 0.88, startA, endA);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // ── History ──

    drawHistory(ctx, layout) {
        const { scale, width, historyY, portrait } = layout;
        const r = 10 * scale;
        const gap = 24 * scale;
        const count = Math.min(this.history.length, 10);
        const startX = portrait ? width / 2 - (count - 1) * gap / 2 : layout.wheelCX - (count - 1) * gap / 2;

        for (let i = 0; i < count; i++) {
            const h = this.history[i];
            const x = startX + i * gap;
            const alpha = i === 0 ? 1 : 0.6 + (1 - i / count) * 0.4;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = h.color === 'red' ? '#C0392B' : h.color === 'green' ? '#27AE60' : '#1a1a1a';
            ctx.beginPath();
            ctx.arc(x, historyY, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = i === 0 ? '#f1c40f' : '#C9A84C';
            ctx.lineWidth = i === 0 ? 2 : 1;
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(7, 8 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(h.number), x, historyY);
            ctx.restore();
        }
    }

    // ── Chip Selector ──

    drawChipSelector(ctx, layout) {
        const { scale, width, chipStripY } = layout;
        const chipR = Math.max(18 * scale, layout.minTouch / 2);
        const gap = Math.max(50 * scale, layout.minTouch + 6);
        const startX = width / 2 - (CHIP_DENOMS.length - 1) * gap / 2;

        for (let i = 0; i < CHIP_DENOMS.length; i++) {
            const d = CHIP_DENOMS[i];
            const cx = startX + i * gap;
            const cy = chipStripY;
            const selected = d.value === this.selectedChip;

            ctx.save();
            if (selected) {
                ctx.shadowColor = '#f1c40f';
                ctx.shadowBlur = 14;
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

    // ── UI Buttons ──

    drawUI(ctx, layout) {
        const { scale, width, height, bottomY, portrait } = layout;
        const spinY = portrait ? bottomY - 5 * scale : bottomY;

        const spinBtnW = 80 * scale;
        const spinBtnH = Math.max(36 * scale, layout.minTouch);
        const spinX = width / 2;
        const btnSize = Math.max(32 * scale, layout.minTouch);
        const btnGap = 8 * scale;

        // Spin button
        const canSpin = this.state === 'BETTING' && this.bets.size > 0;
        const g = ctx.createLinearGradient(spinX - spinBtnW / 2, spinY - spinBtnH / 2, spinX + spinBtnW / 2, spinY + spinBtnH / 2);
        if (canSpin) {
            g.addColorStop(0, '#f1c40f');
            g.addColorStop(1, '#d35400');
        } else {
            g.addColorStop(0, '#555');
            g.addColorStop(1, '#333');
        }

        if (canSpin) {
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 12;
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(spinX - spinBtnW / 2, spinY - spinBtnH / 2, spinBtnW, spinBtnH, 8 * scale);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = canSpin ? '#000' : '#888';
        ctx.font = `bold ${Math.max(12, 14 * scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.state === 'SPINNING' ? 'SPINNING' : 'SPIN', spinX, spinY);

        // Helper for small buttons
        const drawSmallBtn = (x, label, enabled = true) => {
            ctx.fillStyle = enabled ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.roundRect(x, spinY - btnSize / 2, btnSize, btnSize, 4 * scale);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = enabled ? '#CCC' : '#666';
            ctx.font = `bold ${Math.max(7, 9 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x + btnSize / 2, spinY);
        };

        // CLR
        const clrX = spinX - spinBtnW / 2 - btnGap - btnSize;
        drawSmallBtn(clrX, 'CLR', this.state === 'BETTING' && this.bets.size > 0);

        // UNDO
        const undoX = clrX - btnGap - btnSize;
        drawSmallBtn(undoX, 'UNDO', this.state === 'BETTING' && this.undoStack.length > 0);

        // REBET
        const rebetX = spinX + spinBtnW / 2 + btnGap;
        drawSmallBtn(rebetX, 'RE', this.state === 'BETTING' && this.lastRoundBets && this.lastRoundBets.size > 0);

        // 2x
        const doubleX = rebetX + btnSize + btnGap;
        drawSmallBtn(doubleX, '2x', this.state === 'BETTING' && this.bets.size > 0);

        // Balance
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f1c40f';
        ctx.font = `bold ${Math.max(12, 14 * scale)}px Arial`;
        const balY = portrait ? bottomY + 20 * scale : spinY;
        ctx.fillText(`$${this.balance}`, 12 * scale, balY);

        // Total bet
        ctx.textAlign = 'right';
        ctx.fillStyle = '#AAA';
        ctx.font = `${Math.max(10, 12 * scale)}px Arial`;
        ctx.fillText(`BET: $${this.totalBet}`, width - 12 * scale, balY);

        // Win display
        if (this.winCounter > 0) {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f1c40f';
            ctx.font = `bold ${Math.max(18, 22 * scale)}px Arial`;
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 12;
            const winY = portrait ? layout.chipStripY - 22 * scale : layout.chipStripY - 32 * scale;
            ctx.fillText(`WIN $${this.winCounter}`, width / 2, winY);
            ctx.shadowBlur = 0;
        }

        // Racetrack toggle icon
        const rtBtnSize = Math.max(24 * scale, layout.minTouch);
        const rtX = portrait ? width - 30 * scale : layout.wheelCX + layout.wheelR - 10 * scale;
        const rtY = layout.historyY;
        ctx.fillStyle = this.showRacetrack ? 'rgba(241, 196, 15, 0.3)' : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(rtX, rtY, rtBtnSize / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.showRacetrack ? '#f1c40f' : '#999';
        ctx.font = `${Math.max(8, 10 * scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RT', rtX, rtY);

        // Stats toggle icon
        const stX = portrait ? width - 60 * scale : layout.wheelCX - layout.wheelR + 10 * scale;
        ctx.fillStyle = this.showStats ? 'rgba(241, 196, 15, 0.3)' : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(stX, rtY, rtBtnSize / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.showStats ? '#f1c40f' : '#999';
        ctx.fillText('ST', stX, rtY);
    }

    // ── Result Banner ──

    drawResultBanner(ctx, layout) {
        if (!this.resultBanner) return;
        const { number, color, timer, maxTimer } = this.resultBanner;
        const { width, height, scale } = layout;

        const fadeIn = Math.min(timer / 15, 1);
        const fadeOut = timer > maxTimer - 30 ? (maxTimer - timer) / 30 : 1;
        const alpha = fadeIn * fadeOut;
        if (alpha <= 0) return;

        const s = easeOutBack(Math.min(timer / 20, 1));
        const bannerW = 160 * scale * s;
        const bannerH = 60 * scale * s;
        const bx = width / 2;
        const by = layout.portrait ? layout.tableTop - 20 * scale : layout.wheelCY;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Banner background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.beginPath();
        ctx.roundRect(bx - bannerW / 2, by - bannerH / 2, bannerW, bannerH, 12 * scale);
        ctx.fill();

        // Border
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        // Number circle
        const circleR = 20 * scale * s;
        ctx.fillStyle = color === 'red' ? '#C0392B' : color === 'green' ? '#27AE60' : '#1a1a1a';
        ctx.beginPath();
        ctx.arc(bx, by, circleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Number text
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.max(16, 24 * scale * s)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(number), bx, by);

        ctx.restore();
    }

    // ── Racetrack Overlay ──

    drawRacetrack(ctx, layout) {
        const rt = this.getRacetrackLayout(layout);
        const { cx, cy, rx, ry, scale } = rt;

        // Dim background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx + 20, ry + 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw sectors
        const sectorAngle = (Math.PI * 2) / 37;
        for (let i = 0; i < 37; i++) {
            const num = WHEEL_NUMBERS[i];
            const startA = i * sectorAngle - Math.PI / 2;
            const endA = startA + sectorAngle;
            const midA = startA + sectorAngle / 2;
            const col = numberColor(num);

            // Outer track (for sectors)
            const innerRx = rx * 0.65;
            const innerRy = ry * 0.65;

            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, startA, endA);
            ctx.ellipse(cx, cy, innerRx, innerRy, 0, endA, startA, true);
            ctx.closePath();

            const isHovered = this.hoveredZone && this.hoveredZone.type === 'racetrack' && this.hoveredZone.idx === i;
            ctx.fillStyle = isHovered ? 'rgba(241, 196, 15, 0.4)' :
                col === 'red' ? 'rgba(192, 57, 43, 0.7)' :
                col === 'green' ? 'rgba(39, 174, 96, 0.7)' :
                'rgba(30, 30, 30, 0.7)';
            ctx.fill();
            ctx.strokeStyle = '#C9A84C';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Number label
            const labelRx = rx * 0.82;
            const labelRy = ry * 0.82;
            const lx = cx + Math.cos(midA) * labelRx;
            const ly = cy + Math.sin(midA) * labelRy;
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(6, 8 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(num), lx, ly);
        }

        // Call bet region labels
        const regions = [
            { key: 'voisins', angle: -Math.PI / 2, label: 'VOISINS' },
            { key: 'tiers', angle: Math.PI / 2, label: 'TIERS' },
            { key: 'orphelins', angle: 0, label: 'ORPH' },
            { key: 'jeu_zero', angle: -Math.PI / 2 - 0.3, label: 'ZERO' },
        ];

        ctx.font = `bold ${Math.max(6, 7 * scale)}px Arial`;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const r of regions) {
            const lx = cx + Math.cos(r.angle) * rx * 0.45;
            const ly = cy + Math.sin(r.angle) * ry * 0.45;
            ctx.fillText(r.label, lx, ly);
        }
    }

    // ── Stats Panel ──

    drawStatsPanel(ctx, layout) {
        if (this.history.length < 2) return;
        const { scale, width, height, portrait } = layout;

        const panelW = 140 * scale;
        const panelH = 180 * scale;
        const px = portrait ? 10 * scale : layout.tableLeft;
        const py = portrait ? layout.tableTop : layout.tableTop;

        // Panel background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.beginPath();
        ctx.roundRect(px, py, panelW, panelH, 8 * scale);
        ctx.fill();
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#f1c40f';
        ctx.font = `bold ${Math.max(9, 11 * scale)}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('STATISTICS', px + 8 * scale, py + 6 * scale);

        // Count occurrences
        const counts = {};
        for (let i = 0; i <= 36; i++) counts[i] = 0;
        for (const h of this.history) counts[h.number]++;

        // Hot numbers (top 5)
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const hot = sorted.slice(0, 5).filter(([, c]) => c > 0);
        const cold = sorted.filter(([, c]) => c === 0).slice(0, 5);
        if (cold.length < 5) {
            const lowHit = sorted.slice(-5).filter(([, c]) => c > 0);
            while (cold.length < 5 && lowHit.length > 0) cold.push(lowHit.shift());
        }

        let yOff = py + 24 * scale;
        ctx.fillStyle = '#E74C3C';
        ctx.font = `bold ${Math.max(8, 9 * scale)}px Arial`;
        ctx.fillText('HOT', px + 8 * scale, yOff);
        yOff += 14 * scale;

        ctx.font = `${Math.max(7, 8 * scale)}px Arial`;
        for (const [num, count] of hot) {
            const col = numberColor(Number(num));
            ctx.fillStyle = col === 'red' ? '#C0392B' : col === 'green' ? '#27AE60' : '#888';
            ctx.beginPath();
            ctx.arc(px + 16 * scale, yOff + 4 * scale, 5 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFF';
            ctx.font = `bold ${Math.max(5, 6 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(num, px + 16 * scale, yOff + 4 * scale + 1);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#CCC';
            ctx.font = `${Math.max(7, 8 * scale)}px Arial`;
            ctx.fillText(`x${count}`, px + 28 * scale, yOff + 2 * scale);
            yOff += 14 * scale;
        }

        yOff += 6 * scale;
        ctx.fillStyle = '#3498DB';
        ctx.font = `bold ${Math.max(8, 9 * scale)}px Arial`;
        ctx.fillText('COLD', px + 8 * scale, yOff);
        yOff += 14 * scale;

        ctx.font = `${Math.max(7, 8 * scale)}px Arial`;
        for (const [num, count] of cold) {
            const col = numberColor(Number(num));
            ctx.fillStyle = col === 'red' ? '#C0392B' : col === 'green' ? '#27AE60' : '#888';
            ctx.beginPath();
            ctx.arc(px + 16 * scale, yOff + 4 * scale, 5 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFF';
            ctx.font = `bold ${Math.max(5, 6 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(num, px + 16 * scale, yOff + 4 * scale + 1);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#CCC';
            ctx.font = `${Math.max(7, 8 * scale)}px Arial`;
            ctx.fillText(`x${count}`, px + 28 * scale, yOff + 2 * scale);
            yOff += 14 * scale;
        }

        // Red/Black ratio bar
        yOff += 6 * scale;
        const redCount = this.history.filter(h => h.color === 'red').length;
        const blackCount = this.history.filter(h => h.color === 'black').length;
        const greenCount = this.history.filter(h => h.color === 'green').length;
        const total = this.history.length || 1;
        const barW = panelW - 16 * scale;
        const barH = 8 * scale;
        const barX = px + 8 * scale;

        ctx.fillStyle = '#C0392B';
        ctx.fillRect(barX, yOff, barW * (redCount / total), barH);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(barX + barW * (redCount / total), yOff, barW * (blackCount / total), barH);
        ctx.fillStyle = '#27AE60';
        ctx.fillRect(barX + barW * ((redCount + blackCount) / total), yOff, barW * (greenCount / total), barH);
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, yOff, barW, barH);
    }

    // ── Big Win Overlay ──

    drawBigWin(ctx, width, height) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, width, height);

        const s = 1 + Math.sin(Date.now() / 150) * 0.15;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(s, s);

        ctx.shadowColor = '#f1c40f';
        ctx.shadowBlur = 40;
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 60px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BIG WIN!', 0, -50);

        ctx.shadowColor = 'white';
        ctx.shadowBlur = 20;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 80px monospace';
        ctx.fillText(`$${this.winCounter}`, 0, 60);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Particles
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Tap to continue
        const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.6})`;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Tap to continue', width / 2, height - 60);
    }

    // ── Vignette ──

    drawVignette(ctx, w, h) {
        const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, w, h);
    }
}
