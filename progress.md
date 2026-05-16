Original prompt: work on getting game fully playable

## Notes
- 2026-05-16 full audit pass started after UI/performance commit. Scope: menu/settings, start/save/load, pointer lock/pause, inventory/crafting, fishing, building, interaction selection, and production build health.
- Initial `npm run build` failed on TypeScript errors in crafting, building, and HUD code.
- Building placement raycast was checking terrain mesh names that do not exist in the generated island, making campfire/shelter placement impossible.
- Fixed TypeScript build errors and verified `npm run build` completes.
- Added `window.advanceTime(ms)` and `window.render_game_to_text()` hooks for automated gameplay verification.
- First Playwright run found a startup page error: rendering pipeline was initialized before a camera existed, so the main menu buttons never wired up.
- Moved rendering pipeline setup to after player camera creation.
- Playwright then entered gameplay successfully with no console errors.
- Added arrow-key movement alongside WASD for broader keyboard support and automated movement tests.
- Moved the initial spawn/facing direction to the resource beach so the player starts near driftwood, stone, crabs, and the raft.
- Hid the misleading raft-repair crafting recipe; raft repair is handled by interacting with the raft once resources are gathered.

## TODO
- Fix build errors.
- Verify the game starts, enters gameplay, and supports movement/interactions.
- Verify crafting/building and expose a concise text-state hook for automated testing.
- Replaced reliance on Babylon keyboard camera input with controller-owned key state so deterministic tests and normal play share movement behavior.
- Tuned manual movement to use direct collision movement instead of accumulating cameraDirection, preventing runaway acceleration during frame stepping.
- Added a nearby/in-front interaction fallback so low pickups can be collected without pixel-perfect vertical aiming.
- Pointer lock and pickup flow follow-up: pickups no longer require pointer lock, canvas requests pointer lock directly on click, and Tab now opens the inventory/crafting menu alongside E.
- Verified movement, pickup interaction, and Stone Axe crafting in browser automation; no page or console errors in final runs.
- Verified Tab menu opens and clicking a nearby driftwood pickup adds wood with no browser errors.
- Lightweight island content pass: reduced rain particle load, added drifting cloud discs, more stone pickups, low-poly beach details, palm fronds, and timed crab respawns.
- Verified forced rain state appears in render_game_to_text; catching a crab adds fish and respawns back to the original crab count with no browser errors.
- Audio pass: replaced URL-backed sound manager with lightweight procedural WebAudio mixer, ambience/rain/wind layers, event cues, settings volume support, and audio state in render_game_to_text. Verified cue firing and rain toggles with no browser errors.
- Audio/settings polish: added compressor, separate SFX bus, live volume preview, visible settings values, Test Audio button, earlier SoundManager initialization, and sanitized settings persistence.
- Audio audit follow-up: moved weather initialization after SettingsManager.apply so ambience/weather sound starts after saved volume is applied.

- Fishing input polish: added canvas-level right-click/contextmenu fallback with debounce and stabilized bobber bob animation around a base height.

- Input polish: restricted generic interact/harvest actions to left click so right-click fishing does not also drink/pick up nearby interactables.

- Verified crafting menu can craft Fishing Rod from 3 wood + 3 fiber and focused fishing flow casts, bites, and catches fish via right-click without triggering drink.

- Weather/audio polish: reduced rain and wind gain, softened procedural noise filters, removed loud rain onset burst, and swapped flat skybox for Babylon CDN cube skybox texture.

- Sky visibility polish: reduced default/settings fog density scale so the CDN skybox and horizon remain visible while weather can still add mist during rain.

- Regional fog pass: reduced normal global fog for sunnier beaches and added lightweight billboard mist patches around the forest, pond edge, and rocky bluff.

- Regional mist follow-up: replaced rectangular transparent fog planes with a generated radial alpha texture so forest/mountain mist fades softly at the edges.

## Detailed Project Report - 2026-05-16

