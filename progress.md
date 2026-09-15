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
- 2026-05-25 combat overhaul: replaced the click-to-fight stub with a real melee system. New `src/combat/CombatSystem.ts` + `src/combat/Weapons.ts`: equipping a weapon (Wooden Spear or new craftable Bone Club) puts the player in a combat stance where left-click swings on a cooldown, finds the best target in a forward cone (per-weapon range/arc/damage/knockback), spends stamina, and plays swing/hit feedback (crosshair strike + hit marker, camera punch). Enemies (animals) now implement a `Combatant` interface: billboard health bars that appear on damage and recolour green→red, hit flash, knockback clamped to walkable ground, and a stagger that interrupts attacks. Hostile predators telegraph a wind-up (rear back + roar) before each bite so hits are dodgeable, enrage when struck (faster, shorter bite cooldown), while prey flee when hit. Death plays a topple-and-sink animation and drops Raw Meat (+ a chance of the new Bone item, used to craft the Bone Club). Player hits now route through `CombatSystem.damagePlayer` which adds a red damage vignette, hurt sound, camera shake, and notification. Tamed companions are immune to targeting. Added combat sound cues (swing/hit/hurt/roar/playerHurt) and rewrote `scripts/test_animals.cjs` to cover spear-swing kills, loot drops, companion immunity, and player damage feedback.
- 2026-05-25 wildlife pass: added a roaming animal system (`src/world/Animals.ts`) with four species — Monkey and Boar (passive, tameable) and Wolf and Tiger (hostile, attack the player on sight until tamed). Procedural low-poly meshes (quadruped + primate forms) with wander/chase/flee/follow AI on walkable ground (`Island._isWalkable`). Taming: click an animal while carrying its preferred food (banana/coconut/berry for monkeys, berries for boars, raw meat/fish for wolves, raw meat for tigers) to feed it; after enough feedings it becomes a following companion and stops being hostile. Combat: clicking an animal while holding a Wooden Spear fights it; killing one drops Raw Meat. Added `banana` and `meat` food items and spawned bananas + animals across the grove and an inland predator clearing. Verified spawn census, monkey taming (consumes exactly tameCount), and tiger spear-kill drop via `scripts/test_animals.cjs`.
- 2026-05-25 gameplay feedback pass: survival needs (hunger/thirst/warmth) now surface player-facing warnings. A "getting hungry/thirsty/cold" warn toast fires once when a need drops to <=25, and a danger toast ("starving/parched/freezing — your health is draining") fires when a need hits 0, so silent health drain is no longer unexplained. Warnings re-arm once the need recovers above 40. Added `scripts/test_need_warnings.cjs` smoke test covering low, depleted, and re-arm cases.
- 2026-05-16 exposed game internals on `window.game` (inventory, stats, weather, fishing, craftingSystem, buildingSystem, interactionSystem, playerController) for deterministic Puppeteer audits. Final audit verified: game start, inventory add, craft Stone Axe, craft Fishing Rod, pickup interaction, save/load round-trip, weather rain on/off, raft interactable presence, game-over overlay on lethal damage - 0 console/page errors.

- 2026-09-10 audit & polish pass. Findings and fixes, all verified in-browser and via `npm run build`:
  - Day/night clock was 6h out of sync with the sun (world went dark at "noon"). The sun treats `_time` 0 as sunrise while the HUD clock displayed `_time*24` directly; the clock now offsets +6h so 12:00 reads at the sun's peak, and a fresh start begins at 08:00 in bright morning light.
  - Pause/menu no longer lets the world run on: `isGameplayActive()` (already used by combat/animal AI) now also treats the loading screen as inactive, and `PlayerStats` + `DayNightCycle` consult it so hunger/thirst/warmth and the sun freeze while paused, while loading, and after death.
  - Survival rebalance: thirst drained 0.6/s (empty in ~2.8 min, ~30x hunger) — now 0.15/s thirst (~11 min) and 0.05/s hunger (~33 min), roughly one drink per in-game day.
  - Death flow: `playerDied` fired every tick after health hit 0 (now once, on the crossing); the journal could still be opened over the death screen via Tab/E (blocked when `run-ended`); hotbar/scroll keys are dead too (`_isAnyMenuOpen`); and `showGameOver`/`showVictory` now dismiss any open pause/crafting menu instead of stacking.
  - Loading: world load stalled up to ~60s awaiting the remote 46 MB fish.glb (and a missing crab.glb 404) inside step 1. The fish fetch now starts immediately but is not on the critical path — vendored models load in parallel, the fish gets a 2s grace window (cache hits are instant), and ponds spawn procedural fish that swap to the model automatically if it lands later. Debug console.logs removed from fish spawning.
  - HUD/crosshair/FPS stayed visible around the loading card; a `body.is-loading` class now hides gameplay chrome until the world is ready.
  - FPS counter showed "FPS: 0" before real frames existed; it now samples `engine.getFps()` twice a second and stays blank until there is something honest to show.
  - Cosmetic: "How to Play" menu button no longer wraps to two lines; emoji in the victory/game-over headers and the touch-control help list swapped for the journal SVG sprite (interact/jump/fish/inventory); dead `#compass-needle` CSS removed; duplicate `window.game` assignment removed.
