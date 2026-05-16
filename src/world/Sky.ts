import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { ProceduralTextures } from "./ProceduralTextures";

export type WeatherKind = "clear" | "storm";

export class Sky {
    private _scene: Scene;
    private _dome: Mesh;
    private _material: StandardMaterial;
    private _clearTex: DynamicTexture;
    private _stormTex: DynamicTexture;
    private _stormBlend: number = 0;
    private _stormTarget: number = 0;
    private _timeOfDay: number = 0.3;

    constructor(scene: Scene) {
        this._scene = scene;
        this._clearTex = ProceduralTextures.skyGradient(scene);
        this._stormTex = ProceduralTextures.skyStorm(scene);

        this._dome = MeshBuilder.CreateSphere(
            "skyDome",
            { diameter: 1000, segments: 24, sideOrientation: Mesh.BACKSIDE },
            scene
        );
        this._dome.infiniteDistance = true;
        this._dome.isPickable = false;
        this._dome.applyFog = false;
        this._dome.renderingGroupId = 0;

        this._material = new StandardMaterial("skyDomeMat", scene);
        this._material.backFaceCulling = false;
        this._material.disableLighting = true;
        this._material.fogEnabled = false;
        this._material.diffuseColor = new Color3(0, 0, 0);
        this._material.specularColor = new Color3(0, 0, 0);
        this._material.emissiveColor = new Color3(1, 1, 1);
        this._material.emissiveTexture = this._clearTex;
        this._dome.material = this._material;

        scene.onBeforeRenderObservable.add(() => this._update());
    }

    public setWeather(kind: WeatherKind): void {
        this._stormTarget = kind === "storm" ? 1 : 0;
    }

    public setTimeOfDay(time: number): void {
        this._timeOfDay = time;
    }

    public get mesh(): Mesh {
        return this._dome;
    }

    private _update(): void {
        const dt = Math.min(this._scene.getEngine().getDeltaTime(), 100) / 1000;
        this._stormBlend = Scalar.Lerp(this._stormBlend, this._stormTarget, Math.min(1, dt * 0.6));

        // Cross-fade the source texture once the blend crosses the midpoint so the
        // brightness ramp covers the swap and avoids a visible pop.
        const wantStorm = this._stormBlend > 0.5;
        const desired = wantStorm ? this._stormTex : this._clearTex;
        if (this._material.emissiveTexture !== desired) {
            this._material.emissiveTexture = desired;
        }

        const sunY = Math.sin(this._timeOfDay * Math.PI * 2);
        const dayBrightness = Scalar.Clamp(sunY * 1.1 + 0.35, 0.12, 1);
        const stormDarken = 1 - this._stormBlend * 0.65;
        const v = dayBrightness * stormDarken;
        this._material.emissiveColor.set(v, v, v);
    }
}
