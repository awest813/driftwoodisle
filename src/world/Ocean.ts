import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { ProceduralTextures } from "./ProceduralTextures";

export class Ocean {
    private _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;

        const ocean = MeshBuilder.CreateGround("ocean", { width: 1000, height: 1000 }, this._scene);
        ocean.position.y = -4;

        const mat = new StandardMaterial("ocean_mat", this._scene);
        // Shared procedural water texture (the pond tiles a clone of the same
        // art) so the sea gets wave lines and sparkle instead of flat blue.
        const tex = ProceduralTextures.water(this._scene);
        tex.uScale = 90;
        tex.vScale = 90;
        mat.diffuseTexture = tex;
        mat.specularColor = new Color3(0.55, 0.55, 0.55);
        mat.alpha = 0.85;

        ocean.material = mat;

        // Subtle wave animation: gentle bob plus a slow texture drift.
        let time = 0;
        this._scene.onBeforeRenderObservable.add(() => {
            const dt = this._scene.getEngine().getDeltaTime() * 0.001;
            time += dt;
            ocean.position.y = -4 + Math.sin(time * 0.8) * 0.1;
            tex.uOffset = (time * 0.006) % 1;
            tex.vOffset = Math.sin(time * 0.05) * 0.04;
        });
    }
}
