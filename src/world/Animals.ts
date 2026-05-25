import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Interactable } from "../interaction/Interactable";
import type { ResourceType } from "../inventory/ItemTypes";
import { SoundManager } from "../game/SoundManager";
import type { Combatant } from "../combat/CombatSystem";

export interface AnimalSpec {
    species: string;
    name: string;
    hostile: boolean;          // attacks the player on sight until tamed
    tameFood: ResourceType[];  // items that befriend it
    tameCount: number;         // feedings needed to tame
    health: number;            // hits it can take when fought
    biteDamage: number;        // damage per attack (hostile only)
    bodyColor: [number, number, number];
    legColor: [number, number, number];
    scale: number;             // overall size multiplier
    speed: number;             // wander/chase speed (m/s)
    form: "quad" | "primate";
}

export const ANIMAL_SPECS: Record<string, AnimalSpec> = {
    monkey: {
        species: "monkey", name: "Monkey", hostile: false,
        tameFood: ["banana", "coconut", "berry"], tameCount: 2,
        health: 40, biteDamage: 0,
        bodyColor: [0.45, 0.3, 0.18], legColor: [0.32, 0.21, 0.12],
        scale: 0.75, speed: 2.2, form: "primate",
    },
    boar: {
        species: "boar", name: "Boar", hostile: false,
        tameFood: ["berry", "banana"], tameCount: 3,
        health: 70, biteDamage: 0,
        bodyColor: [0.3, 0.24, 0.2], legColor: [0.2, 0.16, 0.13],
        scale: 0.9, speed: 2.4, form: "quad",
    },
    wolf: {
        species: "wolf", name: "Wolf", hostile: true,
        tameFood: ["meat", "fish"], tameCount: 3,
        health: 60, biteDamage: 6,
        bodyColor: [0.55, 0.55, 0.6], legColor: [0.4, 0.4, 0.45],
        scale: 0.95, speed: 3.4, form: "quad",
    },
    tiger: {
        species: "tiger", name: "Tiger", hostile: true,
        tameFood: ["meat"], tameCount: 5,
        health: 110, biteDamage: 12,
        bodyColor: [0.85, 0.5, 0.15], legColor: [0.6, 0.34, 0.1],
        scale: 1.15, speed: 3.8, form: "quad",
    },
};

export interface AnimalContext {
    scene: Scene;
    isWalkable: (x: number, z: number) => boolean;
    isClear: (x: number, z: number, pad: number) => boolean;
    onTamed?: (species: string) => void;
}

type State = "wander" | "chase" | "flee" | "tamed";

export class Animal implements Combatant {
    private _scene: Scene;
    private _spec: AnimalSpec;
    private _ctx: AnimalContext;
    private _root: Mesh;
    private _home: Vector3;
    private _target: Vector3;
    private _state: State = "wander";
    private _maxHp: number;
    private _hp: number;
    private _tameProgress = 0;
    private _tamed = false;
    private _dead = false;
    private _pauseUntil = 0;
    private _lastBite = 0;
    private _windupUntil = 0;
    private _staggerUntil = 0;
    private _fleeUntil = 0;
    private _enrageUntil = 0;
    private _phase = Math.random() * Math.PI * 2;
    private _obs: Observer<Scene> | null = null;
    private _disposed = false;
    private _flashUntil = 0;
    private _bodyMat: StandardMaterial;
    private _baseEmissive: Color3;
    private _barRoot: Mesh | null = null;
    private _barFill: Mesh | null = null;
    private _barHideAt = 0;

    private readonly _pad = 0.6;
    private readonly _wanderRadius = 6;
    private readonly _aggroRange = 13;
    private readonly _attackRange = 1.8;
    private readonly _biteCooldownMs = 1400;
    private readonly _windupMs = 360;

    public get isAlive(): boolean { return !this._dead && !this._disposed; }
    public get isTamed(): boolean { return this._tamed; }

    constructor(spec: AnimalSpec, position: Vector3, ctx: AnimalContext, id: string) {
        this._scene = ctx.scene;
        this._spec = spec;
        this._ctx = ctx;
        this._maxHp = spec.health;
        this._hp = spec.health;
        this._home = position.clone();
        this._target = position.clone();

        this._root = this._buildMesh(id);
        this._root.position = position.clone();
        this._bodyMat = this._root.material as StandardMaterial;
        this._baseEmissive = this._bodyMat.emissiveColor.clone();

        this._attachInteractable(id);
        this._buildHealthBar(id);
        this._pickTarget();

        this._obs = this._scene.onBeforeRenderObservable.add(() => this._tick());
        this._root.onDisposeObservable.add(() => {
            this._disposed = true;
            if (this._obs) this._scene.onBeforeRenderObservable.remove(this._obs);
        });
    }

