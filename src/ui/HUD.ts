import { PlayerStats } from "../player/PlayerStats";
import { Inventory } from "../inventory/Inventory";
import { ITEMS, HOTBAR_ORDER, itemDef } from "../inventory/ItemRegistry";
import type { ResourceType } from "../inventory/ItemTypes";
import { consumeItem } from "../inventory/Consume";

const HOTBAR_SIZE = 9;

export class HUD {
    private _inventory: Inventory;
    private _stats: PlayerStats;
    private _activeSlot: number = 0;
    private _bindings: (ResourceType | null)[] = new Array(HOTBAR_SIZE).fill(null);
    // 0 = ok, 1 = warned low, 2 = warned depleted
    private _needWarnLevel: Record<"hunger" | "thirst" | "warmth", number> = {
        hunger: 0,
        thirst: 0,
        warmth: 0,
    };

    constructor(inventory: Inventory, stats: PlayerStats) {
        this._inventory = inventory;
        this._stats = stats;

        this._setupListeners();
    }

    public getHotbarBindings(): (ResourceType | null)[] {
        return this._bindings.slice();
    }

    public setHotbarBindings(bindings: (ResourceType | null)[]): void {
        for (let i = 0; i < HOTBAR_SIZE; i++) {
            this._bindings[i] = bindings[i] ?? null;
        }
        this.updateInventory(this._inventory.getData());
    }

    private _setupListeners(): void {
        this._stats.addListener((stats) => {
            this._updateStat("health", stats.health);
            this._updateStat("hunger", stats.hunger);
            this._updateStat("thirst", stats.thirst);
            this._updateStat("stamina", stats.stamina);
            this._updateStat("warmth", stats.warmth);

            const wIcon = document.getElementById("warmthIcon");
            if (wIcon) {
                wIcon.innerText = stats.warmth < 30 ? "❄️" : "☀️";
            }
            
            const tDisp = document.getElementById("tempDisplay");
            if (tDisp) tDisp.innerText = Math.round((stats.warmth / 100) * 37).toString();

            this._checkNeedWarnings(stats);
        });

        this._inventory.addListener((items: any) => {
            this.updateInventory(items);
        });

        this._inventory.onChange((type, delta) => {
            if (delta > 0) this._pulseSlot(type);
        });

        window.addEventListener("keydown", (e) => {
            if (this._isAnyMenuOpen()) return;
            if (e.key >= '1' && e.key <= '9') {
                this._setActiveSlot(parseInt(e.key) - 1);
                return;
            }
            if (e.code === "KeyF") {
                this._useActiveSlot();
            }
        });

        window.addEventListener("wheel", (e) => {
            if (this._isAnyMenuOpen()) return;
            const dir = e.deltaY > 0 ? 1 : -1;
            this._setActiveSlot((this._activeSlot + dir + HOTBAR_SIZE) % HOTBAR_SIZE);
        });

        // Compass update
        setInterval(() => this._updateCompass(), 50);
    }

    public updateInventory(items: Record<string, number>): void {
        // Clear bindings for slots whose item dropped to zero so the slot becomes
        // available for a different type next time.
        for (let i = 0; i < HOTBAR_SIZE; i++) {
            const bound = this._bindings[i];
            if (bound && (items[bound] || 0) <= 0) {
                this._bindings[i] = null;
            }
        }

        // Auto-assign any held type that isn't yet bound, following HOTBAR_ORDER
        // so first-pickup placement feels predictable.
        const bound = new Set(this._bindings.filter((b): b is ResourceType => b !== null));
        for (const type of HOTBAR_ORDER) {
            if (bound.has(type)) continue;
            if (!ITEMS[type]?.showInHotbar) continue;
            if ((items[type] || 0) <= 0) continue;
            const emptyIdx = this._bindings.indexOf(null);
            if (emptyIdx === -1) break;
            this._bindings[emptyIdx] = type;
            bound.add(type);
        }

        const slots = document.querySelectorAll('.hotbar-slot');
        slots.forEach((slot, i) => {
            Array.from(slot.childNodes).forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) child.remove();
            });
            const qty = slot.querySelector('.slot-qty');
            if (qty) qty.textContent = '';
            (slot as HTMLElement).removeAttribute('data-item');
            (slot as HTMLElement).removeAttribute('title');

