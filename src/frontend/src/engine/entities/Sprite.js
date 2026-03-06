export class Sprite {
    constructor(texture, x = 0, y = 0) {
        this.texture = texture; // Image object or color string
        this.x = x;
        this.y = y;
        this.width = texture.width || 50;
        this.height = texture.height || 50;
        this.rotation = 0;
        this.scale = { x: 1, y: 1 };
        this.anchor = { x: 0.5, y: 0.5 }; // Center by default
        this.visible = true;
        this.alpha = 1;
    }

    update(dt) {
        // Override me
    }

    render(ctx) {
        if (!this.visible || this.alpha <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale.x, this.scale.y);
        ctx.globalAlpha = this.alpha;

        if (typeof this.texture === 'string') {
            // Placeholder: Draw colored rect
            ctx.fillStyle = this.texture;
            ctx.fillRect(
                -this.width * this.anchor.x,
                -this.height * this.anchor.y,
                this.width,
                this.height
            );
        } else if (this.texture instanceof Image) {
            ctx.drawImage(
                this.texture,
                -this.width * this.anchor.x,
                -this.height * this.anchor.y,
                this.width,
                this.height
            );
        }

        ctx.restore();
    }
}
