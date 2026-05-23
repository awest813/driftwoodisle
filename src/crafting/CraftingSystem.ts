import { recipes } from "./Recipes";
import type { Recipe, StationType } from "./Recipes";
import { Inventory } from "../inventory/Inventory";
import { HUD } from "../ui/HUD";
import type { ResourceType } from "../inventory/ItemTypes";
import type { BuildingSystem } from "../building/BuildingSystem";
import type { PlayerStats } from "../player/PlayerStats";
import { SoundManager } from "../game/SoundManager";
import { ITEMS, CATEGORY_LABELS, CATEGORY_ORDER, itemDef } from "../inventory/ItemRegistry";
import type { ItemCategory } from "../inventory/ItemRegistry";

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
        campfire: '🔥', shelter: '⛺', workbench: '🛠️', dryingRack: '🪤',
        cookedFish: '🍣', driedFish: '🐠', berryJam: '🍯', bandage: '🩹',
        raftProgress: '⛵'
    };
    private static readonly STATION_RANGE = 4;
    private static readonly STATION_LABEL: Record<StationType, string> = {
        workbench: "Workbench",
        dryingRack: "Drying Rack",
        campfire: "Campfire"
    };
    private static readonly STRUCTURE_RECIPES = new Set([
        "campfire", "shelter", "workbench", "dryingRack"
    ]);

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

        // Click on the dim backdrop (outside the journal page) closes the panel.
        if (this._menuElement) {
            this._menuElement.addEventListener("mousedown", (e) => {
                if (e.target === this._menuElement) this.close();
            });
        }
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
            if (!canvas || !this._canReturnToPointerLock()) return;

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

    private _canReturnToPointerLock(): boolean {
        const mainMenu = document.getElementById("mainMenu");
        const escMenu = document.getElementById("escMenu");
        const victoryMenu = document.getElementById("victoryScreen");
        const gameOverMenu = document.getElementById("gameOverScreen");

        const isMainMenuOpen = mainMenu ? mainMenu.style.display !== "none" : false;
        const isPauseOpen = escMenu ? escMenu.style.display === "flex" : false;
        const isGameOver = (victoryMenu?.style.display === "flex") || (gameOverMenu?.style.display === "flex");

        return !isMainMenuOpen && !isPauseOpen && !isGameOver;
    }

    private _hidePauseMenu(): void {
        const escMenu = document.getElementById("escMenu");
        if (escMenu) escMenu.style.display = "none";
    }

    private _renderRecipes(): void {
        if (!this._recipeListElement) return;
        this._recipeListElement.innerHTML = "";

        const entries = Object.entries(recipes)
            .filter(([id]) => id !== "raftRepair");

        // Surface craftable recipes first so the player sees what's actionable.
        entries.sort(([idA, a], [idB, b]) => {
            const structA = CraftingSystem.STRUCTURE_RECIPES.has(idA);
            const structB = CraftingSystem.STRUCTURE_RECIPES.has(idB);
            const stationOkA = !a.station || this._isNearStation(a.station);
            const stationOkB = !b.station || this._isNearStation(b.station);
            const canA = (structA || this._canCraft(a)) && stationOkA;
            const canB = (structB || this._canCraft(b)) && stationOkB;
            if (canA !== canB) return canA ? -1 : 1;
            return 0;
        });

        entries.forEach(([id, recipe]) => {
            const isStructure = CraftingSystem.STRUCTURE_RECIPES.has(id);
            const stationOk = !recipe.station || this._isNearStation(recipe.station);
            const haveMats = this._canCraft(recipe);
            const canCraft = (isStructure || haveMats) && stationOk;
            const btnText = isStructure ? "Place Blueprint" : "Craft";

            const itemEl = document.createElement("div");
            itemEl.className = "recipe-item" + (canCraft ? " craftable" : " locked");

            const chips = Object.entries(recipe.requires).map(([type, count]) => {
                const need = count || 0;
                const have = this._inventory.getQuantity(type as ResourceType);
                const icon = this._icons[type] || itemDef(type)?.icon || type;
                const ok = have >= need;
                const name = itemDef(type)?.name || type;
                return `<span class="ingredient-chip ${ok ? "ok" : "lacking"}" title="${name}">`
                    + `<span class="chip-icon">${icon}</span>`
                    + `<span class="chip-count">${have}/${need}</span>`
                    + `</span>`;
            }).join("");

            const stationChip = recipe.station
                ? `<span class="ingredient-chip ${stationOk ? "ok" : "lacking"}" title="Required station">`
                    + `<span class="chip-icon">${this._icons[recipe.station] || ''}</span>`
                    + `<span class="chip-count">${CraftingSystem.STATION_LABEL[recipe.station]}</span>`
                    + `</span>`
                : "";

            const resultIcon = this._icons[recipe.creates] || itemDef(recipe.creates)?.icon || '';

            itemEl.innerHTML = `
                <div class="recipe-info">
                    <h3>${resultIcon} ${recipe.name}</h3>
                    <div class="recipe-ingredients">${chips}${stationChip}</div>
                </div>
                <button class="craft-btn" ${canCraft ? "" : "disabled"}>${btnText}</button>
            `;

            const btn = itemEl.querySelector(".craft-btn") as HTMLButtonElement;
            btn.onclick = () => this._craft(id, recipe);

            this._recipeListElement?.appendChild(itemEl);
        });

        this._renderInventoryGrid();
    }

    private _renderInventoryGrid(): void {
        const invGrid = document.getElementById("inventoryGrid");
        if (!invGrid) return;
        invGrid.innerHTML = "";

        const data = this._inventory.getData();
        const grouped: Partial<Record<ItemCategory, Array<{ type: string; count: number }>>> = {};
        Object.entries(data).forEach(([type, count]) => {
            if ((count as number) <= 0) return;
            const def = itemDef(type);
            if (!def) return;
            (grouped[def.category] ||= []).push({ type, count: count as number });
        });

        const hasAny = Object.values(grouped).some(arr => arr && arr.length > 0);
        if (!hasAny) {
            const empty = document.createElement("div");
            empty.className = "inv-empty";
            empty.textContent = "Your backpack is empty. Forage and gather!";
            invGrid.appendChild(empty);
            return;
        }

        CATEGORY_ORDER.forEach(cat => {
            const entries = grouped[cat];
            if (!entries || entries.length === 0) return;

            const header = document.createElement("div");
            header.className = "inv-category-header";
            header.textContent = CATEGORY_LABELS[cat];
            invGrid.appendChild(header);

            entries
                .sort((a, b) => (ITEMS[a.type as keyof typeof ITEMS]?.name || a.type).localeCompare(ITEMS[b.type as keyof typeof ITEMS]?.name || b.type))
                .forEach(({ type, count }) => {
                    const def = itemDef(type)!;
                    const isEdible = !!def.food;

                    const consumeLabel = def.food?.consumeLabel || "Click to eat";
                    const itemEl = document.createElement("div");
                    itemEl.className = "recipe-item inv-item" + (isEdible ? " edible" : "");
                    itemEl.title = isEdible
                        ? `${def.name} — ${consumeLabel.toLowerCase()}`
                        : def.name;
                    itemEl.innerHTML = `
                        <div class="inv-item-row">
                            <span class="inv-icon">${def.icon}</span>
                            <span class="inv-name">${def.name}</span>
                            <span class="inv-qty">x${count}</span>
                        </div>
                        ${isEdible ? `<div class="inv-hint">${consumeLabel}</div>` : ''}
                    `;

                    if (isEdible) {
                        itemEl.style.cursor = "pointer";
                        itemEl.onclick = () => this._eatItem(type);
                    }

                    invGrid.appendChild(itemEl);
                });
        });
    }

    private _eatItem(type: string): void {
        const def = itemDef(type);
        if (!def?.food) return;
        if (!this._inventory.hasItem(type as ResourceType, 1)) return;

        this._inventory.removeItem(type as ResourceType, 1);
        if (def.food.sound) SoundManager.instance?.play(def.food.sound);

        const parts: string[] = [];
        if (def.food.hunger) {
            this._stats.restoreHunger(def.food.hunger);
            parts.push(`+${def.food.hunger} Hunger`);
        }
        if (def.food.thirst) {
            this._stats.restoreThirst(def.food.thirst);
            parts.push(`+${def.food.thirst} Thirst`);
        }
        if (def.food.health) {
            this._stats.restoreHealth(def.food.health);
            parts.push(`+${def.food.health} HP`);
        }
        if (def.food.warmth) {
            this._stats.restoreWarmth(def.food.warmth);
            parts.push(`+${def.food.warmth} Warmth`);
        }
        const verb = def.food.consumeVerb || "Ate";
        this._hud.showNotification(`${verb} ${def.name}${parts.length ? ` (${parts.join(", ")})` : ""}`);
        this._renderRecipes();
    }

    private _canCraft(recipe: Recipe): boolean {
        return Object.entries(recipe.requires).every(([type, count]) => {
            return this._inventory.getQuantity(type as ResourceType) >= (count || 0);
        });
    }

    private _isNearStation(station: StationType): boolean {
        const camera = (window as any).game?.playerController?.camera;
        if (!camera) return false;
        const stations = this._buildingSystem.getPlacedStations?.() ?? [];
        const r = CraftingSystem.STATION_RANGE;
        for (const s of stations) {
            if (s.type !== station) continue;
            const dx = camera.position.x - s.position.x;
            const dz = camera.position.z - s.position.z;
            if (dx * dx + dz * dz <= r * r) return true;
        }
        return false;
    }

    private _craft(id: string, recipe: Recipe): void {
        const isStructure = CraftingSystem.STRUCTURE_RECIPES.has(id);

        if (recipe.station && !this._isNearStation(recipe.station)) {
            SoundManager.instance?.play("error");
            this._hud.showNotification(`Stand near a ${CraftingSystem.STATION_LABEL[recipe.station]} to craft this.`);
            return;
        }

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