    public get mesh(): Mesh { return this._root; }

    private _mat(name: string, rgb: [number, number, number]): StandardMaterial {
        const m = new StandardMaterial(name, this._scene);
        m.diffuseColor = new Color3(rgb[0], rgb[1], rgb[2]);
        m.specularColor = new Color3(0.05, 0.05, 0.05);
        return m;
    }

    private _buildMesh(id: string): Mesh {
        const s = this._spec.scale;
        const bodyMat = this._mat(`${id}_body`, this._spec.bodyColor);
        const legMat = this._mat(`${id}_leg`, this._spec.legColor);

        let root: Mesh;
        const parts: Mesh[] = [];

        if (this._spec.form === "quad") {
            root = MeshBuilder.CreateBox(id, { width: 0.5 * s, height: 0.5 * s, depth: 1.2 * s }, this._scene);
            root.material = bodyMat;

            const head = MeshBuilder.CreateBox(`${id}_head`, { width: 0.42 * s, height: 0.42 * s, depth: 0.42 * s }, this._scene);
            head.position = new Vector3(0, 0.12 * s, 0.72 * s);
            head.material = bodyMat;
            parts.push(head);

            const snout = MeshBuilder.CreateBox(`${id}_snout`, { width: 0.18 * s, height: 0.16 * s, depth: 0.25 * s }, this._scene);
            snout.position = new Vector3(0, 0.04 * s, 0.95 * s);
            snout.material = legMat;
            parts.push(snout);

            const tail = MeshBuilder.CreateBox(`${id}_tail`, { width: 0.1 * s, height: 0.1 * s, depth: 0.5 * s }, this._scene);
            tail.position = new Vector3(0, 0.18 * s, -0.78 * s);
            tail.material = legMat;
            parts.push(tail);

            const legY = -0.42 * s;
            const lx = 0.18 * s, lz = 0.42 * s;
            for (const [px, pz] of [[lx, lz], [-lx, lz], [lx, -lz], [-lx, -lz]]) {
                const leg = MeshBuilder.CreateBox(`${id}_leg`, { width: 0.14 * s, height: 0.5 * s, depth: 0.14 * s }, this._scene);
                leg.position = new Vector3(px, legY, pz);
                leg.material = legMat;
                parts.push(leg);
            }
        } else {
            // primate: upright torso + round head + limbs
            root = MeshBuilder.CreateBox(id, { width: 0.4 * s, height: 0.6 * s, depth: 0.35 * s }, this._scene);
            root.material = bodyMat;

            const head = MeshBuilder.CreateSphere(`${id}_head`, { diameter: 0.42 * s }, this._scene);
            head.position = new Vector3(0, 0.5 * s, 0.05 * s);
            head.material = bodyMat;
            parts.push(head);

            const face = MeshBuilder.CreateSphere(`${id}_face`, { diameter: 0.24 * s }, this._scene);
            face.position = new Vector3(0, 0.46 * s, 0.18 * s);
            face.material = legMat;
            parts.push(face);

            for (const px of [0.28 * s, -0.28 * s]) {
                const arm = MeshBuilder.CreateBox(`${id}_arm`, { width: 0.12 * s, height: 0.5 * s, depth: 0.12 * s }, this._scene);
                arm.position = new Vector3(px, 0.05 * s, 0);
                arm.material = legMat;
                parts.push(arm);
            }
            for (const px of [0.14 * s, -0.14 * s]) {
                const leg = MeshBuilder.CreateBox(`${id}_leg`, { width: 0.14 * s, height: 0.4 * s, depth: 0.14 * s }, this._scene);
                leg.position = new Vector3(px, -0.48 * s, 0);
                leg.material = legMat;
                parts.push(leg);
            }
            const tail = MeshBuilder.CreateBox(`${id}_tail`, { width: 0.08 * s, height: 0.08 * s, depth: 0.5 * s }, this._scene);
            tail.position = new Vector3(0, -0.1 * s, -0.4 * s);
            tail.material = legMat;
            parts.push(tail);
        }

        for (const p of parts) {
            p.parent = root;
            p.isPickable = false;
        }
        // Lift the root so feet rest on the ground.
        const lift = this._spec.form === "quad" ? 0.7 * s : 0.78 * s;
        root.position.y += lift;
        this._home.y += lift;
        this._target.y += lift;
        return root;
    }

