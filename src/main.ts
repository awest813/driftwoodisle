import './style.css'

// Initialize the game
window.addEventListener('DOMContentLoaded', async () => {
    const { Game } = await import('./game/Game');
    const game = new Game('renderCanvas');

    // For debugging
    (window as any).game = game;

    // Add FPS counter to UI
    const fpsDiv = document.createElement('div');
    fpsDiv.id = 'fpsCounter';
    document.body.appendChild(fpsDiv);

    game.scene.onAfterRenderObservable.add(() => {
        fpsDiv.innerText = `FPS: ${game.engine.getFps().toFixed()}`;
    });
});
