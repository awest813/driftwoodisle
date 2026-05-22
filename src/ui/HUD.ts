import { PlayerStats } from "../player/PlayerStats";
import { Inventory } from "../inventory/Inventory";
import { ITEMS, HOTBAR_ORDER, itemDef } from "../inventory/ItemRegistry";
import type { ResourceType } from "../inventory/ItemTypes";

export class HUD {
    private _inventory: Inventory;
    private _stats: PlayerStats;

    constructor(inventory: Inventory, stats: PlayerStats) {
        this._inventory = inventory;
        this._stats = stats;
        
        this._setupListeners();
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
        });

        this._inventory.addListener((items: any) => {
            this.updateInventory(items);
        });

        this._inventory.onChange((type, delta) => {
            if (delta > 0) this._pulseSlot(type);
        });
        
        // Setup hotbar input
        window.addEventListener("keydown", (e) => {
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                document.querySelectorAll('.hotbar-slot').forEach((s, i) => {
                    s.classList.toggle('active', i === index);
                });
            }
        });
        
        // Mousewheel hotbar scrolling
        let currentSlot = 0;
        window.addEventListener("wheel", (e) => {
            if (e.deltaY > 0) currentSlot = (currentSlot + 1) % 9;
            else currentSlot = (currentSlot - 1 + 9) % 9;
            document.querySelectorAll('.hotbar-slot').forEach((s, i) => {
                s.classList.toggle('active', i === currentSlot);
            });
        });

        // Compass update
        setInterval(() => this._updateCompass(), 50);
    }

    public updateInventory(items: Record<string, number>): void {
        const slots = document.querySelectorAll('.hotbar-slot');

        slots.forEach(slot => {
            Array.from(slot.childNodes).forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) child.remove();
            });
            const qty = slot.querySelector('.slot-qty');
            if (qty) qty.textContent = '';
            (slot as HTMLElement).removeAttribute('data-item');
            (slot as HTMLElement).removeAttribute('title');
        });

        const visibleTypes = HOTBAR_ORDER.filter(t => (items[t] || 0) > 0 && ITEMS[t]?.showInHotbar);
        visibleTypes.slice(0, 9).forEach((type, slotIndex) => {
            const slot = slots[slotIndex] as HTMLElement;
            if (!slot) return;
            const def = ITEMS[type];
            const count = items[type] || 0;
            slot.appendChild(document.createTextNode(def?.icon || '📦'));
            const qty = slot.querySelector('.slot-qty');
            if (qty && count > 1) qty.textContent = count.toString();
            slot.setAttribute('data-item', type);
            slot.setAttribute('title', `${def?.name || type} (${count})`);
        });
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
