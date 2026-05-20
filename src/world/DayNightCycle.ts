import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export class DayNightCycle {
    private _scene: Scene;
    private _sun: DirectionalLight;
    private _time: number = 0.3; // start in the morning
    private _dayDuration: number = 960000; // 16 minutes for a full day (8 day / 8 night)
    private _day: number = 1;
    
    constructor(scene: Scene, sun: DirectionalLight) {
        this._scene = scene;
        this._sun = sun;
        
        this._scene.onBeforeRenderObservable.add(() => {
            this._update();
        });

        setInterval(() => {
            const timeSpan = document.getElementById("timeClock");
            if (timeSpan) {
                const hours = Math.floor(this._time * 24);
                const mins = Math.floor((this._time * 24 * 60) % 60);
                timeSpan.innerText = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    private _update(): void {
        const deltaTime = this._scene.getEngine().getDeltaTime();
        this._time += deltaTime / this._dayDuration;
        if (this._time >= 1) {
            this._time -= 1;
            this._day++;
            const dSpan = document.getElementById("dayCount");
            if (dSpan) dSpan.innerText = this._day.toString();
        }

        // Calculate sun position (circular path)
        const angle = this._time * Math.PI * 2;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        
        this._sun.direction = new Vector3(x, -y, 0.5);
        
        // Intensity and Colors
        const isDay = y > 0;
        const intensity = Math.max(0, y);
        this._sun.intensity = intensity * 1.0;

        // Atmosphere colors
        const noonColor = new Color3(1, 1, 1);
        const nightColor = new Color3(0.05, 0.05, 0.2);

        // Interpolate background color; fog color is managed by WeatherSystem and SettingsManager
        const lerpFactor = Math.abs(y);
        const bgColor = Color3.Lerp(nightColor, isDay ? noonColor : nightColor, lerpFactor);
        this._scene.clearColor = bgColor.toColor4();
    }

    public get time(): number {
        return this._time;
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
