import type { ResourceType } from "../inventory/ItemTypes";

export interface Recipe {
    name: string;
    requires: Partial<Record<ResourceType, number>>;
    creates: string;
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
  raftRepair: {
    name: "Repair Raft ⛵",
    requires: { wood: 20, fiber: 10, rope: 2, cloth: 2 },
    creates: "raftProgress"
  }
};
