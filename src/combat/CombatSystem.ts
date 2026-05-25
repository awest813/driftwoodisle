import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { SoundManager } from "../game/SoundManager";
import { weaponFor, type WeaponStat } from "./Weapons";

export interface Combatant {
    isAlive: boolean;
    isTamed: boolean;
    takeHit(damage: number, fromPosition: Vector3, knockback: number): void;
}

export class CombatSystem {
    private _scene: Scene;
    private _hud: any;
    private _stats: any;
    private _cooldownUntil = 0;
    private _crosshair: HTMLElement | null;
    private _vignette: HTMLElement | null;
    private _shakeMag = 0;
    private _shakeBaseRot: { x: number; y: number } | null = null;

    constructor(scene: Scene, hud: any, stats: any) {
        this._scene = scene;
        this._hud = hud;
        this._stats = stats;
        this._crosshair = document.getElementById("crosshair");
        this._vignette = document.getElementById("damageVignette");
        this._scene.onBeforeRenderObservable.add(() => this._applyShake());
    }

    /** Returns true if the click was consumed as a combat action (player is armed). */
    public tryAttack(): boolean {
        const weapon = weaponFor(this._hud?.getActiveItem?.());
        if (!weapon) return false; // not armed — let the interaction system handle the click

        const now = performance.now();
        if (now < this._cooldownUntil) return true; // mid-swing: still a combat click, don't gather
        this._cooldownUntil = now + weapon.cooldownMs;

        this._stats?.useStamina?.(weapon.staminaCost);
        SoundManager.instance?.play("swing");
        this._animateSwing();
        this._cameraPunch();

        const target = this._findTarget(weapon);
        if (target) {
            const cam = this._scene.activeCamera;
            const from = cam ? cam.position.clone() : Vector3.Zero();
            target.combatant.takeHit(weapon.damage, from, weapon.knockback);
            SoundManager.instance?.play("hit");
            this._hitMarker();
        }
        return true;
    }

    private _findTarget(weapon: WeaponStat): { mesh: AbstractMesh; combatant: Combatant } | null {
        const cam = this._scene.activeCamera;
        if (!cam) return null;
        const forward = cam.getForwardRay(1).direction.normalize();

        let best: { mesh: AbstractMesh; combatant: Combatant } | null = null;
        let bestScore = -Infinity;
        for (const mesh of this._scene.meshes) {
            const c = mesh.metadata?.combatant as Combatant | undefined;
            if (!c || !c.isAlive || c.isTamed) continue;
            const to = mesh.getAbsolutePosition().subtract(cam.position);
            const dist = to.length();
            if (dist > weapon.range) continue;
            const dot = to.normalize().dot(forward);
            if (dot < weapon.arcDot) continue;
            // Prefer the most centred target, then the closest.
            const score = dot * 2 - dist * 0.1;
            if (score > bestScore) {
                bestScore = score;
                best = { mesh, combatant: c };
            }
        }
        return best;
    }

    /** Called by hostile animals when they land a bite. */
    public damagePlayer(amount: number, sourceName: string): void {
        if (document.body.classList.contains("run-ended")) return;
        this._stats?.decreaseHealth?.(amount);
        SoundManager.instance?.play("playerHurt");
        this._flashVignette(amount);
        this._shakeMag = Math.min(0.05, 0.012 + amount * 0.002);
        this._hud?.showNotification?.(`${sourceName} attacks you!`, "danger");
    }

    private _animateSwing(): void {
        if (!this._crosshair) return;
        this._crosshair.classList.remove("strike");
        void this._crosshair.offsetWidth;
        this._crosshair.classList.add("strike");
    }

    private _hitMarker(): void {
        if (!this._crosshair) return;
        this._crosshair.classList.remove("hit");
        void this._crosshair.offsetWidth;
        this._crosshair.classList.add("hit");
        setTimeout(() => this._crosshair?.classList.remove("hit"), 220);
    }

    private _flashVignette(amount: number): void {
        if (!this._vignette) return;
        this._vignette.style.setProperty("--dmg", Math.min(1, 0.35 + amount * 0.04).toString());
        this._vignette.classList.remove("flash");
        void this._vignette.offsetWidth;
        this._vignette.classList.add("flash");
    }

    private _cameraPunch(): void {
        this._shakeMag = Math.max(this._shakeMag, 0.008);
    }

    private _applyShake(): void {
        const cam = this._scene.activeCamera as any;
        if (!cam || this._shakeMag < 0.0005) {
            if (this._shakeBaseRot && cam?.rotation) {
                cam.rotation.x = this._shakeBaseRot.x;
                cam.rotation.y = this._shakeBaseRot.y;
                this._shakeBaseRot = null;
            }
            this._shakeMag = 0;
            return;
        }
        if (!cam.rotation) return;
        if (this._shakeBaseRot) {
            // restore previous frame's offset before applying a new one
            cam.rotation.x = this._shakeBaseRot.x;
            cam.rotation.y = this._shakeBaseRot.y;
        }
        this._shakeBaseRot = { x: cam.rotation.x, y: cam.rotation.y };
        cam.rotation.x += (Math.random() - 0.5) * this._shakeMag;
        cam.rotation.y += (Math.random() - 0.5) * this._shakeMag;
        this._shakeMag *= 0.82;
    }
}
