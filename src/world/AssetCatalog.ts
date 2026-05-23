// Asset URLs grouped by source. Catalog-only; loading happens in AssetLoader.
//
// Babylon "Village Pack" is CC-BY 4.0 (BabylonJS/Assets). A small subset is vendored
// under public/assets/babylon/ so the game works offline and doesn't depend on GitHub
// uptime at runtime. The fish model stays remote-only (the bundled GLB is 46 MB).
//
// Kenney / Poly Haven assets are CC0 but neither host is reachable from the build
// sandbox (network policy blocks everything except GitHub) and they ship no
// GitHub-hosted GLB mirror. Place them under public/assets/ following the LOCAL_*
// paths below; the loader uses them when present and falls back otherwise.

const BABYLON_ROOT = "https://raw.githubusercontent.com/BabylonJS/Assets/master/meshes/";

// Vendored locally (public/assets/babylon/). Served at /assets/babylon/ by Vite.
export const REMOTE_MODELS = {
    tree:      "/assets/babylon/tree1.glb",
    tree2:     "/assets/babylon/tree2.glb",
    bush:      "/assets/babylon/bush1.glb",
    rock:      "/assets/babylon/rocks1.glb",
    crate:     "/assets/babylon/crate1.glb",
    barrel:    "/assets/babylon/barrel.glb",
    hollowLog: "/assets/babylon/hollowLog.glb",
    // Too large to vendor; loaded from CDN if reachable, else procedural fallback.
    fish:      `${BABYLON_ROOT}fish.glb`,
} as const;

// Optional local overrides. If a file exists at the path, it wins. Vite serves /assets/
// from public/ at runtime, so dropping files under public/assets/<...> makes them load.
export const LOCAL_MODELS = {
    raft:     "/assets/kenney/raft.glb",
    mast:     "/assets/kenney/mast.glb",
    campfire: "/assets/kenney/campfire.glb",
    spear:    "/assets/kenney/spear.glb",
    axe:      "/assets/kenney/axe.glb",
    pickaxe:  "/assets/kenney/pickaxe.glb",
    crab:     "/assets/kenney/crab.glb",
    torch:    "/assets/kenney/torch.glb",
} as const;

export const LOCAL_TEXTURES = {
    sand:  "/assets/polyhaven/sand_1k.jpg",
    grass: "/assets/polyhaven/grass_1k.jpg",
    rock:  "/assets/polyhaven/rock_1k.jpg",
    wood:  "/assets/polyhaven/wood_1k.jpg",
} as const;
