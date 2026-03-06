export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true });
        this.width = canvas.width;
        this.height = canvas.height;
        this.dpr = window.devicePixelRatio || 1;

        console.log('[Renderer] Initialized');

        // Robust resizing with ResizeObserver
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                this.resize(entry.contentRect);
            }
        });

        if (this.canvas.parentElement) {
            this.resizeObserver.observe(this.canvas.parentElement);
        }
    }

    resize(rect) {
        if (!rect) {
            const parent = this.canvas.parentElement;
            if (parent) {
                rect = parent.getBoundingClientRect();
            }
        }

        if (rect) {
            this.width = rect.width;
            this.height = rect.height;

            console.log(`[Renderer] Resizing to ${this.width}x${this.height}`);

            this.canvas.width = this.width * this.dpr;
            this.canvas.height = this.height * this.dpr;

            this.canvas.style.width = `${this.width}px`;
            this.canvas.style.height = `${this.height}px`;

            this.ctx.scale(this.dpr, this.dpr);
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        // Debug: Fill with dark gray to verify canvas visibility
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    render(scene) {
        this.clear();
        if (scene && scene.render) {
            scene.render(this.ctx);
        }
    }

    destroy() {
        this.resizeObserver.disconnect();
    }
}
