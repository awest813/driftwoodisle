import { SaveSystem } from "../save/SaveSystem";
import { SettingsManager } from "../save/SettingsManager";

export class MainMenu {
    private _menuElement: HTMLElement | null;
    private _onStart: (isLoad: boolean) => Promise<void> | void;
    private _isStarting: boolean = false;

    constructor(onStart: (isLoad: boolean) => Promise<void> | void) {
        this._menuElement = document.getElementById("mainMenu");
        this._onStart = onStart;

        this._setupButtons();
    }

    private _setupButtons(): void {
        const startBtn = document.getElementById("startGame");
        const loadBtn = document.getElementById("loadGame") as HTMLButtonElement;
        const settingsBtn = document.getElementById("openSettings");
        const creditsBtn = document.getElementById("openCredits");

        if (startBtn) startBtn.onclick = () => this._start(false);
        
        if (loadBtn) {
            if (SaveSystem.hasSave()) {
                loadBtn.disabled = false;
                loadBtn.onclick = () => this._start(true);
            }
        }

        if (settingsBtn) settingsBtn.onclick = () => this._showScreen("settingsMenu");
        if (creditsBtn) creditsBtn.onclick = () => this._showScreen("creditsMenu");

        // Back buttons
        document.getElementById("closeSettings")!.onclick = () => {
            this._saveSettings();
            this._showScreen("menuContent");
        };
        document.getElementById("closeCredits")!.onclick = () => this._showScreen("menuContent");

        this._initSettingsUI();
        this._setupLiveSettings();
    }

    private _showScreen(id: string): void {
        const pages = this._menuElement?.querySelectorAll(".journal-page") ?? [];
        pages.forEach(p => (p as HTMLElement).style.display = "none");
        document.getElementById(id)!.style.display = "block";
    }

    private _initSettingsUI(): void {
        const s = SettingsManager.load();
        
        (document.getElementById("sensRange") as HTMLInputElement).value = s.sensitivity.toString();
        (document.getElementById("volRange") as HTMLInputElement).value = s.volume.toString();
        (document.getElementById("fogRange") as HTMLInputElement).value = (s.fogDensity).toString();
        (document.getElementById("ppToggle") as HTMLInputElement).checked = s.postProcessing;
        this._updateSettingLabels();
    }

    private _setupLiveSettings(): void {
        const sensRange = document.getElementById("sensRange") as HTMLInputElement;
        const volRange = document.getElementById("volRange") as HTMLInputElement;
        const fogRange = document.getElementById("fogRange") as HTMLInputElement;
        const ppToggle = document.getElementById("ppToggle") as HTMLInputElement;
        const previewBtn = document.getElementById("audioPreviewBtn");

        [sensRange, fogRange, ppToggle].forEach(input => {
            input.addEventListener("input", () => this._updateSettingLabels());
        });

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
        document.getElementById("sensValue")!.innerText = sensRange.value;
        document.getElementById("volValue")!.innerText = `${volRange.value}%`;
        document.getElementById("fogValue")!.innerText = `${fogRange.value}/10`;
        document.getElementById("qualityValue")!.innerText = ppToggle.checked ? "Native" : "Low GPU";
    }

    private _saveSettings(): void {
        SettingsManager.save({
            sensitivity: parseInt((document.getElementById("sensRange") as HTMLInputElement).value),
            volume: parseInt((document.getElementById("volRange") as HTMLInputElement).value),
            fogDensity: parseInt((document.getElementById("fogRange") as HTMLInputElement).value),
            postProcessing: (document.getElementById("ppToggle") as HTMLInputElement).checked
        });
    }

    private async _start(isLoad: boolean): Promise<void> {
        if (this._isStarting) return;
        this._isStarting = true;
        this._setStartingState(true);

        if (this._menuElement) {
            this._menuElement.style.display = "none";
        }
        
        try {
            await this._onStart(isLoad);
            this._setStartingState(false);
        } catch (error) {
            console.error("Failed to start game", error);
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

        const startBtn = document.getElementById("startGame") as HTMLButtonElement | null;
        if (startBtn) startBtn.textContent = isStarting ? "Loading..." : "New Entry";
    }
}
