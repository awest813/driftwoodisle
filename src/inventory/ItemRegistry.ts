import type { ResourceType } from "./ItemTypes";

export type ItemCategory = "food" | "consumable" | "resource" | "tool" | "material" | "structure" | "progress";

export interface ItemDef {
    type: ResourceType;
    name: string;
    icon: string;
    category: ItemCategory;
    showInHotbar: boolean;
    food?: {
        hunger?: number; thirst?: number; health?: number; warmth?: number;
        sound?: string;
        consumeLabel?: string;
        consumeVerb?: string;
    };
}

export const ITEMS: Record<ResourceType, ItemDef> = {
    wood:         { type: "wood",         name: "Wood",          icon: "wood",         category: "resource", showInHotbar: true },
    stone:        { type: "stone",        name: "Stone",         icon: "stone",        category: "resource", showInHotbar: true },
    fiber:        { type: "fiber",        name: "Fiber",         icon: "fiber",        category: "resource", showInHotbar: true },
    leaf:         { type: "leaf",         name: "Leaf",          icon: "leaf",         category: "resource", showInHotbar: true },
    flint:        { type: "flint",        name: "Flint",         icon: "flint",        category: "resource", showInHotbar: true },
    scrap:        { type: "scrap",        name: "Scrap",         icon: "scrap",        category: "resource", showInHotbar: true },
    bone:         { type: "bone",         name: "Bone",          icon: "bone",         category: "resource", showInHotbar: true },
    rope:         { type: "rope",         name: "Rope",          icon: "rope",         category: "material", showInHotbar: true },
    cloth:        { type: "cloth",        name: "Cloth",         icon: "cloth",        category: "material", showInHotbar: true },
    berry:        { type: "berry",        name: "Berries",       icon: "berry",        category: "food",     showInHotbar: true,
        food: { hunger: 5, thirst: 5, sound: "pickup" } },
    coconut:      { type: "coconut",      name: "Coconut",       icon: "coconut",      category: "food",     showInHotbar: true,
        food: { hunger: 15, thirst: 20, sound: "wood" } },
    banana:       { type: "banana",       name: "Banana",        icon: "banana",       category: "food",     showInHotbar: true,
        food: { hunger: 12, thirst: 5, sound: "pickup" } },
    meat:         { type: "meat",         name: "Raw Meat",      icon: "meat",         category: "food",     showInHotbar: true,
        food: { hunger: 18, sound: "fish" } },
    fish:         { type: "fish",         name: "Raw Fish",      icon: "fish",         category: "food",     showInHotbar: true,
        food: { hunger: 10, sound: "fish" } },
    stoneAxe:     { type: "stoneAxe",     name: "Stone Axe",     icon: "stoneAxe",     category: "tool",     showInHotbar: true },
    stonePickaxe: { type: "stonePickaxe", name: "Stone Pickaxe", icon: "stonePickaxe", category: "tool",     showInHotbar: true },
    woodenSpear:  { type: "woodenSpear",  name: "Wooden Spear",  icon: "woodenSpear",  category: "tool",     showInHotbar: true },
    boneClub:     { type: "boneClub",     name: "Bone Club",     icon: "boneClub",     category: "tool",     showInHotbar: true },
    fishingRod:   { type: "fishingRod",   name: "Fishing Rod",   icon: "fishingRod",   category: "tool",     showInHotbar: true },
    campfire:     { type: "campfire",     name: "Campfire",      icon: "campfire",     category: "structure", showInHotbar: false },
    shelter:      { type: "shelter",      name: "Shelter",       icon: "shelter",      category: "structure", showInHotbar: false },
    workbench:    { type: "workbench",    name: "Workbench",     icon: "workbench",    category: "structure", showInHotbar: false },
    dryingRack:   { type: "dryingRack",   name: "Drying Rack",   icon: "dryingRack",   category: "structure", showInHotbar: false },
    cookedFish:   { type: "cookedFish",   name: "Cooked Fish",   icon: "cookedFish",   category: "food",     showInHotbar: true,
        food: { hunger: 40, warmth: 5, sound: "fish" } },
    cookedMeat:   { type: "cookedMeat",   name: "Cooked Meat",   icon: "cookedMeat",   category: "food",     showInHotbar: true,
        food: { hunger: 35, warmth: 10, sound: "fish" } },
    driedFish:    { type: "driedFish",    name: "Dried Fish",    icon: "driedFish",    category: "food",     showInHotbar: true,
        food: { hunger: 25, sound: "fish" } },
    berryJam:     { type: "berryJam",     name: "Berry Jam",     icon: "berryJam",     category: "food",     showInHotbar: true,
        food: { hunger: 30, thirst: 20, sound: "pickup" } },
    bandage:      { type: "bandage",      name: "Bandage",       icon: "bandage",      category: "consumable", showInHotbar: true,
        food: { health: 25, sound: "pickup", consumeLabel: "Click to apply", consumeVerb: "Used" } },
    raftProgress: { type: "raftProgress", name: "Raft Progress", icon: "raftProgress", category: "progress",  showInHotbar: false },
};

export const HOTBAR_ORDER: ResourceType[] = [
    "stoneAxe", "stonePickaxe", "woodenSpear", "boneClub", "fishingRod",
    "wood", "stone", "fiber", "leaf", "flint", "bone",
    "rope", "cloth", "scrap",
    "berry", "coconut", "banana", "meat", "fish",
    "cookedFish", "cookedMeat", "driedFish", "berryJam", "bandage",
];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
    tool: "Tools",
    food: "Food",
    consumable: "Consumables",
    resource: "Resources",
    material: "Materials",
    structure: "Structures",
    progress: "Progress",
};

export const CATEGORY_ORDER: ItemCategory[] = ["tool", "food", "consumable", "resource", "material", "structure", "progress"];

export function itemDef(type: string): ItemDef | undefined {
    return (ITEMS as Record<string, ItemDef>)[type];
}
