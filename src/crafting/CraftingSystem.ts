import { recipes } from "./Recipes";
import type { Recipe } from "./Recipes";
import { Inventory } from "../inventory/Inventory";
import { HUD } from "../ui/HUD";
import type { ResourceType } from "../inventory/ItemTypes";
import type { BuildingSystem } from "../building/BuildingSystem";
import type { PlayerStats } from "../player/PlayerStats";
import { SoundManager } from "../game/SoundManager";

export class CraftingSystem {
    private _inventory: Inventory;
    private _hud: HUD;
    private _buildingSystem: BuildingSystem;
    private _stats: PlayerStats;
    private _menuElement: HTMLElement | null;
    private _recipeListElement: HTMLElement | null;
    private _isOpen: boolean = false;
    private _icons: Record<string, string> = {
        wood: '🪵', stone: '🪨', fiber: '🌿', leaf: '🍃',
        coconut: '🥥', berry: '🫐', fish: '🐟', rope: '🪢',
        cloth: '👕', scrap: '🔩', flint: '🪨',
        stoneAxe: '🪓', stonePickaxe: '⛏️', woodenSpear: '🔱', fishingRod: '🎣',
        campfire: '🔥', shelter: '⛺', raft: '⛵'
    };

    constructor(inventory: Inventory, hud: HUD, buildingSystem: BuildingSystem, stats: PlayerStats) {
        this._inventory = inventory;
        this._hud = hud;
        this._buildingSystem = buildingSystem;
        this._stats = stats;
        this._menuElement = document.getElementById("craftingMenu");
        this._recipeListElement = document.getElementById("recipeList");

        this._setupInput();
        this._setupCloseButton();
        this._renderRecipes();
        
        // Update menu if inventory changes while open
        this._inventory.addListener(() => {
            if (this._isOpen) this._renderRecipes();
        });
    }

    private _setupInput(): void {
        window.addEventListener("keydown", (e) => {
            if (e.code === "KeyE" || e.code === "Tab") {
                e.preventDefault();
                this._hidePauseMenu();
                this.toggle();
            }
            if (e.code === "Escape" && this._isOpen) {
                e.preventDefault();
                this.close();
            }
        });
    }

    private _setupCloseButton(): void {
        const btn = document.getElementById("closeCrafting");
        if (btn) btn.onclick = () => this.close();
    }

    public toggle(): void {
        if (this._isOpen) this.close();
        else this.open();
    }

    public open(): void {
        if (this._menuElement) {
            SoundManager.instance?.play("menu");
            this._hidePauseMenu();
            this._menuElement.classList.add("active");
            this._isOpen = true;
            this._renderRecipes();
            document.exitPointerLock(); // Allow mouse interaction
        }
    }

    public close(): void {
        if (this._menuElement) {
            SoundManager.instance?.play("menu");
            this._menuElement.classList.remove("active");
            this._isOpen = false;
            const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
            canvas?.focus({ preventScroll: true });
            try {
                const result = canvas?.requestPointerLock?.();
                if (result && typeof result.catch === "function") {
                    result.catch(() => {});
                }
            } catch {
                // Browsers may reject pointer lock when closing from a keyboard shortcut.
            }
        }
    }

    private _hidePauseMenu(): void {
        const escMenu = document.getElementById("escMenu");
        if (escMenu) escMenu.style.display = "none";
    }

    private _renderRecipes(): void {
        if (!this._recipeListElement) return;
        this._recipeListElement.innerHTML = "";

        Object.entries(recipes).forEach(([id, recipe]) => {
            if (id === "raftRepair") return;

            const isStructure = id === "campfire" || id === "shelter";
            const canCraft = isStructure || this._canCraft(recipe);
            const btnText = isStructure ? "Place Blueprint" : "Craft";

            const itemEl = document.createElement("div");
            itemEl.className = "recipe-item";
            
            const ingredients = Object.entries(recipe.requires)
                .map(([type, count]) => `${count}x ${this._icons[type] || type}`)
                .join(" ");

            itemEl.innerHTML = `
                <div class="recipe-info">
                    <h3>${this._icons[recipe.creates] || ''} ${recipe.name}</h3>
                    <div class="recipe-ingredients">${ingredients}</div>
                </div>
                <button class="craft-btn" ${canCraft ? "" : "disabled"}>${btnText}</button>
            `;

            const btn = itemEl.querySelector(".craft-btn") as HTMLButtonElement;
            btn.onclick = () => this._craft(id, recipe);

            this._recipeListElement?.appendChild(itemEl);
        });

        // Render Inventory
        const invGrid = document.getElementById("inventoryGrid");
        if (invGrid) {
            invGrid.innerHTML = "";
            const data = this._inventory.getData();
            Object.entries(data).forEach(([type, count]) => {
                if ((count as number) > 0) {
                    const itemEl = document.createElement("div");
                    itemEl.className = "recipe-item";
                    
                    const isEdible = type === "berry" || type === "coconut" || type === "fish";
                    const btnHtml = isEdible ? `<button class="craft-btn eat-btn">Eat</button>` : '';

                    itemEl.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h3 style="margin:0; font-size: 1.2rem;">${this._icons[type] || ''} x${count}</h3>
                            ${btnHtml}
                        </div>
                    `;
                    invGrid.appendChild(itemEl);

                    if (isEdible) {
                        const btn = itemEl.querySelector(".eat-btn") as HTMLButtonElement;
                        btn.onclick = () => this._eatItem(type);
                    }
                }
            });
        }
    }

    private _eatItem(type: string): void {
        const amount = this._inventory.getQuantity(type as ResourceType);
        if (amount > 0) {
            this._inventory.removeItem(type as ResourceType, 1);
            if (type === "berry") {
                SoundManager.instance?.play("pickup");
                this._stats.restoreHunger(5);
                this._stats.restoreThirst(5);
                this._hud.showNotification("Ate Berry (+5 Hunger, +5 Thirst)");
            } else if (type === "coconut") {
                SoundManager.instance?.play("wood");
                this._stats.restoreHunger(15);
                this._stats.restoreThirst(20);
                this._hud.showNotification("Ate Coconut (+15 Hunger, +20 Thirst)");
            } else if (type === "fish") {
                SoundManager.instance?.play("fish");
                this._stats.restoreHunger(10);
                this._hud.showNotification("Ate Raw Fish (+10 Hunger)");
            }
            this._renderRecipes(); // Re-render to update quantities
        }
    }

    private _canCraft(recipe: Recipe): boolean {
        return Object.entries(recipe.requires).every(([type, count]) => {
            return this._inventory.getQuantity(type as ResourceType) >= (count || 0);
        });
    }

    private _craft(id: string, recipe: Recipe): void {
        const isStructure = id === "campfire" || id === "shelter";

        if (!isStructure && !this._canCraft(recipe)) return;

        if (isStructure) {
            this.close();
            this._startBuilding(id, recipe);
        } else {
            // Consume resources
            Object.entries(recipe.requires).forEach(([type, count]) => {
                this._inventory.removeItem(type as ResourceType, count || 0);
            });
            this._inventory.addItem(recipe.creates as ResourceType, 1);
            SoundManager.instance?.play("craft");
            this._hud.showNotification(`Crafted ${recipe.name}!`);
            this._renderRecipes();
        }
    }

    private async _startBuilding(type: string, recipe: Recipe): Promise<void> {
        this._buildingSystem.startBuilding(type, recipe);
    }
}
