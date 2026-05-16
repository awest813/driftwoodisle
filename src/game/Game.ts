import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";

export class Game {
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;
    private _scene: Scene;
    private _inventory: any;
    private _stats: any;
    private _hud: any;
    private _playerController: any;
    private _dayNight: any;
    private _weather: any;
    private _fishing: any;
    private _worldPromise: Promise<void>;
    private _isStarting: boolean = false;
    private _craftingSystem: any;
    private _buildingSystem: any;
    private _interactionSystem: any;

    public get inventory() { return this._inventory; }
    public get stats() { return this._stats; }
    public get hud() { return this._hud; }
    public get playerController() { return this._playerController; }
    public get dayNight() { return this._dayNight; }
    public get weather() { return this._weather; }
    public get fishing() { return this._fishing; }
    public get craftingSystem() { return this._craftingSystem; }
    public get buildingSystem() { return this._buildingSystem; }
    public get interactionSystem() { return this._interactionSystem; }

    constructor(canvasId: string) {
        this._canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this._engine = new Engine(this._canvas, false, {
            preserveDrawingBuffer: false,
            stencil: true
        }, false);
        this._engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio || 1));
        this._scene = new Scene(this._engine);

        this._worldPromise = Promise.resolve();
        this._initialize();
    }

    private async _initialize(): Promise<void> {
        // Enable collisions and gravity
        this._scene.collisionsEnabled = true;
        this._scene.gravity = new Vector3(0, -0.9, 0);

        // Fog
        this._scene.fogMode = Scene.FOGMODE_EXP;
        this._scene.fogDensity = 0.0025;
        this._scene.fogColor = new Color3(0.68, 0.78, 0.82);

        // Setup lighting
        this._setupLights();

        const { SoundManager } = await import("./SoundManager");
        new SoundManager(this._scene);

        // Setup world
        this._worldPromise = this._createPlaceholderWorld();

        const { MeshBuilder } = await import("@babylonjs/core/Meshes/meshBuilder");
        const { StandardMaterial } = await import("@babylonjs/core/Materials/standardMaterial");
        const { ProceduralTextures } = await import("../world/ProceduralTextures");
        const skydome = MeshBuilder.CreateSphere("skyDome", { diameter: 1000, segments: 24, sideOrientation: 1 }, this._scene);
        skydome.infiniteDistance = true;
        skydome.isPickable = false;
        const skyMat = new StandardMaterial("skyDomeMat", this._scene);
        skyMat.backFaceCulling = false;
        skyMat.disableLighting = true;
        skyMat.diffuseColor = new Color3(0, 0, 0);
        skyMat.specularColor = new Color3(0, 0, 0);
        skyMat.emissiveColor = new Color3(1, 1, 1);
        skyMat.emissiveTexture = ProceduralTextures.skyGradient(this._scene);
        skydome.material = skyMat;

        // Setup Main Menu
        this._setupMenu();

        // Handle resize
        window.addEventListener("resize", () => {
            this._engine.resize();
        });

        // Run the render loop
        this._engine.runRenderLoop(() => {
            if (this._scene.activeCamera) {
                this._scene.render();
            }
        });

        this._exposeTestHooks();
    }

    private async _setupMenu(): Promise<void> {
        const { MainMenu } = await import("../ui/MainMenu");
        new MainMenu((isLoad) => this._startGame(isLoad));
    }

    private async _startGame(isLoad: boolean): Promise<void> {
        if (this._isStarting || this._playerController) return;
        this._isStarting = true;
        try {
            // Wait for the world to finish generating so player doesn't fall
            await this._worldPromise;

            // Setup HUD and Stats
            await this._setupSystems();

            // Setup Player Controller
            await this._setupPlayer();

            // Setup ESC Menu
            this._setupEscMenu();

            // Setup Interaction System
            await this._setupInteraction();
            await this._setupFishing();

            const { SaveSystem } = await import("../save/SaveSystem");
            if (isLoad && SaveSystem.hasSave()) {
                SaveSystem.load(this._inventory, this._stats, this._dayNight, this._playerController.camera);
                this._hud.showNotification("Game Loaded");
            }

            const { SettingsManager } = await import("../save/SettingsManager");
            SettingsManager.apply();

            // Post processing is expensive on integrated GPUs, so load it only when enabled.
            if (SettingsManager.settings.postProcessing) {
                await this.enableHighQualityRendering();
            }

            // Setup Weather after settings so ambience inherits saved audio volume.
            const { WeatherSystem } = await import("../world/WeatherSystem");
            this._weather = new WeatherSystem(this._scene, this._stats);

            // Handle death
            window.addEventListener("playerDied", () => {
                this._hud.showGameOver();
            });
        } finally {
            this._isStarting = false;
        }
    }

    private _setupLights(): void {
        const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this._scene);
        hemiLight.intensity = 0.7;

        const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), this._scene);
        dirLight.position = new Vector3(20, 40, 20);
        dirLight.intensity = 0.8;
    }

    private async _setupPlayer(): Promise<void> {
        const { PlayerController } = await import("../player/PlayerController");
        this._playerController = new PlayerController(this._scene, this._canvas, this._stats);
    }

    public async enableHighQualityRendering(): Promise<void> {
        this._engine.setHardwareScalingLevel(1);
    }

    public disableHighQualityRendering(): void {
        this._engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio || 1));
    }

    private async _setupInteraction(): Promise<void> {
        const { InteractionSystem } = await import("../interaction/InteractionSystem");
        this._interactionSystem = new InteractionSystem(this._scene, this._inventory, this._hud, this._stats);
    }

    private async _setupFishing(): Promise<void> {
        const { FishingSystem } = await import("../interaction/FishingSystem");
        this._fishing = new FishingSystem(this._scene, this._inventory, this._hud);
    }

    private async _setupSystems(): Promise<void> {
        const { Inventory } = await import("../inventory/Inventory");
        const { PlayerStats } = await import("../player/PlayerStats");
        const { HUD } = await import("../ui/HUD");
        const { CraftingSystem } = await import("../crafting/CraftingSystem");
        const { DayNightCycle } = await import("../world/DayNightCycle");
        const { SaveSystem } = await import("../save/SaveSystem");
        const { BuildingSystem } = await import("../building/BuildingSystem");

        this._inventory = new Inventory();
        this._stats = new PlayerStats();
        this._hud = new HUD(this._inventory, this._stats);
        this._buildingSystem = new BuildingSystem(this._scene, this._hud);
        this._craftingSystem = new CraftingSystem(this._inventory, this._hud, this._buildingSystem, this._stats);

        const sun = this._scene.getLightByName("dirLight") as DirectionalLight;
        this._dayNight = new DayNightCycle(this._scene, sun);

        // Auto-save every 30 seconds
        setInterval(() => {
            SaveSystem.save(this._inventory, this._stats, this._dayNight, this._playerController.camera);
            this._hud.showNotification("Game Auto-saved");
        }, 30000);
    }

    private async _createPlaceholderWorld(): Promise<void> {
        const { Island } = await import("../world/Island");
        const { Ocean } = await import("../world/Ocean");
        
        new Ocean(this._scene);
        const island = new Island(this._scene);
        await island.init();
    }

    private _setupEscMenu(): void {
        const resumeBtn = document.getElementById("resumeBtn");
        const saveBtn = document.getElementById("saveBtn");
        const loadBtn = document.getElementById("loadInGameBtn");
        const exitBtn = document.getElementById("exitBtn");

        if (resumeBtn) resumeBtn.onclick = () => {
            this._resumeGameplay();
        };
        if (saveBtn) saveBtn.onclick = () => {
            import("../save/SaveSystem").then(({ SaveSystem }) => {
                SaveSystem.save(this._inventory, this._stats, this._dayNight, this._playerController.camera);
                this._hud.showNotification("Game Saved manually.");
                this._resumeGameplay();
            });
        };
        if (loadBtn) loadBtn.onclick = () => {
            import("../save/SaveSystem").then(({ SaveSystem }) => {
                if (SaveSystem.hasSave()) {
                    SaveSystem.load(this._inventory, this._stats, this._dayNight, this._playerController.camera);
                    this._hud.showNotification("Game Loaded manually.");
                    this._resumeGameplay();
                } else {
                    this._hud.showNotification("No save found.");
                }
            });
        };
        if (exitBtn) exitBtn.onclick = () => location.reload();
    }

    public get scene(): Scene {
        return this._scene;
    }

    public get engine(): Engine {
        return this._engine;
    }

    private _resumeGameplay(): void {
        const escMenu = document.getElementById("escMenu");
        const craftingMenu = document.getElementById("craftingMenu");
        if (escMenu) escMenu.style.display = "none";
        craftingMenu?.classList.remove("active");
        this._requestGameplayPointerLock();
    }

    private _requestGameplayPointerLock(): void {
        this._canvas.focus({ preventScroll: true });
        try {
            const result = this._canvas.requestPointerLock?.();
            if (result && typeof result.catch === "function") {
                result.catch(() => {
                    this._playerController?.camera?.attachControl(this._canvas, true);
                });
            }
        } catch {
            this._playerController?.camera?.attachControl(this._canvas, true);
        }
    }

    private _exposeTestHooks(): void {
        (window as any).game = this;
        (window as any).advanceTime = (ms: number = 16) => {
            const steps = Math.max(1, Math.round(ms / (1000 / 60)));
            for (let i = 0; i < steps; i++) {
                this._scene.render();
            }
        };

        (window as any).render_game_to_text = () => {
            const camera = this._scene.activeCamera;
            const inventory = this._inventory?.getData?.() ?? {};
            const stats = this._stats?.getData?.() ?? {};
            const interactables = this._scene.meshes
                .filter(mesh => mesh.isEnabled() && mesh.metadata?.interactable)
                .slice(0, 40)
                .map(mesh => ({
                    name: mesh.metadata.interactable.name,
                    prompt: mesh.metadata.interactable.prompt,
                    position: {
                        x: Number(mesh.position.x.toFixed(1)),
                        y: Number(mesh.position.y.toFixed(1)),
                        z: Number(mesh.position.z.toFixed(1))
                    }
                }));

            return JSON.stringify({
                coordinateSystem: "Babylon.js world coordinates; x right/left, y up, z forward/back.",
                mode: document.getElementById("mainMenu")?.style.display === "none" ? "playing" : "menu",
                player: camera ? {
                    x: Number(camera.position.x.toFixed(2)),
                    y: Number(camera.position.y.toFixed(2)),
                    z: Number(camera.position.z.toFixed(2)),
                    yaw: Number(((camera as any).rotation?.y ?? 0).toFixed(2))
                } : null,
                stats,
                inventory,
                weather: {
                    raining: Boolean(this._weather?.isRaining)
                },
                audio: (window as any).soundManager?.getStatus?.() ?? null,
                fishing: this._fishing?.getStatus?.() ?? null,
                interactables
            });
        };
    }
}
