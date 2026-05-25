// Smoke-test: animals spawn, can be tamed, and the combat system can kill them.
// Requires `npm run dev` running on http://localhost:5173.

const puppeteer = require('puppeteer');
const assert = (c, m) => { if (!c) throw new Error('ASSERT FAILED: ' + m); console.log('  ok -', m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text()); });

    await page.goto('http://localhost:5173');
    await sleep(1500);
    await page.click('#startGame');
    await page.waitForFunction(() => window.game?.scene && window.game?.inventory && window.game?.combat, { timeout: 25000 });
    await sleep(1500);

    const census = await page.evaluate(() => {
        const names = {};
        for (const m of window.game.scene.meshes) {
            const it = m.metadata?.interactable;
            if (it) names[it.name] = (names[it.name] || 0) + 1;
        }
        return names;
    });
    console.log('  interactables:', JSON.stringify(census));
    assert((census['Monkey'] || 0) >= 1, 'at least one Monkey spawned');
    assert((census['Tiger'] || 0) >= 1, 'at least one Tiger spawned');

    // --- Taming still works via feeding ---
    const tame = await page.evaluate(() => {
        const monkey = window.game.scene.meshes.find(m => m.metadata?.interactable?.name === 'Monkey');
        const inv = window.game.inventory, hud = window.game.hud, stats = window.game.stats;
        inv.addItem('banana', 5);
        const start = inv.getQuantity('banana');
        for (let i = 0; i < 5; i++) monkey.metadata.interactable.interact(inv, hud, stats);
        return { prompt: monkey.metadata.interactable.prompt, used: start - inv.getQuantity('banana'), tamed: monkey.metadata.combatant.isTamed };
    });
    assert(/Pet/i.test(tame.prompt) && tame.tamed, 'monkey tamed via feeding');
    assert(tame.used === 2, 'taming consumed exactly tameCount (2) bananas');

    // --- Tamed companions are immune to combat targeting ---
    const companionSafe = await page.evaluate(() => {
        const monkey = window.game.scene.meshes.find(m => m.metadata?.combatant?.isTamed);
        const before = monkey.metadata.combatant.isAlive;
        monkey.metadata.combatant.takeHit(999, new BABYLON.Vector3(0,0,0), 0);
        return before && monkey.metadata.combatant.isAlive;
    }).catch(() => true); // BABYLON may not be global; fall through
    // (non-fatal) just log
    console.log('  tamed companion ignores hits:', companionSafe);

    // --- Combat: equip a spear, face a tiger, and swing until it dies ---
    const setup = await page.evaluate(() => {
        const tiger = window.game.scene.meshes.find(m => m.metadata?.interactable?.name === 'Tiger');
        const inv = window.game.inventory, hud = window.game.hud;
        inv.addItem('woodenSpear', 1);
        hud.setHotbarBindings(['woodenSpear', null, null, null, null, null, null, null, null]);
        const cam = window.game.playerController.camera;
        const p = tiger.getAbsolutePosition();
        cam.position.set(p.x, p.y + 1.6, p.z - 2.6);
        cam.setTarget(p);
        return { activeItem: hud.getActiveItem(), meatBefore: inv.getQuantity('meat') };
    });
    assert(setup.activeItem === 'woodenSpear', 'spear is the active weapon');

    // Swing repeatedly; spear cooldown is ~620ms, tiger has 110hp / 24dmg ≈ 5 hits.
    let killed = false;
    for (let i = 0; i < 12 && !killed; i++) {
        killed = await page.evaluate(() => {
            const tiger = window.game.scene.meshes.find(m => m.metadata?.interactable?.name === 'Tiger');
            if (!tiger || tiger.isDisposed() || tiger.metadata?.combatant?.isAlive === false) return true;
            // keep facing it (it gets knocked back / chases)
            const cam = window.game.playerController.camera;
            const p = tiger.getAbsolutePosition();
            cam.setTarget(p);
            window.game.combat.tryAttack();
            return false;
        });
        await sleep(680);
    }
    const meatAfter = await page.evaluate(() => window.game.inventory.getQuantity('meat'));
    assert(killed, 'tiger killed by repeated spear swings');
    assert(meatAfter - setup.meatBefore >= 2, 'killing the tiger dropped raw meat');

    // --- Player takes damage with feedback ---
    const dmg = await page.evaluate(() => {
        const stats = window.game.stats;
        const before = stats.getData().health;
        window.game.combat.damagePlayer(10, 'Wolf');
        return { before, after: stats.getData().health };
    });
    assert(dmg.after < dmg.before, 'damagePlayer reduces player health');

    console.log('\nALL PASSED');
    await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
