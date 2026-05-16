export interface GameSettings {
    sensitivity: number;
    volume: number;
    fogDensity: number;
    postProcessing: boolean;
}

export class SettingsManager {
    private static _settings: GameSettings = {
        sensitivity: 2000,
        volume: 50,
        fogDensity: 5,
        postProcessing: false
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
        console.log(`Settings applied: Sens=${this._settings.sensitivity}, Vol=${this._settings.volume}, Fog=${this._settings.fogDensity}`);
    }

    public static previewVolume(volume: number): void {
        this._settings.volume = this._clamp(Math.round(volume), 0, 100);
        (window as any).soundManager?.setMasterVolume(this._settings.volume / 100);
    }

    public static get settings(): GameSettings {
        return this._settings;
    }

    private static _sanitize(settings: Partial<GameSettings>): GameSettings {
        return {
            sensitivity: this._clamp(Math.round(settings.sensitivity ?? 2000), 100, 5000),
            volume: this._clamp(Math.round(settings.volume ?? 50), 0, 100),
            fogDensity: this._clamp(Math.round(settings.fogDensity ?? 5), 0, 10),
            postProcessing: Boolean(settings.postProcessing ?? false)
        };
    }

    private static _clamp(value: number, min: number, max: number): number {
        if (!Number.isFinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }
}
