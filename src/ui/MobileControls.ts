import type { GameSettings, TouchControlsMode } from "../save/SettingsManager";

export class MobileControls {
    private _container: HTMLElement;
    private _joystick: HTMLElement;
    private _joystickKnob: HTMLElement;
    private _joystickZone: HTMLElement;
    private _lookPad: HTMLElement;
    private _btnInteract: HTMLElement;
    private _btnFish: HTMLElement;
    private _btnJump: HTMLElement;
    private _btnSprint: HTMLElement;
    private _btnCrouch: HTMLElement;
    private _btnInventory: HTMLElement;
    private _btnPause: HTMLElement;

    private _enabled: boolean = false;
    private _mode: TouchControlsMode = "auto";
    private _sensitivity: number = 5;
    private _invertY: boolean = false;
    private _leftHanded: boolean = false;

    // Joystick state
    private _joystickRadius: number = 60;
    private _joystickPointerId: number | null = null;
    private _joystickOriginX: number = 0;
    private _joystickOriginY: number = 0;

    // Look pad state
    private _lookPointerId: number | null = null;
    private _lookLastX: number = 0;
    private _lookLastY: number = 0;

    // Overlay visibility observer
    private _overlayPoll: number | null = null;

    constructor() {
        this._container = this._require("mobileControls");
        this._joystick = this._require("mc-joystick");
        this._joystickKnob = this._require("mc-joystick-knob");
        this._joystickZone = this._require("mc-joystick-zone");
        this._lookPad = this._require("mc-lookpad");
        this._btnInteract = this._require("mc-btn-interact");
        this._btnFish = this._require("mc-btn-fish");
        this._btnJump = this._require("mc-btn-jump");
        this._btnSprint = this._require("mc-btn-sprint");
        this._btnCrouch = this._require("mc-btn-crouch");
        this._btnInventory = this._require("mc-btn-inventory");
        this._btnPause = this._require("mc-btn-pause");

        this._wireJoystick();
        this._wireLookPad();
        this._wireButtons();

        (window as any).mobileControls = this;
    }

    public applySettings(settings: GameSettings): void {
        this._mode = settings.touchControls;
        this._sensitivity = settings.touchSensitivity;
        this._invertY = settings.invertY;
        this._leftHanded = settings.leftHanded;

        this._container.classList.toggle("left-handed", this._leftHanded);

        const shouldEnable = this._mode === "on" || (this._mode === "auto" && MobileControls.isLikelyTouchDevice());
        this._setEnabled(shouldEnable);
    }

    public isEnabled(): boolean {
        return this._enabled;
    }

    public static isLikelyTouchDevice(): boolean {
        const nav = navigator as any;
        const hasTouchPoints = typeof nav.maxTouchPoints === "number" && nav.maxTouchPoints > 0;
        const hasTouchEvents = "ontouchstart" in window;
        const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
        return hasTouchPoints || hasTouchEvents || coarse;
    }

    private _setEnabled(enabled: boolean): void {
        if (this._enabled === enabled) {
            this._refreshVisibility();
            return;
        }
        this._enabled = enabled;
        const player = (window as any).game?.playerController;
        player?.setMobileMode?.(enabled);

        if (enabled) {
            document.body.classList.add("mobile-active");
            this._container.classList.add("active");
            // Cancel any pending touches
            this._releaseJoystick();
            this._releaseLookPad();
            this._refreshVisibility();
            if (this._overlayPoll === null) {
                this._overlayPoll = window.setInterval(() => this._refreshVisibility(), 200);
            }
        } else {
            document.body.classList.remove("mobile-active");
            this._container.classList.remove("active");
            this._container.style.display = "none";
            if (this._overlayPoll !== null) {
                window.clearInterval(this._overlayPoll);
                this._overlayPoll = null;
            }
        }
    }

    private _refreshVisibility(): void {
        if (!this._enabled) {
            this._container.style.display = "none";
            return;
        }

        const mainMenu = document.getElementById("mainMenu");
        const escMenu = document.getElementById("escMenu");
        const craftingMenu = document.getElementById("craftingMenu");
        const victoryMenu = document.getElementById("victoryScreen");
        const gameOverMenu = document.getElementById("gameOverScreen");
        const loadingScreen = document.getElementById("loadingScreen");

        const isMainMenuOpen = mainMenu ? mainMenu.style.display !== "none" : false;
        const isPauseOpen = escMenu ? escMenu.style.display === "flex" : false;
        const isCraftingOpen = craftingMenu?.classList.contains("active") ?? false;
        const isGameOver = (victoryMenu?.style.display === "flex") || (gameOverMenu?.style.display === "flex");
        const isLoading = loadingScreen?.style.display === "flex";

        const shouldShow = !isMainMenuOpen && !isPauseOpen && !isCraftingOpen && !isGameOver && !isLoading;
        this._container.style.display = shouldShow ? "block" : "none";

        if (!shouldShow) {
            this._releaseJoystick();
            this._releaseLookPad();
            const player = (window as any).game?.playerController;
            player?.setExternalMove?.(0, 0);
        }
    }

    private _require(id: string): HTMLElement {
        const el = document.getElementById(id);
        if (!el) throw new Error(`MobileControls: missing element #${id}`);
        return el;
    }

