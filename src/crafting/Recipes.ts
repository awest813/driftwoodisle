import type { ResourceType } from "../inventory/ItemTypes";

export type StationType = "workbench" | "dryingRack" | "campfire";

export interface Recipe {
    name: string;
    requires: Partial<Record<ResourceType, number>>;
    creates: string;
    station?: StationType;
}

export const recipes: Record<string, Recipe> = {
  stoneAxe: {
    name: "Stone Axe 🪓",
    requires: { wood: 2, stone: 2, fiber: 1 },
    creates: "stoneAxe"
  },
  stonePickaxe: {
    name: "Stone Pickaxe ⛏️",
    requires: { wood: 3, stone: 4, fiber: 2 },
    creates: "stonePickaxe"
  },
  woodenSpear: {
    name: "Wooden Spear 🔱",
    requires: { wood: 4, flint: 1, fiber: 2 },
    creates: "woodenSpear"
  },
  boneClub: {
    name: "Bone Club 🏏",
    requires: { wood: 2, bone: 3, fiber: 2 },
    creates: "boneClub"
  },
  fishingRod: {
    name: "Fishing Rod",
    requires: { wood: 3, fiber: 3 },
    creates: "fishingRod"
  },
  campfire: {
    name: "Campfire 🔥",
    requires: { wood: 5, stone: 4 },
    creates: "campfire"
  },
  shelter: {
    name: "Shelter ⛺",
    requires: { wood: 10, leaf: 8, fiber: 4 },
    creates: "shelter"
  },
  workbench: {
    name: "Workbench 🛠️",
    requires: { wood: 10, fiber: 5, stone: 2 },
    creates: "workbench"
  },
  dryingRack: {
    name: "Drying Rack 🪤",
    requires: { wood: 4, fiber: 4 },
    creates: "dryingRack"
  },
  cookedFish: {
    name: "Cooked Fish 🍣",
    requires: { fish: 1, wood: 1 },
    creates: "cookedFish",
    station: "campfire"
  },
  berryJam: {
    name: "Berry Jam 🍯",
    requires: { berry: 3, wood: 1 },
    creates: "berryJam",
    station: "campfire"
  },
  driedFish: {
    name: "Dried Fish 🐠",
    requires: { fish: 1 },
    creates: "driedFish",
    station: "dryingRack"
  },
  bandage: {
    name: "Bandage 🩹",
    requires: { cloth: 1, fiber: 2 },
    creates: "bandage",
    station: "workbench"
  },
  raftRepair: {
    name: "Repair Raft ⛵",
    requires: { wood: 20, fiber: 10, rope: 2, cloth: 2 },
    creates: "raftProgress"
  }
};