            const type = this._bindings[i];
            if (!type) return;
            const def = ITEMS[type];
            const count = items[type] || 0;
            slot.appendChild(document.createTextNode(def?.icon || '📦'));
            if (qty && count > 1) qty.textContent = count.toString();
            (slot as HTMLElement).setAttribute('data-item', type);
            (slot as HTMLElement).setAttribute('title', `${def?.name || type} (${count})`);
        });

        this._applyActiveSlotClass();
    }

    private _setActiveSlot(index: number): void {
        if (index < 0 || index >= HOTBAR_SIZE) return;
        this._activeSlot = index;
        this._applyActiveSlotClass();
    }

    private _applyActiveSlotClass(): void {
        document.querySelectorAll('.hotbar-slot').forEach((s, i) => {
            s.classList.toggle('active', i === this._activeSlot);
        });
    }

    private _isAnyMenuOpen(): boolean {
        const crafting = document.getElementById("craftingMenu");
        const esc = document.getElementById("escMenu");
        const main = document.getElementById("mainMenu");
        if (crafting?.classList.contains("active")) return true;
        if (esc && esc.style.display === "flex") return true;
        if (main && main.style.display !== "none") return true;
        return false;
    }

    private _useActiveSlot(): void {
        const type = this._bindings[this._activeSlot];
        if (!type) return;
        if (this._inventory.getQuantity(type) <= 0) return;
        consumeItem(type, this._inventory, this._stats, this);
    }

    private _pulseSlot(type: ResourceType): void {
        if (!itemDef(type)?.showInHotbar) return;
        const slot = document.querySelector(`.hotbar-slot[data-item="${type}"]`) as HTMLElement | null;
        if (!slot) return;
        slot.classList.remove('pulse');
        // force reflow to restart the animation
        void slot.offsetWidth;
        slot.classList.add('pulse');
    }

    private _checkNeedWarnings(stats: { hunger: number; thirst: number; warmth: number }): void {
        const needs = [
            { key: "hunger" as const, value: stats.hunger, depleted: "You're starving — your health is draining. Find food.", low: "You're getting hungry." },
            { key: "thirst" as const, value: stats.thirst, depleted: "You're parched — your health is draining. Find fresh water.", low: "You're getting thirsty." },
            { key: "warmth" as const, value: stats.warmth, depleted: "You're freezing — your health is draining. Get warm by a fire.", low: "You're getting cold." },
        ];
        for (const need of needs) {
            const level = this._needWarnLevel[need.key];
            if (need.value <= 0) {
                if (level < 2) {
                    this.showNotification(need.depleted, "danger");
                    this._needWarnLevel[need.key] = 2;
                }
            } else if (need.value <= 25) {
                if (level < 1) {
                    this.showNotification(need.low, "warn");
                    this._needWarnLevel[need.key] = 1;
                }
            } else if (need.value > 40) {
                this._needWarnLevel[need.key] = 0;
            }
        }
    }

    private _updateStat(key: string, value: number): void {
        const v = Math.max(0, Math.min(100, value));
        const bar = document.getElementById(`${key}Bar`);
        if (bar) bar.style.width = `${v}%`;
        const valEl = document.getElementById(`${key}Val`);
        if (valEl) valEl.innerText = Math.ceil(v).toString();
        const row = bar?.closest(".stat-row") as HTMLElement | null;
        if (row) {
            row.classList.toggle("low", v < 30 && v >= 15);
            row.classList.toggle("critical", v < 15);
        }
    }

    private _updateCompass(): void {
        const compassText = document.getElementById("compass-text");
        const cam = (window as any).game?.scene?.activeCamera;
        if (compassText && cam) {
            let angle = cam.rotation.y * (180 / Math.PI);
            angle = (angle % 360 + 360) % 360;
            let dir = "N";
            if (angle > 22.5 && angle <= 67.5) dir = "NE";
            else if (angle > 67.5 && angle <= 112.5) dir = "E";
            else if (angle > 112.5 && angle <= 157.5) dir = "SE";
            else if (angle > 157.5 && angle <= 202.5) dir = "S";
            else if (angle > 202.5 && angle <= 247.5) dir = "SW";
            else if (angle > 247.5 && angle <= 292.5) dir = "W";
            else if (angle > 292.5 && angle <= 337.5) dir = "NW";
            compassText.innerText = `${dir} (${Math.round(angle)}°)`;
        }
    }

    public showNotification(text: string, kind?: "gain" | "info" | "warn" | "danger"): void {
        const notifications = document.getElementById("notifications");
        if (!notifications) return;
        const type = kind ?? this._inferKind(text);

        // Coalesce a rapid duplicate (e.g. repeated chop progress) into the most recent toast.
        const last = notifications.lastElementChild as HTMLElement | null;
        if (last && last.dataset.text === text) {
            last.classList.remove("repeat");
            void last.offsetWidth;
            last.classList.add("repeat");
            return;
        }

        const n = document.createElement("div");
        n.className = `notification ${type}`;
        n.dataset.text = text;
        const icon = document.createElement("span");
        icon.className = "notif-icon";
        icon.textContent = { gain: "+", info: "•", warn: "!", danger: "✕" }[type];
        const body = document.createElement("span");
        body.className = "notif-text";
        body.textContent = text;
        n.appendChild(icon);
        n.appendChild(body);
        notifications.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    private _inferKind(text: string): "gain" | "info" | "warn" | "danger" {
        const t = text.toLowerCase();
        if (/^\+|\(\+\d|caught|mined|gathered|drank|smashed|felled|crafted|built|repaired|cooked/.test(t)) return "gain";
        if (/not enough|cannot|can't|no save|too |failed|perished/.test(t)) return "danger";
        if (/wait|aim|cast|bite|building mode|blueprint|cancelled|tip|hint/.test(t)) return "warn";
        return "info";
    }

    public showInteractionPrompt(text: string): void {
        const el = document.getElementById("interactionPrompt");
        if (el) {
            el.innerHTML = text;
            el.style.opacity = "1";
        }
    }

    public hideInteractionPrompt(): void {
        const el = document.getElementById("interactionPrompt");
        if (el) el.style.opacity = "0";
    }

    public showVictory(): void {
        const el = document.getElementById("victoryScreen");
        if (el) el.style.display = "flex";
        document.body.classList.add("run-ended");
        document.exitPointerLock();
    }

    public showGameOver(): void {
        const el = document.getElementById("gameOverScreen");
        if (el) el.style.display = "flex";
        document.body.classList.add("run-ended");
        document.exitPointerLock();
    }
}