- Not changed deliberately: LOCAL_MODELS/LOCAL_TEXTURES 404-on-miss behavior is a documented drop-in override path, and the chunk-size build warning remains a known Babylon bundle size tradeoff.

- 2026-09-10 FPS/performance pass. Changes, all typecheck/build verified and smoke-tested in-browser:
  - LoadingScreen.step no longer gates the next world-build step strictly on requestAnimationFrame: occluded/background windows suspend rAF entirely, which could leave world loading stuck forever (observed at 18% "Shaping the island terrain"). A 60ms timer races the rAF so visible tabs still paint the status first.
  - AssetLoader.instantiate now passes `doNotInstantiate: false` to `instantiateModelsToScene`. The Babylon default is actually "clone everything"; the explicit flag hardware-instances repeated props (trees, bushes, rocks, crates, barrels) so N copies batch into ~1 draw per source mesh instead of N clones (measured 21 InstancedMeshes on a fresh isle; skinned meshes like the fish still clone as they must). Verified instanced trees render and remain interactable through the normal target pipeline.
  - Static world content (terrain parts, mast, beach details, raft, trees, bushes, rocks, crates, pickups, fish anchors, palm leaves) now freezes its world matrix, skipping per-frame matrix recompute for ~100 meshes. Harvested/animated things (crabs, animals, mist, clouds, ocean) stay dynamic.
  - DayNightCycle reuses its sun-direction vector and background colors instead of allocating new Vector3/Color3 pairs every frame (GC churn).
  - WeatherSystem: the rain particle system now starts only when rain begins and stops when it clears (previously it simulated 24/7 at emitRate 0), and the emitter reuses a single Vector3 instead of allocating per frame.
  - `scene.skipPointerMovePicking = true` — all interaction is click/ray driven, hover picking was pure overhead.
  - Removed leftover per-spawn console.log strings from Island._spawnNodes.
  - Measurement note: the dev sandbox renders in software (SwiftShader) with ±1.5ms frame-time jitter between identical runs, so micro-benchmark A/B could not resolve draw-call savings reliably; instancing/freezing were kept on the strength of Babylon's documented CPU-side costs (draw calls, matrix dirty checks), and correctness (rendering + interaction + rain) was verified live.

