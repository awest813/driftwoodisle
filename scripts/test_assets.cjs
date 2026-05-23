// Smoke test for the external-asset pipeline.
// - Verifies the game still reaches playable state when remote assets fail (procedural fallback).
// - When remote assets DO load (real browser, real network), verifies the glTF meshes appear.
//
// Requires `npm run dev` on http://localhost:5173.

const puppeteer = require('puppeteer');

const assert = (cond, msg) => {
    if (!cond) throw new Error('ASSERT FAILED: ' + msg);
    console.log('  ok -', msg);
};

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('http://localhost:5173');
    await new Promise(r => setTimeout(r, 1500));
    await page.click('#startGame');
    await page.waitForFunction(() => window.game?.hud && window.game?.inventory, { timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const state = await page.evaluate(() => {
        const meshes = window.game.scene.meshes;
        const hasName = (substr) => meshes.some(m => m.name && m.name.toLowerCase().includes(substr));
        return {
            meshCount: meshes.length,
            treeGLBLoaded: hasName('tree1'),
            bushGLBLoaded: hasName('bush1'),
            rockGLBLoaded: hasName('rocks1'),
            fishGLBLoaded: hasName('fish.glb') || meshes.filter(m => m.name && m.name.toLowerCase().includes('fish') && m.name !== 'baseFish').length > 0,
            // Procedural fallback indicators (instanced from base meshes)
            hasBaseTree: hasName('basetree'),
            hasBaseBush: hasName('basebush'),
            hasBaseRock: hasName('baserock'),
            hasBaseCrab: hasName('basecrab'),
            // Any tree-shaped entity at all
            anyTreeId: meshes.some(m => m.name && m.name.startsWith('tree_')),
            anyBushId: meshes.some(m => m.name && m.name.startsWith('bush_')),
            anyRockId: meshes.some(m => m.name && m.name.startsWith('rock_')),
            anyCrabId: meshes.some(m => m.name && m.name.startsWith('crab_')),
            anyFishId: meshes.some(m => m.name && m.name.startsWith('fish_')),
        };
    });

    const remoteOk = state.treeGLBLoaded;
    console.log(`\nEnvironment: remote glTF ${remoteOk ? 'REACHABLE' : 'UNREACHABLE — exercising fallback path'}`);
    console.log(`Mesh count: ${state.meshCount}`);

    const tests = [];
    const run = (name, fn) => tests.push({ name, fn });

    run('game reaches playable state', async () => {
        assert(state.meshCount > 50, `scene has many meshes (${state.meshCount})`);
        assert(errors.length === 0, `no page errors (got ${errors.length}): ${errors.join(' | ')}`);
    });

    run('trees spawn (glTF or procedural fallback)', async () => {
        assert(state.anyTreeId, 'at least one tree_* mesh exists');
        if (remoteOk) {
            assert(state.treeGLBLoaded, 'Village Pack tree1 GLB instance is in the scene');
        } else {
            assert(state.hasBaseTree, 'procedural baseTree exists as template');
        }
    });

    run('bushes spawn (glTF or procedural fallback)', async () => {
        assert(state.anyBushId, 'at least one bush_* mesh exists');
        if (remoteOk) assert(state.bushGLBLoaded, 'Village Pack bush1 GLB instance present');
        else assert(state.hasBaseBush, 'procedural baseBush template exists');
    });

    run('rocks spawn (glTF or procedural fallback)', async () => {
        assert(state.anyRockId, 'at least one rock_* mesh exists');
        if (remoteOk) assert(state.rockGLBLoaded, 'Village Pack rocks1 GLB instance present');
        else assert(state.hasBaseRock, 'procedural baseRock template exists');
    });

    run('fish spawn (glTF or procedural fallback)', async () => {
        assert(state.anyFishId, 'at least one fish_* mesh exists');
    });

    run('crab falls back to procedural (Kenney crab.glb not bundled in sandbox)', async () => {
        assert(state.anyCrabId, 'at least one crab_* mesh exists');
        assert(state.hasBaseCrab, 'procedural baseCrab template exists');
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
    await browser.close();
    process.exit(failed === 0 ? 0 : 1);
})();
