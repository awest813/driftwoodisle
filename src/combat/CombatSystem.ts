import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { SoundManager } from "../game/SoundManager";
import { isGameplayActive } from "../game/GameState";
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
    // The shake we added to the camera last frame, so we can remove exactly that
    // contribution without disturbing the player's own mouse-look input.
    private _shakeOffX = 0;
    private _shakeOffY = 0;

    constructor(scene: Scene, hud: any, stats: any) {
        this._scene = scene;
        this._hud = hud;
        this._stats = stats;
        this._crosshair = document.getElementById("crosshair");
        this._vignette = document.getElementById("damageVignette");
        this._scene.onBeforeRenderObservable.add(() => this._applyShake());
    }

    public isArmed(): boolean {
        return !!weaponFor(this._hud?.getActiveItem?.());
    }

    public weaponRange(): number {
        return weaponFor(this._hud?.getActiveItem?.())?.range ?? 0;
    }

    /**
     * Attempt a melee swing. Returns true when the click was consumed as combat:
     * either a hit landed, or the player is clearly engaging a nearby enemy (a
     * whiff just out of reach — which suppresses accidental taming/gathering).
     * Returns false when armed but no enemy is in front, so the click falls
     * through to normal gathering — holding a weapon never blocks interaction.
     */
    public tryAttack(): boolean {
        if (!isGameplayActive()) return false;
        const weapon = weaponFor(this._hud?.getActiveItem?.());
        if (!weapon) return false;

        const target = this._findTarget(weapon, weapon.range);
        // Engaging an enemy slightly out of reach still counts as a combat click.
        const engaged = target ?? this._findTarget(weapon, weapon.range + 2);
        if (!engaged) return false; // no enemy in front — let interaction proceed

        const now = performance.now();
        if (now < this._cooldownUntil) return true; // mid-swing while engaged: don't gather/tame
        this._cooldownUntil = now + weapon.cooldownMs;

        this._stats?.useStamina?.(weapon.staminaCost);
        SoundManager.instance?.play("swing");
        this._animateSwing();
        this._cameraPunch();

        if (target) {
            const cam = this._scene.activeCamera;
            const from = cam ? cam.position.clone() : Vector3.Zero();
            target.combatant.takeHit(weapon.damage, from, weapon.knockback);
            SoundManager.instance?.play("hit");
            this._hitMarker();
        }
        return true;
    }

    private _findTarget(weapon: WeaponStat, range: number): { mesh: AbstractMesh; combatant: Combatant } | null {
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
            if (dist > range) continue;
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
        if (!isGameplayActive()) return;
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
        if (!cam?.rotation) return;

        // Undo only the shake we injected last frame, leaving the player's
        // mouse-look (applied since then) intact.
        cam.rotation.x -= this._shakeOffX;
        cam.rotation.y -= this._shakeOffY;
        this._shakeOffX = 0;
        this._shakeOffY = 0;

        if (this._shakeMag < 0.0005) {
            this._shakeMag = 0;
            return;
        }
        this._shakeOffX = (Math.random() - 0.5) * this._shakeMag;
        this._shakeOffY = (Math.random() - 0.5) * this._shakeMag;
        cam.rotation.x += this._shakeOffX;
        cam.rotation.y += this._shakeOffY;
        this._shakeMag *= 0.82;
    }
}
