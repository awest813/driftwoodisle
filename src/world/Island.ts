import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { ProceduralTextures } from "./ProceduralTextures";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import type { Scene } from "@babylonjs/core/scene";
import type { Interactable } from "../interaction/Interactable";
import { SoundManager } from "../game/SoundManager";
import { Rng, generateSeed } from "./Rng";
import { SaveSystem } from "../save/SaveSystem";

let _sharedFlareTex: DynamicTexture | null = null;
let _sharedFlareScene: Scene | null = null;
function getFlareTexture(scene: Scene): DynamicTexture {
    if (!_sharedFlareTex || _sharedFlareScene !== scene) {
        _sharedFlareTex = ProceduralTextures.radialFlare(scene);
        _sharedFlareScene = scene;
    }
    return _sharedFlareTex;
}

// Babylon's Texture.clone() on a DynamicTexture allocates a new GL texture but
// never copies the source canvas or calls update(), so isReady() stays false and
// any mesh using the clone is silently skipped during rendering.
function cloneDynamicTextureTiled(src: DynamicTexture, uScale: number, vScale: number, scene: Scene): DynamicTexture {
    const size = src.getSize();
    const out = new DynamicTexture(src.name, { width: size.width, height: size.height }, scene, false);
    out.hasAlpha = src.hasAlpha;
    const srcCanvas = (src.getContext() as unknown as CanvasRenderingContext2D).canvas;
    const dstCtx = out.getContext() as unknown as CanvasRenderingContext2D;
    dstCtx.drawImage(srcCanvas, 0, 0);
    out.update(false);
    out.uScale = uScale;
    out.vScale = vScale;
    return out;
}

export class Island {
    private _scene: Scene;
    private _treeModel: any;
    private _rockModel: any;
    private _baseTree!: Mesh;
    private _baseBush!: Mesh;
    private _baseRock!: Mesh;
    private _baseCrate!: Mesh;
    private _baseCrab!: Mesh;
    private _baseFish!: Mesh;
    private _basePalmLeaf!: Mesh;
    private _mistPatches: Mesh[] = [];
    private _crabObstacles: { x: number; z: number; r: number }[] = [];
    private _woodTex!: DynamicTexture;
    private _grassTex!: DynamicTexture;
    private _rockTex!: DynamicTexture;
    private _sandTex!: DynamicTexture;
    private _waterTex!: DynamicTexture;
    private _seed: number;
    private _rng: Rng;
    private _collected: Set<string>;

    constructor(scene: Scene, seed?: number, collected?: Iterable<string>) {
        this._scene = scene;
        this._seed = (seed ?? generateSeed()) >>> 0;
        this._rng = new Rng(this._seed);
        this._collected = new Set(collected ?? []);
        SaveSystem.setWorldSeed(this._seed);
        if (collected) {
            for (const id of this._collected) SaveSystem.markCollected(id);
        }
    }

    public get seed(): number { return this._seed; }

    private _initTextures(): void {
        this._woodTex = ProceduralTextures.wood(this._scene);
        this._grassTex = ProceduralTextures.grass(this._scene);
        this._rockTex = ProceduralTextures.rock(this._scene);
        this._sandTex = ProceduralTextures.sand(this._scene);
        this._waterTex = ProceduralTextures.water(this._scene);
    }

    private _cloneTiled(src: DynamicTexture, uScale: number, vScale: number): DynamicTexture {
        return cloneDynamicTextureTiled(src, uScale, vScale, this._scene);
    }

    public async init(): Promise<void> {
        this._initTextures();
        this._createBaseMeshes();
        this._createTerrain();
        this._createRegionalMist();
        this._spawnNodes();
        this._createRaft();
    }

