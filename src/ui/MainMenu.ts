import { SaveSystem } from "../save/SaveSystem";
import { SettingsManager } from "../save/SettingsManager";
import { LoadingScreen } from "./LoadingScreen";

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
        const controlsBtn = document.getElementById("openControls");
        const continueSub = document.getElementById("continueSub");

        if (startBtn) startBtn.onclick = () => this._start(false);

        if (loadBtn) {
            if (SaveSystem.hasSave()) {
                loadBtn.disabled = false;
                loadBtn.onclick = () => this._start(true);
                if (continueSub) continueSub.textContent = "Pick up where you left off";
            }
        }

        if (settingsBtn) settingsBtn.onclick = () => this._showScreen("settingsMenu");
        if (creditsBtn) creditsBtn.onclick = () => this._showScreen("creditsMenu");
        if (controlsBtn) controlsBtn.onclick = () => this._showScreen("controlsMenu");

        // Back buttons
        document.getElementById("closeSettings")!.onclick = () => {
            this._saveSettings();
            this._showScreen("menuContent");
        };
        document.getElementById("closeCredits")!.onclick = () => this._showScreen("menuContent");
        document.getElementById("closeControls")!.onclick = () => this._showScreen("menuContent");

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
        document.getElementById("volValue")!.innerText = `${volRange.value}%`;
        document.getElementById("fogValue")!.innerText = `${fogRange.value}/10`;
        document.getElementById("qualityValue")!.innerText = ppToggle.checked ? "High" : "Low GPU";

        const touchLabel = touchModeSelect.value === "auto" ? "Auto" :
                           touchModeSelect.value === "on" ? "On" : "Off";
        document.getElementById("touchModeValue")!.innerText = touchLabel;
        document.getElementById("touchSensValue")!.innerText = touchSensRange.value;
        document.getElementById("invertYValue")!.innerText = invertYToggle.checked ? "On" : "Off";
        document.getElementById("leftHandedValue")!.innerText = leftHandedToggle.checked ? "On" : "Off";
    }

    private _saveSettings(): void {
        const touchMode = (document.getElementById("touchModeSelect") as HTMLSelectElement).value as
            "auto" | "on" | "off";
        SettingsManager.save({
            sensitivity: parseInt((document.getElementById("sensRange") as HTMLInputElement).value),
            volume: parseInt((document.getElementById("volRange") as HTMLInputElement).value),
            fogDensity: parseInt((document.getElementById("fogRange") as HTMLInputElement).value),
            postProcessing: (document.getElementById("ppToggle") as HTMLInputElement).checked,
            touchControls: touchMode,
            touchSensitivity: parseInt((document.getElementById("touchSensRange") as HTMLInputElement).value),
            invertY: (document.getElementById("invertYToggle") as HTMLInputElement).checked,
            leftHanded: (document.getElementById("leftHandedToggle") as HTMLInputElement).checked
        });
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
