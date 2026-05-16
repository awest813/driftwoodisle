import { Scene, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";

export class Ocean {
    private _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;
        
        const ocean = MeshBuilder.CreateGround("ocean", { width: 1000, height: 1000 }, this._scene);
        ocean.position.y = -0.5;
        
        const mat = new StandardMaterial("ocean_mat", this._scene);
        mat.diffuseColor = new Color3(0.1, 0.5, 0.8);
        mat.specularColor = new Color3(0.5, 0.5, 0.5);
        mat.alpha = 0.4;
        
        ocean.material = mat;

        // Subtle wave animation
        let time = 0;
        this._scene.onBeforeRenderObservable.add(() => {
            time += 0.01;
            ocean.position.y = -0.5 + Math.sin(time) * 0.1;
        });
    }
}
