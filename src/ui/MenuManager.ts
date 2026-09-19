import { SoundManager } from "../game/SoundManager";

export type SettingsReturnTarget = "main" | "pause" | null;

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Central visibility and input routing for all blocking overlays. */
export class MenuManager {
    private static _settingsReturn: SettingsReturnTarget = null;
    private static _trapContainer: HTMLElement | null = null;
    private static _trapHandler: ((e: KeyboardEvent) => void) | null = null;
    private static _previousFocus: HTMLElement | null = null;

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
        this._openOverlay(el);
        document.exitPointerLock();
    }

    static hidePause(): void {
        const el = document.getElementById("escMenu");
        if (el) el.style.display = "none";
        if (this._trapContainer === el) this.deactivateFocusTrap();
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
        this._openOverlay(overlay);
        if (returnTo === "pause") this.hidePause();
    }

    static hideSettings(): void {
        const overlay = document.getElementById("settingsOverlay");
        if (overlay) overlay.style.display = "none";
        if (this._trapContainer === overlay) this.deactivateFocusTrap();
        const target = this._settingsReturn;
        this._settingsReturn = null;
        if (target === "pause") this.showPause();
    }

    static get settingsReturnTarget(): SettingsReturnTarget {
        return this._settingsReturn;
    }

    static dismissGameplayMenus(): void {
        this.hidePause();
        this.hideCrafting();
        this.hideSettings();
    }

    static showCrafting(): void {
        const el = document.getElementById("craftingMenu");
        if (!el) return;
        el.classList.add("active");
        this._openOverlay(el);
    }

    static hideCrafting(): void {
        const el = document.getElementById("craftingMenu");
        if (el) el.classList.remove("active");
        if (this._trapContainer === el) this.deactivateFocusTrap();
    }

    static showEndScreen(id: "victoryScreen" | "gameOverScreen"): void {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = "flex";
        this._openOverlay(el);
    }

    static hideEndScreens(): void {
        for (const id of ["victoryScreen", "gameOverScreen"] as const) {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        }
        if (this._trapContainer?.id === "victoryScreen" || this._trapContainer?.id === "gameOverScreen") {
            this.deactivateFocusTrap();
        }
    }

    static showMainMenu(): void {
        const menu = document.getElementById("mainMenu");
        if (menu) menu.style.display = "flex";
    }

    static hideMainMenu(): void {
        const menu = document.getElementById("mainMenu");
        if (menu) menu.style.display = "none";
    }

    /** Reset all overlay UI before returning to the title screen. */
    static prepareReturnToMainMenu(): void {
        document.exitPointerLock();
        this.dismissGameplayMenus();
        this.hideEndScreens();
        this.hideSettings();
        document.body.classList.remove("run-ended", "is-loading");
        document.getElementById("notifications")!.innerHTML = "";
        this.showMainMenu();
    }

    static activateFocusTrap(container: HTMLElement): void {
        this.deactivateFocusTrap();
        this._previousFocus = document.activeElement as HTMLElement | null;
        this._trapContainer = container;
        this._trapHandler = (e: KeyboardEvent) => {
            if (e.key !== "Tab" || !this._trapContainer) return;
            const nodes = Array.from(
                this._trapContainer.querySelectorAll<HTMLElement>(FOCUSABLE)
            ).filter(el => el.offsetParent !== null);
            if (nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus({ preventScroll: true });
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus({ preventScroll: true });
            }
        };
        document.addEventListener("keydown", this._trapHandler);
    }

    static deactivateFocusTrap(): void {
        if (this._trapHandler) {
            document.removeEventListener("keydown", this._trapHandler);
            this._trapHandler = null;
        }
        this._trapContainer = null;
        this._previousFocus?.focus?.({ preventScroll: true });
        this._previousFocus = null;
    }

    private static _openOverlay(container: HTMLElement): void {
        const btn = container.querySelector<HTMLButtonElement>("button:not(:disabled)");
        btn?.focus({ preventScroll: true });
        this.activateFocusTrap(container);
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
