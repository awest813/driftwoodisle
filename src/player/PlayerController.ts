import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import "@babylonjs/core/Collisions/collisionCoordinator";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { SoundManager } from "../game/SoundManager";

export class PlayerController {
    private _scene: Scene;
    private _camera!: FreeCamera;
    private _canvas: HTMLCanvasElement;
    private _stats: any;

    // Movement settings
    private _walkSpeed: number = 0.1;
    private _runSpeed: number = 0.18;
    private _crouchSpeed: number = 0.05;
    private _currentSpeed: number = 0.1;

    // Head Bob settings
    private _bobTime: number = 0;
    private _bobFrequency: number = 10;
    private _bobHeight: number = 0.05;
    private _defaultCameraY: number = 1.8;
    private _pressedKeys: Set<string> = new Set();
    private _hasEnteredPointerLock: boolean = false;

    // Crouching
    private _isCrouching: boolean = false;
    private _crouchY: number = 1.0;

    // External (touch) input
    private _mobileMode: boolean = false;
    private _externalMoveForward: number = 0;
    private _externalMoveRight: number = 0;
    private _externalSprint: boolean = false;
    private _externalCrouch: boolean = false;

    constructor(scene: Scene, canvas: HTMLCanvasElement, stats: any) {
        this._scene = scene;
        this._canvas = canvas;
        this._stats = stats;

        this._setupCamera();
        this._setupInput();
        this._setupPointerLock();
    }

    private _setupCamera(): void {
        this._camera = new FreeCamera("playerCamera", new Vector3(15, this._defaultCameraY, -15), this._scene);
        this._camera.setTarget(new Vector3(0, this._defaultCameraY, 45));
        this._canvas.tabIndex = 0;
        this._canvas.focus({ preventScroll: true });
        this._camera.attachControl(this._canvas, true);

        // Physics/Collision settings
        this._camera.checkCollisions = true;
        this._camera.applyGravity = true;
        this._camera.ellipsoid = new Vector3(0.8, 0.9, 0.8);

        this._camera.speed = this._walkSpeed;
        this._camera.angularSensibility = 1500;
        this._camera.inertia = 0.85;

        this._scene.onBeforeRenderObservable.add(() => {
            this._update();
        });
    }

    private _update(): void {
        this._handleMovement();
        this._handleStamina();
        this._handleHeadBob();
        this._handleCrouch();
    }

    private _handleMovement(): void {
        const direction = Vector3.Zero();
        const forward = this._camera.getDirection(Vector3.Forward());
        const right = this._camera.getDirection(Vector3.Right());

        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();

        let analogMagnitude = 0;

        if (this._mobileMode &&
            (Math.abs(this._externalMoveForward) > 0.001 || Math.abs(this._externalMoveRight) > 0.001)) {
            direction.addInPlace(forward.scale(this._externalMoveForward));
            direction.addInPlace(right.scale(this._externalMoveRight));
            analogMagnitude = Math.min(1, Math.hypot(this._externalMoveForward, this._externalMoveRight));
        } else {
            if (this._isKeyDown("KeyW", "ArrowUp")) direction.addInPlace(forward);
            if (this._isKeyDown("KeyS", "ArrowDown")) direction.subtractInPlace(forward);
            if (this._isKeyDown("KeyD", "ArrowRight")) direction.addInPlace(right);
            if (this._isKeyDown("KeyA", "ArrowLeft")) direction.subtractInPlace(right);
            if (direction.lengthSquared() > 0) analogMagnitude = 1;
        }

        if (analogMagnitude === 0) return;

        direction.normalize();
        const deltaScale = Math.min(this._scene.getEngine().getDeltaTime(), 33.33) / (1000 / 60);
        const speed = this._isCrouching ? this._crouchSpeed : this._currentSpeed;
        this._camera.position.addInPlace(direction.scale(speed * analogMagnitude * deltaScale));
    }

    private _isMovingInput(): boolean {
        if (this._mobileMode &&
            (Math.abs(this._externalMoveForward) > 0.001 || Math.abs(this._externalMoveRight) > 0.001)) {
            return true;
        }
        return this._isKeyDown("KeyW", "ArrowUp", "KeyS", "ArrowDown", "KeyA", "ArrowLeft", "KeyD", "ArrowRight");
    }

    private _isKeyDown(...codes: string[]): boolean {
        return codes.some(code => this._pressedKeys.has(code));
    }

