import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import "@babylonjs/core/Culling/ray";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Interactable } from "./Interactable";
import { SoundManager } from "../game/SoundManager";

export class InteractionSystem {
    private _scene: Scene;
    private _inventory: any;
    private _hud: any;
    private _stats: any;
    private _promptElement: HTMLElement | null;
    private _crosshairElement: HTMLElement | null;
    private _currentInteractable: Interactable | null = null;
    private _highlightedMesh: AbstractMesh | null = null;
    private _raycastDistance: number = 5;
    private _pickTimerMs: number = 0;
    private readonly _pickIntervalMs: number = 80;
    private readonly _selectorColor = new Color3(1, 0.78, 0.28);

    constructor(scene: Scene, inventory: any, hud: any, stats: any) {
        this._scene = scene;
        this._inventory = inventory;
        this._hud = hud;
        this._stats = stats;
        this._promptElement = document.getElementById("interactionPrompt");
        this._crosshairElement = document.getElementById("crosshair");
        
        this._setupInput();
        
        this._scene.onBeforeRenderObservable.add(() => {
            this._pickTimerMs += this._scene.getEngine().getDeltaTime();
            if (this._pickTimerMs >= this._pickIntervalMs) {
                this._pickTimerMs = 0;
                this._update();
            }
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

        if (targetMesh) {
            const interactable = targetMesh.metadata.interactable as Interactable;
            this._showPrompt(interactable);
            this._currentInteractable = interactable;
            this._setHighlightedMesh(targetMesh);
        } else {
            this._hidePrompt();
            this._currentInteractable = null;
            this._setHighlightedMesh(null);
        }
    }

    private _setHighlightedMesh(mesh: AbstractMesh | null): void {
        if (this._highlightedMesh === mesh) return;

        if (this._highlightedMesh) {
            this._highlightedMesh.renderOverlay = false;
            this._highlightedMesh.renderOutline = false;
        }

        this._highlightedMesh = mesh;

        if (this._highlightedMesh) {
            this._highlightedMesh.renderOutline = false;
            this._highlightedMesh.renderOverlay = true;
            this._highlightedMesh.overlayColor = this._selectorColor;
            this._highlightedMesh.overlayAlpha = 0.18;
            this._crosshairElement?.classList.add("targeted");
        } else {
            this._crosshairElement?.classList.remove("targeted");
        }
    }

    private _findNearbyInteractable(): AbstractMesh | null {
        const camera = this._scene.activeCamera;
        if (!camera) return null;

        const forward = camera.getForwardRay(1).direction.normalize();
        let closest: AbstractMesh | null = null;
        let closestDistance = Infinity;

        for (const mesh of this._scene.meshes) {
            if (!mesh.isEnabled() || !mesh.metadata?.interactable) continue;

            const toMesh = mesh.getAbsolutePosition().subtract(camera.position);
            const distance = toMesh.length();
            if (distance > 7) continue;

            const facing = Math.max(0, toMesh.normalize().dot(forward));
            if (facing < 0.35) continue;

            if (distance < closestDistance) {
                closest = mesh;
                closestDistance = distance;
            }
        }

        return closest;
    }

    private _showPrompt(interactable: Interactable): void {
        if (this._promptElement) {
            const action = this._formatPromptAction(interactable);
            this._promptElement.replaceChildren();
            this._promptElement.setAttribute("aria-label", `${interactable.name}: ${action}`);

            const nameElement = document.createElement("span");
            nameElement.className = "interaction-name";
            nameElement.textContent = interactable.name;

            const actionElement = document.createElement("span");
            actionElement.className = "interaction-action";
            actionElement.textContent = action;

            this._promptElement.append(nameElement, actionElement);
            this._promptElement.style.opacity = "1";
        }
    }

    private _formatPromptAction(interactable: Interactable): string {
        let action = interactable.prompt.replace(/\[Click\]\s*/i, "Click - ");
        const escapedName = interactable.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        action = action.replace(new RegExp(`\\s+${escapedName}$`, "i"), "");
        return action;
    }

    private _hidePrompt(): void {
        if (this._promptElement) {
            this._promptElement.style.opacity = "0";
        }
    }
}
