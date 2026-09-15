import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import { isGameplayActive } from "../game/GameState";

const _NOON_COLOR = new Color3(1, 1, 1);
const _NIGHT_COLOR = new Color3(0.05, 0.05, 0.2);
// Overcast wash the world lerps toward as cloud cover builds (storm gloom).
const _STORM_COLOR = new Color3(0.42, 0.46, 0.52);

// Emissive tints multiplied onto the sky-dome gradient texture.
const _SKY_DAY = new Color3(1, 1, 1);
const _SKY_NIGHT = new Color3(0.07, 0.09, 0.2);
const _SKY_GLOW = new Color3(1, 0.6, 0.38);
const _SKY_STORM = new Color3(0.5, 0.53, 0.58);

export class DayNightCycle {
    private _scene: Scene;
    private _sun: DirectionalLight;
    // Reused per-frame objects to avoid GC churn in the render loop.
    private _sunDir: Vector3 = new Vector3();
    private _bgColor: Color3 = new Color3();
    private _clearColor: Color4 = new Color4();
    // Sun position: _time of 0 is sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight.
    private _time: number = 1 / 12; // 08:00 on the clock, shortly after sunrise
    private _dayDuration: number = 960000; // 16 minutes for a full day (8 day / 8 night)
    private _day: number = 1;
    // 0 = clear sky, 1 = full storm overcast. WeatherSystem drives the target;
    // the actual value eases toward it so rain dims the world gradually.
    private _cloudCover: number = 0;
    private _cloudTarget: number = 0;
    // The sky dome renders an emissive gradient; tinting its material makes the
    // visible sky follow the sun and storms (clearColor alone is hidden by the dome).
    private _skyMat: StandardMaterial | null = null;
    private _skyTint: Color3 = new Color3(1, 1, 1);

    constructor(scene: Scene, sun: DirectionalLight) {
        this._scene = scene;
        this._sun = sun;
        this._skyMat = scene.getMeshByName("skyDome")?.material as StandardMaterial ?? null;

        this._scene.onBeforeRenderObservable.add(() => {
            this._update();
        });

        setInterval(() => {
            const timeSpan = document.getElementById("timeClock");
            if (timeSpan) {
                const hours = Math.floor(this._clockHours());
                const mins = Math.floor((this._clockHours() * 60) % 60);
                timeSpan.innerText = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    // Clock hours the player sees, offset so noon reads 12:00 while the sun peaks.
    private _clockHours(): number {
        return ((this._time + 0.25) * 24) % 24;
    }

    // True during the cold hours (roughly 19:30–05:30 on the displayed clock).
    public isNight(): boolean {
        const h = this._clockHours();
        return h >= 19.5 || h < 5.5;
    }

    private _update(): void {
        // The isle waits while a menu is up: freeze sun and clock like combat/AI do.
        if (!isGameplayActive()) return;
        const deltaTime = this._scene.getEngine().getDeltaTime();
        this._time += deltaTime / this._dayDuration;
        if (this._time >= 1) {
            this._time -= 1;
            this._day++;
            const dSpan = document.getElementById("dayCount");
            if (dSpan) dSpan.innerText = this._day.toString();
        }

        // Calculate sun position (circular path). Reuse vectors/colors — this
        // runs every frame and allocating here is pure GC churn.
        const angle = this._time * Math.PI * 2;
        const x = Math.cos(angle);
        const y = Math.sin(angle);

        this._sunDir.set(x, -y, 0.5);
        this._sun.direction = this._sunDir;

        // Intensity and Colors
        const isDay = y > 0;
        const intensity = Math.max(0, y);
        // Ease the actual cover toward the weather target (~4s to swing fully).
        const coverStep = Math.min(1, (deltaTime / 1000) / 4);
        this._cloudCover += (this._cloudTarget - this._cloudCover) * coverStep;
        // Heavy overcast chokes most of the direct sunlight.
        this._sun.intensity = intensity * (1 - this._cloudCover * 0.55);

        // Interpolate background color; fog color is managed by WeatherSystem and SettingsManager
        const lerpFactor = Math.abs(y);
        Color3.LerpToRef(_NIGHT_COLOR, isDay ? _NOON_COLOR : _NIGHT_COLOR, lerpFactor, this._bgColor);
        if (this._cloudCover > 0.001) {
            Color3.LerpToRef(this._bgColor, _STORM_COLOR, this._cloudCover * 0.6, this._bgColor);
        }
        this._scene.clearColor = this._clearColor.set(this._bgColor.r, this._bgColor.g, this._bgColor.b, 1);

        // Tint the visible sky dome: bright by day, navy at night, a warm band
        // around sunrise/sunset, and a grey wash under storm cloud cover.
        if (this._skyMat) {
            const dayFactor = Math.min(1, Math.max(0, y / 0.22));
            Color3.LerpToRef(_SKY_NIGHT, _SKY_DAY, dayFactor, this._skyTint);
            const glow = Math.max(0, 1 - Math.abs(y) / 0.22);
            if (glow > 0) {
                Color3.LerpToRef(this._skyTint, _SKY_GLOW, glow * 0.75, this._skyTint);
            }
            if (this._cloudCover > 0.001) {
                Color3.LerpToRef(this._skyTint, _SKY_STORM, this._cloudCover * 0.65, this._skyTint);
            }
            this._skyMat.emissiveColor.copyFrom(this._skyTint);
        }
    }

    public get time(): number {
        return this._time;
    }

    // Cloud cover the weather wants (0 clear .. 1 overcast). The rendered value
    // eases toward it every frame — see _update.
    public set cloudCover(target: number) {
        this._cloudTarget = Math.max(0, Math.min(1, target));
    }

    public get cloudCover(): number {
        return this._cloudCover;
    }

    public setTime(time: number): void {
        this._time = Math.max(0, Math.min(1, time));
    }

    public get day(): number {
        return this._day;
    }

    public setDay(day: number): void {
        this._day = Math.max(1, Math.floor(day));
        const dSpan = document.getElementById("dayCount");
        if (dSpan) dSpan.innerText = this._day.toString();
    }
}