    private _createBaseMeshes(): void {
        this._baseTree = MeshBuilder.CreateCylinder("baseTree", { height: 6, diameter: 1 }, this._scene);
        const treeMat = new StandardMaterial("treeMat", this._scene);
        treeMat.diffuseTexture = this._woodTex;
        this._baseTree.material = treeMat;
        this._baseTree.isVisible = false;

        this._baseBush = MeshBuilder.CreateSphere("baseBush", { diameter: 1.5 }, this._scene);
        const bushMat = new StandardMaterial("bushMat", this._scene);
        bushMat.diffuseTexture = this._cloneTiled(this._grassTex, 2, 2);
        this._baseBush.material = bushMat;
        this._baseBush.isVisible = false;

        this._baseRock = MeshBuilder.CreateBox("baseRock", { size: 2 }, this._scene);
        const rockMat = new StandardMaterial("rockMat", this._scene);
        rockMat.diffuseTexture = this._rockTex;
        this._baseRock.material = rockMat;
        this._baseRock.isVisible = false;

        this._baseCrate = MeshBuilder.CreateBox("baseCrate", { size: 1.2 }, this._scene);
        const crateMat = new StandardMaterial("crateMat", this._scene);
        crateMat.diffuseTexture = this._woodTex;
        this._baseCrate.material = crateMat;
        this._baseCrate.isVisible = false;

        this._baseCrab = MeshBuilder.CreateBox("baseCrab", { width: 0.4, height: 0.2, depth: 0.4 }, this._scene);
        const crabMat = new StandardMaterial("crabMat", this._scene);
        crabMat.diffuseColor = new Color3(0.8, 0.2, 0.2);
        this._baseCrab.material = crabMat;
        this._baseCrab.isVisible = false;

        this._baseFish = MeshBuilder.CreateCylinder("baseFish", { diameter: 0.3, height: 0.6 }, this._scene);
        this._baseFish.rotation.z = Math.PI / 2;
        const fishMat = new StandardMaterial("fishMat", this._scene);
        fishMat.diffuseColor = new Color3(0.2, 0.4, 0.8);
        this._baseFish.material = fishMat;
        this._baseFish.isVisible = false;

        this._basePalmLeaf = MeshBuilder.CreateBox("basePalmLeaf", { width: 0.25, height: 0.08, depth: 3.5 }, this._scene);
        const leafMat = new StandardMaterial("palmLeafMat", this._scene);
        leafMat.diffuseTexture = this._grassTex;
        leafMat.diffuseColor = new Color3(0.35, 0.75, 0.25);
        this._basePalmLeaf.material = leafMat;
        this._basePalmLeaf.isVisible = false;
    }

    private _createTerrain(): void {
        // Main Island Base (Spawn Beach & Escape Beach) - Crescent shape approximation
        // Height 8 and centre at y=-4 means the top surface sits at y=0 while the island
        // extends 4 m below the ocean surface (ocean is at y=-4), giving a proper island silhouette.
        const base1 = MeshBuilder.CreateCylinder("base1", { height: 8, diameterTop: 140, diameterBottom: 150 }, this._scene);
        base1.position = new Vector3(10, -4, -10);
        const base2 = MeshBuilder.CreateCylinder("base2", { height: 8, diameterTop: 120, diameterBottom: 130 }, this._scene);
        base2.position = new Vector3(-20, -4, 20);
        
        const sandMat = new StandardMaterial("sand_mat", this._scene);
        sandMat.diffuseTexture = this._cloneTiled(this._sandTex, 20, 20);
        sandMat.specularColor = new Color3(0.1, 0.1, 0.1);
        base1.material = sandMat;
        base2.material = sandMat;
        base1.checkCollisions = true;
        base2.checkCollisions = true;

        // Palm Grove (Middle level, grassy) — decorative layer, no collision needed
        const grove = MeshBuilder.CreateCylinder("grove", { height: 0.02, diameter: 70 }, this._scene);
        grove.position = new Vector3(25, 0.01, 10);
        grove.checkCollisions = false;
        const grassMat = new StandardMaterial("grass_mat", this._scene);
        grassMat.diffuseTexture = this._cloneTiled(this._grassTex, 15, 15);
        grassMat.specularColor = new Color3(0, 0, 0);
        grove.material = grassMat;

        // Rocky Bluff (High level, stone)
        const bluff = MeshBuilder.CreateCylinder("bluff", { height: 10, diameterTop: 10, diameterBottom: 60 }, this._scene);
        bluff.position = new Vector3(0, 5, 45);
        bluff.checkCollisions = true;
        const bluffMat = new StandardMaterial("rock_mat", this._scene);
        bluffMat.diffuseTexture = this._cloneTiled(this._rockTex, 10, 10);
        bluff.material = bluffMat;

        // Pond — flat disc sitting on the terrain surface (no CSG carving needed)
        const pond = MeshBuilder.CreateCylinder("pond", { height: 0.1, diameter: 17.5 }, this._scene);
        pond.position = new Vector3(20, 0.05, 5); // Sits just above terrain surface at y=0
        pond.checkCollisions = false;
        const pondMat = new StandardMaterial("pond_mat", this._scene);
        pondMat.diffuseTexture = this._cloneTiled(this._waterTex, 5, 5);
        pondMat.specularColor = new Color3(1, 1, 1);
        pondMat.alpha = 0.8;
        pond.material = pondMat;

        pond.metadata = {
            interactable: {
                id: "pond",
                name: "Freshwater Pond",
                prompt: "[Click] Drink",
                interact: (_inventory: any, hud: any, stats: any) => {
                    SoundManager.instance?.play("water");
                    stats.restoreThirst(50);
                    hud.showNotification("Drank fresh water (+50 Thirst)");
                }
            } as Interactable
        };

        // Shipwreck Base / Mast
        const mast = MeshBuilder.CreateCylinder("mast", { height: 12, diameter: 0.8 }, this._scene);
        mast.position = new Vector3(-35, 6, -10);
        mast.rotation.z = 0.2;
        mast.rotation.x = 0.1;
        mast.checkCollisions = true;
        const woodMat = new StandardMaterial("wood_mat", this._scene);
        woodMat.diffuseColor = new Color3(0.2, 0.15, 0.1);
        mast.material = woodMat;

        this._createBeachDetails();
    }

