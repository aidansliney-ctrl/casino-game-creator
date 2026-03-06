export class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.volume = 0.5;
        this.muted = false;
        this.customAudio = {}; // { soundId: audioUrl }
        this.audioBuffers = new Map(); // Cache decoded buffers
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('[AudioManager] Web Audio not available:', e);
        }
    }

    ensureContext() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
    }

    setMuted(m) {
        this.muted = m;
        if (this.masterGain) {
            this.masterGain.gain.value = m ? 0 : this.volume;
        }
    }

    setCustomAudio(soundId, url) {
        this.customAudio[soundId] = url;
        this.audioBuffers.delete(soundId); // Clear cache
    }

    clearCustomAudio(soundId) {
        delete this.customAudio[soundId];
        this.audioBuffers.delete(soundId);
    }

    async playCustom(soundId) {
        if (!this.ctx || this.muted) return;
        const url = this.customAudio[soundId];
        if (!url) return false;

        try {
            let buffer = this.audioBuffers.get(soundId);
            if (!buffer) {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                buffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.audioBuffers.set(soundId, buffer);
            }
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.masterGain);
            source.start(0);
            return true;
        } catch (e) {
            console.warn(`[AudioManager] Failed to play custom audio for ${soundId}:`, e);
            return false;
        }
    }

    async play(soundId) {
        this.ensureContext();
        if (!this.ctx || this.muted) return;

        if (this.customAudio[soundId]) {
            const played = await this.playCustom(soundId);
            if (played) return;
        }

        const mp3 = AudioManager.MP3_SOUNDS[soundId];
        if (mp3) {
            this._playMP3(soundId, mp3.src, mp3.vol);
            return;
        }

        switch (soundId) {
            case 'spin': this._playSpin(); break;
            case 'reelStop': this._playReelStop(); break;
            case 'win': this._playWin(); break;
            case 'bigWin': this._playBigWin(); break;
            case 'buttonClick': this._playButtonClick(); break;
            case 'ambient': this._playAmbientChord(); break;
            default: break;
        }
    }

    async _playMP3(id, src, vol = 0.7) {
        if (!this.ctx) return;
        try {
            let buffer = this.audioBuffers.get(id);
            if (!buffer) {
                const resp = await fetch(src);
                const ab = await resp.arrayBuffer();
                buffer = await this.ctx.decodeAudioData(ab);
                this.audioBuffers.set(id, buffer);
            }
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            const gain = this.ctx.createGain();
            gain.gain.value = vol;
            source.connect(gain);
            gain.connect(this.masterGain);
            source.start(0);
        } catch (e) {
            console.warn(`[AudioManager] MP3 play failed for ${id}:`, e);
        }
    }

    static MP3_SOUNDS = {
        safe: { src: '/sounds/money.mp3', vol: 0.7 },
        bomb: { src: '/sounds/ack.mp3', vol: 0.8 },
        megaBomb: { src: '/sounds/bomb.mp3', vol: 0.8 },
        quickieWin: { src: '/sounds/yay.mp3', vol: 0.8 },
        quickieLose: { src: '/sounds/lose-some.mp3', vol: 0.7 },
    };

    _playSpin() {
        const now = this.ctx.currentTime;
        // Mechanical spin sound — rising frequency sweep with noise
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.5);

        // Add a click at the start
        const click = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        click.type = 'square';
        click.frequency.value = 1200;
        clickGain.gain.setValueAtTime(0.2, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        click.connect(clickGain);
        clickGain.connect(this.masterGain);
        click.start(now);
        click.stop(now + 0.05);
    }

    _playReelStop() {
        const now = this.ctx.currentTime;
        // Satisfying thud/click
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.15);

        // High click
        const click = this.ctx.createOscillator();
        const cg = this.ctx.createGain();
        click.type = 'triangle';
        click.frequency.value = 800;
        cg.gain.setValueAtTime(0.15, now);
        cg.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        click.connect(cg);
        cg.connect(this.masterGain);
        click.start(now);
        click.stop(now + 0.04);
    }

    _playWin() {
        const now = this.ctx.currentTime;
        // Ascending arpeggio — C E G C (major chord)
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = now + i * 0.12;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.4);
        });

        // Sparkle noise
        this._playNoiseBurst(now + 0.3, 0.3, 0.08);
    }

    _playBigWin() {
        const now = this.ctx.currentTime;
        // Grand fanfare — multiple ascending arpeggios with harmonics
        const fanfare = [
            [523.25, 0], [659.25, 0.1], [783.99, 0.2],
            [1046.5, 0.35], [1318.5, 0.5], [1567.98, 0.65],
            [2093, 0.85]
        ];
        fanfare.forEach(([freq, offset]) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = now + offset;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.06);
            gain.gain.setValueAtTime(0.2, t + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.6);

            // Add a harmonic
            const h = this.ctx.createOscillator();
            const hg = this.ctx.createGain();
            h.type = 'triangle';
            h.frequency.value = freq * 2;
            hg.gain.setValueAtTime(0, t);
            hg.gain.linearRampToValueAtTime(0.06, t + 0.06);
            hg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            h.connect(hg);
            hg.connect(this.masterGain);
            h.start(t);
            h.stop(t + 0.4);
        });

        // Multiple sparkle noise bursts
        for (let i = 0; i < 4; i++) {
            this._playNoiseBurst(now + 0.3 + i * 0.25, 0.2, 0.1);
        }
    }

    _playButtonClick() {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    _playAmbientChord() {
        const now = this.ctx.currentTime;
        // Soft mysterious pad — Cm chord
        const notes = [130.81, 155.56, 196.0]; // C3, Eb3, G3
        notes.forEach(freq => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.04, now + 1.0);
            gain.gain.setValueAtTime(0.04, now + 2.0);
            gain.gain.linearRampToValueAtTime(0, now + 4.0);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 4.0);
        });
    }

    _playNoiseBurst(time, duration, volume) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // High-pass filter for sparkle
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 3000;

        const gain = this.ctx.createGain();
        gain.gain.value = volume;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start(time);
    }

    static getSoundSlots(gameType) {
        const all = [
            { id: 'spin', name: 'Spin Start', description: 'Plays when the player presses spin', icon: '🔄', category: 'gameplay', games: ['slots'] },
            { id: 'reelStop', name: 'Reel Stop', description: 'Plays as each reel locks into place', icon: '🛑', category: 'gameplay', games: ['slots'] },
            { id: 'win', name: 'Win', description: 'Celebratory jingle on a winning spin', icon: '🎵', category: 'feedback', games: ['slots', 'table'] },
            { id: 'bigWin', name: 'Big Win', description: 'Grand fanfare for large payouts', icon: '🎺', category: 'feedback', games: ['slots', 'table'] },
            { id: 'buttonClick', name: 'Button Click', description: 'UI interaction feedback', icon: '🔘', category: 'ui', games: ['slots', 'table', 'quickie', 'instant'] },
            { id: 'ambient', name: 'Ambient Pad', description: 'Background atmosphere chord', icon: '🌙', category: 'ambience', games: ['slots', 'table'] },
            { id: 'safe', name: 'Safe Tile', description: 'Plays when a safe tile is revealed', icon: '💎', category: 'gameplay', games: ['quickie'] },
            { id: 'bomb', name: 'Bomb Hit', description: 'Plays when a regular bomb is hit', icon: '💣', category: 'feedback', games: ['quickie'] },
            { id: 'megaBomb', name: 'Mega Bomb', description: 'Plays when the mega bomb is hit', icon: '💀', category: 'feedback', games: ['quickie'] },
            { id: 'quickieWin', name: 'Quickie Win', description: 'Plays on a winning round end', icon: '🎉', category: 'feedback', games: ['quickie'] },
            { id: 'quickieLose', name: 'Quickie Lose', description: 'Plays when mega bomb ends the game', icon: '😢', category: 'feedback', games: ['quickie'] },
        ];
        if (!gameType) return all;
        const prefix = gameType.startsWith('slots') ? 'slots'
            : gameType.startsWith('table') ? 'table'
            : gameType.startsWith('quickie') ? 'quickie'
            : gameType.startsWith('instant') ? 'instant'
            : null;
        if (!prefix) return all;
        return all.filter(s => s.games.includes(prefix));
    }

    destroy() {
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
            this.initialized = false;
        }
    }
}