### Current Goal
Driftwood Isle is being pushed from a rough Babylon.js prototype into a fully playable lightweight browser survival game. The current direction is a compact first-person island survival loop inspired by Minecraft-style interaction: gather resources, craft tools, use tools to harvest faster, fish for food, manage survival stats, build/place structures, and eventually repair the raft to escape.

### Current Playable State
- The game starts from the main menu and reliably enters gameplay.
- The player spawns on the beach near early resources: driftwood, stones, crabs, pond, forest access, and raft direction.
- Movement works with WASD and arrow keys.
- Mouse look/pointer lock has been improved and no longer blocks basic pickups.
- Left click is now reserved for general interact/harvest/pickup actions.
- Right click is reserved for fishing rod use when aimed at water.
- Tab and E both open the same Backpack & Crafting journal page.
- ESC now uses the same full-screen journal overlay layer for pause, and the menu states no longer stack over each other.
- `render_game_to_text()` exposes concise game state for automated verification.
- `advanceTime(ms)` exists for test stepping, though Babylon physics/rendering still means some checks are best done with short real-time waits.

### Menu/UI State
- Main menu: usable, with New Entry, Continue placeholder, Settings, and Credits.
- Settings: sensitivity, volume, fog density, post-processing toggle, and Test Audio button are present.
- Inventory/Crafting: now a full-screen overlay, same visual layer and journal treatment as ESC pause.
- Tab/E behavior: toggles Backpack & Crafting.
- ESC behavior:
  - If Backpack & Crafting is open, ESC closes it.
  - If no journal page is open, ESC opens Pause.
  - Pause shows Resume, Save Game, Load Game, Exit to Menu.
- Verified by Playwright:
  - Initial gameplay has no menu overlay.
  - Tab opens Backpack & Crafting.
  - E closes it.
  - E opens it again.
  - ESC closes crafting without opening pause on top.
  - ESC then opens Pause.
  - Both crafting and pause share z-index `3000` and full-screen overlay display behavior.

### Survival/World Systems
- Player stats: health, hunger, thirst, stamina, warmth.
- HUD shows health/hunger/thirst/stamina/warmth, compass, time/temp, notifications, and hotbar.
- Pond restores thirst when clicked.
- Rain restores thirst and reduces warmth unless near campfire.
- Day/night cycle exists and adjusts background/fog color.
- Weather system includes lightweight rain particles and drifting cloud discs.
- Regional atmosphere has been changed:
  - Normal global fog is low so the beach stays sunny-ish.
  - Forest, pond edge, and mountain/bluff areas use local soft billboard mist.
  - Mist uses a generated radial alpha texture so it fades at the edges instead of showing rectangles.
  - Rain still increases whole-scene fog for storm mood.

### Interaction and Gathering
- Pickups use left click and no longer require pointer lock.
- Interaction raycast has a nearby/in-front fallback so low resources are easier to pick up.
- Driftwood, stones, flint, scrap, crates, bushes, trees, rocks, fish, crabs, pond, and raft are represented as interactables.
- Small stones have more natural low-poly rock shapes and rock texture.
- Trees require repeated chopping; stone axe makes chopping faster.
- Large rocks require repeated mining; stone pickaxe is fastest, axe is slower, bare hands are slowest.
- Crabs can be caught and now respawn after a delay.
- Crates give rope, cloth, scrap, and wood.

### Crafting and Tool Loop
- Recipes currently include:
  - Stone Axe: wood + stone + fiber.
  - Stone Pickaxe: wood + stone + fiber.
  - Wooden Spear: wood + flint + fiber.
  - Fishing Rod: wood + fiber.
  - Campfire blueprint.
  - Shelter blueprint.
- Raft repair is intentionally not shown as a normal crafting recipe; it is handled by interacting with the raft.
- Crafting consumes resources and adds the created item.
- Edible items can be eaten from Backpack:
  - Berry restores hunger/thirst lightly.
  - Coconut restores hunger/thirst more.
  - Raw fish restores hunger.
