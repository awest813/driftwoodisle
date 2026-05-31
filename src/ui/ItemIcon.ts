import { itemDef } from "../inventory/ItemRegistry";

export const GAME_ICONS_SPRITE = "/game-icons.svg";

/** Resolve sprite symbol id for an item or station type. */
export function itemIconId(type: string): string {
    const def = itemDef(type);
    if (def?.icon) return def.icon;
    return type;
}

/** Inline SVG referencing the shared sprite (safe for innerHTML in trusted UI). */
export function itemIconHtml(type: string, className = "item-icon"): string {
    const id = itemIconId(type);
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">`
        + `<use href="${GAME_ICONS_SPRITE}#icon-${id}"></use></svg>`;
}

/** Stat bar / HUD glyph (health, hunger, thirst, stamina, warmth, cold). */
export function statIconHtml(stat: "health" | "hunger" | "thirst" | "stamina" | "warmth" | "cold", className = "item-icon stat-glyph"): string {
    const id = stat === "cold" ? "stat-cold" : `stat-${stat}`;
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">`
        + `<use href="${GAME_ICONS_SPRITE}#icon-${id}"></use></svg>`;
}

/** Touch / menu UI glyph. */
export function uiIconHtml(ui: "pause" | "inventory" | "jump" | "interact" | "sprint" | "crouch" | "fish", className = "ui-icon"): string {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">`
        + `<use href="${GAME_ICONS_SPRITE}#icon-ui-${ui}"></use></svg>`;
}

export function mountItemIcon(container: HTMLElement, type: string, className = "item-icon"): void {
    container.innerHTML = itemIconHtml(type, className);
}
