export type ResourceType =
  | "wood"
  | "stone"
  | "fiber"
  | "leaf"
  | "berry"
  | "coconut"
  | "banana"
  | "meat"
  | "fish"
  | "rope"
  | "cloth"
  | "scrap"
  | "flint"
  | "bone"
  | "stoneAxe"
  | "stonePickaxe"
  | "woodenSpear"
  | "boneClub"
  | "fishingRod"
  | "campfire"
  | "shelter"
  | "workbench"
  | "dryingRack"
  | "cookedFish"
  | "driedFish"
  | "berryJam"
  | "bandage"
  | "raftProgress";

export interface Item {
    id: string;
    name: string;
    type: ResourceType;
    quantity: number;
    icon?: string;
}
