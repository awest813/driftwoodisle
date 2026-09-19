export class LoadingScreen {
    private static _el(): HTMLElement | null {
        return document.getElementById("loadingScreen");
    }

    public static show(initialStatus: string = "Charting the shore"): void {
        const el = this._el();
        if (!el) return;
        el.style.display = "flex";
        // Keep the HUD/crosshair hidden until the world is ready to play.
        document.body.classList.add("is-loading");
        this.setStatus(initialStatus);
        this.setProgress(0);
    }

    public static hide(): void {
        const el = this._el();
        if (!el) return;
        // Snap the bar full first so the final step feels finished.
        this.setProgress(1);
        // Small fade-out so the world doesn't pop in harshly.
        el.style.transition = "opacity 0.25s ease";
        el.style.opacity = "0";
        window.setTimeout(() => {
            el.style.display = "none";
            el.style.opacity = "1";
            el.style.transition = "";
            document.body.classList.remove("is-loading");
        }, 260);
    }

    public static setStatus(status: string): void {
        const s = document.getElementById("loadingStatus");
        if (s) s.textContent = status;
    }

    public static setProgress(fraction: number): void {
        const clamped = Math.max(0, Math.min(1, fraction));
        const bar = document.getElementById("loadingBar");
        if (bar) bar.style.width = `${clamped * 100}%`;
        const progress = document.querySelector<HTMLElement>(".loading-bar-bg");
        if (progress) progress.setAttribute("aria-valuenow", Math.round(clamped * 100).toString());
    }

    public static async step(status: string, fraction: number, task?: () => Promise<void> | void): Promise<void> {
        this.setStatus(status);
        this.setProgress(fraction);
        // Yield to the browser so the status text and bar paint before the work
        // runs. Occluded/background windows suspend rAF entirely, so race it
        // against a short timer instead of stalling world load forever.
        await new Promise<void>(resolve => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            requestAnimationFrame(finish);
            setTimeout(finish, 60);
        });
        if (task) await task();
    }
}
