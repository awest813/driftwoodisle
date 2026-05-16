export interface Stats {
    health: number;
    hunger: number;
    thirst: number;
    stamina: number;
    warmth: number;
}

export type StatsCallback = (stats: Stats) => void;

export class PlayerStats {
    private _stats: Stats = {
        health: 100,
        hunger: 100,
        thirst: 100,
        stamina: 100,
        warmth: 100
    };
    private _listeners: StatsCallback[] = [];

    constructor() {
        // Survival loop
        setInterval(() => {
            this.decreaseHunger(0.02);
            this.decreaseThirst(0.6);
            if (this._stats.warmth < 100) this.restoreWarmth(0.5);
            if (this._stats.stamina < 100 && this._stats.hunger > 10 && this._stats.thirst > 10) {
                this.restoreStamina(5);
            }
            this._checkHealthDrain();
        }, 1000);
    }

    private _checkHealthDrain(): void {
        if (this._stats.hunger <= 0 || this._stats.thirst <= 0 || this._stats.warmth <= 0) {
            this.decreaseHealth(1);
        }
    }

    public decreaseHealth(amount: number): void {
        this._stats.health = Math.max(0, this._stats.health - amount);
        this._notify();
        if (this._stats.health <= 0) {
            // Handle Death
            window.dispatchEvent(new CustomEvent("playerDied"));
        }
    }

    public restoreHealth(amount: number): void {
        this._stats.health = Math.min(100, this._stats.health + amount);
        this._notify();
    }

    public restoreHunger(amount: number): void {
        this._stats.hunger = Math.min(100, this._stats.hunger + amount);
        this._notify();
    }

    public restoreThirst(amount: number): void {
        this._stats.thirst = Math.min(100, this._stats.thirst + amount);
        this._notify();
    }

    public decreaseHunger(amount: number): void {
        this._stats.hunger = Math.max(0, this._stats.hunger - amount);
        this._notify();
    }

    public decreaseThirst(amount: number): void {
        this._stats.thirst = Math.max(0, this._stats.thirst - amount);
        this._notify();
    }

    public decreaseWarmth(amount: number): void {
        this._stats.warmth = Math.max(0, this._stats.warmth - amount);
        this._notify();
    }

    public restoreWarmth(amount: number): void {
        this._stats.warmth = Math.min(100, this._stats.warmth + amount);
        this._notify();
    }

    public useStamina(amount: number): boolean {
        if (this._stats.stamina >= amount) {
            this._stats.stamina -= amount;
            this._notify();
            return true;
        }
        return false;
    }

    public restoreStamina(amount: number): void {
        this._stats.stamina = Math.min(100, this._stats.stamina + amount);
        this._notify();
    }

    public addListener(callback: StatsCallback): void {
        this._listeners.push(callback);
        callback(this._stats);
    }

    private _notify(): void {
        this._listeners.forEach(cb => cb(this._stats));
    }

    public get stats(): Stats {
        return this._stats;
    }

    public getData(): Stats {
        return this._stats;
    }

    public loadData(data: Stats): void {
        this._stats = { ...data };
        this._notify();
    }
}
