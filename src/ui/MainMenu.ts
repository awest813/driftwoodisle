import { SaveSystem } from "../save/SaveSystem";
import { SettingsManager } from "../save/SettingsManager";
import { LoadingScreen } from "./LoadingScreen";
import { MenuManager } from "./MenuManager";

const HERO_BLURBS = [
    "Cast ashore with nothing but salt in your boots and a stub of pencil. Forage, build, and live to write tomorrow's page.",
    "The tide left you a beach, a rusted knife, and the smell of distant rain. Make of it what you can before nightfall.",
    "Driftwood, freshwater, and the patience to keep a fire lit — that is the whole syllabus of survival.",
    "Each sunrise costs you a page. Spend it well; the isle keeps no copies."
];

export class MainMenu {
    private static _instance: MainMenu | null = null;

    private _menuElement: HTMLElement | null;
    private _onStart: (isLoad: boolean) => Promise<void> | void;
    private _isStarting: boolean = false;
    private _currentScreen: string = "menuContent";

    constructor(onStart: (isLoad: boolean) => Promise<void> | void) {
        this._menuElement = document.getElementById("mainMenu");
        this._onStart = onStart;
        MainMenu._instance = this;

        MenuManager.setSettingsCloseHandler((save) => this._closeSettings(save));
        this._setupButtons();
        this._setupHero();
        this._setupKeyboard();
    }

    /** Restore the title screen after exiting a run without reloading. */
    public static prepareForReturn(): void {
        MainMenu._instance?._resetToHero();
        MainMenu.refreshSavePreview();
    }

    public static refreshSavePreview(): void {
        const loadBtn = document.getElementById("loadGame") as HTMLButtonElement | null;
        const pauseLoadBtn = document.getElementById("loadInGameBtn") as HTMLButtonElement | null;
        const continueSub = document.getElementById("continueSub");
        const hasSave = SaveSystem.hasSave();
        const preview = SaveSystem.getSavePreview();

        if (loadBtn) {
            loadBtn.disabled = !hasSave;
            loadBtn.onclick = () => MainMenu._instance?._start(true);
            if (continueSub) {
                continueSub.textContent = preview
                    ? `Day ${preview.day} · resume your journal`
                    : "No saved entries";
            }
        }

        if (pauseLoadBtn) {
            pauseLoadBtn.disabled = !hasSave;
            pauseLoadBtn.title = hasSave ? "Resume your saved journal" : "No journal entries found";
        }
    }

    private _resetToHero(): void {
        this._isStarting = false;
        this._currentScreen = "menuContent";
        if (this._menuElement) this._menuElement.style.display = "flex";
        document.getElementById("menuContent")!.style.display = "block";
        for (const page of this._menuElement?.querySelectorAll(".journal-page") ?? []) {
            const el = page as HTMLElement;
            if (el.id !== "menuContent") el.style.display = "none";
        }
        this._setStartingState(false);
    }

    private _setupHero(): void {
        const blurb = document.getElementById("heroBlurb");
        if (blurb) blurb.textContent = HERO_BLURBS[Math.floor(Math.random() * HERO_BLURBS.length)];
    }

    private _setupKeyboard(): void {
        document.addEventListener("keydown", (e) => {
            if (!this._menuElement || this._menuElement.style.display === "none") return;
            if (e.key === "Escape" && MenuManager.isSettingsOpen()) {
                e.preventDefault();
                this._closeSettings();
                return;
            }
            if (e.key === "Escape" && this._currentScreen !== "menuContent") {
                e.preventDefault();
                this._showScreen("menuContent");
            }
        });
    }

    private _setupButtons(): void {
        const startBtn = document.getElementById("startGame");
        const settingsBtn = document.getElementById("openSettings");
        const creditsBtn = document.getElementById("openCredits");
        const controlsBtn = document.getElementById("openControls");

        if (startBtn) startBtn.onclick = () => this._start(false);

        MainMenu.refreshSavePreview();

        if (settingsBtn) settingsBtn.onclick = () => this._openSettings();
        if (creditsBtn) creditsBtn.onclick = () => this._showScreen("creditsMenu");
        if (controlsBtn) controlsBtn.onclick = () => this._showScreen("controlsMenu");

        // Back buttons
        document.getElementById("closeSettings")!.onclick = () => this._closeSettings();
        document.getElementById("settingsOverlay")?.addEventListener("mousedown", (e) => {
            if (e.target === e.currentTarget) this._closeSettings();
        });
        document.getElementById("closeCredits")!.onclick = () => this._showScreen("menuContent");
        document.getElementById("closeControls")!.onclick = () => this._showScreen("menuContent");

        this._initSettingsUI();
        this._setupLiveSettings();
    }

    private _openSettings(): void {
        document.getElementById("menuContent")!.style.display = "none";
        MenuManager.showSettings("main");
        this._currentScreen = "settingsMenu";
    }

    private _closeSettings(save = true): void {
        if (save) this._saveSettings();
        const target = MenuManager.settingsReturnTarget;
        MenuManager.hideSettings();
        if (target === "main") {
            this._showScreen("menuContent");
        }
    }

    private _showScreen(id: string): void {
        const pages = this._menuElement?.querySelectorAll(".journal-page") ?? [];
        pages.forEach(p => {
            const el = p as HTMLElement;
            el.style.display = "none";
            el.classList.remove("page-enter");
        });
        const next = document.getElementById(id);
        if (next) {
            next.style.display = "block";
            // restart entrance animation
            next.classList.remove("page-enter");
            void next.offsetWidth;
            next.classList.add("page-enter");
            const firstBtn = next.querySelector<HTMLButtonElement>("button:not(:disabled)");
            firstBtn?.focus({ preventScroll: true });
        }
        this._currentScreen = id;
    }