    private _wireJoystick(): void {
        const zone = this._joystickZone;
        const stick = this._joystick;
        const updateKnob = (dx: number, dy: number) => {
            this._joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        };

        zone.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (this._joystickPointerId !== null) return;
            this._joystickPointerId = e.pointerId;
            zone.setPointerCapture(e.pointerId);

            // Anchor the joystick under the player's thumb (floating stick).
            const size = stick.offsetWidth || 150;
            stick.style.left = `${e.clientX - size / 2}px`;
            stick.style.top = `${e.clientY - size / 2}px`;
            stick.style.right = "auto";
            stick.style.bottom = "auto";
            stick.classList.add("engaged");

            this._joystickOriginX = e.clientX;
            this._joystickOriginY = e.clientY;
            this._joystickRadius = size * 0.42;
            this._handleJoystickMove(e.clientX, e.clientY, updateKnob);

            navigator.vibrate?.(8);
        });

        zone.addEventListener("pointermove", (e) => {
            if (e.pointerId !== this._joystickPointerId) return;
            e.preventDefault();
            this._handleJoystickMove(e.clientX, e.clientY, updateKnob);
        });

        const end = (e: PointerEvent) => {
            if (e.pointerId !== this._joystickPointerId) return;
            e.preventDefault();
            this._releaseJoystick();
            updateKnob(0, 0);
        };
        zone.addEventListener("pointerup", end);
        zone.addEventListener("pointercancel", end);
    }

    private _handleJoystickMove(clientX: number, clientY: number, updateKnob: (dx: number, dy: number) => void): void {
        let dx = clientX - this._joystickOriginX;
        let dy = clientY - this._joystickOriginY;
        const dist = Math.hypot(dx, dy);
        const r = this._joystickRadius;
        if (dist > r) {
            dx = (dx / dist) * r;
            dy = (dy / dist) * r;
        }
        updateKnob(dx, dy);

        // Deadzone of ~15% of radius
        const deadzone = r * 0.15;
        const magnitude = Math.max(0, (dist - deadzone) / (r - deadzone));
        let nx = 0;
        let ny = 0;
        if (magnitude > 0 && dist > 0) {
            nx = (dx / dist) * Math.min(1, magnitude);
            ny = (dy / dist) * Math.min(1, magnitude);
        }

        // ny is positive downward in screen coords; forward should be negative ny
        const forward = -ny;
        const right = nx;
        const player = (window as any).game?.playerController;
        player?.setExternalMove?.(forward, right);
    }

    private _releaseJoystick(): void {
        if (this._joystickPointerId !== null) {
            try { this._joystickZone.releasePointerCapture(this._joystickPointerId); } catch { /* noop */ }
        }
        this._joystickPointerId = null;
        this._joystickKnob.style.transform = "translate(0px, 0px)";
        this._joystick.classList.remove("engaged");
        // Reset to docked rest position (CSS owns the default placement).
        this._joystick.style.left = "";
        this._joystick.style.top = "";
        this._joystick.style.right = "";
        this._joystick.style.bottom = "";
        const player = (window as any).game?.playerController;
        player?.setExternalMove?.(0, 0);
    }

    private _wireLookPad(): void {
        const pad = this._lookPad;

        pad.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (this._lookPointerId !== null) return;
            this._lookPointerId = e.pointerId;
            this._lookLastX = e.clientX;
            this._lookLastY = e.clientY;
            pad.setPointerCapture(e.pointerId);
            this._container.classList.add("has-looked");
        });

        pad.addEventListener("pointermove", (e) => {
            if (e.pointerId !== this._lookPointerId) return;
            e.preventDefault();
            const dx = e.clientX - this._lookLastX;
            const dy = e.clientY - this._lookLastY;
            this._lookLastX = e.clientX;
            this._lookLastY = e.clientY;
            const player = (window as any).game?.playerController;
            // Map slider 1..10 → 0.3..1.7 sensitivity scale, then clamp
            const scale = 0.3 + (this._sensitivity - 1) * (1.4 / 9);
            player?.applyExternalLook?.(dx, dy, scale, this._invertY);
        });

        const end = (e: PointerEvent) => {
            if (e.pointerId !== this._lookPointerId) return;
            e.preventDefault();
            this._releaseLookPad();
        };
        pad.addEventListener("pointerup", end);
        pad.addEventListener("pointercancel", end);
        pad.addEventListener("pointerleave", end);
    }

    private _releaseLookPad(): void {
        if (this._lookPointerId !== null) {
            try { this._lookPad.releasePointerCapture(this._lookPointerId); } catch { /* noop */ }
        }
        this._lookPointerId = null;
    }

    private _wireButtons(): void {
        this._bindTap(this._btnInteract, () => {
            (window as any).game?.interactionSystem?.triggerInteract?.();
        });

        this._bindTap(this._btnFish, () => {
            (window as any).game?.fishing?.triggerFish?.();
        });

        this._bindTap(this._btnJump, () => {
            (window as any).game?.playerController?.triggerJump?.();
        });

        this._bindToggle(this._btnSprint, (active) => {
            (window as any).game?.playerController?.setExternalSprint?.(active);
        });

        this._bindToggle(this._btnCrouch, (active) => {
            (window as any).game?.playerController?.setExternalCrouch?.(active);
        });

        this._bindTap(this._btnInventory, () => {
            (window as any).game?.craftingSystem?.toggle?.();
        });

        this._bindTap(this._btnPause, () => {
            (window as any).game?.playerController?.triggerPause?.();
        });
    }

    private _bindTap(el: HTMLElement, handler: () => void): void {
        el.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.add("pressed");
            navigator.vibrate?.(10);
            handler();
        });
        const up = (e: Event) => {
            e.preventDefault();
            el.classList.remove("pressed");
        };
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
        el.addEventListener("pointerleave", up);
    }

    private _bindToggle(el: HTMLElement, handler: (active: boolean) => void): void {
        el.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isActive = el.classList.toggle("toggled");
            navigator.vibrate?.(isActive ? 14 : 6);
            handler(isActive);
        });
    }
}