    private _createRegionalMist(): void {
        const mistTexture = new DynamicTexture("regional_mist_texture", { width: 128, height: 128 }, this._scene, false);
        const ctx = mistTexture.getContext();
        const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
        gradient.addColorStop(0, "rgba(210, 225, 220, 0.7)");
        gradient.addColorStop(0.55, "rgba(210, 225, 220, 0.32)");
        gradient.addColorStop(1, "rgba(210, 225, 220, 0)");
        ctx.clearRect(0, 0, 128, 128);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        mistTexture.hasAlpha = true;
        mistTexture.update();

        const patches = [
            { name: "forest_mist_0", position: new Vector3(24, 3.4, 12), scale: new Vector3(18, 6, 1), alpha: 0.2 },
            { name: "forest_mist_1", position: new Vector3(35, 4.2, 17), scale: new Vector3(16, 7, 1), alpha: 0.18 },
            { name: "forest_mist_2", position: new Vector3(18, 3.8, 25), scale: new Vector3(15, 6, 1), alpha: 0.17 },
            { name: "pond_mist_0", position: new Vector3(20, 1.6, 6), scale: new Vector3(13, 3.5, 1), alpha: 0.12 },
            { name: "mountain_mist_0", position: new Vector3(0, 9.5, 42), scale: new Vector3(24, 9, 1), alpha: 0.22 },
            { name: "mountain_mist_1", position: new Vector3(-8, 13, 51), scale: new Vector3(18, 8, 1), alpha: 0.18 },
            { name: "mountain_mist_2", position: new Vector3(9, 12, 55), scale: new Vector3(15, 7, 1), alpha: 0.17 }
        ];

        patches.forEach((patch, i) => {
            // Build a fresh material per patch sharing the mist texture; cloning a
            // StandardMaterial deep-clones DynamicTextures into non-ready stubs.
            const mat = new StandardMaterial(`${patch.name}_mat`, this._scene);
            mat.diffuseColor = new Color3(0.78, 0.84, 0.82);
            mat.emissiveColor = new Color3(0.32, 0.36, 0.34);
            mat.specularColor = new Color3(0, 0, 0);
            mat.alpha = patch.alpha;
            mat.diffuseTexture = mistTexture;
            mat.opacityTexture = mistTexture;
            mat.useAlphaFromDiffuseTexture = true;
            mat.disableLighting = true;
            mat.backFaceCulling = false;
            const mist = MeshBuilder.CreatePlane(patch.name, { width: 1, height: 1 }, this._scene);
            mist.position = patch.position;
            mist.scaling = patch.scale;
            mist.billboardMode = Mesh.BILLBOARDMODE_ALL;
            mist.material = mat;
            mist.isPickable = false;
            mist.renderingGroupId = 1;
            this._mistPatches.push(mist);

            const phase = i * 0.8;
            this._scene.onBeforeRenderObservable.add(() => {
                const t = performance.now() * 0.00035 + phase;
                mist.position.y = patch.position.y + Math.sin(t) * 0.18;
                mat.alpha = patch.alpha + Math.sin(t * 1.7) * 0.025;
            });
        });
    }

