import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import type { Scene } from "@babylonjs/core/scene";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

// Loads .glb / .gltf assets and caches one AssetContainer per URL. Failed loads
// resolve to null so callers can fall back to procedural geometry.
export class AssetLoader {
    private _scene: Scene;
    private _cache = new Map<string, AssetContainer | null>();
    private _inflight = new Map<string, Promise<AssetContainer | null>>();

    constructor(scene: Scene) {
        this._scene = scene;
    }

    public async load(url: string): Promise<AssetContainer | null> {
        if (this._cache.has(url)) return this._cache.get(url)!;
        const pending = this._inflight.get(url);
        if (pending) return pending;

        const lastSlash = url.lastIndexOf("/");
        const rootUrl = url.substring(0, lastSlash + 1);
        const filename = url.substring(lastSlash + 1);

        const promise = SceneLoader.LoadAssetContainerAsync(rootUrl, filename, this._scene)
            .then(container => {
                // Hide template meshes so only instantiated copies render.
                container.meshes.forEach(m => m.setEnabled(false));
                this._cache.set(url, container);
                return container;
            })
            .catch(err => {
                console.warn(`[AssetLoader] ${url} unavailable:`, err?.message || err);
                this._cache.set(url, null);
                return null;
            })
            .finally(() => this._inflight.delete(url));

        this._inflight.set(url, promise);
        return promise;
    }

    public async loadAll(urls: string[]): Promise<void> {
        await Promise.all(urls.map(u => this.load(u)));
    }

    // Returns a fresh instantiated copy if the model is loaded, else null.
    public instantiate(url: string): TransformNode | null {
        const container = this._cache.get(url);
        if (!container) return null;
        const result = container.instantiateModelsToScene(name => name);
        return result.rootNodes[0] as TransformNode;
    }

    public isAvailable(url: string): boolean {
        return !!this._cache.get(url);
    }
}