    private _buildHealthBar(id: string): void {
        const w = 1.1, h = 0.16;
        const bg = MeshBuilder.CreatePlane(`${id}_bar`, { width: w, height: h }, this._scene);
        const bgMat = new StandardMaterial(`${id}_barbg`, this._scene);
        bgMat.disableLighting = true;
        bgMat.emissiveColor = new Color3(0.08, 0.02, 0.02);
        bg.material = bgMat;
        bg.billboardMode = Mesh.BILLBOARDMODE_ALL;
        bg.isPickable = false;
        bg.renderingGroupId = 1;
        bg.parent = this._root;
        const headY = (this._spec.form === "quad" ? 0.95 : 1.15) * this._spec.scale;
        bg.position = new Vector3(0, headY, 0);

        const fill = MeshBuilder.CreatePlane(`${id}_barfill`, { width: w, height: h * 0.66 }, this._scene);
        const fillMat = new StandardMaterial(`${id}_barfm`, this._scene);
        fillMat.disableLighting = true;
        fillMat.emissiveColor = new Color3(0.3, 0.8, 0.25);
        fill.material = fillMat;
        fill.isPickable = false;
        fill.renderingGroupId = 1;
        fill.parent = bg;
        fill.position = new Vector3(0, 0, -0.01);

        this._barRoot = bg;
        this._barFill = fill;
        bg.setEnabled(false);
    }

    private _updateHealthBar(): void {
        if (!this._barFill) return;
        const ratio = Math.max(0, Math.min(1, this._hp / this._maxHp));
        this._barFill.scaling.x = ratio || 0.0001;
        this._barFill.position.x = -(1 - ratio) * 1.1 / 2;
        const mat = this._barFill.material as StandardMaterial;
        // green -> yellow -> red
        mat.emissiveColor = new Color3(
            ratio < 0.5 ? 0.85 : 0.85 - (ratio - 0.5) * 1.1,
            ratio < 0.5 ? 0.25 + ratio * 1.1 : 0.8,
            0.18,
        );
    }

    public takeHit(damage: number, fromPosition: Vector3, knockback: number): void {
        if (!this.isAlive || this._tamed) return;
        const now = performance.now();
        this._hp -= damage;

        // hit flash
        this._flashUntil = now + 140;
        this._bodyMat.emissiveColor = new Color3(0.6, 0.06, 0.06);

        // knockback away from the attacker, clamped to walkable ground
        const dir = this._root.position.subtract(fromPosition);
        dir.y = 0;
        if (dir.lengthSquared() > 1e-4) {
            dir.normalize();
            for (const f of [1, 0.5, 0.25]) {
                const nx = this._root.position.x + dir.x * knockback * f;
                const nz = this._root.position.z + dir.z * knockback * f;
                if (this._ctx.isWalkable(nx, nz) && this._ctx.isClear(nx, nz, this._pad)) {
                    this._root.position.x = nx;
                    this._root.position.z = nz;
                    break;
                }
            }
        }

        this._staggerUntil = now + 320;
        this._windupUntil = 0; // interrupt any telegraphed bite

        if (this._barRoot) {
            this._barRoot.setEnabled(true);
            this._barHideAt = now + 5000;
            this._updateHealthBar();
        }
        SoundManager.instance?.play("hurt");

        const hud = (window as any).game?.hud;
        if (this._hp <= 0) {
            this._die(hud);
            return;
        }

        // reaction: prey flees, predators enrage
        if (this._spec.hostile) {
            this._enrageUntil = now + 4000;
            this._state = "chase";
            if (Math.random() < 0.4) SoundManager.instance?.play("roar");
        } else {
            this._fleeUntil = now + 6000;
            this._state = "flee";
        }
    }

    private _die(hud: any): void {
        if (this._dead) return;
        this._dead = true;
        this._barRoot?.setEnabled(false);

        const inv = (window as any).game?.inventory;
        const drops: string[] = [];
        const meat = this._spec.species === "monkey" ? 1 : 2;
        inv?.addItem?.("meat", meat);
        drops.push(`+${meat} Raw Meat`);
        if (this._spec.species !== "monkey" && Math.random() < 0.85) {
            inv?.addItem?.("bone", 1);
            drops.push("+1 Bone");
        }
        hud?.showNotification?.(`You took down the ${this._spec.name}. (${drops.join(", ")})`, "gain");

        // topple-and-sink death, then remove
        const start = performance.now();
        const baseY = this._root.position.y;
        const dieObs = this._scene.onBeforeRenderObservable.add(() => {
            const t = (performance.now() - start) / 850;
            this._root.rotation.z = Math.min(Math.PI / 2, t * Math.PI * 0.8);
            this._root.position.y = baseY - Math.min(0.55, t * 0.6);
            if (t >= 1) {
                this._scene.onBeforeRenderObservable.remove(dieObs);
                this._root.dispose();
            }
        });
    }

