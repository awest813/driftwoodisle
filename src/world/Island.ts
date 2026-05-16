import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { ProceduralTextures } from "./ProceduralTextures";
import { CSG } from "@babylonjs/core/Meshes/csg";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import type { Scene } from "@babylonjs/core/scene";
import type { Interactable } from "../interaction/Interactable";
import { SoundManager } from "../game/SoundManager";

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
    private _woodTex!: Texture;
    private _grassTex!: Texture;
    private _rockTex!: Texture;
    private _sandTex!: Texture;
    private _waterTex!: Texture;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    private _initTextures(): void {
        this._woodTex = ProceduralTextures.wood(this._scene);
        this._grassTex = ProceduralTextures.grass(this._scene);
        this._rockTex = ProceduralTextures.rock(this._scene);
        this._sandTex = ProceduralTextures.sand(this._scene);
        this._waterTex = ProceduralTextures.water(this._scene);
    }

    private _cloneTiled(src: Texture, uScale: number, vScale: number): Texture {
        const t = src.clone() as Texture;
        t.uScale = uScale;
        t.vScale = vScale;
        return t;
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
        const base1 = MeshBuilder.CreateCylinder("base1", { height: 1, diameterTop: 140, diameterBottom: 150 }, this._scene);
        base1.position = new Vector3(10, -0.5, -10);
        const base2 = MeshBuilder.CreateCylinder("base2", { height: 1, diameterTop: 120, diameterBottom: 130 }, this._scene);
        base2.position = new Vector3(-20, -0.5, 20);
        
        const sandMat = new StandardMaterial("sand_mat", this._scene);
        sandMat.diffuseTexture = this._cloneTiled(this._sandTex, 20, 20);
        sandMat.specularColor = new Color3(0.1, 0.1, 0.1);
        base1.material = sandMat;
        base2.material = sandMat;
        base1.checkCollisions = true;
        base2.checkCollisions = true;

        // Palm Grove (Middle level, grassy)
        const grove = MeshBuilder.CreateCylinder("grove", { height: 0.02, diameter: 70 }, this._scene);
        grove.position = new Vector3(25, 0.01, 10);
        grove.checkCollisions = true;
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

        // --- POND CSG CARVING ---
        const pondCutter = MeshBuilder.CreateCylinder("cutter", { height: 2, diameter: 18 }, this._scene);
        pondCutter.position = new Vector3(20, -0.2, 5);

        const baseCSG = CSG.FromMesh(base1);
        const groveCSG = CSG.FromMesh(grove);
        const cutterCSG = CSG.FromMesh(pondCutter);

        const newBaseCSG = baseCSG.subtract(cutterCSG);
        const newGroveCSG = groveCSG.subtract(cutterCSG);

        base1.dispose();
        grove.dispose();
        pondCutter.dispose();

        const newBase1 = newBaseCSG.toMesh("base1", sandMat, this._scene);
        newBase1.checkCollisions = true;

        const newGrove = newGroveCSG.toMesh("grove", grassMat, this._scene);
        newGrove.checkCollisions = false;

        const pond = MeshBuilder.CreateCylinder("pond", { height: 0.8, diameter: 17.5 }, this._scene);
        pond.position = new Vector3(20, -0.4, 5); // Water surface slightly below ground
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

        const mistMat = new StandardMaterial("regional_mist_mat", this._scene);
        mistMat.diffuseColor = new Color3(0.78, 0.84, 0.82);
        mistMat.emissiveColor = new Color3(0.32, 0.36, 0.34);
        mistMat.alpha = 0.16;
        mistMat.diffuseTexture = mistTexture;
        mistMat.opacityTexture = mistTexture;
        mistMat.useAlphaFromDiffuseTexture = true;
        mistMat.disableLighting = true;
        mistMat.backFaceCulling = false;
        mistMat.specularColor = new Color3(0, 0, 0);

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
            const mat = mistMat.clone(`${patch.name}_mat`);
            mat.alpha = patch.alpha;
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
        const nodes = [
            // Spawn Beach
            { type: "driftwood", position: new Vector3(15, 0.25, -25) },
            { type: "driftwood", position: new Vector3(20, 0.25, -20) },
            { type: "driftwood", position: new Vector3(10, 0.25, -22) },
            { type: "driftwood", position: new Vector3(22, 0.25, -28) },
            { type: "stone", position: new Vector3(12, 0.25, -28) },
            { type: "stone", position: new Vector3(18, 0.25, -22) },
            { type: "stone", position: new Vector3(25, 0.25, -25) },
            { type: "stone", position: new Vector3(14, 0.25, -18) },
            { type: "stone", position: new Vector3(8, 0.25, -30) },
            { type: "stone", position: new Vector3(18, 0.25, -32) },
            { type: "stone", position: new Vector3(27, 0.25, -18) },
            { type: "stone", position: new Vector3(4, 0.25, -17) },
            { type: "stone", position: new Vector3(-6, 0.25, -24) },
            { type: "stone", position: new Vector3(-18, 0.25, -4) },
            { type: "stone", position: new Vector3(-28, 0.25, 14) },
            { type: "stone", position: new Vector3(36, 0.25, -4) },
            
            // Palm Grove (Forest)
            { type: "tree", position: new Vector3(25, 0.1, 5) },
            { type: "tree", position: new Vector3(35, 0.1, 15) },
            { type: "tree", position: new Vector3(20, 0.1, 25) },
            { type: "tree", position: new Vector3(30, 0.1, 10) },
            { type: "tree", position: new Vector3(22, 0.1, 8) },
            { type: "tree", position: new Vector3(28, 0.1, 20) },
            { type: "tree", position: new Vector3(32, 0.1, 2) },
            { type: "tree", position: new Vector3(40, 0.1, 10) },
            { type: "bush", position: new Vector3(28, 0.1, 10) },
            { type: "bush", position: new Vector3(22, 0.1, 18) },
            { type: "bush", position: new Vector3(34, 0.1, 8) },
            { type: "bush", position: new Vector3(20, 0.1, 15) },
            { type: "bush", position: new Vector3(38, 0.1, 18) },
            
            // Beach Crabs
            { type: "crab", position: new Vector3(16, 0.2, -15) },
            { type: "crab", position: new Vector3(28, 0.2, -22) },
            { type: "crab", position: new Vector3(-15, 0.2, 22) },
            { type: "crab", position: new Vector3(4, 0.2, -31) },
            { type: "crab", position: new Vector3(-28, 0.2, 8) },
            
            // Pond Area & Fish
            { type: "bush", position: new Vector3(-2, 0.1, 5) },
            { type: "bush", position: new Vector3(12, 0.1, 2) },
            { type: "stone", position: new Vector3(0, 0.25, 0) },
            { type: "fish", position: new Vector3(5, -0.2, 5) },
            { type: "fish", position: new Vector3(8, -0.2, -2) },

            // Rocky Bluff
            { type: "rock", position: new Vector3(5, 0.5, 35) },
            { type: "rock", position: new Vector3(-5, 0.5, 40) },
            { type: "flint", position: new Vector3(0, 10.5, 45) },

            // Shipwreck
            { type: "crate", position: new Vector3(-33, 0.5, -8) },
            { type: "crate", position: new Vector3(-36, 0.5, -12) },
            { type: "scrap", position: new Vector3(-30, 0.25, -10) }
        ];

        nodes.forEach((node, i) => {
            switch (node.type) {
                case "driftwood": this._createPickup(node.position, `driftwood_${i}`, "Driftwood", "wood", 1, new Color3(0.6, 0.4, 0.2)); break;
                case "stone": this._createPickup(node.position, `stone_${i}`, "Small Stone", "stone", 1, new Color3(0.5, 0.5, 0.5)); break;
                case "flint": this._createPickup(node.position, `flint_${i}`, "Flint", "flint", 1, new Color3(0.2, 0.2, 0.2)); break;
                case "scrap": this._createPickup(node.position, `scrap_${i}`, "Metal Scrap", "scrap", 1, new Color3(0.7, 0.7, 0.8)); break;
                case "tree": this._createTree(node.position, `tree_${i}`); break;
                case "bush": this._createBush(node.position, `bush_${i}`); break;
                case "rock": this._createLargeRock(node.position, `rock_${i}`); break;
                case "crate": this._createCrate(node.position, `crate_${i}`); break;
                case "crab": this._createCrab(node.position, `crab_${i}`); break;
                case "fish": this._createFish(node.position, `fish_${i}`); break;
            }
        });
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
        ps.particleTexture = new Texture("https://www.babylonjs-playground.com/textures/flare.png", this._scene);
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
                    crate.dispose();
                }
            } as Interactable
        };
    }

    private _createCrab(position: Vector3, id: string): void {
        const crab = this._baseCrab.createInstance(id);
        const spawnPosition = position.clone();
        crab.position = spawnPosition.clone();

        crab.metadata = {
            interactable: {
                id, name: "Crab",
                prompt: "[Click] Catch Crab",
                interact: (inventory: any, hud: any) => {
                    SoundManager.instance?.play("crab");
                    inventory.addItem("fish", 1);
                    hud.showNotification("Caught Crab (+1 Raw Meat)");
                    crab.dispose();
                    setTimeout(() => {
                        this._createCrab(spawnPosition, `${id}_respawn_${Date.now()}`);
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
