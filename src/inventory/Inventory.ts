import type { ResourceType } from "./ItemTypes";

export type InventoryCallback = (items: Record<ResourceType, number>) => void;

export class Inventory {
    private _items: Partial<Record<ResourceType, number>> = {
        wood: 0,
        stone: 0,
        fiber: 0,
        leaf: 0,
        berry: 0,
        coconut: 0,
        fish: 0
    };
    private _listeners: InventoryCallback[] = [];

    public addItem(type: ResourceType, quantity: number = 1): void {
        this._items[type] = (this._items[type] || 0) + quantity;
        this._notifyListeners();
    }

    public removeItem(type: ResourceType, quantity: number = 1): boolean {
        const current = this._items[type] || 0;
        if (current >= quantity) {
            this._items[type] = current - quantity;
            this._notifyListeners();
            return true;
        }
        return false;
    }

    public getQuantity(type: ResourceType): number {
        return this._items[type] || 0;
    }

    public addListener(callback: InventoryCallback): void {
        this._listeners.push(callback);
        callback(this._items as Record<ResourceType, number>);
    }

    private _notifyListeners(): void {
        this._listeners.forEach(cb => cb(this._items as Record<ResourceType, number>));
    }

    public getData(): Record<ResourceType, number> {
        return this._items as Record<ResourceType, number>;
    }

    public loadData(data: Record<ResourceType, number>): void {
        this._items = { ...data };
        this._notifyListeners();
    }
}
