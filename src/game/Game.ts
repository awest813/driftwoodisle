import { Engine, Scene, Color3, HemisphericLight, DirectionalLight, Vector3 } from "@babylonjs/core";
import "@babylonjs/loaders";

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

    constructor(canvasId: string) {
        this._canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this._engine = new Engine(this._canvas, true);
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

        const { MeshBuilder, StandardMaterial, CubeTexture, Texture } = await import("@babylonjs/core");
        const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, this._scene);
        skybox.infiniteDistance = true;
        skybox.isPickable = false;
        const skyboxMaterial = new StandardMaterial("skyBoxMat", this._scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.disableLighting = true;
        skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
        skyboxMaterial.specularColor = new Color3(0, 0, 0);
        skyboxMaterial.emissiveColor = new Color3(0.55, 0.72, 0.88);
        skyboxMaterial.reflectionTexture = new CubeTexture("https://playground.babylonjs.com/textures/skybox", this._scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
        skybox.material = skyboxMaterial;

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
        // Wait for the world to finish generating so player doesn't fall
        await this._worldPromise;

        // Setup HUD and Stats
        await this._setupSystems();

        // Setup Player Controller
        await this._setupPlayer();

        // Post Process & Graphics Polish
        await this._setupRenderingPipeline();

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

        // Setup Weather after settings so ambience inherits saved audio volume.
        const { WeatherSystem } = await import("../world/WeatherSystem");
        this._weather = new WeatherSystem(this._scene, this._stats);

        // Handle death
        window.addEventListener("playerDied", () => {
            this._hud.showGameOver();
        });
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

    private async _setupRenderingPipeline(): Promise<void> {
        const camera = this._scene.activeCamera;
        if (!camera || (window as any).defaultPipeline) return;

        const { DefaultRenderingPipeline } = await import("@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline");
        const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, this._scene, [camera]);
        pipeline.samples = 4;
        pipeline.bloomEnabled = true;
        pipeline.bloomThreshold = 0.8;
        pipeline.bloomWeight = 0.3;
        (window as any).defaultPipeline = pipeline;
    }

    private async _setupInteraction(): Promise<void> {
        const { InteractionSystem } = await import("../interaction/InteractionSystem");
        new InteractionSystem(this._scene, this._inventory, this._hud, this._stats);
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
        const buildingSystem = new BuildingSystem(this._scene, this._hud);
        new CraftingSystem(this._inventory, this._hud, buildingSystem, this._stats);

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
            const craftingMenu = document.getElementById("craftingMenu");
            craftingMenu?.classList.remove("active");
            this._canvas.requestPointerLock();
        };
        if (saveBtn) saveBtn.onclick = () => {
            import("../save/SaveSystem").then(({ SaveSystem }) => {
                SaveSystem.save(this._inventory, this._stats, this._dayNight, this._playerController.camera);
                this._hud.showNotification("Game Saved manually.");
                this._canvas.requestPointerLock();
            });
        };
        if (loadBtn) loadBtn.onclick = () => {
            import("../save/SaveSystem").then(({ SaveSystem }) => {
                if (SaveSystem.hasSave()) {
                    SaveSystem.load(this._inventory, this._stats, this._dayNight, this._playerController.camera);
                    this._hud.showNotification("Game Loaded manually.");
                    this._canvas.requestPointerLock();
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

    private _exposeTestHooks(): void {
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
