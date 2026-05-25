import type { ResourceType } from "../inventory/ItemTypes";

export interface WeaponStat {
    name: string;
    damage: number;
    range: number;       // melee reach in metres
    arcDot: number;      // min forward dot product for a hit (smaller = wider cone)
    cooldownMs: number;  // time between swings
    knockback: number;   // metres the target is shoved back
    staminaCost: number;
}

// Only items listed here put the player in a combat stance (left-click swings).
// Harvest tools (axe/pickaxe) deliberately stay out so gathering is unaffected.
export const WEAPONS: Partial<Record<ResourceType, WeaponStat>> = {
    woodenSpear: {
        name: "Wooden Spear",
        damage: 24, range: 3.6, arcDot: 0.6,
        cooldownMs: 620, knockback: 2.4, staminaCost: 6,
    },
    boneClub: {
        name: "Bone Club",
        damage: 42, range: 2.6, arcDot: 0.45,
        cooldownMs: 880, knockback: 3.4, staminaCost: 10,
    },
};

export function weaponFor(type: string | null | undefined): WeaponStat | null {
    if (!type) return null;
    return WEAPONS[type as ResourceType] ?? null;
}
