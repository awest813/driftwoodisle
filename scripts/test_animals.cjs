// Smoke-test: animals spawn and can be tamed / fought.
// Requires `npm run dev` running on http://localhost:5173.

const puppeteer = require('puppeteer');
const assert = (c, m) => { if (!c) throw new Error('ASSERT FAILED: ' + m); console.log('  ok -', m); };

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text()); });

    await page.goto('http://localhost:5173');
    await new Promise(r => setTimeout(r, 1500));
    await page.click('#startGame');
    await page.waitForFunction(() => window.game?.scene && window.game?.inventory, { timeout: 25000 });
    await new Promise(r => setTimeout(r, 1500));

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
    assert(((census['Wolf'] || 0) + (census['Boar'] || 0)) >= 1, 'at least one Wolf or Boar spawned');

    // Tame a monkey: give bananas and feed it until it becomes a companion.
    const tameResult = await page.evaluate(() => {
        const monkey = window.game.scene.meshes.find(m => m.metadata?.interactable?.name === 'Monkey');
        const inv = window.game.inventory, hud = window.game.hud, stats = window.game.stats;
        inv.addItem('banana', 5);
        const start = inv.getQuantity('banana');
        // feed up to 5 times; tameCount for monkey is 2
        for (let i = 0; i < 5; i++) monkey.metadata.interactable.interact(inv, hud, stats);
        return { promptAfter: monkey.metadata.interactable.prompt, bananasUsed: start - inv.getQuantity('banana') };
    });
    console.log('  monkey prompt after feeding:', tameResult.promptAfter, '| bananas used:', tameResult.bananasUsed);
    assert(/Pet/i.test(tameResult.promptAfter), 'monkey became tamed (prompt switches to Pet)');
    assert(tameResult.bananasUsed === 2, 'taming consumed exactly tameCount (2) bananas, not more');

    // Fight a tiger with a spear: enough hits should remove it and drop meat.
    const fightResult = await page.evaluate(() => {
        const tiger = window.game.scene.meshes.find(m => m.metadata?.interactable?.name === 'Tiger');
        const inv = window.game.inventory, hud = window.game.hud, stats = window.game.stats;
        inv.addItem('woodenSpear', 1);
        const meatBefore = inv.getQuantity('meat');
        for (let i = 0; i < 6 && !tiger.isDisposed(); i++) tiger.metadata.interactable.interact(inv, hud, stats);
        return { disposed: tiger.isDisposed(), meatGained: inv.getQuantity('meat') - meatBefore };
    });
    console.log('  tiger disposed:', fightResult.disposed, '| meat gained:', fightResult.meatGained);
    assert(fightResult.disposed, 'tiger removed after enough spear hits');
    assert(fightResult.meatGained >= 2, 'killing the tiger dropped raw meat');

    console.log('\nALL PASSED');
    await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
