import './style.css'
import { Game } from './game/Game';

// Initialize the game
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game('renderCanvas');

    // For debugging
    (window as any).game = game;

    // Add FPS counter to UI
    const fpsDiv = document.createElement('div');
    fpsDiv.id = 'fpsCounter';
    document.body.appendChild(fpsDiv);

    game.engine.runRenderLoop(() => {
        fpsDiv.innerText = `FPS: ${game.engine.getFps().toFixed()}`;
    });
});
