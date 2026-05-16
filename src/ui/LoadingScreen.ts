export class LoadingScreen {
    private static _el(): HTMLElement | null {
        return document.getElementById("loadingScreen");
    }

    public static show(initialStatus: string = "Charting the shore"): void {
        const el = this._el();
        if (!el) return;
        el.style.display = "flex";
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
        }, 260);
    }

    public static setStatus(status: string): void {
        const s = document.getElementById("loadingStatus");
        if (s) s.textContent = status;
    }

    public static setProgress(fraction: number): void {
        const bar = document.getElementById("loadingBar");
        if (bar) bar.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    }

    public static async step(status: string, fraction: number, task?: () => Promise<void> | void): Promise<void> {
        this.setStatus(status);
        this.setProgress(fraction);
        // Yield to the browser so the status text and bar paint before the work runs.
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (task) await task();
    }
}
