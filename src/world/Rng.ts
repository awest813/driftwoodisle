// Deterministic RNG for per-run world generation.
// mulberry32: fast, well-distributed for game-level seeding.
export class Rng {
    private _state: number;

    constructor(seed: number) {
        this._state = (seed | 0) || 1;
    }

    public next(): number {
        let t = (this._state = (this._state + 0x6D2B79F5) | 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    public range(min: number, max: number): number {
        return min + (max - min) * this.next();
    }

    public int(min: number, max: number): number {
        return Math.floor(this.range(min, max + 1));
    }
}

export function generateSeed(): number {
    return (Math.random() * 0x100000000) >>> 0;
}
