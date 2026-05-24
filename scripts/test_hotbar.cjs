// Runtime smoke-test for the hotbar/slotbar behavior.
// Requires `npm run dev` running on http://localhost:5173.

const puppeteer = require('puppeteer');

const assert = (cond, msg) => {
    if (!cond) throw new Error('ASSERT FAILED: ' + msg);
    console.log('  ok -', msg);
};

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('console', msg => {
        if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text());
    });

    await page.goto('http://localhost:5173');
    await new Promise(r => setTimeout(r, 1500));
    await page.click('#startGame');
    // Wait for the world to finish loading and HUD to wire up.
    await page.waitForFunction(() => window.game?.hud && window.game?.inventory && window.game?.playerController, { timeout: 25000 });
    await new Promise(r => setTimeout(r, 1000));

    const tests = [];
    const run = (name, fn) => tests.push({ name, fn });

    run('initial bindings are empty', async () => {
        const bindings = await page.evaluate(() => window.game.hud.getHotbarBindings());
        assert(bindings.length === 9, 'hotbar size is 9');
        assert(bindings.every(b => b === null), 'all slots start unbound');
    });

    run('first pickup binds to leftmost empty slot', async () => {
        await page.evaluate(() => {
            window.game.inventory.clear();
            window.game.hud.setHotbarBindings(new Array(9).fill(null));
            window.game.inventory.addItem('wood', 3);
        });
        const bindings = await page.evaluate(() => window.game.hud.getHotbarBindings());
        assert(bindings[0] === 'wood', `slot 0 = wood (got ${bindings[0]})`);
        assert(bindings.slice(1).every(b => b === null), 'rest empty');
    });

    run('second pickup goes to slot 1, follows HOTBAR_ORDER even if added later', async () => {
        await page.evaluate(() => window.game.inventory.addItem('stone', 2));
        const bindings = await page.evaluate(() => window.game.hud.getHotbarBindings());
        assert(bindings[0] === 'wood', 'wood stays in slot 0');
        assert(bindings[1] === 'stone', `slot 1 = stone (got ${bindings[1]})`);
    });

    run('removing all of an item clears its slot', async () => {
        await page.evaluate(() => {
            const q = window.game.inventory.getQuantity('wood');
            window.game.inventory.removeItem('wood', q);
        });
        const bindings = await page.evaluate(() => window.game.hud.getHotbarBindings());
        assert(bindings[0] === null, `slot 0 cleared (got ${bindings[0]})`);
        assert(bindings[1] === 'stone', 'stone stays in slot 1');
    });

    run('new pickup takes the leftmost empty slot, not the order index', async () => {
        await page.evaluate(() => window.game.inventory.addItem('fiber', 1));
        const bindings = await page.evaluate(() => window.game.hud.getHotbarBindings());
        assert(bindings[0] === 'fiber', `slot 0 reused for fiber (got ${bindings[0]})`);
        assert(bindings[1] === 'stone', 'stone untouched');
    });

    run('digit key sets active slot', async () => {
        // Make sure no menu intercepts
        await page.evaluate(() => {
            document.getElementById('craftingMenu')?.classList.remove('active');
            const esc = document.getElementById('escMenu'); if (esc) esc.style.display = 'none';
            const main = document.getElementById('mainMenu'); if (main) main.style.display = 'none';
        });
        await page.keyboard.press('3');
        const active = await page.evaluate(() => document.querySelectorAll('.hotbar-slot.active').length);
        const idx = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.hotbar-slot')).findIndex(s => s.classList.contains('active')));
        assert(active === 1, 'exactly one slot is active');
        assert(idx === 2, `slot 3 is active (index 2, got ${idx})`);
    });

    run('wheel after digit key advances from current slot (no desync)', async () => {
        await page.keyboard.press('5');
        await page.mouse.wheel({ deltaY: 100 });
        const idx = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.hotbar-slot')).findIndex(s => s.classList.contains('active')));
        assert(idx === 5, `after press 5 then scroll down, active is slot 6 (index 5, got ${idx})`);
    });

    run('wheel wraps around', async () => {
        await page.keyboard.press('1');
        await page.mouse.wheel({ deltaY: -100 });
        const idx = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.hotbar-slot')).findIndex(s => s.classList.contains('active')));
        assert(idx === 8, `scrolling up from slot 1 wraps to slot 9 (got ${idx})`);
    });

    run('wheel is ignored when crafting menu is open', async () => {
        await page.evaluate(() => document.getElementById('craftingMenu')?.classList.add('active'));
        await page.keyboard.press('4');  // also ignored
        await page.mouse.wheel({ deltaY: 100 });
        const idx = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.hotbar-slot')).findIndex(s => s.classList.contains('active')));
        assert(idx === 8, `active slot unchanged with menu open (got ${idx})`);
        await page.evaluate(() => document.getElementById('craftingMenu')?.classList.remove('active'));
    });

    run('F consumes the active slot item (food)', async () => {
        await page.evaluate(() => {
            window.game.inventory.clear();
            window.game.hud.setHotbarBindings(new Array(9).fill(null));
            window.game.stats._stats.hunger = 50;
            window.game.inventory.addItem('berry', 2);
        });
        // berry should bind to slot 0
        await page.keyboard.press('1');
        const before = await page.evaluate(() => ({
            qty: window.game.inventory.getQuantity('berry'),
            hunger: window.game.stats.getData().hunger,
        }));
        await page.keyboard.press('f');
        await new Promise(r => setTimeout(r, 50));
        const after = await page.evaluate(() => ({
            qty: window.game.inventory.getQuantity('berry'),
            hunger: window.game.stats.getData().hunger,
        }));
        assert(after.qty === before.qty - 1, `qty decreased by 1 (${before.qty} -> ${after.qty})`);
        assert(after.hunger > before.hunger, `hunger restored (${before.hunger} -> ${after.hunger})`);
    });

    run('F is ignored when crafting menu is open', async () => {
        await page.evaluate(() => document.getElementById('craftingMenu')?.classList.add('active'));
        const before = await page.evaluate(() => window.game.inventory.getQuantity('berry'));
        await page.keyboard.press('f');
        await new Promise(r => setTimeout(r, 50));
        const after = await page.evaluate(() => window.game.inventory.getQuantity('berry'));
        assert(before === after, `berry count unchanged with menu open (${before} == ${after})`);
        await page.evaluate(() => document.getElementById('craftingMenu')?.classList.remove('active'));
    });

    run('F does nothing on a non-food slot', async () => {
        await page.evaluate(() => {
            window.game.inventory.clear();
            window.game.hud.setHotbarBindings(new Array(9).fill(null));
            window.game.inventory.addItem('wood', 5);
        });
        await page.keyboard.press('1');
        const before = await page.evaluate(() => window.game.inventory.getQuantity('wood'));
        await page.keyboard.press('f');
        await new Promise(r => setTimeout(r, 50));
        const after = await page.evaluate(() => window.game.inventory.getQuantity('wood'));
        assert(before === after, 'wood is not consumed by F');
    });

    run('bindings survive a save/load round-trip', async () => {
        await page.evaluate(() => {
            window.game.inventory.clear();
            window.game.hud.setHotbarBindings(new Array(9).fill(null));
            window.game.inventory.addItem('wood', 1);
            window.game.inventory.addItem('stone', 1);
            window.game.inventory.addItem('fiber', 1);
        });
        // Force a specific layout: swap wood and fiber slots
        await page.evaluate(() => {
            const b = window.game.hud.getHotbarBindings();
            // expected so far: [wood, stone, fiber, ...]
            const swapped = [b[2], b[1], b[0], null, null, null, null, null, null];
            window.game.hud.setHotbarBindings(swapped);
        });
        const before = await page.evaluate(() => window.game.hud.getHotbarBindings());

        await page.evaluate(async () => {
            const m = await import('/src/save/SaveSystem.ts');
            m.SaveSystem.save(window.game.inventory, window.game.stats, window.game.dayNight, window.game.playerController.camera, window.game.hud);
            // Now wipe in-memory bindings, then reload.
            window.game.hud.setHotbarBindings(new Array(9).fill(null));
            m.SaveSystem.load(window.game.inventory, window.game.stats, window.game.dayNight, window.game.playerController.camera, window.game.hud);
        });
        const after = await page.evaluate(() => window.game.hud.getHotbarBindings());
        assert(JSON.stringify(after) === JSON.stringify(before),
            `bindings restored: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
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