    private _spawnNodes(): void {
        const placed: { x: number; z: number; r: number }[] = [];

        // y offsets per type
        const yFor = (type: string): number => {
            switch (type) {
                case "driftwood": case "stone": case "scrap": return 0.25;
                case "flint": return 10.5;
                case "tree": case "bush": return 0.1;
                case "rock": case "crate": return 0.5;
                case "crab": return 0.2;
                case "fish": return 0.15;
                default: return 0.25;
            }
        };

        // Radius used for rejection sampling (footprint + spacing).
        const footprintFor = (type: string): number => {
            switch (type) {
                case "tree": return 1.6;
                case "rock": return 2.2;
                case "bush": return 1.3;
                case "crate": return 1.2;
                default: return 0.8;
            }
        };

        type Region = {
            name: string;
            cx: number; cz: number; radius: number;
            inside: (x: number, z: number) => boolean;
            // [type, minCount, maxCount]
            contents: Array<[string, number, number]>;
        };

        const inDisc = (cx: number, cz: number, r: number) =>
            (x: number, z: number) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r;

        const regions: Region[] = [
            {
                name: "spawnBeach",
                cx: 15, cz: -25, radius: 12,
                inside: (x, z) => this._isOnSand(x, z) && inDisc(15, -25, 12)(x, z),
                contents: [["driftwood", 3, 5], ["stone", 4, 7], ["crab", 1, 2]]
            },
            {
                name: "westBeach",
                cx: -20, cz: 15, radius: 14,
                inside: (x, z) => this._isOnSand(x, z) && inDisc(-20, 15, 14)(x, z),
                contents: [["driftwood", 1, 3], ["stone", 2, 4], ["crab", 1, 2]]
            },
            {
                name: "palmGrove",
                cx: 28, cz: 12, radius: 14,
                inside: (x, z) => inDisc(25, 10, 16)(x, z) && !this._inPond(x, z),
                contents: [["tree", 6, 9], ["bush", 4, 6]]
            },
            {
                name: "pondArea",
                cx: 20, cz: 5, radius: 8,
                inside: (x, z) => inDisc(20, 5, 8)(x, z) && this._inPond(x, z),
                contents: [["fish", 2, 3]]
            },
            {
                name: "pondShore",
                cx: 20, cz: 5, radius: 10,
                inside: (x, z) => {
                    const inRing = inDisc(20, 5, 10)(x, z) && !this._inPond(x, z);
                    return inRing && !this._inBluff(x, z);
                },
                contents: [["bush", 1, 2], ["stone", 1, 2]]
            },
            {
                name: "rockyBluff",
                cx: 0, cz: 42, radius: 11,
                inside: (x, z) => inDisc(0, 42, 11)(x, z),
                contents: [["rock", 2, 3], ["flint", 1, 2]]
            },
            {
                name: "shipwreck",
                cx: -33, cz: -10, radius: 5,
                inside: (x, z) => inDisc(-33, -10, 5)(x, z),
                contents: [["crate", 1, 2], ["scrap", 1, 2]]
            }
        ];

        let idCounter = 0;
        const tryPlace = (region: Region, type: string): Vector3 | null => {
            const pad = footprintFor(type);
            for (let attempt = 0; attempt < 40; attempt++) {
                const a = this._rng.next() * Math.PI * 2;
                const r = Math.sqrt(this._rng.next()) * region.radius;
                const x = region.cx + Math.cos(a) * r;
                const z = region.cz + Math.sin(a) * r;
                if (!region.inside(x, z)) continue;
                let clear = true;
                for (const p of placed) {
                    const dx = x - p.x, dz = z - p.z;
                    const rr = p.r + pad;
                    if (dx * dx + dz * dz < rr * rr) { clear = false; break; }
                }
                if (!clear) continue;
                placed.push({ x, z, r: pad });
                return new Vector3(x, yFor(type), z);
            }
            return null;
        };

        const spawn = (type: string, position: Vector3) => {
            const id = `${type}_${idCounter++}`;
            if (this._collected.has(id)) return;
            this._spawnOne(type, position, id);
        };

        // Guaranteed starter kit near player spawn so the run is always playable.
        // Player spawn is roughly (15, _, -25); we cluster items close-by.
        const starter: Array<[string, number, number]> = [
            ["driftwood", 14, -23],
            ["driftwood", 17, -27],
            ["stone", 13, -25],
            ["stone", 19, -24]
        ];
        for (const [type, x, z] of starter) {
            placed.push({ x, z, r: footprintFor(type) });
            spawn(type, new Vector3(x, yFor(type), z));
        }

        for (const region of regions) {
            for (const [type, min, max] of region.contents) {
                const count = this._rng.int(min, max);
                for (let i = 0; i < count; i++) {
                    const pos = tryPlace(region, type);
                    if (pos) spawn(type, pos);
                }
            }
        }
    }

