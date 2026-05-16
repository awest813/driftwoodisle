import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import "@babylonjs/core/Culling/ray";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { SoundManager } from "../game/SoundManager";

type FishingState = "idle" | "waiting" | "bite";

export class FishingSystem {
    private _scene: Scene;
    private _inventory: any;
    private _hud: any;
    private _state: FishingState = "idle";
    private _bobber: Mesh | null = null;
    private _biteTimer: number | null = null;
    private _missTimer: number | null = null;
    private _casts: number = 0;
    private _caught: number = 0;
    private _bobberBaseY: number = 0;
    private _lastUseAt: number = 0;
    private _waitingMat: StandardMaterial;
    private _biteMat: StandardMaterial;

    constructor(scene: Scene, inventory: any, hud: any) {
        this._scene = scene;
        this._inventory = inventory;
        this._hud = hud;

        this._waitingMat = new StandardMaterial("bobber_waiting_mat", this._scene);
        this._waitingMat.diffuseColor = new Color3(0.95, 0.95, 0.95);
        this._biteMat = new StandardMaterial("bobber_bite_mat", this._scene);
        this._biteMat.diffuseColor = new Color3(1, 0.12, 0.08);

        this._setupInput();
        this._scene.onBeforeRenderObservable.add(() => this._animateBobber());
    }

    private _setupInput(): void {
        const canvas = this._scene.getEngine().getRenderingCanvas();
        canvas?.addEventListener("pointerdown", (event) => {
            if (event.button !== 2) return;
            event.preventDefault();
            this._tryUseFishingRod();
        });
        canvas?.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            this._tryUseFishingRod();
        });

        this._scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type !== PointerEventTypes.POINTERDOWN || pointerInfo.event.button !== 2) return;
            pointerInfo.event.preventDefault();
            this._tryUseFishingRod();
        });
    }

    private _tryUseFishingRod(): void {
        const now = performance.now();
        if (now - this._lastUseAt < 140) return;
        this._lastUseAt = now;
        this._useFishingRod();
    }

    private _useFishingRod(): void {
        if (this._inventory.getQuantity("fishingRod") <= 0) {
            SoundManager.instance?.play("error");
            this._hud.showNotification("Craft a Fishing Rod to fish.");
            return;
        }

        if (this._state === "idle") {
            this._cast();
        } else if (this._state === "bite") {
            this._catchFish();
        } else {
            this._cancelCast("Reeled in too early.");
        }
    }

    private _cast(): void {
        const camera = this._scene.activeCamera;
        if (!camera) return;

        const ray = camera.getForwardRay(22);
        const hit = this._scene.pickWithRay(ray, (mesh) => mesh.name === "pond" || mesh.name === "ocean");
        if (!hit?.hit || !hit.pickedPoint) {
            SoundManager.instance?.play("error");
            this._hud.showNotification("Aim at water to cast.");
            return;
        }

        this._bobber = MeshBuilder.CreateSphere("fishing_bobber", { diameter: 0.35, segments: 8 }, this._scene);
        this._bobber.position = hit.pickedPoint.add(new Vector3(0, 0.18, 0));
        this._bobberBaseY = this._bobber.position.y;
        this._bobber.material = this._waitingMat;
        this._bobber.isPickable = false;
        this._state = "waiting";
        this._casts++;
        SoundManager.instance?.play("water");
        this._hud.showNotification("Cast line. Wait for a bite...");

        const biteDelay = 2500 + Math.random() * 4500;
        this._biteTimer = window.setTimeout(() => this._triggerBite(), biteDelay);
    }

    private _triggerBite(): void {
        if (this._state !== "waiting" || !this._bobber) return;
        this._state = "bite";
        this._bobber.material = this._biteMat;
        this._bobberBaseY -= 0.18;
        this._bobber.position.y = this._bobberBaseY;
        SoundManager.instance?.play("fish");
        this._hud.showNotification("Bite! Right-click to reel!");
        this._missTimer = window.setTimeout(() => this._cancelCast("The fish got away."), 2500);
    }

    private _catchFish(): void {
        this._clearTimers();
        this._inventory.addItem("fish", 1);
        this._caught++;
        SoundManager.instance?.play("fish");
        this._hud.showNotification("Caught Fish (+1 Raw Fish)");
        this._disposeBobber();
        this._state = "idle";
    }

    private _cancelCast(message: string): void {
        this._clearTimers();
        SoundManager.instance?.play("water");
        this._hud.showNotification(message);
        this._disposeBobber();
        this._state = "idle";
    }

    private _clearTimers(): void {
        if (this._biteTimer !== null) window.clearTimeout(this._biteTimer);
        if (this._missTimer !== null) window.clearTimeout(this._missTimer);
        this._biteTimer = null;
        this._missTimer = null;
    }

    private _disposeBobber(): void {
        this._bobber?.dispose();
        this._bobber = null;
    }

    private _animateBobber(): void {
        if (!this._bobber) return;
        const bob = Math.sin(performance.now() * 0.004) * (this._state === "bite" ? 0.08 : 0.035);
        this._bobber.position.y = this._bobberBaseY + bob;
    }

    public getStatus(): { state: FishingState; casts: number; caught: number; bobber: null | { x: number; y: number; z: number } } {
        return {
            state: this._state,
            casts: this._casts,
            caught: this._caught,
            bobber: this._bobber ? {
                x: Number(this._bobber.position.x.toFixed(1)),
                y: Number(this._bobber.position.y.toFixed(1)),
                z: Number(this._bobber.position.z.toFixed(1))
            } : null
        };
    }
}