- 2026-09-10 game assets audit & polish pass:
  - Reference audit: `hero.png`, `images/icons.png` (531 KB), `typescript.svg`, `vite.svg` were unreferenced (Vite-template leftovers) and have been removed. `splash.png` stays — it is the main-menu backdrop.
  - Attribution fix (CC-BY compliance): the in-game Credits page claimed "Art: Low-Poly Jungle Kit" while the actually-shipped models are the BabylonJS/Assets Village Pack (CC-BY 4.0, vendored under `public/assets/babylon/`). Credits now credit BabylonJS/Assets properly, plus procedural textures/sounds/icons in-house.
  - `hollowLog.glb` was vendored but never referenced — it now loads and two logs lie on the sands (starter beach + west beach) as driftwood decor, scaled 0.6 (the source is ~4 m × 1.5 m), world-matrix frozen, unpickable. GLB dims parsed from the files to confirm orientation rather than guessing.
  - Crab fallback replaced: the red box is now a merged primitive crab (flattened body, claws, six legs, eye stalks) in crab-red; still one mesh so `createInstance` keeps working for all crab spawns.
  - Escape raft replaced: brown box is now a proper log raft — 7 logs, two crossbeams, mast, yard and cloth sail — merged into one multi-material mesh at the escape beach.
  - Buildable structures upgraded from placeholder boxes: campfire = stone ring + charcoal bed + log tepee (existing flame particles kept, emit box raised); shelter = palm-thatch lean-to on poles; workbench = tabletop + four legs; drying rack = posts + crossbar + three hanging fish. All merged single meshes so metadata/pickups/interaction behave exactly as before.
  - Rock procedural texture gained low-frequency mottling so the large bluff no longer reads as flat grey.
  - FPS readout guard: `getFps()` can return Infinity right after synchronous render bursts (test hooks); the HUD now shows nothing rather than "FPS: Infinity".
  - Babylon gotcha fixed during verification: setting `backFaceCulling` on a brand-new material before it is attached to any mesh can crash `markAsDirty` (null subMeshes) — shelter thatch and raft sail now set the flag after `mesh.material = ...`.
  - Verified in-browser: fresh-isle screenshots of the log, crab (recognizable + interactable "CRAB — CLICK — CATCH"), raft with sail, and all four built structures; `npm run build` clean.
- 2026-09-10 full-change audit pass (reviewing all uncommitted work together):
  - Cross-impact bug found and fixed: sleepInShelter was calibrated to the old broken clock. `setTime(0.27)` ("~6:30am") now landed at 12:28 displayed after the clock remap, and its `isNight = t > 0.78 || t < 0.22` gate allowed sleeping in daylight. Sleep now reasons in displayed clock hours (allowed 19:00–05:30) and wakes at `setTime(1/48)` = 06:30. Verified in-browser: forced midnight + sleep → wakes 06:30 with HP/stamina restored.
  - Confirmed no other consumers of raw `dayNight.time` depend on the old display mapping (SaveSystem round-trips it raw, which stays correct).
  - Cosmetic: merged the split Color3/Color4 imports in DayNightCycle.
  - Known accepted tradeoffs: blueprint/ghost previews remain simple translucent boxes even though finished structures are detailed; old saves resume with the sun where it was but their displayed clock shifts +6h (cosmetic, one-time).
- 2026-09-10 UX pass:
  - Autosave is no longer a toast: "Game Auto-saved" fired every 30 seconds and monopolised the notification feed. Autosaves now write silently and pulse the day/clock box border for ~2s (HUD.flashSaved + savedPulse keyframes). Manual "Save Game" keeps its toast.
  - New-run onboarding: a fresh game (New Journal) now shows three staggered hints in the notification feed — movement/sprint (1.5s), gather + journal controls (7s), and the objective "repair the broken raft on this shore" (13s). Loading a save shows nothing.
  - Audit of existing UX found these already solid, left as-is: fishing bite cue ("Bite! Right-click to reel!"), building placement feedback (green/red ghost + "Cannot place here!" + R-to-rotate hint), crafting recipe sorting with lacking ingredient chips, and low-need warning toasts.
  - Verified in-browser: hints fire on schedule with no console errors, autosave writes localStorage silently, saved-pulse animation applies, manual save still toasts.
- 2026-09-10 mechanics pass:
  - Night cold mechanic implemented (was promised by the How-to-Play tip but never existed): clear nights now drain warmth at 1.0/s when the player is exposed (net -0.5/s vs passive regen, so a full bar freezes in ~3 minutes of exposure), a campfire warms +2.0/s, and shelter blocks the drain. Rain chills remain as before, faster (2.5/s). Warmth logic is gated on isGameplayActive so pausing freezes exposure too, and WeatherSystem now receives the DayNightCycle reference; DayNightCycle gained a public isNight() (19:30–05:30 clock hours). This makes campfire/shelter matter every night, not only during rain, and the existing warmth need-warnings/cold HUD glyph surface the danger.
  - Cooked Meat: new campfire recipe (1 raw meat + 1 wood → cooked meat: +35 hunger, +10 warmth) giving hunted meat a cooked upgrade alongside fish. Item type, registry def, hotbar order and recipe wired; verified in-browser that the recipe crafts next to a campfire and the result is edible from the journal.
  - Missing item icons authored: stoneAxe, stonePickaxe, woodenSpear, boneClub, fishingRod, cookedFish, driedFish, berryJam, cookedMeat, raftProgress were referenced by the registry but absent from game-icons.svg, rendering blank in the hotbar/backpack/recipe list. All added in the sprite's stroke-glyph style (43 symbols total, registry/sprite cross-check now clean).
  - Verified in-browser: night warmth drain away from fire, recovery by campfire (+2.5/s net with passive regen), cooked meat craft + eat path, icons render in the crafting/backpack UI; `npm run build` clean.
