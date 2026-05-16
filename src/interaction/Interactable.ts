export interface Interactable {
    id: string;
    name: string;
    prompt: string;
    interact(inventory: any, hud: any, stats: any): void;
}
