export class GameLoop {
    constructor(update, render) {
        this.update = update;
        this.render = render;
        this.lastTime = 0;
        this.accumulator = 0;
        this.step = 1 / 60; // Fixed time step 60fps
        this.rafId = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this.loop.bind(this));
    }

    stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.rafId);
    }

    loop(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Cap deltaTime to avoid spiral of death
        const safeDelta = Math.min(deltaTime, 0.25);
        this.accumulator += safeDelta;

        while (this.accumulator >= this.step) {
            this.update(this.step);
            this.accumulator -= this.step;
        }

        // Interpolation alpha can be passed to render for smoother visuals
        const alpha = this.accumulator / this.step;
        this.render(alpha);

        this.rafId = requestAnimationFrame(this.loop.bind(this));
    }
}