    private _handleHeadBob(): void {
        const isMoving = this._isMovingInput();

        if (isMoving) {
            const speedFactor = this._camera.speed / this._runSpeed;
            const delta = this._scene.getEngine().getDeltaTime() * 0.001;
            this._bobTime += delta * this._bobFrequency * (speedFactor + 0.5);

            const baseHeight = this._isCrouching ? this._crouchY : this._defaultCameraY;
            const bobOffset = Math.sin(this._bobTime) * this._bobHeight;
            this._camera.position.y = baseHeight + bobOffset;
        } else {
            // Smoothly return to base height
            const targetY = this._isCrouching ? this._crouchY : this._defaultCameraY;
            this._camera.position.y = Scalar.Lerp(this._camera.position.y, targetY, 0.1);
        }
    }

    private _handleCrouch(): void {
        const isCrouching = this._isCrouching || (this._mobileMode && this._externalCrouch);
        this._isCrouching = isCrouching;
        const targetSpeed = this._isCrouching ? this._crouchSpeed : (this._currentSpeed || this._walkSpeed);
        this._camera.speed = Scalar.Lerp(this._camera.speed, targetSpeed, 0.1);
    }

    private _handleStamina(): void {
        const isMoving = this._isMovingInput();
        if (this._mobileMode && this._externalSprint && !this._isCrouching) {
            this._currentSpeed = this._runSpeed;
        }
        // Detect sprint from intent (currentSpeed at run setting), not camera.speed which lerps and never
        // quite reaches the old threshold of walkSpeed + 0.1.
        const isSprinting = this._currentSpeed >= this._runSpeed - 0.001 && isMoving && !this._isCrouching;

        if (isMoving) {
            if (SoundManager.instance) {
                SoundManager.instance.playStep();
            }
        }

        // Per-second drain so behaviour is framerate-independent. ~14s of sprint at full bar.
        const dt = Math.min(this._scene.getEngine().getDeltaTime(), 100) / 1000;
        this._stats.setSprinting(isSprinting);
        if (isSprinting) {
            const drained = this._stats.useStamina(7 * dt);
            if (!drained || this._stats.getData().stamina <= 0.01) {
                this._currentSpeed = this._walkSpeed;
                if (this._mobileMode) this._externalSprint = false;
            }
        }
        // Passive regen is handled centrally in PlayerStats while not sprinting.
    }

    private _setupInput(): void {
        window.addEventListener("keydown", (e) => {
            if (e.defaultPrevented) return;

            if (e.code === "Escape") {
                this._showPauseMenu();
                return;
            }

            this._pressedKeys.add(e.code);

            if (e.shiftKey && !this._isCrouching) {
                this._currentSpeed = this._runSpeed;
            }

            if (e.code === "ControlLeft" || e.code === "KeyC") {
                this._isCrouching = true;
            }

            // Jump logic
            if (e.code === "Space" && !this._isCrouching) {
                this._tryJump();
            }
        });

        window.addEventListener("keyup", (e) => {
            this._pressedKeys.delete(e.code);

            if (!e.shiftKey) {
                this._currentSpeed = this._walkSpeed;
            }
            if (e.code === "ControlLeft" || e.code === "KeyC") {
                this._isCrouching = false;
            }
        });
    }

    private _tryJump(): void {
        // Ground check: if Y is close to land (simplified)
        if (this._camera.position.y < 2.5) {
            this._camera.cameraDirection.y += 0.8;
        }
    }

    private _showPauseMenu(): void {
        const victoryMenu = document.getElementById("victoryScreen");
        const gameOverMenu = document.getElementById("gameOverScreen");
        const isGameOver = (victoryMenu && victoryMenu.style.display === "flex") ||
                           (gameOverMenu && gameOverMenu.style.display === "flex");
        if (isGameOver) return;

        const craftingMenu = document.getElementById("craftingMenu");
        if (craftingMenu?.classList.contains("active")) return;

        const escMenu = document.getElementById("escMenu");
        if (escMenu) escMenu.style.display = "flex";
        if (document.pointerLockElement === this._canvas) {
            document.exitPointerLock();
        }
    }

