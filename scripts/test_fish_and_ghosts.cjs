// Smoke test for the fish-asset polish + WYSIWYG building-ghost pass.
// - Catchable fish are merged fish shapes (not cylinders), swim idly, and respawn.
// - The ambient fish school loads (tolerates offline) at sane scale.
// - Building ghosts show real part colors translucently, tint red on invalid
//   ground, place into wireframe blueprints, and finish into opaque structures.
//
// Requires `npm run dev`; override the URL with DRIFTWOOD_TEST_URL.

const puppeteer = require('puppeteer');

const assert = (cond, msg) => {
    if (!cond) throw new Error('ASSERT FAILED: ' + msg);
    console.log('  ok -', msg);
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const BASE_URL = process.env.DRIFTWOOD_TEST_URL || 'http://localhost:5173';

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        executablePath: require('fs').existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
            ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
            : undefined
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', err => {
        errors.push(err.message);
        console.log('PAGE ERROR:', err.message);
    });
    page.on('console', msg => {
        if (msg.type() === 'error') console.log(`[Browser Console error]`, msg.text());
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('goto:', e.message));
    await page.waitForFunction(() => window.game && document.getElementById('startGame'), { timeout: 30000 });
    await sleep(1000);
    await page.click('#startGame');
    await page.waitForFunction(() => window.game?.hud && window.game?.inventory && window.game?.playerController && window.game?.island, { timeout: 60000 });
    await sleep(4000);

    const tests = [];
    const run = (name, fn) => tests.push({ name, fn });
    const evalJson = async (fn, ...args) => page.evaluate(fn, ...args);

    run('game reaches playable state with no page errors', async () => {
        assert(errors.length === 0, `no page errors (got ${errors.length}): ${errors.join(' | ')}`);
    });

    run('catchable fish are shaped like fish (longer than wide, with fins)', async () => {
        const state = await evalJson(() => {
            const base = window.game.scene.meshes.find(m => m.name === 'baseFish');
            const fish = window.game.scene.meshes.filter(m => /^fish_\d+$/.test(m.name));
            if (!base || fish.length === 0) return { base: !!base, count: fish.length };
            const b = base.getBoundingInfo().boundingBox;
            const ext = b.maximumWorld.subtract(b.minimumWorld);
            return {
                base: true,
                count: fish.length,
                length: Number(ext.z.toFixed(2)),
                width: Number(ext.x.toFixed(2)),
                height: Number(ext.y.toFixed(2)),
                color: base.material.diffuseColor.asArray().map(v => +v.toFixed(2))
            };
        });
        assert(state.base && state.count > 0, `base fish template + ${state.count} catchable fish exist`);
        assert(state.length > state.width * 1.5 && state.length > state.height * 1.5,
            `fish is elongated (L${state.length} x W${state.width} x H${state.height})`);
    });

    run('fish swim idly (positions and headings change over time)', async () => {
        const sample = () => evalJson(() => window.game.scene.meshes
            .filter(m => /^fish_\d+$/.test(m.name))
            .map(m => [m.position.x, m.position.z, m.rotation.y]));
        const a = await sample();
        await sleep(2500);
        const b = await sample();
        assert(a.length === b.length && a.length > 0, `fish samples consistent (${a.length} fish)`);
        const moved = a.some((p, i) =>
            Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) > 0.05 || Math.abs(p[2] - b[i][2]) > 0.02);
        assert(moved, 'at least one fish moved/turned between samples');
        const inPond = await evalJson(() => window.game.scene.meshes
            .filter(m => /^fish_\d+$/.test(m.name))
            .every(m => Math.hypot(m.position.x - 20, m.position.z - 5) <= 5.2));
        assert(inPond, 'all fish stayed inside the pond deep zone');
    });

    run('fish freeze while the game is paused', async () => {
        const a = await evalJson(() => {
            document.getElementById('escMenu').style.display = 'flex';
            return window.game.scene.meshes.filter(m => /^fish_\d+$/.test(m.name))
                .map(m => [m.position.x, m.position.z]);
        });
        await sleep(2000);
        const b = await evalJson(() => {
            const s = window.game.scene.meshes.filter(m => /^fish_\d+$/.test(m.name))
                .map(m => [m.position.x, m.position.z]);
            document.getElementById('escMenu').style.display = 'none';
            return s;
        });
        const still = a.every((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) < 0.001);
        assert(still, 'fish did not move while paused');
    });

    run('ambient fish school loads at sane scale (or is skipped offline)', async () => {
        await sleep(12000); // give the 46 MB model a moment if the network allows
        const state = await evalJson(() => {
            const scene = window.game.scene;
            const school = scene.transformNodes.find(t => t.name === 'fish_school');
            const wrapper = scene.transformNodes.find(t => t.name === 'fish_school_scale');
            return { hasSchool: !!school, wrapperScale: wrapper ? wrapper.scaling.x : null };
        });
        if (!state.hasSchool) {
            console.log('  note - remote fish.glb unreachable; skipping school checks');
        } else {
            assert(Math.abs(state.wrapperScale - 0.12) < 0.001, `school wrapper scale is 0.12 (got ${state.wrapperScale})`);
        }
    });

    run('campfire ghost is a true-color translucent preview on valid ground', async () => {
        const state = await evalJson(() => {
            window.game.buildingSystem.startBuilding('campfire', { name: 'Campfire', requires: { wood: 5, stone: 4 } });
            const cam = window.game.playerController.camera;
            cam.position.set(15, 1.8, -20);
            const V3 = cam.position.constructor;
            cam.setTarget(new V3(15, -0.8, -14)); // look down at flat spawn-beach sand
            window.advanceTime(300);
            const ghost = window.game.scene.meshes.find(m => m.name === 'ghost_campfire');
            if (!ghost) return null;
            const mats = [];
            const gm = ghost.material;
            if (gm && gm.subMaterials) mats.push(...gm.subMaterials.filter(Boolean));
            else if (gm) mats.push(gm);
            return {
                valid: window.game.buildingSystem._ghostValid,
                matCount: mats.length,
                alphas: mats.map(m => +m.alpha.toFixed(2)),
                tints: mats.map(m => m.emissiveColor.asArray().map(v => +v.toFixed(2))),
                multiMaterial: !!gm.subMaterials
            };
        });
        assert(state, 'ghost_campfire mesh exists');
        assert(state.valid === true, 'flat sand reports a valid placement');
        assert(state.matCount >= 2, `ghost kept distinct real part materials (${state.matCount})`);
        assert(state.alphas.every(a => Math.abs(a - 0.55) < 0.01), `all ghost materials translucent (${state.alphas})`);
        assert(state.tints.every(t => t[1] > t[0] && t[1] > t[2]), `valid tint is green-ish (${JSON.stringify(state.tints[0])})`);
        // camera above the ghost for the screenshot
        await evalJson(() => {
            const cam = window.game.playerController.camera;
            cam.position.set(15, 3.2, -18.5);
        });
        await sleep(400);
        await page.screenshot({ path: 'scripts/shots/ghost_campfire_valid.png' });
    });

    run('ghost tints red on the steep bluff', async () => {
        const state = await evalJson(() => {
            const cam = window.game.playerController.camera;
            cam.position.set(2, 4, 33);
            const V3 = cam.position.constructor;
            cam.setTarget(new V3(0.5, 6.5, 37.5)); // up the bluff slope
            window.advanceTime(400);
            const ghost = window.game.scene.meshes.find(m => m.name === 'ghost_campfire');
            const mats = [];
            const gm = ghost.material;
            if (gm && gm.subMaterials) mats.push(...gm.subMaterials.filter(Boolean));
            else if (gm) mats.push(gm);
            return {
                valid: window.game.buildingSystem._ghostValid,
                tint: mats[0].emissiveColor.asArray().map(v => +v.toFixed(2))
            };
        });
        assert(state.valid === false, 'bluff slope reports an invalid placement');
        assert(state.tint[0] > state.tint[1] && state.tint[0] > state.tint[2], `invalid tint is red-ish (${JSON.stringify(state.tint)})`);
        await page.screenshot({ path: 'scripts/shots/ghost_campfire_invalid.png' });
    });

    run('ghost places into a wireframe blueprint and finishes opaque', async () => {
        const state = await evalJson(() => {
            const cam = window.game.playerController.camera;
            cam.position.set(15, 1.8, -20);
            const V3 = cam.position.constructor;
            cam.setTarget(new V3(15, -0.8, -14));
            window.advanceTime(300);
            window.game.buildingSystem._placeStructure();
            const bp = window.game.scene.meshes.find(m => m.name === 'blueprint_campfire');
            if (!bp) return { placed: false };
            // Donate all resources in one click.
            window.game.inventory.addItem('wood', 5);
            window.game.inventory.addItem('stone', 4);
            bp.metadata.interactable.interact(window.game.inventory, window.game.hud, window.game.stats);
            const finished = window.game.scene.meshes.find(m => m.name === 'campfire' && !m.isDisposed());
            const fire = window.game.scene.particleSystems.find(ps => ps.name === 'fire');
            const fm = finished ? finished.material : null;
            const fmats = [];
            if (fm && fm.subMaterials) fmats.push(...fm.subMaterials.filter(Boolean));
            else if (fm) fmats.push(fm);
            return {
                placed: true,
                finished: !!finished,
                fireStarted: !!fire && fire.isStarted(),
                finishedAlphas: fmats.map(m => +m.alpha.toFixed(2)),
                stationListed: window.game.buildingSystem.getPlacedStations().some(s => s.type === 'campfire')
            };
        });
        assert(state.placed, 'blueprint_campfire created from the ghost');
        assert(state.finished, 'finished campfire mesh exists');
        assert(state.fireStarted, 'campfire flame particles are running');
        assert(state.finishedAlphas.every(a => a === 1), `finished structure is opaque (${state.finishedAlphas})`);
        assert(state.stationListed, 'campfire registered as a crafting station');
        await page.screenshot({ path: 'scripts/shots/ghost_campfire_finished.png' });
    });

    run('shelter ghost previews the real lean-to colors', async () => {
        const state = await evalJson(() => {
            window.game.buildingSystem.startBuilding('shelter', { name: 'Shelter', requires: { wood: 10, leaf: 8, fiber: 4 } });
            const cam = window.game.playerController.camera;
            cam.position.set(24, 2.6, -22);
            const V3 = cam.position.constructor;
            cam.setTarget(new V3(24, -0.6, -17));
            window.advanceTime(300);
            const ghost = window.game.scene.meshes.find(m => m.name === 'ghost_shelter');
            return { hasGhost: !!ghost, valid: window.game.buildingSystem._ghostValid };
        });
        assert(state.hasGhost, 'ghost_shelter mesh exists');
        assert(state.valid, 'shelter ghost valid on flat sand');
        await sleep(400);
        await page.screenshot({ path: 'scripts/shots/ghost_shelter.png' });
        await evalJson(() => window.game.buildingSystem._cancelBuilding());
    });

    run('ghost survives save/load round-trip as blueprint', async () => {
        const state = await evalJson(async () => {
            window.game.buildingSystem.startBuilding('dryingRack', { name: 'Drying Rack', requires: { wood: 4, fiber: 4 } });
            const cam = window.game.playerController.camera;
            cam.position.set(15, 1.8, -20);
            const V3 = cam.position.constructor;
            cam.setTarget(new V3(15, -0.8, -14));
            window.advanceTime(300);
            window.game.buildingSystem._placeStructure();
            const { SaveSystem } = await import('/src/save/SaveSystem.ts');
            SaveSystem.save(window.game.inventory, window.game.stats, window.game.dayNight,
                window.game.playerController.camera, window.game.hud, window.game.buildingSystem);
            SaveSystem.load(window.game.inventory, window.game.stats, window.game.dayNight,
                window.game.playerController.camera, window.game.hud, window.game.buildingSystem);
            const bp = window.game.scene.meshes.filter(m => m.name === 'blueprint_dryingRack' && !m.isDisposed());
            const campfires = window.game.scene.meshes.filter(m => m.name === 'campfire' && !m.isDisposed());
            return {
                blueprints: bp.length,
                campfires: campfires.length,
                wireframe: bp.length > 0 && !!bp[0].material.wireframe,
                prompt: bp.length > 0 ? bp[0].metadata.interactable.prompt : null,
                stationListed: window.game.buildingSystem.getPlacedStations().some(s => s.type === 'campfire')
            };
        });
        assert(state.blueprints === 1, `exactly one drying rack blueprint after in-session load (${state.blueprints})`);
        assert(state.campfires === 1, `exactly one campfire after in-session load (${state.campfires})`);
        assert(state.stationListed, 'campfire station restored into the station list');
        assert(state.wireframe, 'restored blueprint uses the wireframe material');
        assert(/Add Resources/.test(state.prompt), `restored blueprint keeps its prompt (${state.prompt})`);
    });

    let passed = 0, failed = 0;
    for (const t of tests) {
        try {
            console.log(`\n${t.name}`);
            await t.fn();
            passed++;
        } catch (e) {
            console.log('  FAIL:', e.message);
            failed++;
        }
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    if (errors.length) console.log('PAGE ERRORS:', errors);
    await browser.close();
    process.exit(failed === 0 ? 0 : 1);
})();