    private _initSettingsUI(): void {
        const s = SettingsManager.load();

        (document.getElementById("sensRange") as HTMLInputElement).value = s.sensitivity.toString();
        (document.getElementById("volRange") as HTMLInputElement).value = s.volume.toString();
        (document.getElementById("fogRange") as HTMLInputElement).value = (s.fogDensity).toString();
        (document.getElementById("ppToggle") as HTMLInputElement).checked = s.postProcessing;
        (document.getElementById("touchModeSelect") as HTMLSelectElement).value = s.touchControls;
        (document.getElementById("touchSensRange") as HTMLInputElement).value = s.touchSensitivity.toString();
        (document.getElementById("invertYToggle") as HTMLInputElement).checked = s.invertY;
        (document.getElementById("leftHandedToggle") as HTMLInputElement).checked = s.leftHanded;
        this._updateSettingLabels();
    }

    private _setupLiveSettings(): void {
        const sensRange = document.getElementById("sensRange") as HTMLInputElement;
        const volRange = document.getElementById("volRange") as HTMLInputElement;
        const fogRange = document.getElementById("fogRange") as HTMLInputElement;
        const ppToggle = document.getElementById("ppToggle") as HTMLInputElement;
        const touchModeSelect = document.getElementById("touchModeSelect") as HTMLSelectElement;
        const touchSensRange = document.getElementById("touchSensRange") as HTMLInputElement;
        const invertYToggle = document.getElementById("invertYToggle") as HTMLInputElement;
        const leftHandedToggle = document.getElementById("leftHandedToggle") as HTMLInputElement;
        const previewBtn = document.getElementById("audioPreviewBtn");

        [sensRange, fogRange, ppToggle, touchSensRange, invertYToggle, leftHandedToggle].forEach(input => {
            input.addEventListener("input", () => this._updateSettingLabels());
        });
        touchModeSelect.addEventListener("change", () => this._updateSettingLabels());

        volRange.addEventListener("input", () => {
            this._updateSettingLabels();
            SettingsManager.previewVolume(parseInt(volRange.value));
        });

        previewBtn?.addEventListener("click", () => {
            (window as any).soundManager?.play("craft");
        });
    }

    private _updateSettingLabels(): void {
        const sensRange = document.getElementById("sensRange") as HTMLInputElement;
        const volRange = document.getElementById("volRange") as HTMLInputElement;
        const fogRange = document.getElementById("fogRange") as HTMLInputElement;
        const ppToggle = document.getElementById("ppToggle") as HTMLInputElement;
        const touchModeSelect = document.getElementById("touchModeSelect") as HTMLSelectElement;
        const touchSensRange = document.getElementById("touchSensRange") as HTMLInputElement;
        const invertYToggle = document.getElementById("invertYToggle") as HTMLInputElement;
        const leftHandedToggle = document.getElementById("leftHandedToggle") as HTMLInputElement;

        document.getElementById("sensValue")!.innerText = sensRange.value;
        sensRange.setAttribute("aria-valuetext", sensRange.value);
        document.getElementById("volValue")!.innerText = `${volRange.value}%`;
        volRange.setAttribute("aria-valuetext", `${volRange.value}%`);
        document.getElementById("fogValue")!.innerText = `${fogRange.value}/10`;
        fogRange.setAttribute("aria-valuetext", `${fogRange.value} of 10`);
        document.getElementById("qualityValue")!.innerText = ppToggle.checked ? "High" : "Low GPU";

        const touchLabel = touchModeSelect.value === "auto" ? "Auto" :
                           touchModeSelect.value === "on" ? "On" : "Off";
        document.getElementById("touchModeValue")!.innerText = touchLabel;
        touchModeSelect.setAttribute("aria-valuetext", touchLabel);
        document.getElementById("touchSensValue")!.innerText = touchSensRange.value;
        touchSensRange.setAttribute("aria-valuetext", touchSensRange.value);
        document.getElementById("invertYValue")!.innerText = invertYToggle.checked ? "On" : "Off";
        invertYToggle.setAttribute("aria-valuetext", invertYToggle.checked ? "On" : "Off");
        document.getElementById("leftHandedValue")!.innerText = leftHandedToggle.checked ? "On" : "Off";
        leftHandedToggle.setAttribute("aria-valuetext", leftHandedToggle.checked ? "On" : "Off");
    }

    private _saveSettings(): void {
        SettingsManager.saveFromForm();
    }

    private async _start(isLoad: boolean): Promise<void> {
        if (this._isStarting) return;
        this._isStarting = true;
        this._setStartingState(true);

        if (this._menuElement) {
            this._menuElement.style.display = "none";
        }

        LoadingScreen.show(isLoad ? "Recovering your journal" : "Charting the shore");

        try {
            await this._onStart(isLoad);
            LoadingScreen.hide();
            this._isStarting = false;
            this._setStartingState(false);
        } catch (error) {
            console.error("Failed to start game", error);
            LoadingScreen.hide();
            if (this._menuElement) this._menuElement.style.display = "flex";
            this._setStartingState(false);
            this._isStarting = false;
        }
    }

    private _setStartingState(isStarting: boolean): void {
        const buttons = document.querySelectorAll<HTMLButtonElement>("#menuContent #menuButtons button");
        buttons.forEach(button => {
            button.disabled = isStarting || (button.id === "loadGame" && !SaveSystem.hasSave());
        });

        const startLabel = document.querySelector<HTMLElement>("#startGame .btn-label");
        if (startLabel) startLabel.textContent = isStarting ? "Loading…" : "New Journal";
    }
}
