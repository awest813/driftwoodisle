import type { ResourceType } from "./ItemTypes";

export type ItemCategory = "food" | "resource" | "tool" | "material" | "structure" | "progress";

export interface ItemDef {
    type: ResourceType;
    name: string;
    icon: string;
    category: ItemCategory;
    showInHotbar: boolean;
    food?: { hunger?: number; thirst?: number; sound?: string };
}

export const ITEMS: Record<ResourceType, ItemDef> = {
    wood:         { type: "wood",         name: "Wood",          icon: "🪵", category: "resource", showInHotbar: true },
    stone:        { type: "stone",        name: "Stone",         icon: "🪨", category: "resource", showInHotbar: true },
    fiber:        { type: "fiber",        name: "Fiber",         icon: "🌿", category: "resource", showInHotbar: true },
    leaf:         { type: "leaf",         name: "Leaf",          icon: "🍃", category: "resource", showInHotbar: true },
    flint:        { type: "flint",        name: "Flint",         icon: "🔥", category: "resource", showInHotbar: true },
    scrap:        { type: "scrap",        name: "Scrap",         icon: "🔩", category: "resource", showInHotbar: true },
    rope:         { type: "rope",         name: "Rope",          icon: "🪢", category: "material", showInHotbar: true },
    cloth:        { type: "cloth",        name: "Cloth",         icon: "👕", category: "material", showInHotbar: true },
    berry:        { type: "berry",        name: "Berries",       icon: "🫐", category: "food",     showInHotbar: true,
        food: { hunger: 5, thirst: 5, sound: "pickup" } },
    coconut:      { type: "coconut",      name: "Coconut",       icon: "🥥", category: "food",     showInHotbar: true,
        food: { hunger: 15, thirst: 20, sound: "wood" } },
    fish:         { type: "fish",         name: "Raw Fish",      icon: "🐟", category: "food",     showInHotbar: true,
        food: { hunger: 10, sound: "fish" } },
    stoneAxe:     { type: "stoneAxe",     name: "Stone Axe",     icon: "🪓", category: "tool",     showInHotbar: true },
    stonePickaxe: { type: "stonePickaxe", name: "Stone Pickaxe", icon: "⛏️", category: "tool",     showInHotbar: true },
    woodenSpear:  { type: "woodenSpear",  name: "Wooden Spear",  icon: "🔱", category: "tool",     showInHotbar: true },
    fishingRod:   { type: "fishingRod",   name: "Fishing Rod",   icon: "🎣", category: "tool",     showInHotbar: true },
    campfire:     { type: "campfire",     name: "Campfire",      icon: "🔥", category: "structure", showInHotbar: false },
    shelter:      { type: "shelter",      name: "Shelter",       icon: "⛺", category: "structure", showInHotbar: false },
    raftProgress: { type: "raftProgress", name: "Raft Progress", icon: "⛵", category: "progress",  showInHotbar: false },
};

export const HOTBAR_ORDER: ResourceType[] = [
    "stoneAxe", "stonePickaxe", "woodenSpear", "fishingRod",
    "wood", "stone", "fiber", "leaf", "flint",
    "rope", "cloth", "scrap",
    "berry", "coconut", "fish",
];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
    tool: "Tools",
    food: "Food",
    resource: "Resources",
    material: "Materials",
    structure: "Structures",
    progress: "Progress",
};

export const CATEGORY_ORDER: ItemCategory[] = ["tool", "food", "resource", "material", "structure", "progress"];

export function itemDef(type: string): ItemDef | undefined {
    return (ITEMS as Record<string, ItemDef>)[type];
}