- 2026-09-10 shelter building pass:
  - Fixed shelters floating when built through the real flow: the ghost/blueprint preview boxes carried legacy +Y offsets (+1.25 for shelter, +0.1–0.8 for the others) that were needed only when previews were centred boxes. The merged structures are ground-anchored, so the final shelter was built 1.25 m in the air. All build stages are now ground-anchored (verified final shelter lands at y=0).
  - WYSIWYG building stages: ghost, wireframe blueprint and finished structure are all generated from shared per-type part builders (_structureParts → campfire/shelter/workbench/dryingRack), replacing the generic boxes. The ghost now literally becomes the wireframe blueprint on placement instead of being swapped for a differently-shaped box.
  - Shelter model upgraded: back wall closes the high side and a leaf bed pad marks the sleeping spot inside the lean-to.
  - Builder-side robustness: part builders take an optional override material (ghost mode paints every part with the valid/invalid ghost material without creating throwaway final materials); thatch backFaceCulling is only set after the material is attached to meshes.
  - Verified in-browser through the real flow (startBuilding → place → contribute resources → finish): ghost valid, blueprint pickable with "Add Resources" prompt, one contribution click completes with exact resources, finished shelter at y=0 with sleep prompt, and sleep jumps midnight → 06:30 with stats restored.
- 2026-09-10 state management audit & pass:
  - Structures now persist. SaveData gained a `structures` blob (placed stations + built shelters + in-progress blueprints with their remaining-resource counts); SaveSystem.save/load take an optional BuildingSystem and all four Game call sites pass it. Previously placed campfires/shelters/workbenches/drying racks vanished on load — which also silently broke station-gated crafting (the stations list emptied) — and blueprints destroyed materials already donated. BuildingSystem gained serialize()/deserialize() plus pending-blueprint and built-shelter tracking; loaded stations regain their click hints and station gating.
  - Verified round-trip in-browser: campfire + shelter + partial workbench blueprint → autosave → reload → Continue → all restored at the same spots (shelter at y=0, sleep interactable, campfire back in the station list, blueprint remaining counts intact).
  - Fishing timers now respect pause: a bite on hold while a menu is open no longer expires (bite re-arms every 500ms until isGameplayActive, same for the miss window). Verified: 10s pause mid-cast → bite fires only after resume.
  - Autosave/manual-save console.log noise removed (the clock-box pulse and toasts already communicate saves).
  - Audit note (not changed): world resources other than crabs (trees, stone, bushes) are finite and do not respawn. The map has enough for the raft + tools, but a long-running save could theoretically exhaust a node type; a regrowth mechanic is a candidate future pass.
