export type TouchControlsMode = "auto" | "on" | "off";

export interface GameSettings {
    sensitivity: number;
    volume: number;
    fogDensity: number;
    postProcessing: boolean;
    touchControls: TouchControlsMode;
    touchSensitivity: number;
    invertY: boolean;
    leftHanded: boolean;
}

export class SettingsManager {
    private static _settings: GameSettings = {
        sensitivity: 2000,
        volume: 50,
        fogDensity: 5,
        postProcessing: false,
        touchControls: "auto",
        touchSensitivity: 5,
        invertY: false,
        leftHanded: false
    };

    public static load(): GameSettings {
        const saved = localStorage.getItem("driftwood_settings");
        if (saved) {
            try {
                this._settings = this._sanitize(JSON.parse(saved));
            } catch {
                this._settings = this._sanitize(this._settings);
            }
        }
        return this._settings;
    }

    public static save(settings: GameSettings): void {
        this._settings = this._sanitize(settings);
        localStorage.setItem("driftwood_settings", JSON.stringify(this._settings));
        this.apply();
    }

    public static apply(): void {
        const game = (window as any).game;
        if (!game) return;

        // Apply fog
        if (game.scene) {
            game.scene.fogDensity = this._settings.fogDensity * 0.0005;
        }

        // Apply sensitivity to player controller if it exists
        if (game._playerController && game._playerController.camera) {
            game._playerController.camera.angularSensibility = this._settings.sensitivity;
        }

        // Apply high quality rendering as a resolution toggle. Full post-processing was too costly
        // and could render black on some low-end integrated GPUs.
        if (this._settings.postProcessing) {
            game.enableHighQualityRendering?.();
        } else {
            game.disableHighQualityRendering?.();
        }

        (window as any).soundManager?.setMasterVolume(this._settings.volume / 100);

        // Apply mobile control settings (auto-detect, enable/disable, sensitivity, etc.)
        const mobile = (window as any).mobileControls;
        if (mobile?.applySettings) {
            mobile.applySettings(this._settings);
        }

        console.log(`Settings applied: Sens=${this._settings.sensitivity}, Vol=${this._settings.volume}, Fog=${this._settings.fogDensity}, Touch=${this._settings.touchControls}`);
    }

    public static previewVolume(volume: number): void {
        this._settings.volume = this._clamp(Math.round(volume), 0, 100);
        (window as any).soundManager?.setMasterVolume(this._settings.volume / 100);
    }

    public static get settings(): GameSettings {
        return this._settings;
    }

    private static _sanitize(settings: Partial<GameSettings>): GameSettings {
        const touchMode = settings.touchControls;
        const validTouch: TouchControlsMode =
            touchMode === "on" || touchMode === "off" || touchMode === "auto" ? touchMode : "auto";
        return {
            sensitivity: this._clamp(Math.round(settings.sensitivity ?? 2000), 100, 5000),
            volume: this._clamp(Math.round(settings.volume ?? 50), 0, 100),
            fogDensity: this._clamp(Math.round(settings.fogDensity ?? 5), 0, 10),
            postProcessing: Boolean(settings.postProcessing ?? false),
            touchControls: validTouch,
            touchSensitivity: this._clamp(Math.round(settings.touchSensitivity ?? 5), 1, 10),
            invertY: Boolean(settings.invertY ?? false),
            leftHanded: Boolean(settings.leftHanded ?? false)
        };
    }

    private static _clamp(value: number, min: number, max: number): number {
        if (!Number.isFinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }
}