- Verified: Fishing Rod can be crafted from 3 wood + 3 fiber through the menu.

### Fishing State
- Fishing is implemented in `src/interaction/FishingSystem.ts`.
- Requires a Fishing Rod in inventory.
- Right-click aimed at pond/ocean casts a bobber.
- After a randomized wait, bobber enters bite state.
- Right-click during bite catches fish and adds raw fish.
- Right-click too early reels in/cancels.
- Fishing input has canvas-level pointerdown/contextmenu fallback with debounce, so browser context menus do not eat the action.
- Bobber animation now stays around a stable base height instead of drifting.
- Verified:
  - Cast starts on right-click water.
  - Bite state appears.
  - Right-click during bite catches fish.
  - Fish enters inventory.
  - Right-click fishing no longer also triggers drink/pickup.

### Audio State
- URL-backed sample sounds were replaced with lightweight procedural WebAudio.
- SoundManager now has:
  - Master gain.
  - SFX gain.
  - Ambience gain.
  - Rain gain.
  - Wind gain.
  - Compressor.
  - Unlock listeners for pointer/key input.
- Cues exist for pickup, stone, wood, leaf, water, fish, crab, craft, build, error, menu, punch, and footsteps.
- Rain ambience was reduced because it was too loud/busy:
  - Rain bed lowered substantially.
  - Wind lowered.
  - Base ambience lowered.
  - Loud rain onset burst removed.
  - Noise filters softened.
- Settings volume now applies live to SoundManager.
- Test Audio button triggers a cue.
- `render_game_to_text()` exposes audio status.
- Verified forced-rain audio state showed calmer rain gain around `0.064` after fade-in instead of the earlier loud `0.22` target.

### Visual/Performance State
- Babylon.js remains the renderer.
- Skybox was upgraded from a flat emissive cube to a Babylon CDN CubeTexture:
  - URL: `https://playground.babylonjs.com/textures/skybox`
  - Uses `Texture.SKYBOX_MODE`.
- Fog scale was reduced so the skybox and horizon are visible.
- Beach now reads clearer and sunnier.
- Forest/mountain zones carry more mood through local mist instead of global fog.
- Rain particle count was previously reduced from heavier early values to a more browser-friendly setup.
- Current build still emits Vite/Babylon chunk-size warnings because Babylon core is large. This is expected right now, not a build failure.

### Verification Done
- `npm run build` passes after the latest menu and fog changes.
- Playwright smoke run enters gameplay and screenshots were inspected.
- Menu-specific Playwright test verified Tab/E/ESC state transitions.
- Focused fishing tests verified cast, bite, catch, inventory update, and no accidental drinking on right-click.
- Crafting test verified Fishing Rod recipe availability and craft result.
- Regional mist screenshots were inspected:
  - Beach stayed bright/clear.
  - Forest had localized soft haze.
  - First rectangular-mist issue was caught and fixed with radial alpha texture.
- In-app browser was reloaded to `http://127.0.0.1:5173/` after recent work.

### Known Rough Edges / Risks
- The repo has many files staged/added already, so git status is noisy. Avoid broad resets or cleanup unless explicitly requested.
- Text encoding for some emoji/icons appears mojibake in source files and rendered HTML in this environment. The UI still functions, but a future polish pass should normalize encoding and icon strategy.
- Babylon bundle is large. Browser play is still usable locally, but production optimization should revisit imports/code splitting.
- Pointer lock remains browser-sensitive. The explicit ESC pause handler helps, but any future menu work should be tested in the real in-app browser and Playwright.
- Save/load exists but has not been recently fully regression-tested against every new item/tool.
- Building blueprints exist, but placement/structure completion should get another focused end-to-end test before calling the game fully complete.
- Victory/raft repair exists, but the full resource-to-escape loop should be tested from a clean save.
- Combat/defense is minimal. Wooden Spear exists as an item recipe, but richer spear behavior is not yet deeply implemented.
- Crabs currently act as interactable food pickups, not animated hostile/passive creatures.
- Regional mist is lightweight and looks acceptable, but could be improved further with layered particles or depth-aware shader work if performance allows.
- Weather affects stats, but player-facing feedback for rain/cold could be clearer.

