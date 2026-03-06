const DEFAULTS = {
    gridCols: 5,
    gridRows: 5,
    bombCount: 6,
    maxPicks: 10,
    minPrize: 100,
    maxPrize: 500,
    bombPenalty: 0.10,
    megaBombLastPicks: 3,
    megaBombChance: 0.5,
};

const C = {
    blue: '#2B4CFF',
    darkBlue: '#0B2595',
    sky: '#00B3FF',
    green: '#42D484',
    yellow: '#FFDF00',
    pink: '#FF63F6',
    white: '#FFFFFF',
    dim: 'rgba(255,255,255,0.6)',
    veryDim: 'rgba(255,255,255,0.3)',
    faint: 'rgba(255,255,255,0.1)',
};

const SOUNDS = {
    safe: '/sounds/money.mp3',
    bomb: '/sounds/ack.mp3',
    megaBomb: '/sounds/bomb.mp3',
    win: '/sounds/yay.mp3',
    lose: '/sounds/lose-some.mp3',
};

const IMAGES = {
    logo: '/logo/mrq.casino.png',
    diamond: '/icons/diamond-sticker.png',
    crown: '/icons/crown-sticker.png',
    seven: '/icons/7-sticker.png',
    cherries: '/icons/cherries-sticker.png',
    clover: '/icons/clover-sticker.png',
    lightning: '/icons/lightning-sticker.png',
    xFace: '/icons/x-face-sticker.png',
    sad: '/icons/sad-sticker.png',
};

const BG_ICONS = ['diamond', 'crown', 'seven', 'cherries', 'clover', 'lightning'];

const ASSET_TO_IMG = {
    'quickie-safe': 'diamond',
    'quickie-bomb': 'xFace',
    'quickie-mega': 'sad',
    'quickie-diamond': 'diamond',
    'quickie-crown': 'crown',
    'quickie-seven': 'seven',
    'quickie-cherries': 'cherries',
    'quickie-clover': 'clover',
    'quickie-lightning': 'lightning',
    'quickie-xface': 'xFace',
    'quickie-sad': 'sad',
    'quickie-logo': 'logo',
};

