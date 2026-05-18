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
        this._stats.addListener((stats: any) => {
            this._updateBar("healthBar", stats.health);
            this._updateBar("hungerBar", stats.hunger);
            this._updateBar("thirstBar", stats.thirst);
            this._updateBar("staminaBar", stats.stamina);
            this._updateBar("warmthBar", stats.warmth);

            this._updateVal("healthVal", stats.health);
            this._updateVal("hungerVal", stats.hunger);
            this._updateVal("thirstVal", stats.thirst);
            this._updateVal("staminaVal", stats.stamina);
            this._updateVal("warmthVal", stats.warmth);

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

    private _updateBar(id: string, value: number): void {
        const bar = document.getElementById(id);
        if (bar) bar.style.width = `${value}%`;
    }

    private _updateVal(id: string, value: number): void {
        const el = document.getElementById(id);
        if (el) el.innerText = Math.ceil(value).toString();
    }

    private _updateCompass(): void {
        const compassText = document.getElementById("compass-text");
        const cam = (window as any).game?.scene?.activeCamera;
        if (compassText && cam) {
            let angle = cam.rotation.y * (180 / Math.PI);
            angle = (angle % 360 + 360) % 360;
            let dir = "N";
            if (angle > 45 && angle <= 135) dir = "E";
            else if (angle > 135 && angle <= 225) dir = "S";
            else if (angle > 225 && angle <= 315) dir = "W";
            compassText.innerText = `${dir} (${Math.round(angle)}°)`;
        }
    }

    public showNotification(text: string): void {
        const notifications = document.getElementById("notifications");
        if (notifications) {
            const n = document.createElement("div");
            n.className = "notification";
            n.innerText = text;
            notifications.appendChild(n);
            setTimeout(() => n.remove(), 3000);
        }
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
