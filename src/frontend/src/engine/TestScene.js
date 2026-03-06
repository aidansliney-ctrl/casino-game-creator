import { Sprite } from './entities/Sprite';

export class TestScene {
    constructor() {
        this.children = [];
        this.frame = 0;
    }

    enter(game) {
        this.game = game; // Store reference
        console.log('[TestScene] Entered');

        // Create a central rotating square
        this.player = new Sprite('orange', 0, 0);
        this.player.width = 100;
        this.player.height = 100;

        // Initial Center
        this.centerPlayer();

        console.log(`[TestScene] Created player at ${this.player.x}, ${this.player.y}`);

        this.children.push(this.player);

        // Add input listener
        game.input.on('click', (pos) => {
            console.log('[TestScene] Clicked at', pos);
            this.player.x = pos.x;
            this.player.y = pos.y;
            // Change color on click
            this.player.texture = this.player.texture === 'orange' ? 'cyan' : 'orange';
        });
    }

    centerPlayer() {
        if (this.player && this.game) {
            this.player.x = this.game.renderer.width / 2;
            this.player.y = this.game.renderer.height / 2;
        }
    }

    exit() {
        this.children = [];
    }

    update(dt) {
        // Rotate the player
        if (this.player) {
            this.player.rotation += 2 * dt;
        }

        // Dynamic re-centering for debugging visibility
        // this.centerPlayer(); 
    }

    render(ctx) {
        this.frame++;
        if (this.frame % 60 === 0) {
            // console.log(`[TestScene] Rendering Frame ${this.frame}`);
        }

        // Draw a background circle to prove coordinate system
        ctx.beginPath();
        ctx.arc(this.game.renderer.width / 2, this.game.renderer.height / 2, 200, 0, Math.PI * 2);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Render all children
        this.children.forEach(child => child.render(ctx));
    }
}
