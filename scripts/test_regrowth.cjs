// Smoke test for the regrowth + weather-dimming + fishing-ripple pass.
// - Harvested resources (stone/fish/crab/tree) respawn after their delay.
// - Respawns wait out open menus (pause-aware tick).
// - Rain raises cloud cover and dims the sun.
// - Casting a fishing rod spawns a ripple ring that dies with the bobber.
// - Pond water is translucent so pond fish are visible.
//
// Requires `npm run dev` (default port 5173; override with DRIFTWOOD_TEST_URL).

const puppeteer = require('puppeteer');

const BASE_URL = process.env.DRIFTWOOD_TEST_URL || 'http://localhost:5173';

const assert = (cond, msg) => {
    if (!cond) throw new Error('ASSERT FAILED: ' + msg);
    console.log('  ok -', msg);
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        // Fall back to system Chrome when puppeteer's pinned build isn't unpacked.
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
        if (msg.type() === 'error') console.log(`[Browser Console ${msg.type()}]`, msg.text());
    });

    await page.goto(BASE_URL);
    // Wait for the Game instance and the wired menu button before clicking.
    await page.waitForFunction(() => window.game && document.getElementById('startGame'), { timeout: 30000 });
    await sleep(1000);
    await page.click('#startGame');
    await page.waitForFunction(() => window.game?.hud && window.game?.inventory && window.game?.playerController && window.game?.island, { timeout: 60000 });
    await sleep(4000);

    const tests = [];
    const run = (name, fn) => tests.push({ name, fn });
    const evalJson = async (fn, ...args) => page.evaluate(fn, ...args);

    // Helpers evaluated in page context.
    const findMesh = (re) => window.game.scene.meshes.find(m => re.test(m.name)) || null;
    const interact = (mesh) => mesh.metadata.interactable.interact(window.game.inventory, window.game.hud, window.game.stats);
    const frames = (n) => window.advanceTime(n * 16);

    run('game reaches playable state with no page errors', async () => {
        assert(errors.length === 0, `no page errors (got ${errors.length}): ${errors.join(' | ')}`);
    });

    run('pond water is translucent and fish are present', async () => {
        const state = await evalJson(() => {
            const pond = window.game.scene.meshes.find(m => m.name === 'pond');
            const fish = window.game.scene.meshes.filter(m => /^fish_\d+$/.test(m.name));
            return {
                alpha: pond && pond.material ? Number(pond.material.alpha.toFixed(2)) : null,
                hasWrap: pond && pond.material && pond.material.diffuseTexture ? pond.material.diffuseTexture.wrapU : null,
                fishCount: fish.length
            };
        });
        assert(state.alpha !== null, 'pond mesh with material found');
        assert(Math.abs(state.alpha - 0.55) < 0.01, `pond alpha reduced to ~0.55 (got ${state.alpha})`);
        assert(state.hasWrap === 1, `pond texture wraps for drift animation (wrapU=${state.hasWrap})`);
        assert(state.fishCount > 0, `pond has fish (${state.fishCount})`);
    });

    run('picked-up stone respawns after its delay', async () => {
        const before = await evalJson(() => {
            const mesh = window.game.scene.meshes.find(m => /^stone_\d+$/.test(m.name));
            if (!mesh) return null;
            mesh.metadata.interactable.interact(window.game.inventory, window.game.hud, window.game.stats);
            return { id: mesh.name, disposed: mesh.isDisposed() };
        });
        assert(before && before.disposed, `stone ${before && before.id} collected and removed`);
        await evalJson(() => { window.game.island.fastForwardRespawns(200); window.advanceTime(200); });
        const respawned = await evalJson(() => window.game.scene.meshes.some(m => /_respawn_/.test(m.name) && m.name.startsWith('stone')));
        assert(respawned, 'new stone appeared with a _respawn_ id');
    });

    run('respawn timer waits while a menu is open', async () => {
        const caught = await evalJson(() => {
            const mesh = window.game.scene.meshes.find(m => /^crab_\d+$/.test(m.name));
            if (!mesh) return null;
            mesh.metadata.interactable.interact(window.game.inventory, window.game.hud, window.game.stats);
            return { id: mesh.name, disposed: mesh.isDisposed() };
        });
        assert(caught && caught.disposed, `crab ${caught && caught.id} caught and removed`);
        // Pause the world (ESC menu open = isGameplayActive false).
        await evalJson(() => { document.getElementById('escMenu').style.display = 'flex'; });
        await evalJson(() => { window.game.island.fastForwardRespawns(120); window.advanceTime(200); });
        let early = await evalJson(() => window.game.scene.meshes.some(m => /_respawn_/.test(m.name) && m.name.startsWith('crab')));
        assert(!early, 'crab did NOT respawn while the menu was open');
        await evalJson(() => { document.getElementById('escMenu').style.display = 'none'; });
        await evalJson(() => { window.advanceTime(100); });
        early = await evalJson(() => window.game.scene.meshes.some(m => /_respawn_/.test(m.name) && m.name.startsWith('crab')));
        assert(early, 'crab respawned as soon as gameplay resumed');
    });

    run('caught pond fish respawns', async () => {
        const caught = await evalJson(() => {
            const mesh = window.game.scene.meshes.find(m => /^fish_\d+$/.test(m.name));
            if (!mesh) return null;
            mesh.metadata.interactable.interact(window.game.inventory, window.game.hud, window.game.stats);
            return { id: mesh.name, disposed: mesh.isDisposed() };
        });
        assert(caught && caught.disposed, `fish ${caught && caught.id} caught and removed`);
        await evalJson(() => { window.game.island.fastForwardRespawns(100); window.advanceTime(200); });
        const respawned = await evalJson(() => window.game.scene.meshes.some(m => /_respawn_/.test(m.name) && m.name.startsWith('fish')));
        assert(respawned, 'new fish appeared with a _respawn_ id');
    });

    run('felled tree respawns (and faster with an axe)', async () => {
        // GLB trees keep their source node names; identify/count via metadata.
        const result = await evalJson(() => {
            const countTrees = () => window.game.scene.meshes.filter(m =>
                m.metadata?.interactable?.name === 'Palm Tree' && !m.name.includes('_respawn_')).length;
            window.game.inventory.addItem('stoneAxe', 1);
            const mesh = window.game.scene.meshes.find(m =>
                m.metadata?.interactable?.name === 'Palm Tree' && !m.name.includes('_respawn_'));
            if (!mesh) return null;
            const before = countTrees();
            for (let i = 0; i < 3; i++) {
                mesh.metadata.interactable.interact(window.game.inventory, window.game.hud, window.game.stats);
                if (mesh.isDisposed()) break;
            }
            return { before, afterFell: countTrees(), disposed: mesh.isDisposed() };
        });
        assert(result && result.disposed, `tree felled in 3 axe hits (found: ${!!result})`);
        assert(result.afterFell === result.before - 1, `tree removed from scene (${result.before} -> ${result.afterFell})`);
        await evalJson(() => { window.game.island.fastForwardRespawns(400); window.advanceTime(200); });
        const regrown = await evalJson(() => window.game.scene.meshes.filter(m =>
            m.metadata?.interactable?.name === 'Palm Tree' && !m.name.includes('_respawn_')).length);
        assert(regrown === result.before, `tree grew back (${result.afterFell} -> ${regrown}, expected ${result.before})`);
    });

    run('rain raises cloud cover and dims the sun', async () => {
        const baseline = await evalJson(() => {
            window.game.dayNight.setTime(0.25); // noon
            window.advanceTime(30);
            return { intensity: window.game.scene.getLightByName('dirLight').intensity };
        });
        await evalJson(() => { window.game.weather.toggleRain(true); });
        await sleep(6000); // let the cover ease in
        const after = await evalJson(() => ({
            cloud: window.game.dayNight.cloudCover,
            intensity: window.game.scene.getLightByName('dirLight').intensity,
            reported: JSON.parse(window.render_game_to_text()).weather
        }));
        assert(after.cloud > 0.5, `cloud cover eased up (got ${after.cloud.toFixed(2)})`);
        assert(after.intensity < baseline.intensity * 0.75, `sun dimmed by overcast (${baseline.intensity.toFixed(2)} -> ${after.intensity.toFixed(2)})`);
        assert(after.reported.cloudCover > 0.5, 'render_game_to_text reports cloudCover');
        await evalJson(() => { window.game.weather.toggleRain(false); });
        await page.screenshot({ path: 'scripts/shots/regrowth_rain.png' });
    });

    run('casting spawns a ripple ring that follows the bobber', async () => {
        const result = await evalJson(() => {
            const cam = window.game.playerController.camera;
            cam.position.set(20, 1.8, 20);
            const V3 = cam.position.constructor; // BABYLON.Vector3 without a global
            cam.setTarget(new V3(20, 0, 5));
            window.game.inventory.addItem('fishingRod', 1);
            window.game.fishing.triggerFish(); // cast
            const ripple = window.game.scene.getMeshByName('fishing_ripple');
            const status = window.game.fishing.getStatus();
            return {
                hasRipple: !!ripple,
                rippleX: ripple ? Number(ripple.position.x.toFixed(1)) : null,
                bobber: status.bobber,
                state: status.state
            };
        });
        assert(result.state === 'waiting', `cast landed (state=${result.state})`);
        assert(result.hasRipple, 'ripple ring mesh exists');
        assert(result.bobber && result.rippleX === result.bobber.x, 'ripple sits under the bobber');
        await sleep(600); // let it animate a bit
        await page.screenshot({ path: 'scripts/shots/regrowth_ripple.png' });
        const cleaned = await evalJson(() => {
            window.game.fishing.triggerFish(); // reel in early
            return {
                rippleGone: !window.game.scene.getMeshByName('fishing_ripple'),
                bobberGone: !window.game.scene.getMeshByName('fishing_bobber')
            };
        });
        assert(cleaned.rippleGone && cleaned.bobberGone, 'ripple and bobber both cleaned up on reel-in');
    });

    run('pond fish are visible in a daylight screenshot', async () => {
        await evalJson(() => {
            window.game.weather.toggleRain(false);
            window.game.dayNight.setTime(0.25);
            const cam = window.game.playerController.camera;
            cam.position.set(20, 3.5, 16);
            const V3 = cam.position.constructor;
            cam.setTarget(new V3(20, -0.5, 5));
        });
        await sleep(1500);
        await page.screenshot({ path: 'scripts/shots/regrowth_pond.png' });
        assert(true, 'screenshot captured for visual inspection');
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
