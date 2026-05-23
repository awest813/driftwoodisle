# External Assets

This directory is served at `/assets/*` at runtime. The game loads files from
here when available and falls back to procedural geometry / textures otherwise.

## What's wired up

Paths the loader checks are defined in `src/world/AssetCatalog.ts`. Anything
not here is loaded at runtime from the Babylon.js public asset CDN
(`raw.githubusercontent.com/BabylonJS/Assets`), which is CORS-friendly.

## To install Kenney models

The Kenney Pirate Kit and Survival Kit are CC0. Download from kenney.nl, then
copy the GLB files into `public/assets/kenney/`:

| Game role     | File expected                  | Source kit        |
| ------------- | ------------------------------ | ----------------- |
| Raft          | `public/assets/kenney/raft.glb`    | Pirate Kit    |
| Ship mast     | `public/assets/kenney/mast.glb`    | Pirate Kit    |
| Campfire      | `public/assets/kenney/campfire.glb`| Survival Kit  |
| Spear         | `public/assets/kenney/spear.glb`   | Survival Kit  |
| Stone axe     | `public/assets/kenney/axe.glb`     | Survival Kit  |
| Stone pickaxe | `public/assets/kenney/pickaxe.glb` | Survival Kit  |
| Crab          | `public/assets/kenney/crab.glb`    | Survival Kit  |
| Torch         | `public/assets/kenney/torch.glb`   | Survival Kit  |

Kenney kits ship with each model as a separate folder containing GLB / FBX /
OBJ; copy just the GLBs and rename them to match the table above.

## To install Poly Haven textures

Poly Haven 1K JPG diffuse maps. Download from polyhaven.com, drop into
`public/assets/polyhaven/`:

| Game role     | File expected                                   |
| ------------- | ----------------------------------------------- |
| Sand terrain  | `public/assets/polyhaven/sand_1k.jpg`            |
| Grass terrain | `public/assets/polyhaven/grass_1k.jpg`           |
| Rock terrain  | `public/assets/polyhaven/rock_1k.jpg`            |
| Wood props    | `public/assets/polyhaven/wood_1k.jpg`            |

Texture wiring is not yet implemented in `src/world/ProceduralTextures.ts`;
add the lookup there when these files are dropped in.

## Licensing

- Babylon Village Pack (loaded from CDN): CC-BY 4.0. Credit "BabylonJS/Assets"
  in the credits screen.
- Kenney kits: CC0, no attribution required.
- Poly Haven: CC0, no attribution required.
