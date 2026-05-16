import type { ResourceType } from "./ItemTypes";

export type InventoryCallback = (items: Record<ResourceType, number>) => void;
export type InventoryChangeCallback = (type: ResourceType, delta: number, total: number) => void;

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
    private _changeListeners: InventoryChangeCallback[] = [];

    public addItem(type: ResourceType, quantity: number = 1): void {
        if (quantity <= 0) return;
        const total = (this._items[type] || 0) + quantity;
        this._items[type] = total;
        this._notifyListeners();
        this._notifyChange(type, quantity, total);
    }

    public removeItem(type: ResourceType, quantity: number = 1): boolean {
        const current = this._items[type] || 0;
        if (current >= quantity) {
            const total = current - quantity;
            this._items[type] = total;
            this._notifyListeners();
            this._notifyChange(type, -quantity, total);
            return true;
        }
        return false;
    }

    public hasItem(type: ResourceType, quantity: number = 1): boolean {
        return (this._items[type] || 0) >= quantity;
    }

    public getQuantity(type: ResourceType): number {
        return this._items[type] || 0;
    }

    public clear(): void {
        const keys = Object.keys(this._items) as ResourceType[];
        keys.forEach(k => { this._items[k] = 0; });
        this._notifyListeners();
    }

    public addListener(callback: InventoryCallback): void {
        this._listeners.push(callback);
        callback(this._items as Record<ResourceType, number>);
    }

    public onChange(callback: InventoryChangeCallback): void {
        this._changeListeners.push(callback);
    }

    private _notifyListeners(): void {
        this._listeners.forEach(cb => cb(this._items as Record<ResourceType, number>));
    }

    private _notifyChange(type: ResourceType, delta: number, total: number): void {
        this._changeListeners.forEach(cb => cb(type, delta, total));
    }

    public getData(): Record<ResourceType, number> {
        return this._items as Record<ResourceType, number>;
    }

    public loadData(data: Record<ResourceType, number>): void {
        this._items = { ...data };
        this._notifyListeners();
    }
}
