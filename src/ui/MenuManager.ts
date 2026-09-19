import { SoundManager } from "../game/SoundManager";

export type SettingsReturnTarget = "main" | "pause" | null;

/** Central visibility and input routing for all blocking overlays. */
export class MenuManager {
    private static _settingsReturn: SettingsReturnTarget = null;

    static isRunEnded(): boolean {
        return document.body.classList.contains("run-ended");
    }

    static isLoadingOpen(): boolean {
        const el = document.getElementById("loadingScreen");
        return el?.style.display === "flex";
    }

    static isMainMenuOpen(): boolean {
        const el = document.getElementById("mainMenu");
        return el ? el.style.display !== "none" : false;
    }

    static isPauseOpen(): boolean {
        const el = document.getElementById("escMenu");
        return el?.style.display === "flex";
    }

    static isCraftingOpen(): boolean {
        return document.getElementById("craftingMenu")?.classList.contains("active") ?? false;
    }

    static isSettingsOpen(): boolean {
        const el = document.getElementById("settingsOverlay");
        return el?.style.display === "flex";
    }

    static isEndScreenOpen(): boolean {
        const victory = document.getElementById("victoryScreen");
        const gameOver = document.getElementById("gameOverScreen");
        return victory?.style.display === "flex" || gameOver?.style.display === "flex";
    }

    /** True when gameplay input (movement, hotbar, pointer lock) should be blocked. */
    static isAnyMenuOpen(): boolean {
        if (this.isRunEnded()) return true;
        if (this.isLoadingOpen()) return true;
        if (this.isMainMenuOpen()) return true;
        if (this.isPauseOpen()) return true;
        if (this.isCraftingOpen()) return true;
        if (this.isSettingsOpen()) return true;
        return false;
    }

    /** True when real-time world simulation should keep running. */
    static isGameplayActive(): boolean {
        if (this.isRunEnded()) return false;
        if (this.isLoadingOpen()) return false;
        if (this.isMainMenuOpen()) return false;
        if (this.isPauseOpen()) return false;
        if (this.isCraftingOpen()) return false;
        if (this.isSettingsOpen()) return false;
        return true;
    }

    static canRequestPointerLock(): boolean {
        return !this.isAnyMenuOpen() && !this.isEndScreenOpen();
    }

    static showPause(): void {
        if (this.isRunEnded() || this.isCraftingOpen() || this.isMainMenuOpen()) return;
        const el = document.getElementById("escMenu");
        if (!el || el.style.display === "flex") return;
        el.style.display = "flex";
        SoundManager.instance?.play("menu");
        this._focusFirstButton(el);
        document.exitPointerLock();
    }

    static hidePause(): void {
        const el = document.getElementById("escMenu");
        if (el) el.style.display = "none";
    }

    static togglePause(): void {
        if (this.isSettingsOpen()) {
            this.hideSettings();
            return;
        }
        if (this.isCraftingOpen()) return;
        if (this.isRunEnded() || this.isMainMenuOpen()) return;
        if (this.isPauseOpen()) {
            this.hidePause();
            this._requestPointerLock();
        } else {
            this.showPause();
        }
    }

    static showSettings(returnTo: SettingsReturnTarget): void {
        const overlay = document.getElementById("settingsOverlay");
        if (!overlay) return;
        this._settingsReturn = returnTo;
        overlay.style.display = "flex";
        SoundManager.instance?.play("menu");
        this._focusFirstButton(overlay);
        if (returnTo === "pause") this.hidePause();
    }

    static hideSettings(): void {
        const overlay = document.getElementById("settingsOverlay");
        if (overlay) overlay.style.display = "none";
        const target = this._settingsReturn;
        this._settingsReturn = null;
        if (target === "pause") this.showPause();
    }

    static get settingsReturnTarget(): SettingsReturnTarget {
        return this._settingsReturn;
    }

    static dismissGameplayMenus(): void {
        this.hidePause();
        document.getElementById("craftingMenu")?.classList.remove("active");
        this.hideSettings();
    }

    private static _focusFirstButton(container: HTMLElement): void {
        const btn = container.querySelector<HTMLButtonElement>("button:not(:disabled)");
        btn?.focus({ preventScroll: true });
    }

    private static _requestPointerLock(): void {
        const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
        if (!canvas || !this.canRequestPointerLock()) return;
        canvas.focus({ preventScroll: true });
        try {
            const result = canvas.requestPointerLock?.();
            if (result && typeof result.catch === "function") {
                result.catch(() => {});
            }
        } catch {
            // Browsers may reject pointer lock without a recent user gesture.
        }
    }
}