    private _spawnOne(type: string, position: Vector3, id: string): void {
        switch (type) {
            case "driftwood": this._createPickup(position, id, "Driftwood", "wood", 1, new Color3(0.6, 0.4, 0.2)); break;
            case "stone": this._createPickup(position, id, "Small Stone", "stone", 1, new Color3(0.5, 0.5, 0.5)); break;
            case "flint": this._createPickup(position, id, "Flint", "flint", 1, new Color3(0.2, 0.2, 0.2)); break;
            case "scrap": this._createPickup(position, id, "Metal Scrap", "scrap", 1, new Color3(0.7, 0.7, 0.8)); break;
            case "tree":
                this._createTree(position, id);
                this._crabObstacles.push({ x: position.x, z: position.z, r: 1.1 });
                break;
            case "bush":
                this._createBush(position, id);
                this._crabObstacles.push({ x: position.x, z: position.z, r: 0.9 });
                break;
            case "rock":
                this._createLargeRock(position, id);
                this._crabObstacles.push({ x: position.x, z: position.z, r: 1.6 });
                break;
            case "crate":
                this._createCrate(position, id);
                this._crabObstacles.push({ x: position.x, z: position.z, r: 0.8 });
                break;
            case "crab": this._createCrab(position, id); break;
            case "fish": this._createFish(position, id); break;
        }
    }

    private _inPond(x: number, z: number): boolean {
        return (x - 20) * (x - 20) + (z - 5) * (z - 5) <= 8.75 * 8.75;
    }

    private _inBluff(x: number, z: number): boolean {
        return x * x + (z - 45) * (z - 45) <= 30 * 30;
    }

