import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import "@babylonjs/core/Culling/ray";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ProceduralTextures } from "../world/ProceduralTextures";
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
    private _ghostValid: boolean = true;
    private _blueprintMaterial: StandardMaterial;
    private _rotationAngle: number = 0;
    private _placedStations: { type: string; mesh: Mesh }[] = [];
    private _builtShelters: Mesh[] = [];
    private _pendingBlueprints: { mesh: Mesh; type: string; remaining: Record<string, number> }[] = [];

    public getPlacedStations(): { type: string; position: Vector3 }[] {
        return this._placedStations
            .filter(s => !s.mesh.isDisposed())
            .map(s => ({ type: s.type, position: s.mesh.position }));
    }

    constructor(scene: Scene, hud: HUD) {
        this._scene = scene;
        this._hud = hud;

        this._blueprintMaterial = new StandardMaterial("blueprintMat", this._scene);
        this._blueprintMaterial.wireframe = true;
        this._blueprintMaterial.diffuseColor = new Color3(0, 0.5, 1);
        this._blueprintMaterial.emissiveColor = new Color3(0, 0.15, 0.35);

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
        this._ghostValid = true;
        SoundManager.instance?.play("menu");
        this._hud.showNotification(`Building mode: Place ${type}. Click to place, R to rotate, ESC to cancel.`);

        // The ghost is built from the same parts and real materials as the
        // finished structure, then made translucent and tinted with the
        // valid/invalid colour — a true WYSIWYG preview instead of a blob.
        const parts = this._structureParts(type, null);
        if (parts) {
            const ghost = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!;
            ghost.name = `ghost_${type}`;
            ghost.isPickable = false;
            this._currentGhost = ghost;
            this._applyGhostTint(true);
        }
    }

    // Ghost materials are created fresh per startBuilding (the part builders
    // allocate new ones), so mutating them here can never leak into placed
    // structures — _finishBuilding builds another fresh set.
    private _applyGhostTint(valid: boolean): void {
        if (!this._currentGhost) return;
        const mat = this._currentGhost.material;
        const mats: StandardMaterial[] = [];
        if (mat instanceof MultiMaterial) {
            for (const sub of mat.subMaterials) if (sub) mats.push(sub as StandardMaterial);
        } else if (mat) {
            mats.push(mat as StandardMaterial);
        }
        for (const m of mats) {
            m.alpha = 0.55;
            m.emissiveColor = valid
                ? new Color3(0.05, 0.22, 0.06)
                : new Color3(0.32, 0.05, 0.05);
        }
    }

    private _cancelBuilding(): void {
        if (this._currentGhost) {
            const mat = this._currentGhost.material;
            this._currentGhost.dispose();
            // The ghost's temporary true-color materials are created per build;
            // without an explicit dispose the scene keeps them registered.
            if (mat && mat !== this._blueprintMaterial) mat.dispose();
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
            // Structures are built ground-anchored (y 0 at their base), so the
            // ghost needs no half-height offset to sit on the terrain.
            this._currentGhost.position.y = hit.pickedPoint.y;

            this._currentGhost.rotation.y = this._rotationAngle;

            // Simple validation: mostly flat?
            if (hit.getNormal()) {
                const angle = Vector3.GetAngleBetweenVectors(hit.getNormal()!, Vector3.Up(), Vector3.Forward());
                const valid = Math.abs(angle) < 0.3;
                if (valid !== this._ghostValid) {
                    this._ghostValid = valid;
                    this._applyGhostTint(valid);
                }
            }
        } else {
            // Not looking at ground
            this._currentGhost.position = ray.origin.add(ray.direction.scale(5));
            if (this._ghostValid) {
                this._ghostValid = false;
                this._applyGhostTint(false);
            }
        }
    }

    private _placeStructure(): void {
        if (!this._currentGhost || !this._ghostValid) {
            SoundManager.instance?.play("error");
            this._hud.showNotification("Cannot place here!");
            return;
        }

        const type = this._buildingType;
        const recipe = this._currentRecipe;

        // The ghost itself becomes the blueprint: same silhouette through every
        // build stage (ghost → wireframe blueprint → finished structure).
        const blueprint = this._currentGhost!;
        blueprint.name = `blueprint_${type}`;
        const ghostMat = blueprint.material;
        blueprint.material = this._blueprintMaterial;
        if (ghostMat && ghostMat !== this._blueprintMaterial) ghostMat.dispose();
        blueprint.checkCollisions = false;
        blueprint.isPickable = true;

        this._currentGhost = null;
        this._isBuilding = false;
        this._buildingType = null;
        this._currentRecipe = null;

        const remaining = { ...recipe.requires };

        this._pendingBlueprints.push({ mesh: blueprint, type: type!, remaining });
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

    // Ground-anchored part builders shared by ghost, blueprint and finished
    // structure so the silhouette never changes mid-build. `overrideMaterial`
    // paints every part one colour (ghost mode); null keeps final materials.
    private _structureParts(type: string, overrideMaterial: StandardMaterial | null): Mesh[] | null {
        switch (type) {
            case "campfire": return this._campfireParts(overrideMaterial);
            case "shelter": return this._shelterParts(overrideMaterial);
            case "workbench": return this._workbenchParts(overrideMaterial);
            case "dryingRack": return this._dryingRackParts(overrideMaterial);
            default: return null;
        }
    }

    private _mat(name: string, r: number, g: number, b: number): StandardMaterial {
        const mat = new StandardMaterial(name, this._scene);
        mat.diffuseColor = new Color3(r, g, b);
        return mat;
    }

    private _campfireParts(override: StandardMaterial | null): Mesh[] {
        const parts: Mesh[] = [];
        const stoneMat = override ?? this._mat("campfireStoneMat", 0.45, 0.44, 0.42);
        const logMat = override ?? this._mat("campfireLogMat", 0.42, 0.28, 0.14);
        const bedMat = override ?? this._mat("campfireBedMat", 0.12, 0.1, 0.09);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const stone = MeshBuilder.CreateBox(`fireStone${i}`, { width: 0.22, height: 0.16, depth: 0.22 }, this._scene);
            stone.position = new Vector3(Math.cos(a) * 0.52, 0.08, Math.sin(a) * 0.52);
            stone.rotation.y = a;
            stone.material = stoneMat;
            parts.push(stone);
        }
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            const log = MeshBuilder.CreateCylinder(`fireLog${i}`, { height: 0.9, diameter: 0.12, tessellation: 6 }, this._scene);
            log.rotation.x = Math.cos(a) * 0.6;
            log.rotation.z = -Math.sin(a) * 0.6;
            log.position = new Vector3(Math.sin(a) * 0.14, 0.3, Math.cos(a) * 0.14);
            log.material = logMat;
            parts.push(log);
        }
        const bed = MeshBuilder.CreateDisc("fireBed", { radius: 0.34, tessellation: 12 }, this._scene);
        bed.rotation.x = Math.PI / 2;
        bed.position.y = 0.04;
        bed.material = bedMat;
        parts.push(bed);
        return parts;
    }

    private _shelterParts(override: StandardMaterial | null): Mesh[] {
        const parts: Mesh[] = [];
        const poleMat = override ?? this._mat("shelterPoleMat", 0.45, 0.32, 0.18);
        const thatchMat = override ?? this._mat("shelterThatchMat", 0.35, 0.48, 0.22);
        const bedMat = override ?? this._mat("shelterBedMat", 0.76, 0.7, 0.55);
        for (const x of [-1.35, 1.35]) {
            const pole = MeshBuilder.CreateCylinder("shelterPole", { height: 1.7, diameter: 0.14, tessellation: 6 }, this._scene);
            pole.position = new Vector3(x, 0.85, 1.1);
            pole.material = poleMat;
            parts.push(pole);
        }
        const roof = MeshBuilder.CreateBox("shelterRoof", { width: 3, height: 0.1, depth: 3.4 }, this._scene);
        roof.rotation.x = -0.62;
        roof.position = new Vector3(0, 1.05, -0.25);
        roof.material = thatchMat;
        parts.push(roof);
        // Back wall closes the high side; a leaf bed marks the sleeping spot.
        const back = MeshBuilder.CreateBox("shelterBack", { width: 3, height: 1.9, depth: 0.08 }, this._scene);
        back.position = new Vector3(0, 0.95, -1.55);
        back.material = poleMat;
        parts.push(back);
        const bed = MeshBuilder.CreateBox("shelterBed", { width: 1.6, height: 0.1, depth: 1.0 }, this._scene);
        bed.position = new Vector3(0, 0.06, 0.3);
        bed.material = bedMat;
        parts.push(bed);
        if (!override) {
            // Safe only now that the material is attached to meshes.
            thatchMat.backFaceCulling = false;
        }
        return parts;
    }

    private _workbenchParts(override: StandardMaterial | null): Mesh[] {
        const parts: Mesh[] = [];
        const mat = override ?? this._mat("workbenchMat", 0.55, 0.35, 0.18);
        const top = MeshBuilder.CreateBox("workbenchTop", { width: 1.6, height: 0.12, depth: 0.8 }, this._scene);
        top.position.y = 0.85;
        top.material = mat;
        parts.push(top);
        for (const x of [-0.68, 0.68]) {
            for (const z of [-0.28, 0.28]) {
                const leg = MeshBuilder.CreateBox("workbenchLeg", { width: 0.12, height: 0.85, depth: 0.12 }, this._scene);
                leg.position = new Vector3(x, 0.425, z);
                leg.material = mat;
                parts.push(leg);
            }
        }
        return parts;
    }

    private _dryingRackParts(override: StandardMaterial | null): Mesh[] {
        const parts: Mesh[] = [];
        const woodMat = override ?? this._mat("dryingRackWoodMat", 0.45, 0.32, 0.2);
        const fishMat = override ?? this._mat("dryingRackFishMat", 0.82, 0.55, 0.45);
        for (const x of [-0.8, 0.8]) {
            const post = MeshBuilder.CreateCylinder("rackPost", { height: 1.6, diameter: 0.12, tessellation: 6 }, this._scene);
            post.position = new Vector3(x, 0.8, 0);
            post.material = woodMat;
            parts.push(post);
        }
        const bar = MeshBuilder.CreateCylinder("rackBar", { height: 1.75, diameter: 0.08, tessellation: 6 }, this._scene);
        bar.rotation.z = Math.PI / 2;
        bar.position.y = 1.55;
        bar.material = woodMat;
        parts.push(bar);
        for (const x of [-0.45, 0, 0.45]) {
            const fish = MeshBuilder.CreateCylinder("rackFish", { diameter: 0.16, height: 0.5, tessellation: 6 }, this._scene);
            fish.rotation.x = Math.PI / 2;
            fish.position = new Vector3(x, 1.22, 0);
            fish.material = fishMat;
            parts.push(fish);
        }
        return parts;
    }

    private _finishBuilding(blueprint: Mesh, type: string): void {
        const position = blueprint.position.clone();
        const rotation = blueprint.rotation.y;
        blueprint.dispose();
        this._pendingBlueprints = this._pendingBlueprints.filter(b => b.mesh !== blueprint);

        const parts = this._structureParts(type, null);
        if (!parts) return;
        const newStructure = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!;
        newStructure.name = type;
        newStructure.checkCollisions = true;
        newStructure.position = position;
        newStructure.rotation.y = rotation;

        if (type === "campfire") {
            const fire = new ParticleSystem("fire", 100, this._scene);
            fire.particleTexture = ProceduralTextures.fireParticle(this._scene);
            // Use the mesh itself as the emitter so the flame stays on the firepit if it ever moves
            fire.emitter = newStructure;
            fire.minEmitBox = new Vector3(-0.08, 0.3, -0.08);
            fire.maxEmitBox = new Vector3(0.08, 0.45, 0.08);
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
            // Campfire is a passive station — cooking happens via the crafting menu
            // when the player stands within range. The mesh stays interactable only as
            // a hint so the player learns the station exists.
            newStructure.metadata = {
                interactable: {
                    id: "campfire_" + Date.now(),
                    name: "Campfire",
                    prompt: "[Crafting station] Open menu to cook",
                    interact: (_inventory: any, hud: any) => {
                        hud.showNotification("Press E to open the crafting menu while standing here.");
                    }
                } as Interactable
            };
            this._placedStations.push({ type: "campfire", mesh: newStructure });
            this._hud.showNotification("Campfire constructed!");
            SoundManager.instance?.play("build");
        } else if (type === "shelter") {
            this._attachShelterMetadata(newStructure);
            this._builtShelters.push(newStructure);
            this._hud.showNotification("Shelter constructed!");
            SoundManager.instance?.play("build");
        } else if (type === "workbench") {
            newStructure.metadata = {
                interactable: {
                    id: "workbench_" + Date.now(),
                    name: "Workbench",
                    prompt: "[Crafting station] Open menu to use",
                    interact: (_inventory: any, hud: any) => {
                        hud.showNotification("Press E to open the crafting menu while standing here.");
                    }
                } as Interactable
            };
            this._placedStations.push({ type: "workbench", mesh: newStructure });
            this._hud.showNotification("Workbench constructed!");
            SoundManager.instance?.play("build");
        } else if (type === "dryingRack") {
            newStructure.metadata = {
                interactable: {
                    id: "dryingRack_" + Date.now(),
                    name: "Drying Rack",
                    prompt: "[Crafting station] Open menu to use",
                    interact: (_inventory: any, hud: any) => {
                        hud.showNotification("Press E to open the crafting menu while standing here.");
                    }
                } as Interactable
            };
            this._placedStations.push({ type: "dryingRack", mesh: newStructure });
            this._hud.showNotification("Drying Rack constructed!");
            SoundManager.instance?.play("build");
        } else {
            return;
        }
    }

    // --- Persistence -------------------------------------------------------
    // Structures and in-progress blueprints survive save/load. Blueprints keep
    // their remaining-resource counts so materials already donated are not lost.

    public serialize(): {
        stations: { type: string; x: number; y: number; z: number; ry: number }[];
        blueprints: { type: string; x: number; y: number; z: number; ry: number; remaining: Record<string, number> }[];
    } {
        const round = (v: number) => +v.toFixed(2);
        const stations = [
            ...this._placedStations
                .filter(s => !s.mesh.isDisposed())
                .map(s => ({ type: s.type, x: round(s.mesh.position.x), y: round(s.mesh.position.y), z: round(s.mesh.position.z), ry: +s.mesh.rotation.y.toFixed(3) })),
            ...this._builtShelters
                .filter(m => !m.isDisposed())
                .map(m => ({ type: "shelter", x: round(m.position.x), y: round(m.position.y), z: round(m.position.z), ry: +m.rotation.y.toFixed(3) })),
        ];
        const blueprints = this._pendingBlueprints
            .filter(b => !b.mesh.isDisposed())
            .map(b => ({ type: b.type, x: round(b.mesh.position.x), y: round(b.mesh.position.y), z: round(b.mesh.position.z), ry: +b.mesh.rotation.y.toFixed(3), remaining: { ...b.remaining } }));
        return { stations, blueprints };
    }

    public deserialize(data: {
        stations?: { type: string; x: number; y: number; z: number; ry: number }[];
        blueprints?: { type: string; x: number; y: number; z: number; ry: number; remaining: Record<string, number> }[];
    } | null | undefined): void {
        if (!data) return;

        // An in-session Load must replace the world's structures, not stack a
        // second copy on top of them (fresh-page Continue is unaffected but
        // this path is used by the pause-menu Load Game button).
        const doomed = [
            ...this._placedStations.map(s => s.mesh),
            ...this._builtShelters,
            ...this._pendingBlueprints.map(b => b.mesh),
        ];
        const particleSystems = [...this._scene.particleSystems];
        for (const mesh of doomed) {
            if (mesh.isDisposed()) continue;
            for (const ps of particleSystems) {
                if (ps.emitter === mesh) { ps.stop(); ps.dispose(); }
            }
            mesh.dispose();
        }
        this._placedStations = [];
        this._builtShelters = [];
        this._pendingBlueprints = [];

        for (const st of data.stations ?? []) {
            if (st.type === "shelter") {
                const mesh = this._spawnStructureMesh("shelter", st);
                this._attachShelterMetadata(mesh);
                this._builtShelters.push(mesh);
            } else {
                const mesh = this._spawnStructureMesh(st.type, st);
                mesh.metadata = {
                    interactable: this._stationInteractable(st.type, mesh)
                };
                this._placedStations.push({ type: st.type, mesh });
            }
        }

        for (const bp of data.blueprints ?? []) {
            // Build the blueprint silhouette straight onto the shared wireframe
            // material so no real part materials are created just to be orphaned.
            const parts = this._structureParts(bp.type, this._blueprintMaterial);
            if (!parts) continue;
            const mesh = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!;
            mesh.name = `blueprint_${bp.type}`;
            // Merge may wrap the single shared material in a MultiMaterial;
            // assign it directly so the blueprint is a plain wireframe mesh.
            mesh.material = this._blueprintMaterial;
            mesh.position = new Vector3(bp.x, bp.y, bp.z);
            mesh.rotation.y = bp.ry;
            mesh.checkCollisions = false;
            mesh.isPickable = true;
            const remaining = { ...bp.remaining };
            this._pendingBlueprints.push({ mesh, type: bp.type, remaining });
            mesh.metadata = {
                interactable: {
                    id: "blueprint_loaded_" + Date.now(),
                    name: (bp.type.charAt(0).toUpperCase() + bp.type.slice(1)) + " Blueprint",
                    prompt: this._getBlueprintPrompt(remaining),
                    interact: (inventory: any, hud: any, _stats: any) => {
                        this._addResourcesToBlueprint(mesh, inventory, hud, bp.type, remaining);
                    }
                } as Interactable
            };
        }
    }

    private _spawnStructureMesh(type: string, st: { x: number; y: number; z: number; ry: number }): Mesh {
        const parts = this._structureParts(type, null);
        const mesh = Mesh.MergeMeshes(parts!, true, true, undefined, false, true)!;
        mesh.name = type;
        mesh.checkCollisions = true;
        mesh.position = new Vector3(st.x, st.y, st.z);
        mesh.rotation.y = st.ry;
        return mesh;
    }

    // Station click-through hints (recreated for loaded structures).
    private _stationInteractable(type: string, mesh: Mesh): Interactable {
        const labels: Record<string, string> = { campfire: "Campfire", workbench: "Workbench", dryingRack: "Drying Rack" };
        return {
            id: type + "_" + Date.now(),
            name: labels[type] ?? type,
            prompt: "[Crafting station] Open menu to use",
            interact: (_inventory: any, hud: any) => {
                const verb = type === "campfire" ? "cook" : "use";
                hud.showNotification(`Press E to open the crafting menu while standing here. (${verb})`);
            }
        } as Interactable;
        void mesh;
    }

    private _attachShelterMetadata(mesh: Mesh): void {
        mesh.metadata = {
            interactable: {
                id: "shelter_" + Date.now(),
                name: "Shelter",
                prompt: "[Click] Sleep until dawn",
                interact: (_inventory: any, hud: any, stats: any) => {
                    BuildingSystem.sleepInShelter(hud, stats);
                }
            } as Interactable
        };
    }

    public static sleepInShelter(hud: HUD, stats: any): void {
        const cycle = (window as any).game?.dayNight;
        if (!cycle) return;

        // DayNightCycle._time is sun position (0 = sunrise, 0.5 = sunset); the
        // HUD clock is offset +6h from it, so reason in displayed clock hours.
        const clockHours = ((cycle.time + 0.25) * 24) % 24;
        const isNight = clockHours >= 19 || clockHours < 5.5;
        if (!isNight) {
            SoundManager.instance?.play("error");
            hud.showNotification("It's too bright to sleep. Try after dusk.");
            return;
        }

        // Fade to black, jump time, restore, fade back
        const fade = document.createElement("div");
        fade.className = "sleep-fade";
        document.body.appendChild(fade);
        SoundManager.instance?.play("menu");

        requestAnimationFrame(() => fade.classList.add("on"));

        setTimeout(() => {
            cycle.setTime(1 / 48); // 06:30 on the clock (sunrise 06:00 = t 0)
            stats.restoreHealth(30);
            stats.restoreStamina(100);
            stats.restoreWarmth(35);
            stats.decreaseHunger(8);
            stats.decreaseThirst(12);
            hud.showNotification("You slept until dawn. (+30 HP, fully rested)");
            fade.classList.remove("on");
            setTimeout(() => fade.remove(), 600);
        }, 700);
    }
}