### Recommended Next Steps
- Full playable loop test:
  - Start fresh.
  - Gather wood/stone/fiber.
  - Craft stone axe and fishing rod.
  - Gather food/water.
  - Mine/chop with tools.
  - Build campfire/shelter.
  - Loot crates.
  - Repair raft and trigger victory.
- Build system polish:
  - Verify campfire and shelter placement on terrain.
  - Show clearer placement validity feedback.
  - Confirm required resources are consumed only on final placement.
- Inventory/tool polish:
  - Add active hotbar item semantics, not just visual slots.
  - Make tool-specific use clearer: axe for trees/crates, pickaxe for rocks, rod for water, spear for crabs/future threats.
  - Consider durability or at least tooltips if keeping it lightweight.
- Audio next pass:
  - Add subtle separate ocean lap layer.
  - Add softer UI open/close paper sounds.
  - Add distinct cast, bite, reel, and catch cues for fishing.
  - Add campfire loop only when near placed campfire.
- Visual next pass:
  - Improve palm leaves and tree silhouettes.
  - Add more beach props with low-poly meshes.
  - Add small animated fish/bobber water rings using simple rings/discs.
  - Tune clouds/sky brightness against day-night cycle.
- Weather next pass:
  - Make rain visually stronger near camera but still cheap.
  - Add wet/dim color grading only during rain.
  - Keep beach sunny outside storms.
- UI next pass:
  - Clean mojibake icons/text.
  - Add recipe categories or tabs if the list grows.
  - Add clearer objective/journal page: "Repair the raft."
  - Make Continue enabled only when a save exists.
- Testing next pass:
  - Add a reusable Playwright script for menu transitions.
  - Add a reusable Playwright script for fishing.
  - Add a reusable Playwright script for full raft victory path.
  - Keep screenshot inspection in the loop after visual changes.

### Latest Menu Verification Snapshot
- Build: passed.
- Test sequence:
  - Start game.
  - Tab opens `Backpack & Crafting`.
  - E closes it.
  - E opens it again.
  - ESC closes crafting.
  - ESC opens Pause.
- Result:
  - Crafting and pause both use full-screen overlay display.
  - Both are on z-index `3000`.
  - They do not stack over each other.
  - ESC pause no longer depends only on pointer-lock change events.

- Menu unification pass started: inventory/crafting now uses the same full-screen journal overlay layer as pause; Tab/E toggles Backpack & Crafting; ESC closes crafting or opens Pause reliably through explicit controller handling.

- 2026-05-16 audit found Babylon DefaultCollisionCoordinator side-effect missing during movement stepping; added explicit collisionCoordinator import in PlayerController before retesting.
- 2026-05-16 major feature audit passed after the collision import: production build, bundled web-game client movement/screenshot loop, settings persistence, start/move, Tab/ESC overlays, craft axe/rod, eat item, place/complete campfire, save/load, fishing cast/bite/catch, raft victory, and game-over overlays all passed with no page errors.

- 2026-05-16 self-contained asset pass: replaced all CDN textures (Babylon playground wood/grass/rock/sand/water/skybox/flare/fire, Google Fonts Special Elite, transparenttextures papyros) with procedural DynamicTexture equivalents in `src/world/ProceduralTextures.ts`. Skybox is now a procedural sky gradient dome instead of a remote CubeTexture. Game now runs with zero failed network requests in offline / restricted environments.
- 2026-05-16 exposed game internals on `window.game` (inventory, stats, weather, fishing, craftingSystem, buildingSystem, interactionSystem, playerController) for deterministic Puppeteer audits. Final audit verified: game start, inventory add, craft Stone Axe, craft Fishing Rod, pickup interaction, save/load round-trip, weather rain on/off, raft interactable presence, game-over overlay on lethal damage - 0 console/page errors.
