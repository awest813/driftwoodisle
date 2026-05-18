import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ProceduralTextures } from "./ProceduralTextures";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Scene } from "@babylonjs/core/scene";
import { PlayerStats } from "../player/PlayerStats";
import { SoundManager } from "../game/SoundManager";
import { SettingsManager } from "../save/SettingsManager";

export class WeatherSystem {
    private _scene: Scene;
    private _stats: PlayerStats;
    private _rainSystem: ParticleSystem | null = null;
    private _clouds: Mesh[] = [];
    private _isRaining: boolean = false;
    private _windTime: number = 0;
    private _rainEndTimeout: number | null = null;

    constructor(scene: Scene, stats: PlayerStats) {
        this._scene = scene;
        this._stats = stats;

        this._setupClouds();
        this._setupRain();

        // Roll for weather every ~90s. ~20% chance to start rain when clear, otherwise rain self-stops.
        setInterval(() => {
            if (this._isRaining) return;
            if (Math.random() < 0.20) {
                this.toggleRain(true);
                // Auto-clear after 45-90s so rain has a natural rhythm instead of nagging
                const duration = 45000 + Math.random() * 45000;
                if (this._rainEndTimeout !== null) window.clearTimeout(this._rainEndTimeout);
                this._rainEndTimeout = window.setTimeout(() => this.toggleRain(false), duration);
            }
        }, 90000);
    }

    private _setupRain(): void {
        this._rainSystem = new ParticleSystem("rain", 1200, this._scene);
        this._rainSystem.particleTexture = ProceduralTextures.radialFlare(this._scene);
        
        // Emission area (above player)
        this._rainSystem.emitter = new Vector3(0, 20, 0);
        this._rainSystem.minEmitBox = new Vector3(-42, 0, -42);
        this._rainSystem.maxEmitBox = new Vector3(42, 0, 42);
        
        this._rainSystem.color1 = new Color4(0.65, 0.78, 0.95, 0.55);
        this._rainSystem.color2 = new Color4(0.35, 0.55, 0.8, 0.35);
        
        this._rainSystem.minSize = 0.04;
        this._rainSystem.maxSize = 0.14;
        
        this._rainSystem.minLifeTime = 0.5;
        this._rainSystem.maxLifeTime = 1.0;
        
        this._rainSystem.emitRate = 0;
        this._rainSystem.gravity = new Vector3(-2, -18, 1);
        this._rainSystem.direction1 = new Vector3(-0.35, -1, 0.1);
        this._rainSystem.direction2 = new Vector3(0.1, -1, 0.35);
        
        this._rainSystem.start();

        setInterval(() => {
            if (this._isRaining) {
                this._stats.restoreThirst(1.0);

                let nearFire = false;
                let underShelter = false;
                if (this._scene.activeCamera) {
                    const p = this._scene.activeCamera.position;
                    this._scene.meshes.forEach(m => {
                        if (m.name === "campfire" && Vector3.Distance(m.position, p) < 6) {
                            nearFire = true;
                        }
                        if (m.name === "shelter" && Vector3.Distance(m.position, p) < 3.5) {
                            underShelter = true;
                        }
                    });
                }

                if (nearFire) {
                    this._stats.restoreWarmth(2.0);
                } else if (!underShelter) {
                    this._stats.decreaseWarmth(2.5);
                }
                // Under shelter (but no fire): rain is blocked, warmth holds steady.
            }
        }, 1000);

        // Update emitter position to follow camera (if player exists)
        this._scene.onBeforeRenderObservable.add(() => {
            const cam = this._scene.activeCamera;
            if (cam && this._rainSystem) {
                this._rainSystem.emitter = cam.position.add(new Vector3(0, 20, 0));
            }
            this._windTime += this._scene.getEngine().getDeltaTime() * 0.001;
            this._clouds.forEach((cloud, i) => {
                cloud.position.x += 0.004 + i * 0.0004;
                cloud.position.y = 58 + Math.sin(this._windTime + i) * 1.4;
                if (cloud.position.x > 95) cloud.position.x = -95;
            });
        });
    }

    private _setupClouds(): void {
        const cloudMat = new StandardMaterial("cloud_mat", this._scene);
        cloudMat.diffuseColor = new Color3(0.9, 0.92, 0.96);
        cloudMat.emissiveColor = new Color3(0.22, 0.24, 0.27);
        cloudMat.alpha = 0.28;
        cloudMat.backFaceCulling = false;
        cloudMat.disableLighting = true;

        const cloudPositions = [
            new Vector3(-70, 58, -45),
            new Vector3(-35, 61, 8),
            new Vector3(10, 57, -62),
            new Vector3(45, 60, 22),
            new Vector3(72, 56, -12)
        ];

        cloudPositions.forEach((position, i) => {
            const cloud = MeshBuilder.CreateDisc(`weather_cloud_${i}`, { radius: 18 + i * 2, tessellation: 18 }, this._scene);
            cloud.position = position;
            cloud.rotation.x = Math.PI / 2;
            cloud.scaling.x = 1.8;
            cloud.scaling.z = 0.45;
            cloud.material = cloudMat;
            cloud.isPickable = false;
            this._clouds.push(cloud);
        });
    }

    public toggleRain(on: boolean): void {
        this._isRaining = on;
        SoundManager.instance?.setRain(on);
        if (this._rainSystem) {
            this._rainSystem.emitRate = on ? 650 : 0;
        }

        if (on) {
            this._scene.fogMode = Scene.FOGMODE_EXP;
            this._scene.fogDensity = 0.014;
            this._scene.fogColor = new Color3(0.58, 0.62, 0.66);
        } else {
            this._scene.fogMode = Scene.FOGMODE_EXP;
            // Restore user's saved fog density instead of hardcoding the default
            this._scene.fogDensity = SettingsManager.settings.fogDensity * 0.0005;
            this._scene.fogColor = new Color3(0.68, 0.78, 0.82);
        }
    }

    public get isRaining(): boolean {
        return this._isRaining;
    }
}
