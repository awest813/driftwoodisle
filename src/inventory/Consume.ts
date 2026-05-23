import type { Inventory } from "./Inventory";
import type { PlayerStats } from "../player/PlayerStats";
import type { HUD } from "../ui/HUD";
import type { ResourceType } from "./ItemTypes";
import { itemDef } from "./ItemRegistry";
import { SoundManager } from "../game/SoundManager";

export function consumeItem(
    type: ResourceType,
    inventory: Inventory,
    stats: PlayerStats,
    hud: HUD
): boolean {
    const def = itemDef(type);
    if (!def?.food) return false;
    if (!inventory.hasItem(type, 1)) return false;

    inventory.removeItem(type, 1);
    if (def.food.sound) SoundManager.instance?.play(def.food.sound);

    const parts: string[] = [];
    if (def.food.hunger) {
        stats.restoreHunger(def.food.hunger);
        parts.push(`+${def.food.hunger} Hunger`);
    }
    if (def.food.thirst) {
        stats.restoreThirst(def.food.thirst);
        parts.push(`+${def.food.thirst} Thirst`);
    }
    if (def.food.health) {
        stats.restoreHealth(def.food.health);
        parts.push(`+${def.food.health} HP`);
    }
    if (def.food.warmth) {
        stats.restoreWarmth(def.food.warmth);
        parts.push(`+${def.food.warmth} Warmth`);
    }
    const verb = def.food.consumeVerb || "Ate";
    hud.showNotification(`${verb} ${def.name}${parts.length ? ` (${parts.join(", ")})` : ""}`);
    return true;
}