    private _createPickup(position: Vector3, id: string, name: string, resourceType: string, amount: number, color: Color3): void {
        const mesh = resourceType === "stone"
            ? MeshBuilder.CreatePolyhedron(id, { type: 2, size: 0.45 }, this._scene)
            : MeshBuilder.CreateBox(id, { size: 0.5 }, this._scene);
        mesh.position = position;
        const mat = new StandardMaterial(`${id}_mat`, this._scene);
        mat.diffuseColor = color;
        if (resourceType === "stone" || resourceType === "flint") {
            mat.diffuseTexture = this._rockTex;
            mesh.rotation = new Vector3(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
        }
        mesh.material = mat;

        mesh.metadata = {
            interactable: {
                id, name,
                prompt: `[Click] Pick Up ${name}`,
                interact: (inventory: any, hud: any) => {
                    SoundManager.instance?.play(resourceType === "stone" || resourceType === "flint" ? "stone" : "pickup");
                    inventory.addItem(resourceType, amount);
                    hud.showNotification(`+${amount} ${name}`);
                    SaveSystem.markCollected(id);
                    mesh.dispose();
                }
            } as Interactable
        };
    }

    private _createTree(position: Vector3, id: string): void {
        let treeMesh: any;
        if (this._treeModel) {
            treeMesh = this._treeModel.instantiateHierarchy();
            treeMesh.position = position;
            treeMesh.scaling = new Vector3(2, 2, 2);
        } else {
            treeMesh = this._baseTree.createInstance(id);
            treeMesh.position = position.add(new Vector3(0, 3, 0));
            treeMesh.checkCollisions = true;
        }

        treeMesh.metadata = {
            hits: 0,
            interactable: {
                id, name: "Palm Tree",
                prompt: "[Click] Chop (Axe is faster)",
                interact: (inventory: any, hud: any, stats: any) => {
                    const hasAxe = inventory.getQuantity("stoneAxe") > 0;
                    const requiredHits = hasAxe ? 3 : 10;
                    const staminaCost = hasAxe ? 5 : 15;

                    if (!stats.useStamina(staminaCost)) {
                        hud.showNotification("Not enough stamina!");
                        return;
                    }

                    treeMesh.metadata.hits = (treeMesh.metadata.hits || 0) + 1;
                    SoundManager.instance?.play("wood");
                    this._spawnParticles(treeMesh.position.add(new Vector3(0, 1, 0)), new Color3(0.6, 0.4, 0.2));
                    if (treeMesh.metadata.hits >= requiredHits) {
                        inventory.addItem("wood", 2);
                        inventory.addItem("leaf", 2);
                        inventory.addItem("coconut", 1);
                        hud.showNotification("Tree Felled (+2 Wood, +2 Leaf, +1 Coconut)");
                        SaveSystem.markCollected(id);
                        treeMesh.dispose();
                    } else {
                        const remaining = requiredHits - treeMesh.metadata.hits;
                        hud.showNotification(`Chopping... (${remaining} hits left)`);
                    }
                }
            } as Interactable
        };

        for (let i = 0; i < 6; i++) {
            const leaf = this._basePalmLeaf.createInstance(`${id}_leaf_${i}`);
            leaf.position = position.add(new Vector3(0, 6.2, 0));
            leaf.rotation.y = (Math.PI * 2 * i) / 6;
            leaf.rotation.x = 0.28;
            leaf.position.x += Math.sin(leaf.rotation.y) * 1.1;
            leaf.position.z += Math.cos(leaf.rotation.y) * 1.1;
            leaf.isPickable = false;
        }
    }

    private _spawnParticles(position: Vector3, color: Color3): void {
        const ps = new ParticleSystem("particles", 50, this._scene);
        ps.particleTexture = getFlareTexture(this._scene);
        ps.emitter = position;
        ps.color1 = new Color4(color.r, color.g, color.b, 1.0);
        ps.color2 = new Color4(color.r, color.g, color.b, 1.0);
        ps.colorDead = new Color4(0, 0, 0, 0);
        ps.minSize = 0.1;
        ps.maxSize = 0.3;
        ps.minLifeTime = 0.2;
        ps.maxLifeTime = 0.5;
        ps.emitRate = 200;
        ps.createSphereEmitter(0.5);
        ps.targetStopDuration = 0.1;
        ps.disposeOnStop = true;
        ps.start();
    }

    private _createBush(position: Vector3, id: string): void {
        const bush = this._baseBush.createInstance(id);
        bush.position = position;
        bush.checkCollisions = true;

        bush.metadata = {
            interactable: {
                id, name: "Wild Bush",
                prompt: "[Click] Gather",
                interact: (inventory: any, hud: any) => {
                    SoundManager.instance?.play("leaf");
                    inventory.addItem("fiber", 2);
                    inventory.addItem("berry", 3);
                    inventory.addItem("leaf", 2);
                    this._spawnParticles(bush.position, new Color3(0.2, 0.8, 0.2));
                    hud.showNotification("Gathered (+2 Fiber, +3 Berry, +2 Leaf)");
                    SaveSystem.markCollected(id);
                    bush.dispose();
                }
            } as Interactable
        };
    }

    private _createLargeRock(position: Vector3, id: string): void {
        let rockMesh: any;
        if (this._rockModel) {
            rockMesh = this._rockModel.instantiateHierarchy();
            rockMesh.position = position;
            rockMesh.scaling = new Vector3(1, 1, 1);
        } else {
            rockMesh = this._baseRock.createInstance(id);
            rockMesh.position = position.add(new Vector3(0, 1, 0));
            rockMesh.checkCollisions = true;
        }

        rockMesh.metadata = {
            hits: 0,
            interactable: {
                id, name: "Large Rock",
                prompt: "[Click] Mine (Axe/Pickaxe is faster)",
                interact: (inventory: any, hud: any, stats: any) => {
                    const hasPickaxe = inventory.getQuantity("stonePickaxe") > 0;
                    const hasAxe = inventory.getQuantity("stoneAxe") > 0;
                    const requiredHits = hasPickaxe ? 3 : (hasAxe ? 8 : 12);
                    const staminaCost = hasPickaxe ? 6 : (hasAxe ? 14 : 20);

                    if (!stats.useStamina(staminaCost)) {
                        hud.showNotification("Not enough stamina!");
                        return;
                    }

                    rockMesh.metadata.hits = (rockMesh.metadata.hits || 0) + 1;
                    SoundManager.instance?.play("stone");
                    this._spawnParticles(rockMesh.position, new Color3(0.5, 0.5, 0.5));
                    if (rockMesh.metadata.hits >= requiredHits) {
                        inventory.addItem("stone", 3);
                        hud.showNotification("Mined Rock (+3 Stone)");
                        SaveSystem.markCollected(id);
                        rockMesh.dispose();
                    } else {
                        const remaining = requiredHits - rockMesh.metadata.hits;
                        hud.showNotification(`Mining... (${remaining} hits left)`);
                    }
                }
            } as Interactable
        };
    }

    private _createCrate(position: Vector3, id: string): void {
        const crate = this._baseCrate.createInstance(id);
        crate.position = position;
        crate.scaling = new Vector3(2, 2, 2);
        crate.checkCollisions = true;

        crate.metadata = {
            interactable: {
                id, name: "Shipwreck Crate",
                prompt: "[Click] Smash (Requires Axe)",
                interact: (inventory: any, hud: any) => {
                    SoundManager.instance?.play("wood");
                    this._spawnParticles(crate.position, new Color3(0.6, 0.4, 0.2));
                    inventory.addItem("rope", 3);
                    inventory.addItem("cloth", 3);
                    inventory.addItem("scrap", 2);
                    inventory.addItem("wood", 5);
                    hud.showNotification("Smashed Crate (+3 Rope, +3 Cloth, +2 Scrap, +5 Wood)");
                    SaveSystem.markCollected(id);
                    crate.dispose();
                }
            } as Interactable
        };
    }

    private _isOnSand(x: number, z: number): boolean {
        // Sand bases (top-down circles) defined in _createTerrain
        const inBase1 = (x - 10) * (x - 10) + (z + 10) * (z + 10) <= 70 * 70;
        const inBase2 = (x + 20) * (x + 20) + (z - 20) * (z - 20) <= 60 * 60;
        if (!inBase1 && !inBase2) return false;
        // Non-sand overlays: grass grove, rocky bluff, pond
        const inGrove = (x - 25) * (x - 25) + (z - 10) * (z - 10) <= 35 * 35;
        const inBluff = x * x + (z - 45) * (z - 45) <= 30 * 30;
        const inPond = (x - 20) * (x - 20) + (z - 5) * (z - 5) <= 8.75 * 8.75;
        return !inGrove && !inBluff && !inPond;
    }

    private _isClearOfObstacles(x: number, z: number, pad: number): boolean {
        for (const o of this._crabObstacles) {
            const dx = x - o.x, dz = z - o.z;
            const rr = o.r + pad;
            if (dx * dx + dz * dz < rr * rr) return false;
        }
        return true;
    }

    private _createCrab(position: Vector3, id: string): void {
        const crab = this._baseCrab.createInstance(id);
        const spawnPosition = position.clone();
        crab.position = spawnPosition.clone();

        const wanderRadius = 2.5;
        const speed = 1.1;
        const crabPad = 0.3;
        let target = spawnPosition.clone();
        let pauseUntil = 0;
        const pickTarget = () => {
            for (let i = 0; i < 12; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.random() * wanderRadius;
                const tx = spawnPosition.x + Math.cos(a) * r;
                const tz = spawnPosition.z + Math.sin(a) * r;
                if (this._isOnSand(tx, tz) && this._isClearOfObstacles(tx, tz, crabPad)) {
                    target = new Vector3(tx, spawnPosition.y, tz);
                    return;
                }
            }
            target = spawnPosition.clone();
        };
        pickTarget();

        const phase = Math.random() * Math.PI * 2;
        const moveObs = this._scene.onBeforeRenderObservable.add(() => {
            const dt = this._scene.getEngine().getDeltaTime() / 1000;
            const now = performance.now();
            const dx = target.x - crab.position.x;
            const dz = target.z - crab.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (now < pauseUntil) {
                // idle wiggle
                const t = now * 0.005 + phase;
                crab.position.y = spawnPosition.y + Math.abs(Math.sin(t * 2)) * 0.03;
                return;
            }

            if (dist < 0.05) {
                pauseUntil = now + 400 + Math.random() * 1200;
                pickTarget();
                return;
            }

            const step = Math.min(dist, speed * dt);
            const nx = dx / dist;
            const nz = dz / dist;
            const nextX = crab.position.x + nx * step;
            const nextZ = crab.position.z + nz * step;
            if (!this._isOnSand(nextX, nextZ) || !this._isClearOfObstacles(nextX, nextZ, crabPad)) {
                // Blocked: drop target, pause briefly, then pick a new one
                pauseUntil = now + 300 + Math.random() * 600;
                pickTarget();
                return;
            }
            crab.position.x = nextX;
            crab.position.z = nextZ;

            // crabs walk sideways: orient body perpendicular to movement direction
            const facing = Math.atan2(nx, nz) + Math.PI / 2;
            crab.rotation.y = facing;

            // scuttle bob
            const t = now * 0.025 + phase;
            crab.position.y = spawnPosition.y + Math.abs(Math.sin(t)) * 0.04;
            crab.rotation.z = Math.sin(t) * 0.12;
        });

        crab.onDisposeObservable.add(() => {
            this._scene.onBeforeRenderObservable.remove(moveObs);
        });

        crab.metadata = {
            interactable: {
                id, name: "Crab",
                prompt: "[Click] Catch Crab",
                interact: (inventory: any, hud: any) => {
                    SoundManager.instance?.play("crab");
                    inventory.addItem("fish", 1);
                    hud.showNotification("Caught Crab (+1 Raw Fish)");
                    crab.dispose();
                    setTimeout(() => {
                        if (this._baseCrab && !this._baseCrab.isDisposed()) {
                            this._createCrab(spawnPosition, `${id}_respawn_${Date.now()}`);
                        }
                    }, 45000);
                }
            } as Interactable
        };
    }

    private _createFish(position: Vector3, id: string): void {
        const fish = this._baseFish.createInstance(id);
        fish.position = position;

        fish.metadata = {
            interactable: {
                id, name: "Fish",
                prompt: "[Click] Catch Fish",
                interact: (inventory: any, hud: any) => {
                    SoundManager.instance?.play("fish");
                    inventory.addItem("fish", 1);
                    hud.showNotification("Caught Fish (+1 Raw Fish)");
                    SaveSystem.markCollected(id);
                    fish.dispose();
                }
            } as Interactable
        };
    }

    private _createRaft(): void {
        const raft = MeshBuilder.CreateBox("raft", { width: 5, height: 0.5, depth: 7 }, this._scene);
        raft.position = new Vector3(5, 0.25, -35); // Escape Beach
        
        const mat = new StandardMaterial("raft_mat", this._scene);
        mat.diffuseColor = new Color3(0.6, 0.4, 0.2);
        raft.material = mat;

        raft.metadata = {
            interactable: {
                id: "raft",
                name: "Broken Escape Raft",
                prompt: "[Click] Repair Raft (Needs 20 Wood, 10 Fiber, 2 Rope, 2 Cloth)",
                interact: (inventory: any, hud: any) => {
                    const wood = inventory.getQuantity("wood");
                    const fiber = inventory.getQuantity("fiber");
                    const rope = inventory.getQuantity("rope");
                    const cloth = inventory.getQuantity("cloth");

                    if (wood >= 20 && fiber >= 10 && rope >= 2 && cloth >= 2) {
                        SoundManager.instance?.play("build");
                        inventory.removeItem("wood", 20);
                        inventory.removeItem("fiber", 10);
                        inventory.removeItem("rope", 2);
                        inventory.removeItem("cloth", 2);
                        hud.showVictory();
                    } else {
                        SoundManager.instance?.play("error");
                        hud.showNotification("Not enough resources to repair raft!");
                    }
                }
            } as Interactable
        };
    }

    private _createBeachDetails(): void {
        const shellMat = new StandardMaterial("shell_mat", this._scene);
        shellMat.diffuseColor = new Color3(0.95, 0.78, 0.58);
        shellMat.specularColor = new Color3(0.2, 0.15, 0.1);

        const coralMat = new StandardMaterial("coral_mat", this._scene);
        coralMat.diffuseTexture = this._grassTex;
        coralMat.diffuseColor = new Color3(0.85, 0.35, 0.28);

        const details = [
            { type: "shell", position: new Vector3(7, 0.08, -27) },
            { type: "shell", position: new Vector3(24, 0.08, -31) },
            { type: "shell", position: new Vector3(-11, 0.08, -18) },
            { type: "shell", position: new Vector3(-26, 0.08, 18) },
            { type: "coral", position: new Vector3(42, 0.15, -18) },
            { type: "coral", position: new Vector3(-38, 0.15, 5) }
        ];

        details.forEach((detail, i) => {
            const mesh = detail.type === "shell"
                ? MeshBuilder.CreateTorus(`shell_${i}`, { diameter: 0.7, thickness: 0.08, tessellation: 12 }, this._scene)
                : MeshBuilder.CreateCylinder(`coral_${i}`, { height: 0.8, diameterTop: 0.15, diameterBottom: 0.35, tessellation: 5 }, this._scene);
            mesh.position = detail.position;
            mesh.rotation = new Vector3(Math.random() * 0.2, Math.random() * Math.PI, Math.PI / 2);
            mesh.scaling.y = detail.type === "shell" ? 0.35 : 1;
            mesh.material = detail.type === "shell" ? shellMat : coralMat;
            mesh.isPickable = false;
        });
    }
}
