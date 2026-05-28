// True when the player is actually in control of the game (no blocking menu or
// end screen is up). Several real-time systems (combat, animal AI) consult this
// so the world effectively pauses while the player is in a menu, even though the
// Babylon render loop keeps running.
export function isGameplayActive(): boolean {
    if (document.body.classList.contains("run-ended")) return false;
    const esc = document.getElementById("escMenu");
    if (esc && esc.style.display === "flex") return false;
    const crafting = document.getElementById("craftingMenu");
    if (crafting?.classList.contains("active")) return false;
    const main = document.getElementById("mainMenu");
    if (main && main.style.display !== "none") return false;
    return true;
}
