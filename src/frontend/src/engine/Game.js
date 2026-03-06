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
        this.onSceneError = null; // Callback for runtime errors in AI-generated scenes
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
            try {
                this.scene.update(dt);
            } catch (e) {
                console.error('[Game] Scene update error:', e);
                if (this.onSceneError) this.onSceneError(e);
            }
        }
    }

    render(alpha) {
        try {
            this.renderer.render(this.scene);
        } catch (e) {
            console.error('[Game] Scene render error:', e);
            if (this.onSceneError) this.onSceneError(e);
        }
    }
}