function easeOutBack(t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randInt(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

export class QuickieDropScene {
    audioManager = null;
    setAudioManager(am) { this.audioManager = am; }

    constructor(config) {
        this.config = config || {};
        this.game = null;

        const m = config?.quickieMaths || {};
        this.maths = { ...DEFAULTS, ...m };
        this.GRID_SIZE = this.maths.gridCols * this.maths.gridRows;

        this.imgs = {};

        this._audioBuffers = new Map();
        this._audioCtx = null;

        this.state = 'INTRO';
        this.prize = 0;
        this.startingPrize = 0;
        this.picksMade = 0;
        this.bombsHit = 0;
        this.megaBombHit = false;
        this.roundOver = false;
        this.bombs = [];
        this.megaBomb = -1;

        this.cells = [];
        this.pendingCell = -1;
        this.revealTimer = 0;

        this.cellScales = [];
        this.hoveredCell = -1;
        this.screenShake = 0;
        this.flashTimer = 0;
        this.flashType = null;
        this.moneyLostAnim = null;
        this.particles = [];
        this.confetti = [];
        this.displayPrize = 0;
        this.message = '';
        this.messageColor = C.dim;
        this.messageTimer = 0;
        this.pulseTimer = 0;
        this.resultAlpha = 0;
        this.resultScale = 0;

        this.bgIcons = [];
        this._initBgIcons();
    }

    _initBgIcons() {
        this.bgIcons = BG_ICONS.map((key, i) => ({
            key,
            relX: 0.05 + (i % 3) * 0.35 + Math.random() * 0.15,
            relY: 0.08 + Math.floor(i / 3) * 0.35 + Math.random() * 0.15,
            phase: Math.random() * Math.PI * 2,
            speed: 1.5 + Math.random() * 1.5,
            size: 40 + Math.random() * 20,
            alpha: 0.45 + Math.random() * 0.15,
        }));
    }

    _loadImg(key, src) {
        if (!this._imgVersions) this._imgVersions = {};
        const version = (this._imgVersions[key] || 0) + 1;
        this._imgVersions[key] = version;

        const img = new Image();
        img.onload = () => {
            if (this._imgVersions[key] === version) {
                this.imgs[key] = img;
            }
        };
        img.onerror = () => { /* silent */ };
        img.src = src;
    }

    _loadAllImages() {
        const overrides = {};
        const custom = this.config.customAssets;
        if (custom) {
            for (const [assetId, value] of Object.entries(custom)) {
                const imgKey = ASSET_TO_IMG[assetId];
                if (imgKey && value && (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http'))) {
                    overrides[imgKey] = value;
                }
            }
        }

        for (const [key, defaultSrc] of Object.entries(IMAGES)) {
            this._loadImg(key, overrides[key] || defaultSrc);
        }
    }

    _drawImg(ctx, key, x, y, w, h, alpha) {
        const img = this.imgs[key];
        if (!img) return;
        if (alpha !== undefined) ctx.globalAlpha = alpha;
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
        if (alpha !== undefined) ctx.globalAlpha = 1;
    }

    _getAudioCtx() {
        if (!this._audioCtx) {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
        return this._audioCtx;
    }

    async _loadSound(id, src) {
        if (this._audioBuffers.has(id) || !src) return;
        try {
            const resp = await fetch(src);
            const ab = await resp.arrayBuffer();
            const buf = await this._getAudioCtx().decodeAudioData(ab);
            this._audioBuffers.set(id, buf);
        } catch (e) { /* silent */ }
    }

    _playSound(id, vol = 0.7) {
        if (this.audioManager) {
            this.audioManager.ensureContext?.();
            if (this.audioManager.customAudio?.[id]) {
                this.audioManager.play(id);
                return;
            }
        }

        const buf = this._audioBuffers.get(id);
        if (!buf) return;
        try {
            const ctx = this._getAudioCtx();
            const source = ctx.createBufferSource();
            const gain = ctx.createGain();
            source.buffer = buf;
            gain.gain.value = vol;
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start(0);
        } catch (e) { /* silent */ }
    }

    _playClick() {
        if (this.audioManager) {
            this.audioManager.play?.('buttonClick');
            return;
        }
        try {
            const ctx = this._getAudioCtx();
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine'; osc.frequency.value = 800;
            g.gain.setValueAtTime(0.2, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.1);
        } catch (e) { /* silent */ }
    }

    _preloadSounds() {
        for (const [id, src] of Object.entries(SOUNDS)) {
            if (src) this._loadSound(id, src);
        }
    }

    enter(game) {
        this.game = game;
        this._inputDown = (m) => this.handleClick(m);
        this._inputMove = (m) => this.handleMove(m);
        this.game.input.on('down', this._inputDown);
        this.game.input.on('move', this._inputMove);
        this._loadAllImages();
        this._preloadSounds();
    }

    exit() {
        if (this.game) {
            this.game.input.off('down', this._inputDown);
            this.game.input.off('move', this._inputMove);
        }
    }

    getUsedAssets() {
        return [
            { type: 'icon', id: 'quickie-safe', name: 'Safe Tile Icon', color: C.green, glyph: '💎', current: this.config.customAssets?.['quickie-safe'] || null },
            { type: 'icon', id: 'quickie-bomb', name: 'Bomb Icon', color: '#EF4444', glyph: '💣', current: this.config.customAssets?.['quickie-bomb'] || null },
            { type: 'icon', id: 'quickie-mega', name: 'Mega Bomb Icon', color: C.pink, glyph: '💀', current: this.config.customAssets?.['quickie-mega'] || null },
            { type: 'decoration', id: 'quickie-diamond', name: 'Diamond Sticker', color: C.sky, glyph: '💎', current: this.config.customAssets?.['quickie-diamond'] || null },
            { type: 'decoration', id: 'quickie-crown', name: 'Crown Sticker', color: C.yellow, glyph: '👑', current: this.config.customAssets?.['quickie-crown'] || null },
            { type: 'decoration', id: 'quickie-seven', name: '7 Sticker', color: '#EF4444', glyph: '7', current: this.config.customAssets?.['quickie-seven'] || null },
            { type: 'decoration', id: 'quickie-cherries', name: 'Cherries Sticker', color: '#EF4444', glyph: '🍒', current: this.config.customAssets?.['quickie-cherries'] || null },
            { type: 'decoration', id: 'quickie-clover', name: 'Clover Sticker', color: C.green, glyph: '🍀', current: this.config.customAssets?.['quickie-clover'] || null },
            { type: 'decoration', id: 'quickie-lightning', name: 'Lightning Sticker', color: C.yellow, glyph: '⚡', current: this.config.customAssets?.['quickie-lightning'] || null },
            { type: 'decoration', id: 'quickie-xface', name: 'X Face Sticker', color: '#EF4444', glyph: '😵', current: this.config.customAssets?.['quickie-xface'] || null },
            { type: 'decoration', id: 'quickie-sad', name: 'Sad Sticker', color: C.pink, glyph: '😢', current: this.config.customAssets?.['quickie-sad'] || null },
            { type: 'background', id: 'quickie-logo', name: 'Logo', color: C.blue, glyph: 'MrQ', current: this.config.customAssets?.['quickie-logo'] || null },
        ];
    }

    _generateBombs() {
        const set = new Set();
        while (set.size < this.maths.bombCount) set.add(randInt(0, this.GRID_SIZE - 1));
        return Array.from(set);
    }

    _generateMegaBomb(bombs) {
        let m;
        do { m = randInt(0, this.GRID_SIZE - 1); } while (bombs.includes(m));
        return m;
    }

    startGame() {
        this.bombs = this._generateBombs();
        this.megaBomb = this._generateMegaBomb(this.bombs);
        this.prize = randInt(this.maths.minPrize, this.maths.maxPrize);
        this.startingPrize = this.prize;
        this.displayPrize = this.prize;
        this.picksMade = 0;
        this.bombsHit = 0;
        this.megaBombHit = false;
        this.roundOver = false;
        this.cells = new Array(this.GRID_SIZE).fill(null);
        this.pendingCell = -1;
        this.cellScales = new Array(this.GRID_SIZE).fill(1);
        this.particles = [];
        this.confetti = [];
        this.screenShake = 0;
        this.flashTimer = 0;
        this.flashType = null;
        this.moneyLostAnim = null;
        this.resultAlpha = 0;
        this.resultScale = 0;
        this.state = 'PLAYING';
        this._setMsg('Pick a tile to reveal!', C.dim);
        this._playClick();
    }

    pickCell(idx) {
        if (this.state !== 'PLAYING' || this.cells[idx] !== null || this.pendingCell >= 0) return;
        this.pendingCell = idx;
        this.revealTimer = 0.35;
        this.state = 'REVEALING';
        this._setMsg('Revealing...', C.dim);
        this._playClick();
    }

    revealCell(idx) {
        let isBomb = this.bombs.includes(idx);
        let isMega = idx === this.megaBomb;
        this.picksMade++;

        const megaThreshold = this.maths.maxPicks - this.maths.megaBombLastPicks + 1;
        if (this.picksMade >= megaThreshold && !isBomb && !isMega && !this.megaBombHit) {
            if (Math.random() < this.maths.megaBombChance) {
                isMega = true;
                this.megaBomb = idx;
            }
        }

        if (isMega) {
            this.cells[idx] = 'mega';
            this.megaBombHit = true;
            this.prize = 0;
            this.roundOver = true;
            this._setMsg('MEGA BOMB! You lose everything!', '#EF4444');
            this.screenShake = 1.2;
            this.flashType = 'mega';
            this.flashTimer = 1.0;
            this.moneyLostAnim = { amount: this.startingPrize, timer: 2.0 };
            this._spawnExplosion(idx, 30, C.pink);
            this._playSound('megaBomb', 0.8);
        } else if (isBomb) {
            this.cells[idx] = 'bomb';
            this.bombsHit++;
            const lost = Math.floor(this.prize * this.maths.bombPenalty);
            this.prize = Math.max(0, this.prize - lost);
            this._setMsg(`BOOM! -£${lost}`, '#EF4444');
            this.screenShake = 0.6;
            this.flashType = 'bomb';
            this.flashTimer = 0.6;
            this.moneyLostAnim = { amount: lost, timer: 1.5 };
            this._spawnExplosion(idx, 15, '#EF4444');
            this._playSound('bomb', 0.8);
        } else {
            this.cells[idx] = 'safe';
            this._setMsg('Safe!', C.green);
            this.cellScales[idx] = 1.3;
            this._spawnSparkle(idx, 10, C.green);
            this._playSound('safe', 0.7);
        }

        if (this.picksMade >= this.maths.maxPicks) this.roundOver = true;
        this.pendingCell = -1;

        if (this.roundOver) {
            this.state = 'RESULT';
            if (this.megaBombHit) {
                this._playSound('lose', 0.7);
            } else {
                setTimeout(() => {
                    this._spawnConfetti(60);
                    this._playSound('win', 0.8);
                }, 600);
            }
        } else {
            this.state = 'PLAYING';
        }
    }

    _setMsg(msg, color) {
        this.message = msg;
        this.messageColor = color || C.dim;
        this.messageTimer = 0;
    }

    _cellCenter(idx, layout) {
        const col = idx % this.maths.gridCols;
        const row = Math.floor(idx / this.maths.gridCols);
        return {
            x: layout.gridX + layout.cellGap + col * (layout.cellSize + layout.cellGap) + layout.cellSize / 2,
            y: layout.gridY + layout.cellGap + row * (layout.cellSize + layout.cellGap) + layout.cellSize / 2,
        };
    }

    _cellRect(idx, layout) {
        const col = idx % this.maths.gridCols;
        const row = Math.floor(idx / this.maths.gridCols);
        return {
            x: layout.gridX + layout.cellGap + col * (layout.cellSize + layout.cellGap),
            y: layout.gridY + layout.cellGap + row * (layout.cellSize + layout.cellGap),
            w: layout.cellSize, h: layout.cellSize,
        };
    }

    _spawnExplosion(idx, count, color) {
        const layout = this._getLayout();
        const pos = this._cellCenter(idx, layout);
        for (let i = 0; i < count; i++) {
            const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const spd = 50 + Math.random() * 150;
            this.particles.push({ x: pos.x, y: pos.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.6 + Math.random() * 0.6, maxLife: 0.6 + Math.random() * 0.6, size: 2 + Math.random() * 4, color });
        }
    }

    _spawnSparkle(idx, count, color) {
        const layout = this._getLayout();
        const pos = this._cellCenter(idx, layout);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 20 + Math.random() * 60;
            this.particles.push({ x: pos.x, y: pos.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 30, life: 0.4 + Math.random() * 0.4, maxLife: 0.4 + Math.random() * 0.4, size: 1.5 + Math.random() * 3, color });
        }
    }

    _spawnConfetti(count) {
        const layout = this._getLayout();
        const colors = [C.yellow, C.green, C.sky, C.pink, '#A855F7', C.blue];
        for (let i = 0; i < count; i++) {
            this.confetti.push({
                x: Math.random() * layout.width, y: -10 - Math.random() * 100,
                vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120,
                life: 2.5 + Math.random() * 2, maxLife: 2.5 + Math.random() * 2,
                size: 4 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                rot: Math.random() * Math.PI * 2, rotSpd: (Math.random() - 0.5) * 8,
            });
        }
    }

    _getLayout() {
        if (!this.game) return { width: 400, height: 700, portrait: true, scale: 1, gridX: 20, gridY: 260, gridW: 360, gridH: 360, cellSize: 60, cellGap: 6, headerY: 10, prizeY: 40, messageY: 220 };
        const { width, height } = this.game.renderer;
        const portrait = height > width || width < 500;
        const scale = portrait ? width / 400 : Math.min(width / 700, height / 500);

        const gridMaxW = portrait ? width - 20 * scale : width * 0.55;
        const gridMaxH = portrait ? height * 0.44 : height - 180 * scale;
        const gridFit = Math.min(gridMaxW, gridMaxH);
        const cellGap = 6 * scale;
        const cellSize = (gridFit - cellGap * (this.maths.gridCols + 1)) / this.maths.gridCols;
        const gridW = cellSize * this.maths.gridCols + cellGap * (this.maths.gridCols + 1);
        const gridH = cellSize * this.maths.gridRows + cellGap * (this.maths.gridRows + 1);

        let headerY, prizeY, messageY, gridX, gridY;
        if (portrait) {
            headerY = 8 * scale;
            prizeY = 36 * scale;
            messageY = prizeY + 108 * scale;
            gridX = (width - gridW) / 2;
            gridY = messageY + 28 * scale;
        } else {
            headerY = 8 * scale;
            prizeY = 28 * scale;
            messageY = prizeY + 100 * scale;
            gridX = (width - gridW) / 2;
            gridY = messageY + 26 * scale;
        }

        return { width, height, portrait, scale, gridX, gridY, gridW, gridH, cellSize, cellGap, headerY, prizeY, messageY };
    }

    _hitCell(mx, my, layout) {
        for (let i = 0; i < this.GRID_SIZE; i++) {
            const r = this._cellRect(i, layout);
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i;
        }
        return -1;
    }

    handleClick(mouse) {
        const L = this._getLayout();
        const mx = mouse.x, my = mouse.y;

        if (this.state === 'INTRO') {
            const bw = 180 * L.scale, bh = 50 * L.scale;
            const bx = (L.width - bw) / 2, by = L.height * 0.72;
            if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) this.startGame();
            return;
        }
        if (this.state === 'PLAYING') {
            const c = this._hitCell(mx, my, L);
            if (c >= 0) this.pickCell(c);
            return;
        }
        if (this.state === 'RESULT' && this.resultAlpha > 0.5) {
            const bw = 200 * L.scale, bh = 48 * L.scale;
            const bx = (L.width - bw) / 2, by = L.height / 2 + 100 * L.scale;
            if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) this.startGame();
        }
    }

    handleMove(mouse) {
        const L = this._getLayout();
        this.hoveredCell = this.state === 'PLAYING' ? this._hitCell(mouse.x, mouse.y, L) : -1;
    }

    update(dt) {
        const s = Math.min(dt, 0.05);
        this.pulseTimer += s;
        this.messageTimer += s;

        if (this.state === 'REVEALING') {
            this.revealTimer -= s;
            if (this.revealTimer <= 0) this.revealCell(this.pendingCell);
        }
        if (this.state === 'RESULT') {
            this.resultAlpha = clamp(this.resultAlpha + s * 2.5, 0, 1);
            this.resultScale = clamp(this.resultScale + s * 4, 0, 1);
        }
        if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - s * 3);
        if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - s);
        if (this.moneyLostAnim) { this.moneyLostAnim.timer -= s; if (this.moneyLostAnim.timer <= 0) this.moneyLostAnim = null; }

        // Prize tick
        if (this.displayPrize !== this.prize) {
            const d = this.prize - this.displayPrize;
            const step = Math.ceil(Math.abs(d) * s * 10);
            this.displayPrize = Math.abs(d) <= step ? this.prize : this.displayPrize + Math.sign(d) * step;
        }

        // Cell spring
        for (let i = 0; i < this.GRID_SIZE; i++) {
            if (this.cellScales[i] && this.cellScales[i] !== 1) {
                this.cellScales[i] = lerp(this.cellScales[i], 1, s * 6);
                if (Math.abs(this.cellScales[i] - 1) < 0.01) this.cellScales[i] = 1;
            }
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * s; p.y += p.vy * s; p.vy += 200 * s; p.life -= s;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.confetti.length - 1; i >= 0; i--) {
            const c = this.confetti[i];
            c.x += c.vx * s; c.y += c.vy * s; c.rot += c.rotSpd * s; c.life -= s;
            if (c.life <= 0) this.confetti.splice(i, 1);
        }
    }

    render(ctx) {
        const L = this._getLayout();
        const { width, height, scale } = L;

        let sx = 0, sy = 0;
        if (this.screenShake > 0) {
            sx = (Math.random() - 0.5) * this.screenShake * 16;
            sy = (Math.random() - 0.5) * this.screenShake * 16;
        }
        ctx.save();
        ctx.translate(sx, sy);

        // Background gradient
        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, C.darkBlue);
        bg.addColorStop(0.5, C.blue);
        bg.addColorStop(1, C.darkBlue);
        ctx.fillStyle = bg;
        ctx.fillRect(-10, -10, width + 20, height + 20);

        // Floating background icons
        for (const icon of this.bgIcons) {
            const bounce = Math.sin(this.pulseTimer * icon.speed + icon.phase) * 10;
            const ix = icon.relX * width;
            const iy = icon.relY * height + bounce;
            this._drawImg(ctx, icon.key, ix, iy, icon.size * scale * 0.7, icon.size * scale * 0.7, icon.alpha);
        }

        // Flash overlay
        if (this.flashTimer > 0) {
            const fa = this.flashTimer * (this.flashType === 'mega' ? 0.7 : 0.5);
            ctx.fillStyle = this.flashType === 'mega' ? `rgba(127,29,29,${fa})` : `rgba(220,38,38,${fa})`;
            ctx.fillRect(0, 0, width, height);
        }

        if (this.state === 'INTRO') {
            this._renderIntro(ctx, L);
        } else {
            this._renderGame(ctx, L);
        }

        // Particles
        for (const p of this.particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Confetti
        for (const c of this.confetti) {
            ctx.globalAlpha = c.life / c.maxLife;
            ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
            ctx.restore();
        }
        ctx.globalAlpha = 1;

        // Money lost floating text
        if (this.moneyLostAnim) {
            const t = 1 - this.moneyLostAnim.timer / 2.0;
            ctx.globalAlpha = clamp(1 - t, 0, 1);
            ctx.fillStyle = '#EF4444';
            ctx.font = `900 ${Math.round(36 * scale)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(239,68,68,0.8)';
            ctx.shadowBlur = 30;
            ctx.fillText(`-£${this.moneyLostAnim.amount}`, width / 2, height * 0.33 - t * 80);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        // Result overlay
        if (this.state === 'RESULT' && this.resultAlpha > 0) this._renderResult(ctx, L);

        ctx.restore();
    }

    _renderIntro(ctx, L) {
        const { width, height, scale } = L;
        ctx.textAlign = 'center';

        // Logo
        this._drawImg(ctx, 'logo', width / 2, height * 0.12, 180 * scale, 72 * scale);

        // Title
        ctx.fillStyle = C.white;
        ctx.font = `900 ${Math.round(32 * scale)}px system-ui, sans-serif`;
        ctx.fillText('QUICKIE', width / 2, height * 0.24);

        ctx.fillStyle = C.yellow;
        ctx.font = `900 ${Math.round(44 * scale)}px system-ui, sans-serif`;
        ctx.shadowColor = 'rgba(255,223,0,0.5)';
        ctx.shadowBlur = 30;
        ctx.fillText('DROP', width / 2, height * 0.24 + 46 * scale);
        ctx.shadowBlur = 0;

        // Rules card
        const cw = Math.min(300 * scale, width - 32);
        const ch = 210 * scale;
        const cx = (width - cw) / 2;
        const cy = height * 0.36;

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        this._rr(ctx, cx, cy, cw, ch, 16 * scale); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        this._rr(ctx, cx, cy, cw, ch, 16 * scale); ctx.stroke();

        ctx.fillStyle = C.yellow;
        ctx.font = `bold ${Math.round(14 * scale)}px system-ui, sans-serif`;
        ctx.fillText('How to Play', width / 2, cy + 26 * scale);

        // Rules
        const rules = [
            { icon: 'crown', text: `Win £${this.maths.minPrize}-£${this.maths.maxPrize} random prize!` },
            { icon: 'diamond', text: `Pick ${this.maths.maxPicks} tiles from ${this.maths.gridCols}x${this.maths.gridRows} grid` },
            { icon: 'xFace', text: `${this.maths.bombCount} bombs take ${Math.round(this.maths.bombPenalty * 100)}% of prize` },
            { icon: 'sad', text: '1 MEGA BOMB = lose 100%!' },
            { icon: 'lightning', text: `Last ${this.maths.megaBombLastPicks} picks: ${Math.round(this.maths.megaBombChance * 100)}/${Math.round((1 - this.maths.megaBombChance) * 100)} mega bomb!` },
        ];

        const iconS = 22 * scale;
        const ruleStartY = cy + 50 * scale;
        rules.forEach((r, i) => {
            const ry = ruleStartY + i * 30 * scale;
            this._drawImg(ctx, r.icon, cx + 20 * scale, ry, iconS, iconS);
            ctx.textAlign = 'left';
            ctx.fillStyle = C.white;
            ctx.font = `${Math.round(12 * scale)}px system-ui, sans-serif`;
            ctx.fillText(r.text, cx + 36 * scale, ry + 4 * scale);
        });

        // PLAY NOW button
        ctx.textAlign = 'center';
        const bw = 180 * scale, bh = 50 * scale;
        const bx = (width - bw) / 2, by = height * 0.72;
        ctx.shadowColor = 'rgba(255,223,0,0.4)';
        ctx.shadowBlur = 40;
        ctx.fillStyle = C.yellow;
        this._rr(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = C.darkBlue;
        ctx.font = `900 ${Math.round(20 * scale)}px system-ui, sans-serif`;
        ctx.fillText('PLAY NOW', width / 2, by + bh / 2 + 7 * scale);
    }

    _renderGame(ctx, L) {
        const { width, scale, gridX, gridY, gridW, gridH } = L;

        // Header
        this._drawImg(ctx, 'logo', 50 * scale, L.headerY + 16 * scale, 80 * scale, 32 * scale);
        ctx.textAlign = 'right';
        ctx.fillStyle = C.veryDim;
        ctx.font = `${Math.round(9 * scale)}px system-ui, sans-serif`;
        ctx.fillText('QUICKIE', width - 12 * scale, L.headerY + 12 * scale);
        ctx.fillStyle = C.yellow;
        ctx.font = `900 ${Math.round(14 * scale)}px system-ui, sans-serif`;
        ctx.fillText('DROP', width - 12 * scale, L.headerY + 28 * scale);

        // Prize panel
        const pw = width - 18 * scale, ph = 100 * scale;
        const px = 9 * scale, py = L.prizeY;
        const pg = ctx.createLinearGradient(px, py, px + pw, py);
        pg.addColorStop(0, C.darkBlue); pg.addColorStop(0.5, C.blue); pg.addColorStop(1, C.darkBlue);
        ctx.fillStyle = pg;
        this._rr(ctx, px, py, pw, ph, 14 * scale); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        this._rr(ctx, px, py, pw, ph, 14 * scale); ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = C.veryDim;
        ctx.font = `${Math.round(9 * scale)}px system-ui, sans-serif`;
        ctx.fillText('YOUR PRIZE', width / 2, py + 16 * scale);

        // Prize amount
        const prizeCol = this.displayPrize >= this.startingPrize * 0.5 ? C.yellow : '#EF4444';
        ctx.fillStyle = prizeCol;
        ctx.shadowColor = prizeCol === C.yellow ? 'rgba(255,223,0,0.5)' : 'rgba(239,68,68,0.4)';
        ctx.shadowBlur = 20;
        ctx.font = `900 ${Math.round(38 * scale)}px system-ui, sans-serif`;
        ctx.fillText(`£${this.displayPrize}`, width / 2, py + 50 * scale);
        ctx.shadowBlur = 0;

        // Stats row
        const sy = py + 72 * scale;
        const tw = pw / 3;

        ctx.fillStyle = C.veryDim;
        ctx.font = `${Math.round(8 * scale)}px system-ui, sans-serif`;
        ctx.fillText('PICKS LEFT', px + tw * 0.5, sy);
        ctx.fillStyle = C.sky;
        ctx.font = `900 ${Math.round(18 * scale)}px system-ui, sans-serif`;
        ctx.fillText(`${this.maths.maxPicks - this.picksMade}`, px + tw * 0.5, sy + 18 * scale);

        ctx.fillStyle = C.veryDim;
        ctx.font = `${Math.round(8 * scale)}px system-ui, sans-serif`;
        ctx.fillText('BOMBS HIT', px + tw * 1.5, sy);
        ctx.fillStyle = '#EF4444';
        ctx.font = `900 ${Math.round(18 * scale)}px system-ui, sans-serif`;
        ctx.fillText(`${this.bombsHit}`, px + tw * 1.5, sy + 18 * scale);

        ctx.fillStyle = C.veryDim;
        ctx.font = `${Math.round(8 * scale)}px system-ui, sans-serif`;
        ctx.fillText('PROGRESS', px + tw * 2.5, sy);
        ctx.fillStyle = C.white;
        ctx.font = `900 ${Math.round(18 * scale)}px system-ui, sans-serif`;
        ctx.fillText(`${this.picksMade}/${this.maths.maxPicks}`, px + tw * 2.5, sy + 18 * scale);

        // Progress bar
        const barY = py + ph - 10 * scale;
        const barH = 5 * scale;
        ctx.fillStyle = C.darkBlue;
        this._rr(ctx, px + 10 * scale, barY, pw - 20 * scale, barH, barH / 2); ctx.fill();
        const prog = this.picksMade / this.maths.maxPicks;
        if (prog > 0) {
            const gb = ctx.createLinearGradient(px + 10 * scale, barY, px + 10 * scale + (pw - 20 * scale) * prog, barY);
            gb.addColorStop(0, C.green); gb.addColorStop(1, C.sky);
            ctx.fillStyle = gb;
            this._rr(ctx, px + 10 * scale, barY, (pw - 20 * scale) * prog, barH, barH / 2); ctx.fill();
        }

        // Status message
        ctx.fillStyle = this.messageColor;
        ctx.font = `bold ${Math.round(15 * scale)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        const msgPulse = this.message.includes('BOOM') || this.message.includes('MEGA') ? 0.5 + Math.sin(this.pulseTimer * 6) * 0.5 : 1;
        ctx.globalAlpha = clamp(msgPulse, 0.4, 1);
        ctx.fillText(this.message, width / 2, L.messageY + 12 * scale);
        ctx.globalAlpha = 1;

        // Grid container
        ctx.fillStyle = 'rgba(11,37,149,0.5)';
        this._rr(ctx, gridX - 6 * scale, gridY - 6 * scale, gridW + 12 * scale, gridH + 12 * scale, 16 * scale); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        this._rr(ctx, gridX - 6 * scale, gridY - 6 * scale, gridW + 12 * scale, gridH + 12 * scale, 16 * scale); ctx.stroke();

        // Cells
        for (let i = 0; i < this.GRID_SIZE; i++) this._renderCell(ctx, i, L);
    }

    _renderCell(ctx, idx, L) {
        const r = this._cellRect(idx, L);
        const st = this.cells[idx];
        const isPending = idx === this.pendingCell;
        const isHover = idx === this.hoveredCell && st === null && !isPending;
        const sc = (this.cellScales[idx] || 1) + (isHover ? 0.05 : 0) + (st === null ? Math.sin(this.pulseTimer * 2 + idx * 0.3) * 0.02 : 0);
        const cr = 10 * L.scale;
        const iconSize = r.w * 0.55;

        ctx.save();
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);

        if (isPending) {
            ctx.fillStyle = C.yellow;
            ctx.globalAlpha = 0.7 + Math.sin(this.pulseTimer * 10) * 0.3;
            this._rr(ctx, r.x, r.y, r.w, r.h, cr); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = C.darkBlue;
            ctx.lineWidth = 3 * L.scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(cx, cy, 10 * L.scale, this.pulseTimer * 8, this.pulseTimer * 8 + Math.PI * 1.2);
            ctx.stroke();
        } else if (st === 'mega') {
            const mg = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
            mg.addColorStop(0, '#7C3AED'); mg.addColorStop(1, C.pink);
            ctx.fillStyle = mg;
            this._rr(ctx, r.x, r.y, r.w, r.h, cr); ctx.fill();
            ctx.shadowColor = 'rgba(255,99,246,0.5)'; ctx.shadowBlur = 12;
            ctx.strokeStyle = C.pink; ctx.lineWidth = 2;
            this._rr(ctx, r.x, r.y, r.w, r.h, cr); ctx.stroke();
            ctx.shadowBlur = 0;
            this._drawImg(ctx, 'sad', cx, cy, iconSize, iconSize);
        } else if (st === 'bomb') {
            const bg = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
            bg.addColorStop(0, '#991B1B'); bg.addColorStop(1, '#EF4444');
            ctx.fillStyle = bg;
            this._rr(ctx, r.x, r.y, r.w, r.h, cr); ctx.fill();
            ctx.shadowColor = 'rgba(239,68,68,0.5)'; ctx.shadowBlur = 10;
            ctx.strokeStyle = '#FCA5A5'; ctx.lineWidth = 2;
            this._rr(ctx, r.x, r.y, r.w, r.h, cr); ctx.stroke();
            ctx.shadowBlur = 0;
            this._drawImg(ctx, 'xFace', cx, cy, iconSize, iconSize);
        } else if (st === 'safe') {
            const sg = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
            sg.addColorStop(0, C.green); sg.addColorStop(1, '#34D399');
            ctx.fillStyle = sg;
            this._rr(ctx, r.x, r.y, r.w, r.h, cr); ctx.fill();
            ctx.shadowColor = 'rgba(66,212,132,0.5)'; ctx.shadowBlur = 10;
            ctx.strokeStyle = C.green; ctx.lineWidth = 2;
            this._rr(ctx, r.x, r.y, r.w, r.h, cr); ctx.stroke();
            ctx.shadowBlur = 0;
            this._drawImg(ctx, 'diamond', cx, cy, iconSize, iconSize);
        } else {
            // Hidden tile
            const hg = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
            hg.addColorStop(0, 'rgba(0,179,255,0.2)'); hg.addColorStop(1, C.blue);
            ctx.fillStyle = hg;
            this._rr(ctx, r.x, r.y, r.w, r.h, cr); ctx.fill();
            ctx.strokeStyle = isHover ? C.yellow : 'rgba(0,179,255,0.5)';
            ctx.lineWidth = isHover ? 2 : 1;
            this._rr(ctx, r.x, r.y, r.w, r.h, cr); ctx.stroke();
            // Inner highlight
            ctx.fillStyle = `rgba(255,255,255,${isHover ? 0.18 : 0.08})`;
            const qs = r.w * 0.25;
            this._rr(ctx, cx - qs / 2, cy - qs / 2, qs, qs, 3 * L.scale); ctx.fill();
        }

        ctx.restore();
    }

    _renderResult(ctx, L) {
        const { width, height, scale } = L;

        ctx.fillStyle = `rgba(0,0,0,${this.resultAlpha * 0.8})`;
        ctx.fillRect(0, 0, width, height);

        const s = easeOutBack(clamp(this.resultScale, 0, 1));
        const cw = Math.min(300 * scale, width - 28);
        const ch = 300 * scale;
        const cx = (width - cw) / 2;
        const cy = (height - ch) / 2 - 10 * scale;

        ctx.save();
        ctx.translate(width / 2, height / 2 - 10 * scale);
        ctx.scale(s, s);
        ctx.translate(-width / 2, -(height / 2 - 10 * scale));
        ctx.globalAlpha = this.resultAlpha;

        // Card
        const cg = ctx.createLinearGradient(cx, cy, cx, cy + ch);
        cg.addColorStop(0, C.blue); cg.addColorStop(1, C.darkBlue);
        ctx.fillStyle = cg;
        this._rr(ctx, cx, cy, cw, ch, 24 * scale); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        this._rr(ctx, cx, cy, cw, ch, 24 * scale); ctx.stroke();

        ctx.textAlign = 'center';
        const iconY = cy + 50 * scale;
        const titleY = cy + 90 * scale;
        const subY = cy + 112 * scale;
        const prizeY = cy + 165 * scale;
        const descY = cy + 195 * scale;

        if (this.megaBombHit) {
            this._drawImg(ctx, 'sad', width / 2, iconY, 50 * scale, 50 * scale);
            ctx.fillStyle = '#EF4444';
            ctx.font = `900 ${Math.round(26 * scale)}px system-ui, sans-serif`;
            ctx.fillText('MEGA BOMB!', width / 2, titleY);
            ctx.fillStyle = 'rgba(252,165,165,0.8)';
            ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
            ctx.fillText('YOUR QUIDS ARE GONE', width / 2, subY);
            ctx.fillStyle = '#EF4444';
            ctx.shadowColor = 'rgba(239,68,68,0.5)'; ctx.shadowBlur = 20;
            ctx.font = `900 ${Math.round(48 * scale)}px system-ui, sans-serif`;
            ctx.fillText('£0', width / 2, prizeY);
            ctx.shadowBlur = 0;
            ctx.fillStyle = C.dim;
            ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
            ctx.fillText('So close... one wrong pick cost you', width / 2, descY);
            ctx.fillText('all your quids.', width / 2, descY + 16 * scale);
        } else if (this.prize < this.startingPrize * 0.3) {
            this._drawImg(ctx, 'xFace', width / 2, iconY, 48 * scale, 48 * scale);
            ctx.fillStyle = '#FB923C';
            ctx.font = `900 ${Math.round(24 * scale)}px system-ui, sans-serif`;
            ctx.fillText('ROUGH ROUND!', width / 2, titleY);
            ctx.fillStyle = C.dim;
            ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
            ctx.fillText('YOU KEPT', width / 2, subY);
            ctx.fillStyle = '#FB923C';
            ctx.shadowColor = 'rgba(251,146,60,0.5)'; ctx.shadowBlur = 20;
            ctx.font = `900 ${Math.round(48 * scale)}px system-ui, sans-serif`;
            ctx.fillText(`£${this.prize}`, width / 2, prizeY);
            ctx.shadowBlur = 0;
            ctx.fillStyle = C.dim;
            ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
            ctx.fillText(`The bombs ate your quids! You hit`, width / 2, descY);
            ctx.fillText(`${this.bombsHit} bomb${this.bombsHit !== 1 ? 's' : ''} and lost most of your prize.`, width / 2, descY + 16 * scale);
        } else {
            this._drawImg(ctx, 'crown', width / 2, iconY, 50 * scale, 50 * scale);
            ctx.fillStyle = C.yellow;
            ctx.font = `900 ${Math.round(22 * scale)}px system-ui, sans-serif`;
            ctx.fillText('YOU KEPT YOUR QUIDS!', width / 2, titleY);
            ctx.fillStyle = C.dim;
            ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
            ctx.fillText('YOU WON', width / 2, subY);
            ctx.fillStyle = C.green;
            ctx.shadowColor = 'rgba(66,212,132,0.5)'; ctx.shadowBlur = 20;
            ctx.font = `900 ${Math.round(48 * scale)}px system-ui, sans-serif`;
            ctx.fillText(`£${this.prize}`, width / 2, prizeY);
            ctx.shadowBlur = 0;
            ctx.fillStyle = C.dim;
            ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
            const dodged = this.maths.bombCount - this.bombsHit;
            ctx.fillText(`Nice one! You dodged ${dodged} bomb${dodged !== 1 ? 's' : ''}`, width / 2, descY);
            ctx.fillText(`and kept £${this.prize}!`, width / 2, descY + 16 * scale);
        }

        // Play Again button
        const bw = 200 * scale, bh = 48 * scale;
        const bx = (width - bw) / 2, by = cy + ch - 62 * scale;
        ctx.shadowColor = 'rgba(255,223,0,0.4)'; ctx.shadowBlur = 30;
        ctx.fillStyle = C.yellow;
        this._rr(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = C.darkBlue;
        ctx.font = `900 ${Math.round(16 * scale)}px system-ui, sans-serif`;
        ctx.fillText('PLAY AGAIN', width / 2, by + bh / 2 + 6 * scale);

        ctx.restore();
    }

    _rr(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }
}
