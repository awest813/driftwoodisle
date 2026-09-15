// Smoke test for the texture pass.
// - Ocean has the water texture, tiled and drifting.
// - Sky dome tint follows the sun: bright at noon, navy at midnight, grey in rain.
// - Terrain textures exist and the pond water clone is the new tile-safe art
//   (flat base, animated offsets).
// - LOCAL_TEXTURES 404s are silent (no page errors, procedural stays).
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
    await page.waitForFunction(() => window.game?.hud && window.game?.playerController && window.game?.island, { timeout: 60000 });
    await sleep(4000);

    const tests = [];
    const run = (name, fn) => tests.push({ name, fn });
    const evalJson = async (fn, ...args) => page.evaluate(fn, ...args);

    run('game reaches playable state with no page errors', async () => {
        assert(errors.length === 0, `no page errors (got ${errors.length}): ${errors.join(' | ')}`);
    });

    run('ocean uses the tiled water texture and it drifts', async () => {
        const state = await evalJson(async () => {
            const ocean = window.game.scene.meshes.find(m => m.name === 'ocean');
            const tex = ocean?.material?.diffuseTexture;
            if (!tex) return null;
            const u0 = tex.uOffset, v0 = tex.vOffset;
            await new Promise(r => setTimeout(r, 1200));
            return {
                uScale: tex.uScale,
                alpha: +ocean.material.alpha.toFixed(2),
                drifted: Math.abs(tex.uOffset - u0) > 0.0001 || Math.abs(tex.vOffset - v0) > 0.00001
            };
        });
        assert(state, 'ocean material has a diffuse texture');
        assert(state.uScale >= 80, `ocean texture is heavily tiled (${state.uScale})`);
        assert(state.alpha > 0.7, `ocean is mostly opaque (${state.alpha})`);
        assert(state.drifted, 'ocean texture offsets animate over time');
    });

    run('sky dome tint is bright at noon', async () => {
        const tint = await evalJson(() => {
            window.game.dayNight.setTime(0.25);
            window.advanceTime(400);
            const dome = window.game.scene.getMeshByName('skyDome');
            return dome.material.emissiveColor.asArray().map(v => +v.toFixed(2));
        });
        assert(tint.every(v => v >= 0.9), `noon sky tint near-white (${tint})`);
    });

    run('sky dome tint is navy at midnight', async () => {
        const tint = await evalJson(() => {
            window.game.dayNight.setTime(0.75);
            window.advanceTime(400);
            const dome = window.game.scene.getMeshByName('skyDome');
            return dome.material.emissiveColor.asArray().map(v => +v.toFixed(2));
        });
        assert(tint[0] < 0.25 && tint[2] > tint[0], `midnight sky tint is dark navy (${tint})`);
        await evalJson(() => {
            const cam = window.game.playerController.camera;
            cam.position.set(15, 1.8, -22);
        });
        await sleep(600);
        await page.screenshot({ path: 'scripts/shots/texture_night_sky.png' });
    });

    run('sky dome tint warms at sunset', async () => {
        const tint = await evalJson(() => {
            window.game.dayNight.setTime(0.48); // just before sunset
            window.game.weather.toggleRain(false);
            window.advanceTime(400);
            const dome = window.game.scene.getMeshByName('skyDome');
            return dome.material.emissiveColor.asArray().map(v => +v.toFixed(2));
        });
        assert(tint[0] > tint[2] + 0.05, `sunset tint is warm (r ${tint[0]} > b ${tint[2]})`);
        await evalJson(() => {
            const cam = window.game.playerController.camera;
            cam.position.set(15, 1.8, -30);
            const V3 = cam.position.constructor;
            cam.setTarget(new V3(-10, 0.15, 30)); // face the sun's western arc
        });
        await sleep(600);
        await page.screenshot({ path: 'scripts/shots/texture_sunset.png' });
    });

    run('sky dome tint greys out in rain', async () => {
        await evalJson(() => { window.game.weather.toggleRain(true); });
        await sleep(5500); // cloud cover eases in over ~4s
        const tint = await evalJson(() => {
            window.advanceTime(200);
            const dome = window.game.scene.getMeshByName('skyDome');
            return {
                tint: dome.material.emissiveColor.asArray().map(v => +v.toFixed(2)),
                cover: +window.game.dayNight.cloudCover.toFixed(2)
            };
        });
        const [r, g, b] = tint.tint;
        assert(tint.cover > 0.5, `cloud cover eased in (${tint.cover})`);
        assert(r < 0.8 && Math.abs(r - g) < 0.15 && Math.abs(g - b) < 0.2, `storm tint is muted grey (${tint.tint})`);
        await sleep(400);
        await page.screenshot({ path: 'scripts/shots/texture_rain_sky.png' });
        await evalJson(() => { window.game.weather.toggleRain(false); });
    });

    run('terrain and pond textures present; pond clone animates', async () => {
        const state = await evalJson(async () => {
            const base1 = window.game.scene.meshes.find(m => m.name === 'base1');
            const pond = window.game.scene.meshes.find(m => m.name === 'pond');
            const sandTex = base1?.material?.diffuseTexture;
            const pondTex = pond?.material?.diffuseTexture;
            const u0 = pondTex.uOffset;
            await new Promise(r => setTimeout(r, 1200));
            return {
                sandTiled: sandTex && sandTex.uScale === 20,
                pondTiled: pondTex && pondTex.uScale === 5,
                pondDrifts: Math.abs(pondTex.uOffset - u0) > 0.0001
            };
        });
        assert(state.sandTiled, 'beach sand texture tiled 20x');
        assert(state.pondTiled, 'pond water texture tiled 5x');
        assert(state.pondDrifts, 'pond texture offsets animate');
    });

    run('daylight beach screenshot for visual inspection', async () => {
        await evalJson(() => {
            window.game.dayNight.setTime(0.25);
            window.game.weather.toggleRain(false);
            const cam = window.game.playerController.camera;
            cam.position.set(15, 1.8, -22);
            const V3 = cam.position.constructor;
            cam.setTarget(new V3(30, -0.2, -10));
        });
        await sleep(800);
        await page.screenshot({ path: 'scripts/shots/texture_day_beach.png' });
        assert(true, 'day beach screenshot captured');
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
