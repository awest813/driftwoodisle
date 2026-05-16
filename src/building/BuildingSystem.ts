import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import "@babylonjs/core/Culling/ray";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import type { Scene } from "@babylonjs/core/scene";
import { HUD } from "../ui/HUD";
import type { Interactable } from "../interaction/Interactable";
import { SoundManager } from "../game/SoundManager";

export class BuildingSystem {
    private _scene: Scene;
    private _hud: HUD;
    private _currentGhost: Mesh | null = null;
    private _buildingType: string | null = null;
    private _currentRecipe: any = null;
    private _isBuilding: boolean = false;
    private _validMaterial: StandardMaterial;
    private _invalidMaterial: StandardMaterial;
    private _rotationAngle: number = 0;

    constructor(scene: Scene, hud: HUD) {
        this._scene = scene;
        this._hud = hud;

        this._validMaterial = new StandardMaterial("ghostValid", this._scene);
        this._validMaterial.diffuseColor = new Color3(0, 1, 0);
        this._validMaterial.alpha = 0.5;

        this._invalidMaterial = new StandardMaterial("ghostInvalid", this._scene);
        this._invalidMaterial.diffuseColor = new Color3(1, 0, 0);
        this._invalidMaterial.alpha = 0.5;

        this._setupInput();
        
        // Update ghost position every frame if building
        this._scene.onBeforeRenderObservable.add(() => {
            if (this._isBuilding) {
                this._updateGhostPosition();
            }
        });
    }

