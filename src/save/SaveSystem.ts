import { Inventory } from "../inventory/Inventory";
import { PlayerStats } from "../player/PlayerStats";
import type { Stats } from "../player/PlayerStats";
import { DayNightCycle } from "../world/DayNightCycle";
import { FreeCamera, Vector3 } from "@babylonjs/core";
import type { ResourceType } from "../inventory/ItemTypes";

export interface SaveData {
    inventory: Record<ResourceType, number>;
    stats: Stats;
    time: number;
    playerPosition: { x: number, y: number, z: number };
    playerRotation: { x: number, y: number, z: number };
}

export class SaveSystem {
    private static SAVE_KEY = "driftwood_isle_save";

    public static save(
        inventory: Inventory,
        stats: PlayerStats,
        dayNight: DayNightCycle,
        camera: FreeCamera
    ): void {
        const data: SaveData = {
            inventory: inventory.getData(),
            stats: stats.getData(),
            time: dayNight.time,
            playerPosition: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            },
            playerRotation: {
                x: camera.rotation.x,
                y: camera.rotation.y,
                z: camera.rotation.z
            }
        };

        localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
        console.log("Game Saved");
    }

    public static load(
        inventory: Inventory,
        stats: PlayerStats,
        dayNight: DayNightCycle,
        camera: FreeCamera
    ): boolean {
        const rawData = localStorage.getItem(this.SAVE_KEY);
        if (!rawData) return false;

        try {
            const data: SaveData = JSON.parse(rawData);

            inventory.loadData(data.inventory);
            stats.loadData(data.stats);
            dayNight.setTime(data.time);
            
            camera.position = new Vector3(
                data.playerPosition.x,
                data.playerPosition.y,
                data.playerPosition.z
            );
            camera.rotation = new Vector3(
                data.playerRotation.x,
                data.playerRotation.y,
                data.playerRotation.z
            );

            console.log("Game Loaded");
            return true;
        } catch (e) {
            console.error("Failed to load game", e);
            return false;
        }
    }

    public static hasSave(): boolean {
        return localStorage.getItem(this.SAVE_KEY) !== null;
    }
}
