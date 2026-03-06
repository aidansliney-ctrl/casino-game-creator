export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouse = { x: 0, y: 0, isDown: false };
        this.keys = {}; // Track key states
        this.events = {}; // Simple event emitter

        this._setupListeners();
    }

    isKeyPressed(code) {
        return !!this.keys[code];
    }

    isMouseButtonPressed(button) {
        return this.mouse.isDown; // Simplified: any button for now
    }

    get mouseX() { return this.mouse.x; }
    get mouseY() { return this.mouse.y; }

    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;
        const idx = this.events[event].indexOf(callback);
        if (idx !== -1) this.events[event].splice(idx, 1);
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(cb => cb(data));
        }
    }

    _setupListeners() {
        // Mouse Events
        this.canvas.addEventListener('mousedown', this._handleDown.bind(this));
        this.canvas.addEventListener('mousemove', this._handleMove.bind(this));
        window.addEventListener('mouseup', this._handleUp.bind(this));

        // Keyboard Events
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // Touch Events
        this.canvas.addEventListener('touchstart', (e) => this._handleDown(e.touches[0]));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this._handleMove(e.touches[0]);
        });
        window.addEventListener('touchend', this._handleUp.bind(this));
    }

    _getPos(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    _handleDown(event) {
        const pos = this._getPos(event);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.mouse.isDown = true;
        this.emit('down', this.mouse);
    }

    _handleMove(event) {
        const pos = this._getPos(event);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.emit('move', this.mouse);
    }

    _handleUp() {
        if (this.mouse.isDown) {
            this.mouse.isDown = false;
            this.emit('up', this.mouse);
            this.emit('click', this.mouse); // Simplified click
        }
    }
}
