export type ResourceType =
  | "wood"
  | "stone"
  | "fiber"
  | "leaf"
  | "berry"
  | "coconut"
  | "fish"
  | "rope"
  | "cloth"
  | "scrap"
  | "flint"
  | "stoneAxe"
  | "stonePickaxe"
  | "woodenSpear"
  | "fishingRod"
  | "campfire"
  | "shelter"
  | "raftProgress";

export interface Item {
    id: string;
    name: string;
    type: ResourceType;
    quantity: number;
    icon?: string;
}