    private _playerXZ(): { x: number; z: number } | null {
        const cam = this._scene.activeCamera;
        if (!cam) return null;
        return { x: cam.position.x, z: cam.position.z };
    }

    private _pickTarget(): void {
        for (let i = 0; i < 14; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * this._wanderRadius;
            const tx = this._home.x + Math.cos(a) * r;
            const tz = this._home.z + Math.sin(a) * r;
            if (this._ctx.isWalkable(tx, tz) && this._ctx.isClear(tx, tz, this._pad)) {
                this._target = new Vector3(tx, this._home.y, tz);
                return;
            }
        }
        this._target = this._home.clone();
    }

    private _faceAndStep(targetX: number, targetZ: number, speed: number, dt: number): boolean {
        const dx = targetX - this._root.position.x;
        const dz = targetZ - this._root.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.05) return true;
        const nx = dx / dist, nz = dz / dist;
        const step = Math.min(dist, speed * dt);
        const nextX = this._root.position.x + nx * step;
        const nextZ = this._root.position.z + nz * step;
        if (!this._ctx.isWalkable(nextX, nextZ) || !this._ctx.isClear(nextX, nextZ, this._pad)) {
            return false;
        }
        this._root.position.x = nextX;
        this._root.position.z = nextZ;
        this._root.rotation.y = Math.atan2(nx, nz);
        // gait bob
        const t = performance.now() * 0.02 + this._phase;
        this._root.position.y = this._home.y + Math.abs(Math.sin(t)) * 0.05;
        return false;
    }

    private _tick(): void {
        if (this._disposed || this._dead) return;
        const dt = Math.min(0.05, this._scene.getEngine().getDeltaTime() / 1000);
        const now = performance.now();

        // Reset hit flash.
        if (this._flashUntil && now > this._flashUntil) {
            this._flashUntil = 0;
            this._bodyMat.emissiveColor = this._baseEmissive.clone();
        }
        // Auto-hide the health bar once combat lulls.
        if (this._barRoot?.isEnabled() && now > this._barHideAt) {
            this._barRoot.setEnabled(false);
        }

        const player = this._playerXZ();
        const runEnded = document.body.classList.contains("run-ended");

        let distToPlayer = Infinity;
        if (player) {
            const dx = player.x - this._root.position.x;
            const dz = player.z - this._root.position.z;
            distToPlayer = Math.sqrt(dx * dx + dz * dz);
        }

        // Stagger from a hit: freeze movement briefly.
        if (now < this._staggerUntil) {
            this._root.position.y = this._home.y;
            return;
        }

        // Decide state.
        if (this._tamed) {
            this._state = "tamed";
        } else if (now < this._fleeUntil) {
            this._state = "flee";
        } else if (this._spec.hostile && player && !runEnded && distToPlayer < this._aggroRange) {
            this._state = "chase";
        } else if (this._state === "chase" || this._state === "flee") {
            this._state = "wander";
        }

        const enraged = now < this._enrageUntil;
        const speed = this._spec.speed * (enraged ? 1.3 : 1);

        if (this._state === "tamed" && player) {
            if (distToPlayer > 3.5) {
                this._faceAndStep(player.x, player.z, this._spec.speed, dt);
            } else {
                this._root.position.y = this._home.y + Math.abs(Math.sin(now * 0.004 + this._phase)) * 0.03;
            }
            return;
        }

        if (this._state === "flee" && player) {
            // Run directly away from the player.
            const awayX = this._root.position.x + (this._root.position.x - player.x);
            const awayZ = this._root.position.z + (this._root.position.z - player.z);
            const moved = this._faceAndStep(awayX, awayZ, this._spec.speed * 1.25, dt);
            if (!moved && !this._ctx.isWalkable(awayX, awayZ)) {
                // cornered: sidestep
                this._faceAndStep(this._home.x, this._home.z, this._spec.speed, dt);
            }
            return;
        }

        if (this._state === "chase" && player) {
            this._root.rotation.y = Math.atan2(player.x - this._root.position.x, player.z - this._root.position.z);
            if (distToPlayer <= this._attackRange) {
                // Telegraph: wind up, then bite. Interrupted by stagger (windup reset on hit).
                const cooldown = enraged ? this._biteCooldownMs * 0.65 : this._biteCooldownMs;
                if (this._windupUntil === 0 && now - this._lastBite > cooldown) {
                    this._windupUntil = now + this._windupMs;
                    if (Math.random() < 0.5) SoundManager.instance?.play("roar");
                }
                if (this._windupUntil > 0) {
                    // rear back during the windup so the player can react
                    const wp = 1 - Math.max(0, (this._windupUntil - now) / this._windupMs);
                    this._root.rotation.x = -0.5 * Math.sin(wp * Math.PI);
                    if (now >= this._windupUntil) {
                        this._windupUntil = 0;
                        this._lastBite = now;
                        this._root.rotation.x = 0;
                        this._bitePlayer();
                    }
                }
            } else {
                this._root.rotation.x = 0;
                this._windupUntil = 0;
                this._faceAndStep(player.x, player.z, speed, dt);
            }
            return;
        }

        // Wander.
        if (now < this._pauseUntil) {
            this._root.position.y = this._home.y + Math.abs(Math.sin(now * 0.004 + this._phase)) * 0.03;
            return;
        }
        const reached = this._faceAndStep(this._target.x, this._target.z, this._spec.speed * 0.5, dt);
        if (reached) {
            this._pauseUntil = now + 600 + Math.random() * 1800;
            this._pickTarget();
        } else if (!this._ctx.isWalkable(this._target.x, this._target.z)) {
            this._pickTarget();
        }
    }

    private _bitePlayer(): void {
        const combat = (window as any).game?.combat;
        if (combat?.damagePlayer) {
            combat.damagePlayer(this._spec.biteDamage, this._spec.name);
            return;
        }
        // Fallback if the combat system isn't wired yet.
        const stats = (window as any).game?.stats;
        stats?.decreaseHealth?.(this._spec.biteDamage);
        SoundManager.instance?.play("punch");
    }

    private _attachInteractable(id: string): void {
        const interactable: Interactable = {
            id,
            name: this._spec.name,
            prompt: this._tamed
                ? `[Click] Pet ${this._spec.name}`
                : `[Click] Approach ${this._spec.name}`,
            interact: (inventory: any, hud: any) => this._onInteract(inventory, hud),
        };
        this._root.metadata = { interactable, combatant: this };
    }

    private _refreshPrompt(): void {
        const meta = this._root.metadata?.interactable as Interactable | undefined;
        if (!meta) return;
        meta.prompt = this._tamed
            ? `[Click] Pet ${this._spec.name}`
            : this._spec.hostile
                ? `[Click] Feed ${this._spec.name} (${this._tameProgress}/${this._spec.tameCount})`
                : `[Click] Tame ${this._spec.name} (${this._tameProgress}/${this._spec.tameCount})`;
    }

    private _onInteract(inventory: any, hud: any): void {
        if (this._tamed) {
            SoundManager.instance?.play("pickup");
            hud?.showNotification(`${this._spec.name} wags happily.`, "info");
            return;
        }

        // Find a tame food the player is carrying.
        const food = this._spec.tameFood.find((f) => inventory.getQuantity(f) > 0);
        if (food) {
            inventory.removeItem(food, 1);
            this._tameProgress++;
            SoundManager.instance?.play("crab");
            if (this._tameProgress >= this._spec.tameCount) {
                this._tamed = true;
                this._state = "tamed";
                this._refreshPrompt();
                this._attachInteractable(this._root.name); // reset name/prompt for tamed state
                hud?.showNotification(`${this._spec.name} is now your companion!`, "gain");
                this._ctx.onTamed?.(this._spec.species);
            } else {
                this._refreshPrompt();
                hud?.showNotification(`${this._spec.name} takes the food (${this._tameProgress}/${this._spec.tameCount}).`, "info");
            }
            return;
        }

        // No food in hand.
        if (this._spec.hostile) {
            hud?.showNotification(`The ${this._spec.name} snarls — bring meat to tame it, or a weapon to fight.`, "warn");
        } else {
            hud?.showNotification(`The ${this._spec.name} is wary — offer ${this._foodHint()} to tame it.`, "warn");
        }
    }

    private _foodHint(): string {
        const names: Record<string, string> = {
            banana: "a banana", coconut: "a coconut", berry: "berries",
            meat: "raw meat", fish: "raw fish",
        };
        return this._spec.tameFood.map((f) => names[f] ?? f).join(" or ");
    }
}
