import './style.css'

// Initialize the game
window.addEventListener('DOMContentLoaded', async () => {
    const { Game } = await import('./game/Game');
    new Game('renderCanvas');

    // Optional FPS readout — append ?debug=1 to the URL to enable.
    if (new URLSearchParams(window.location.search).has("debug")) {
        document.body.classList.add("debug-fps");
        const fpsDiv = document.createElement("div");
        fpsDiv.id = "fpsCounter";
        document.body.appendChild(fpsDiv);

        let lastFpsText = "";
        window.setInterval(() => {
            const raw = (window as any).game?.engine?.getFps?.() ?? 0;
            const fps = Number.isFinite(raw) ? Math.round(raw) : 0;
            const text = fps > 0 ? `FPS: ${fps}` : "";
            if (text !== lastFpsText) {
                lastFpsText = text;
                fpsDiv.innerText = text;
            }
        }, 500);
    }
});
