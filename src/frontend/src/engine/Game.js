import { GameLoop } from './core/GameLoop';
import { Renderer } from './core/Renderer';
import { InputManager } from './core/InputManager';

export class Game {
    constructor(canvas) {
        this.renderer = new Renderer(canvas);
        this.input = new InputManager(canvas);
        this.loop = new GameLoop(this.update.bind(this), this.render.bind(this));

        this.scene = null; // Current active scene
        this.assets = {}; // Asset cache
    }

    start() {
        this.renderer.resize(); // Force initial resize
        this.loop.start();
    }

    stop() {
        this.loop.stop();
    }

    setScene(scene) {
        if (this.scene && this.scene.exit) {
            this.scene.exit();
        }
        this.scene = scene;
        if (this.scene && this.scene.enter) {
            this.scene.enter(this);
        }
        this.scene.input = this.input; // Inject input manager
    }

    update(dt) {
        if (this.scene && this.scene.update) {
            this.scene.update(dt);
        }
    }

    render(alpha) {
        this.renderer.render(this.scene);
    }
}
