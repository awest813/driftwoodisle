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
                // LoadAssetContainer keeps templates out of the scene already, so no
                // need to disable them (doing so would propagate to instantiated copies).
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
    // doNotInstantiate:false hardware-instances static meshes (skinned ones
    // still clone), so repeated props share draw batches instead of each
    // paying a full clone + draw call.
    public instantiate(url: string): TransformNode | null {
        const container = this._cache.get(url);
        if (!container) return null;
        const result = container.instantiateModelsToScene(name => name, false, { doNotInstantiate: false });
        const root = result.rootNodes[0] as TransformNode;
        root.setEnabled(true);
        root.getChildMeshes().forEach(m => m.setEnabled(true));
        // Cloned animation groups (e.g. the fish "swimming" clip) start paused —
        // play them so animated models actually animate. Animated nodes sit
        // below the returned root, so caller placement composes over the clip.
        for (const group of result.animationGroups) {
            group.start(true);
        }
        return root;
    }

    public isAvailable(url: string): boolean {
        return !!this._cache.get(url);
    }
}