- 2026-09-10 fish assets pass:
  - Pond fish orientation fixed: the remote fish.glb is authored upright, so fish stood vertically on/near the pond rim. They now lie horizontal (rotation.x 90°) with a random heading per fish, for both the GLB model and the procedural fallback cylinder.
  - Fish placement tightened: the pond-fish spawn region radius dropped from 8 to 5.5 so fish stay in deeper water instead of hugging the rim, and the swim height was tuned (y -0.05) so fish backs break the pond surface — visible, but clearly swimming rather than hovering (the skinned model's origin sits near its body centre, established empirically after bounding-box measurements returned zero-height for the skinned mesh).
  - AssetLoader.instantiate now starts cloned animation groups; the fish.glb "swimming" clip was shipping but never played, so model fish were frozen statues.
  - Known quirk: the pond water is near-opaque, so fish below the surface are effectively invisible; catching still works through the nearby-interactable fallback (prompt shows "FISH — CLICK — CATCH" at the water's edge). Verified visually after the height fix.
- 2026-09-13 regrowth + pond/fish + weather-dimming pass (all verified in-browser via new `scripts/test_regrowth.cjs`, 9/9, `npm run build` clean):
  - Resource regrowth implemented (was flagged as the map being finite): every harvested node now returns after a pause-aware delay — fish 75s, crabs 45s, driftwood/bananas 120s, stones 150s, bushes 210s, flint/scrap 240s, trees 300s, rocks 360s; shipwreck crates stay one-shot loot. Island keeps a pending-respawn queue ticked from an onBeforeRender observable gated on `isGameplayActive()` (menus freeze regrowth — verified), and respawns get fresh `*_respawn_*` ids so they behave correctly through save/load. The old crab `setTimeout` respawn was migrated onto this queue. Bonus fix: crab-wander obstacles were leaking (stumps kept blocking crabs forever and respawned nodes double-added); obstacles are now keyed by node id and removed when the node is harvested.
  - Test hook: `window.game.island` getter plus `Island.fastForwardRespawns(seconds)` for deterministic regrowth tests.
  - Pond water pass: alpha 0.8 → 0.55 with a slight emissive tint and a slow animated texture drift (wrap-enabled offsets), so the pond finally reads as living water and the catchable fish are visible through the surface (fish swim height raised to y 0.02). Verified in screenshots.
  - Fish model bug found & fixed by rework: with the 46 MB fish.glb actually loaded, the old per-fish "upgrade" produced giant fish hovering in mid-air — the GLB is not one fish but a whole rigged school ("all_fish1"/"Clown" node hierarchy, 441 animated transform nodes per clone) circling a large model-space orbit, and glTF skinned meshes ignore ancestor scaling, so the 0.3 root scaling never applied. The per-fish upgrade path was removed (along with `_fishSpawns`/`_activeFish` machinery): catchable pond fish are now always procedural single-mesh instances (one click = one catch), and the GLB joins the pond as one ambient `fish_school` centrepiece at the pond centre, un-pickable, resized via a `fish_school_scale` wrapper TransformNode parented between the root and the rig (0.12 keeps the circling over deep water, only leap arcs break the surface). Wrapper initially re-parented itself into itself (infinite recursion, stack overflow) — guarded.
  - Fishing polish: casting now spawns an expanding water-ripple ring under the bobber (shared torus + one material; slow 1.7 s cycle while waiting, fast 0.7 s + brighter during a bite, restarts on bite as a splash cue, disposed with the bobber on reel-in/catch).
  - Weather: rain now visibly darkens the world, not just the fog. DayNightCycle gained a `cloudCover` (0–1, eased ~4 s) that scales sun intensity (×0.55 at full overcast) and lerps the sky/background toward storm gray; WeatherSystem.toggleRain drives the target (1 raining / 0 clear). `render_game_to_text` reports `weather.cloudCover`; verified sun 1.00 → 0.57 at noon with cover 0.78.
  - Not changed: crates remain finite (shipwreck salvage), blueprint ghosts still simple silhouettes (accepted tradeoff), crab.glb still 404s to procedural (documented override path).
- 2026-09-13 fish asset audit & polish + true-WYSIWYG building ghosts (verified in-browser via new `scripts/test_fish_and_ghosts.cjs`, 10/10, regrowth suite still 9/9, `npm run build` clean):
  - Fish asset audit findings: the only fish model in play is the 46 MB remote school GLB (correctly used as the ambient pond centrepiece since the last pass); catchable pond fish were still the old plain blue cylinder, frozen in place with an awkward rotation.x=90° lay-down; no vendored local fish model exists; icons for fish items were already complete. Nothing unused to delete.
  - Catchable fish rebuilt: `_baseFish` is now a merged multi-part fish (elongated body, tail-fin cone, dorsal fin, two angled pectoral fins) in silvery-teal with specular glint, authored facing +Z so `rotation.y` is directly the heading — no more lay-down rotation. Still one mesh + one material so `createInstance()` keeps every spawn a single click target.
  - Fish idle swim: each pond fish now drifts lazily inside the pond deep zone (centre r≈4.4 m, 0.45 m/s, pause 0.8–3.3 s between targets), turning toward its heading with a tail-flick wobble and a gentle surface bob; gated on `isGameplayActive()` so fish freeze with the world while paused. Verified: positions/headings change live, all fish stay inside the pond, and fish are statues while the ESC menu is open. Observable removed on dispose (crab pattern).
  - WYSIWYG ghost upgrade: build ghosts are no longer a uniform green blob — `startBuilding` now builds the parts with their REAL materials (structure-part builders allocate fresh ones per build), merges, then sets every material translucent (alpha 0.55) with a validity emissive tint (soft green on flat ground / red on steep slopes or sky). Because the materials are per-build allocations, the tint can never leak into placed structures (`_finishBuilding` builds another fresh set), and the ghost's temporary materials are explicitly disposed on both placement and cancel so the scene doesn't accumulate them. Validation now flips a `_ghostValid` flag + tint instead of swapping shared materials; `_placeStructure` gates on the flag.
  - Blueprint material deduplicated: one shared wireframe `_blueprintMaterial` replaces per-placement allocations; loaded (deserialize) blueprints build straight onto it instead of creating real part materials just to orphan them, and the merged mesh gets the material assigned directly (merge can wrap a lone material in a MultiMaterial).
  - Bug found by the new test and fixed: in-session Load Game stacked duplicate structures (save + load left 2 blueprints + 2 campfires). `BuildingSystem.deserialize` now clears all tracked stations/shelters/blueprints first (stopping campfire particle systems bound to the disposed meshes), then restores from the save — fresh-page Continue was always fine, but the pause-menu Load path is now correct too. Verified: exactly one of each after round-trip, station list intact.
  - Visual verification screenshots: `scripts/shots/ghost_campfire_valid.png` (translucent true-color campfire with green tint), `ghost_campfire_invalid.png` (red tint on the bluff), `ghost_shelter.png` (translucent lean-to with thatch/poles/bed readable), `ghost_campfire_finished.png`, `fish_closeup.png` (new fish silhouette near the surface).
- 2026-09-13 texture audit & polish pass (verified via new `scripts/test_textures.cjs`, 8/8; fish/ghost 10/10 and regrowth 9/9 still green; `npm run build` clean):
  - Audit findings: the ocean was a flat untextured blue plane; the sky dome rendered the same static gradient at noon, midnight and in storms (DayNightCycle only tinted the clearColor the dome covers); the water texture's vertical gradient banded hard at the pond's 5× v-tiling; LOCAL_TEXTURES (the documented photo override path) was declared in AssetCatalog but never wired to anything; terrain textures were functional but flat.
  - Terrain texture upgrades (all still deterministic seeded DynamicTextures): sand gained wind ripples (whole-number sine periods so lines wrap seamlessly when tiled) + shell grit; grass gained 600 leaning blade strokes in varied greens plus a few dry yellow ones (was green static); wood gained knots (dark-ring/light-core radial gradients kept off tile edges); rock gained warm mineral patches and quartz flecks so the bluff is not pure grey; water replaced its banding gradient with a flat base + 90 tile-safe wave highlight lines + sparkle flecks (pond and ocean share the art).
  - Sky dome now follows time and weather: DayNightCycle tints the dome material's emissiveColor every frame — near-white at noon, dark navy at night, a warm golden-hour band around sunrise/sunset, and a grey wash blended in by storm cloud cover. Tint reuses a Color3 (no per-frame allocs). Verified numerically: noon (1,1,1), midnight (0.07,0.09,0.2), sunset r>b (0.73/0.56), rain cover 0.76 → muted grey.
  - Ocean retextured: shared procedural water art tiled 90× with a slow u/v drift animation and alpha 0.4 → 0.85, so the sea reads as water instead of a blue plane (fog still fades the horizon).
  - LOCAL_TEXTURES photo-override path implemented (was dead): Island._initTextures now tries to paint `public/assets/polyhaven/<name>.jpg` images over the procedural canvases (same-origin, so no canvas tainting; 404s never fire onload and procedural stays). Because tiled clones copy canvas content at clone time, a module-level repaint registry (WeakMap of listeners) refreshes every clone when a source texture is repainted — the async photo propagates to the 20× sand / 15× grass / 10× rock tiling too.
  - Sky gradient texture retuned (deeper zenith, warmer horizon band) so tinting has a better base; verification screenshots: `texture_day_beach.png` (sand ripples + ocean waves), `texture_night_sky.png` (navy night), `texture_sunset.png` (golden horizon), `texture_rain_sky.png` (grey overcast).
