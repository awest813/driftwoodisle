import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";

export class Ocean {
    private _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;
        
        const ocean = MeshBuilder.CreateGround("ocean", { width: 1000, height: 1000 }, this._scene);
        ocean.position.y = -4;
        
        const mat = new StandardMaterial("ocean_mat", this._scene);
        mat.diffuseColor = new Color3(0.1, 0.5, 0.8);
        mat.specularColor = new Color3(0.5, 0.5, 0.5);
        mat.alpha = 0.4;
        
        ocean.material = mat;

        // Subtle wave animation
        let time = 0;
        this._scene.onBeforeRenderObservable.add(() => {
            time += 0.01;
            ocean.position.y = -4 + Math.sin(time) * 0.1;
        });
    }
}
