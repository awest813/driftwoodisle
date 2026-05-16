import { Scene, PointerEventTypes, Mesh } from "@babylonjs/core";
import type { Interactable } from "./Interactable";
import { SoundManager } from "../game/SoundManager";

export class InteractionSystem {
    private _scene: Scene;
    private _inventory: any;
    private _hud: any;
    private _stats: any;
    private _promptElement: HTMLElement | null;
    private _currentInteractable: Interactable | null = null;
    private _raycastDistance: number = 5;

    constructor(scene: Scene, inventory: any, hud: any, stats: any) {
        this._scene = scene;
        this._inventory = inventory;
        this._hud = hud;
        this._stats = stats;
        this._promptElement = document.getElementById("interactionPrompt");
        
        this._setupInput();
        
        // Check every frame
        this._scene.onBeforeRenderObservable.add(() => {
            this._update();
        });
    }

    private _setupInput(): void {
        this._scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                if (pointerInfo.event.button !== 0) return;
                if (this._currentInteractable) {
                    SoundManager.instance?.play("punch");
                    this._currentInteractable.interact(this._inventory, this._hud, this._stats);
                }
            }
        });
    }

    private _update(): void {
        const camera = this._scene.activeCamera;
        if (!camera) return;

        const ray = camera.getForwardRay(this._raycastDistance);
        const pickInfo = this._scene.pickWithRay(ray, (mesh) => {
            return mesh.metadata && mesh.metadata.interactable;
        });

        const targetMesh = pickInfo && pickInfo.hit && pickInfo.pickedMesh
            ? pickInfo.pickedMesh
            : this._findNearbyInteractable();

        this._scene.meshes.forEach(m => m.renderOutline = false);

        if (targetMesh) {
            const interactable = targetMesh.metadata.interactable as Interactable;
            this._showPrompt(interactable);
            this._currentInteractable = interactable;
            targetMesh.renderOutline = true;
            targetMesh.outlineWidth = 0.1;
        } else {
            this._hidePrompt();
            this._currentInteractable = null;
        }
    }

    private _findNearbyInteractable(): Mesh | null {
        const camera = this._scene.activeCamera;
        if (!camera) return null;

        const forward = camera.getForwardRay(1).direction.normalize();
        let closest: Mesh | null = null;
        let closestDistance = Infinity;

        for (const mesh of this._scene.meshes) {
            if (!mesh.isEnabled() || !mesh.metadata?.interactable) continue;

            const toMesh = mesh.getAbsolutePosition().subtract(camera.position);
            const distance = toMesh.length();
            if (distance > 7) continue;

            const facing = Math.max(0, toMesh.normalize().dot(forward));
            if (facing < 0.35) continue;

            if (distance < closestDistance) {
                closest = mesh as Mesh;
                closestDistance = distance;
            }
        }

        return closest;
    }

    private _showPrompt(interactable: Interactable): void {
        if (this._promptElement) {
            this._promptElement.innerText = interactable.prompt;
            this._promptElement.style.opacity = "1";
        }
    }

    private _hidePrompt(): void {
        if (this._promptElement) {
            this._promptElement.style.opacity = "0";
        }
    }
}
