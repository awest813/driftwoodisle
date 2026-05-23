// Asset URLs grouped by source. Catalog-only; loading happens in AssetLoader.
//
// Babylon "Village Pack" is CC-BY 4.0 (BabylonJS/Assets). Hosted on raw.githubusercontent.com,
// which serves the .glb files with `access-control-allow-origin: *` so they fetch cleanly
// from a browser without proxying.
//
// Kenney / Poly Haven assets are CC0 but the sandbox / browser cannot pull them directly.
// Place them under public/assets/ following the paths below; the loader will use them when
// present and fall back to procedural meshes / textures otherwise.

const BABYLON_VILLAGE = "https://raw.githubusercontent.com/BabylonJS/Assets/master/meshes/villagePack/";
const BABYLON_ROOT = "https://raw.githubusercontent.com/BabylonJS/Assets/master/meshes/";

export const REMOTE_MODELS = {
    tree:     `${BABYLON_VILLAGE}tree1/tree1.glb`,
    bush:     `${BABYLON_VILLAGE}bush1/bush1.glb`,
    rock:     `${BABYLON_VILLAGE}rocks1/rocks1.glb`,
    crate:    `${BABYLON_VILLAGE}crate1/crate1.glb`,
    hollowLog: `${BABYLON_VILLAGE}hollowLog/hollowLog.glb`,
    fish:     `${BABYLON_ROOT}fish.glb`,
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
