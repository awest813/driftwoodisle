import { MenuManager } from "../ui/MenuManager";

// True when the player is actually in control of the game (no blocking menu or
// end screen is up). Several real-time systems (combat, animal AI) consult this
// so the world effectively pauses while the player is in a menu, even though the
// Babylon render loop keeps running.
export function isGameplayActive(): boolean {
    return MenuManager.isGameplayActive();
}