    private _setupPointerLock(): void {
        this._canvas.addEventListener("click", () => {
            if (this._mobileMode) return;
            if (!this._canRequestPointerLock()) return;
            this._requestPointerLock();
        });

        this._scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
                if (this._mobileMode) return;
                if (!this._canRequestPointerLock()) return;
                this._requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            const escMenu = document.getElementById("escMenu");
            const craftingMenu = document.getElementById("craftingMenu");

            if (document.pointerLockElement === this._canvas) {
                this._hasEnteredPointerLock = true;
                this._camera.detachControl();
                this._camera.attachControl(this._canvas, true);
                if (escMenu) escMenu.style.display = "none";
                craftingMenu?.classList.remove("active");
            } else if (this._hasEnteredPointerLock && !this._mobileMode) {
                this._pressedKeys.clear();
                this._camera.detachControl();

                // Only show pause menu if crafting menu is not open
                const isCraftingOpen = craftingMenu && craftingMenu.classList.contains("active");

                const victoryMenu = document.getElementById("victoryScreen");
                const gameOverMenu = document.getElementById("gameOverScreen");
                const isGameOver = (victoryMenu && victoryMenu.style.display === "flex") ||
                                   (gameOverMenu && gameOverMenu.style.display === "flex");

                if (!isCraftingOpen && !isGameOver) {
                    if (escMenu) escMenu.style.display = "flex";
                }
            }
        }, false);
    }

    private _requestPointerLock(): void {
        if (document.pointerLockElement === this._canvas) return;
        if (!this._canRequestPointerLock()) return;

        this._canvas.focus({ preventScroll: true });
        try {
            const result = this._canvas.requestPointerLock();
            if (result && typeof result.catch === "function") {
                result.catch(() => {
                    this._camera.attachControl(this._canvas, true);
                });
            }
        } catch {
            this._camera.attachControl(this._canvas, true);
        }
    }

    private _canRequestPointerLock(): boolean {
        if (this._mobileMode) return false;
        const mainMenu = document.getElementById("mainMenu");
        const escMenu = document.getElementById("escMenu");
        const craftingMenu = document.getElementById("craftingMenu");
        const victoryMenu = document.getElementById("victoryScreen");
        const gameOverMenu = document.getElementById("gameOverScreen");

        const isMainMenuOpen = mainMenu ? mainMenu.style.display !== "none" : false;
        const isPauseOpen = escMenu ? escMenu.style.display === "flex" : false;
        const isCraftingOpen = craftingMenu?.classList.contains("active") ?? false;
        const isGameOver = (victoryMenu?.style.display === "flex") || (gameOverMenu?.style.display === "flex");

        return !isMainMenuOpen && !isPauseOpen && !isCraftingOpen && !isGameOver;
    }

    public get camera(): FreeCamera {
        return this._camera;
    }

    // --- Mobile / external input API ---

    public setMobileMode(enabled: boolean): void {
        if (this._mobileMode === enabled) return;
        this._mobileMode = enabled;
        if (enabled) {
            // Drop any held keys and detach the camera's default mouse/touch look
            this._pressedKeys.clear();
            this._externalMoveForward = 0;
            this._externalMoveRight = 0;
            this._externalSprint = false;
            this._externalCrouch = false;
            this._camera.detachControl();
            if (document.pointerLockElement === this._canvas) {
                document.exitPointerLock();
            }
        } else {
            this._externalMoveForward = 0;
            this._externalMoveRight = 0;
            this._externalSprint = false;
            this._externalCrouch = false;
            this._camera.attachControl(this._canvas, true);
        }
    }

    public get isMobileMode(): boolean {
        return this._mobileMode;
    }

    public setExternalMove(forward: number, right: number): void {
        this._externalMoveForward = Math.max(-1, Math.min(1, forward));
        this._externalMoveRight = Math.max(-1, Math.min(1, right));
    }

    public setExternalSprint(active: boolean): void {
        this._externalSprint = active;
        if (active && !this._isCrouching) {
            this._currentSpeed = this._runSpeed;
        } else if (!active) {
            this._currentSpeed = this._walkSpeed;
        }
    }

    public setExternalCrouch(active: boolean): void {
        this._externalCrouch = active;
        this._isCrouching = active || this._isKeyDown("ControlLeft", "KeyC");
    }

    public applyExternalLook(deltaXPx: number, deltaYPx: number, sensitivityScale: number = 1, invertY: boolean = false): void {
        // Touch look uses a per-pixel rotation rate. The base rate (~0.0045 rad/px) feels right
        // on a phone-sized screen and is then scaled by the user-configurable sensitivity slider.
        const base = 0.0045;
        const yaw = deltaXPx * base * sensitivityScale;
        const pitch = (invertY ? -deltaYPx : deltaYPx) * base * sensitivityScale;
        this._camera.rotation.y += yaw;
        const newPitch = this._camera.rotation.x + pitch;
        const limit = Math.PI / 2 - 0.05;
        this._camera.rotation.x = Math.max(-limit, Math.min(limit, newPitch));
    }

    public triggerJump(): void {
        if (this._isCrouching) return;
        this._tryJump();
    }

    public triggerPause(): void {
        this._showPauseMenu();
    }
}