    private _setupInput(): void {
        this._scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 0) {
                if (this._isBuilding && this._currentGhost) {
                    this._placeStructure();
                }
            }
        });

        window.addEventListener("keydown", (e) => {
            if (e.code === "Escape" && this._isBuilding) {
                this._cancelBuilding();
            }
            if ((e.code === "KeyR" || e.code === "KeyQ") && this._isBuilding) {
                this._rotationAngle += (e.code === "KeyR" ? Math.PI / 4 : -Math.PI / 4);
                if (this._currentGhost) {
                    this._currentGhost.rotation.y = this._rotationAngle;
                }
            }
        });
    }

    public startBuilding(type: string, recipe?: any): void {
        if (this._isBuilding) this._cancelBuilding();

        this._buildingType = type;
        this._currentRecipe = recipe;
        this._isBuilding = true;
        this._rotationAngle = 0;
        SoundManager.instance?.play("menu");
        this._hud.showNotification(`Building mode: Place ${type}. Click to place, R to rotate, ESC to cancel.`);

        if (type === "campfire") {
            this._currentGhost = MeshBuilder.CreateCylinder("ghost_campfire", { height: 0.2, diameter: 1 }, this._scene);
        } else if (type === "shelter") {
            this._currentGhost = MeshBuilder.CreateBox("ghost_shelter", { width: 3, height: 2.5, depth: 3 }, this._scene);
        } else {
            this._currentGhost = MeshBuilder.CreateBox("ghost_default", { size: 1 }, this._scene);
        }

        if (this._currentGhost) {
            this._currentGhost.material = this._validMaterial;
            this._currentGhost.isPickable = false;
        }
    }

    private _cancelBuilding(): void {
        if (this._currentGhost) {
            this._currentGhost.dispose();
            this._currentGhost = null;
        }
        this._isBuilding = false;
        this._buildingType = null;
        SoundManager.instance?.play("menu");
        this._hud.showNotification("Building cancelled.");
    }

    private _updateGhostPosition(): void {
        if (!this._currentGhost) return;

        const camera = this._scene.activeCamera;
        if (!camera) return;

        const ray = camera.getForwardRay(8);
        const hit = this._scene.pickWithRay(ray, (mesh) => {
            return ["base1", "base2", "grove", "bluff"].includes(mesh.name);
        });

        if (hit && hit.pickedPoint) {
            const snap = 0.5;
            this._currentGhost.position.x = Math.round(hit.pickedPoint.x / snap) * snap;
            this._currentGhost.position.z = Math.round(hit.pickedPoint.z / snap) * snap;
            this._currentGhost.position.y = hit.pickedPoint.y;
            
            // For shelter, offset Y by half height so it sits on ground
            if (this._buildingType === "shelter") {
                this._currentGhost.position.y += 1.25;
            } else if (this._buildingType === "campfire") {
                this._currentGhost.position.y += 0.1;
            }

            this._currentGhost.rotation.y = this._rotationAngle;

            // Simple validation: mostly flat?
            if (hit.getNormal()) {
                const angle = Vector3.GetAngleBetweenVectors(hit.getNormal()!, Vector3.Up(), Vector3.Forward());
                if (Math.abs(angle) < 0.3) {
                    this._currentGhost.material = this._validMaterial;
                } else {
                    this._currentGhost.material = this._invalidMaterial;
                }
            }
        } else {
            // Not looking at ground
            this._currentGhost.position = ray.origin.add(ray.direction.scale(5));
            this._currentGhost.material = this._invalidMaterial;
        }
    }

    private _placeStructure(): void {
        if (!this._currentGhost || this._currentGhost.material === this._invalidMaterial) {
            SoundManager.instance?.play("error");
            this._hud.showNotification("Cannot place here!");
            return;
        }

        const type = this._buildingType;
        const position = this._currentGhost.position.clone();
        const rotation = this._currentGhost.rotation.y;
        const recipe = this._currentRecipe;

        this._currentGhost.dispose();
        this._currentGhost = null;
        this._isBuilding = false;
        this._buildingType = null;
        this._currentRecipe = null;

        // Create Blueprint Mesh
        let blueprint: Mesh;
        if (type === "campfire") {
            blueprint = MeshBuilder.CreateCylinder("blueprint_campfire", { height: 0.2, diameter: 1 }, this._scene);
        } else if (type === "shelter") {
            blueprint = MeshBuilder.CreateBox("blueprint_shelter", { width: 3, height: 2.5, depth: 3 }, this._scene);
        } else {
            return;
        }

        blueprint.position = position;
        blueprint.rotation.y = rotation;
        const mat = new StandardMaterial("blueprintMat", this._scene);
        mat.wireframe = true;
        mat.diffuseColor = new Color3(0, 0.5, 1);
        blueprint.material = mat;
        blueprint.checkCollisions = false;

        const remaining = { ...recipe.requires };

        blueprint.metadata = {
            interactable: {
                id: "blueprint_" + Date.now(),
                name: recipe.name + " Blueprint",
                prompt: this._getBlueprintPrompt(remaining),
                interact: (inventory: any, hud: any, _stats: any) => {
                    this._addResourcesToBlueprint(blueprint, inventory, hud, type!, remaining);
                }
            } as Interactable
        };

        this._hud.showNotification("Blueprint placed! Add resources to build.");
        SoundManager.instance?.play("build");
    }

    private _getBlueprintPrompt(remaining: Record<string, number>): string {
        const needs = Object.entries(remaining)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ");
        return `[Click] Add Resources (Needs: ${needs})`;
    }

    private _addResourcesToBlueprint(blueprint: Mesh, inventory: any, hud: any, type: string, remaining: Record<string, number>): void {
        let addedSomething = false;

        // Try to add resources
        for (const [resType, count] of Object.entries(remaining)) {
            if (count > 0) {
                const hasAmount = inventory.getQuantity(resType);
                if (hasAmount > 0) {
                    const toAdd = Math.min(hasAmount, count);
                    inventory.removeItem(resType, toAdd);
                    remaining[resType] -= toAdd;
                    addedSomething = true;
                }
            }
        }

        if (addedSomething) {
            SoundManager.instance?.play("pickup");
            hud.showNotification("Resources added to blueprint.");
        } else {
            SoundManager.instance?.play("error");
            hud.showNotification("You don't have the required resources.");
        }

        // Check if finished
        const isFinished = Object.values(remaining).every((v: unknown) => (v as number) <= 0);

        if (isFinished) {
            this._finishBuilding(blueprint, type);
        } else {
            // Update prompt
            blueprint.metadata.interactable.prompt = this._getBlueprintPrompt(remaining);
        }
    }

    private _finishBuilding(blueprint: Mesh, type: string): void {
        const position = blueprint.position.clone();
        const rotation = blueprint.rotation.y;
        blueprint.dispose();

        let newStructure: Mesh;

        if (type === "campfire") {
            newStructure = MeshBuilder.CreateCylinder("campfire", { height: 0.2, diameter: 1 }, this._scene);
            const mat = new StandardMaterial("campfireMat", this._scene);
            mat.diffuseColor = new Color3(0.5, 0.2, 0.1);
            newStructure.material = mat;
            newStructure.checkCollisions = true;

            const fire = new ParticleSystem("fire", 100, this._scene);
            fire.particleTexture = new Texture("https://playground.babylonjs.com/textures/fire.png", this._scene);
            fire.emitter = newStructure.position.add(new Vector3(0, 0.2, 0));
            fire.color1 = new Color4(1, 0.5, 0, 1.0);
            fire.color2 = new Color4(1, 0.1, 0, 1.0);
            fire.minSize = 0.2;
            fire.maxSize = 0.6;
            fire.minLifeTime = 0.2;
            fire.maxLifeTime = 0.5;
            fire.emitRate = 80;
            fire.direction1 = new Vector3(-0.2, 1, -0.2);
            fire.direction2 = new Vector3(0.2, 1, 0.2);
            fire.start();
            newStructure.metadata = {
                interactable: {
                    id: "campfire_" + Date.now(),
                    name: "Campfire",
                    prompt: "[Click] Cook Fish",
                    interact: (inventory: any, hud: any, stats: any) => {
                        const fish = inventory.getQuantity("fish");
                        if (fish > 0) {
                            SoundManager.instance?.play("fish");
                            inventory.removeItem("fish", 1);
                            stats.restoreHunger(40);
                            hud.showNotification("Cooked and ate fish! (+40 Hunger)");
                        } else {
                            SoundManager.instance?.play("error");
                            hud.showNotification("You need raw fish to cook.");
                        }
                    }
                } as Interactable
            };
            this._hud.showNotification("Campfire constructed!");
            SoundManager.instance?.play("build");
        } else if (type === "shelter") {
            newStructure = MeshBuilder.CreateBox("shelter", { width: 3, height: 2.5, depth: 3 }, this._scene);
            const mat = new StandardMaterial("shelterMat", this._scene);
            mat.diffuseColor = new Color3(0.4, 0.6, 0.3);
            newStructure.material = mat;
            newStructure.checkCollisions = true;
            this._hud.showNotification("Shelter constructed!");
            SoundManager.instance?.play("build");
        } else {
            return;
        }

        newStructure.position = position;
        newStructure.rotation.y = rotation;
    }
}
