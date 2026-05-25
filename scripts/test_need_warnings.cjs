// Smoke-test: low/depleted survival-need warnings surface to the player.
// Requires `npm run dev` running on http://localhost:5173.

const puppeteer = require('puppeteer');

const assert = (cond, msg) => {
    if (!cond) throw new Error('ASSERT FAILED: ' + msg);
    console.log('  ok -', msg);
};

const notifTexts = (page) => page.evaluate(() =>
    Array.from(document.querySelectorAll('#notifications .notif-text')).map(n => n.textContent)
);

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text()); });

    await page.goto('http://localhost:5173');
    await new Promise(r => setTimeout(r, 1500));
    await page.click('#startGame');
    await page.waitForFunction(() => window.game?.stats, { timeout: 25000 });
    await new Promise(r => setTimeout(r, 800));

    // Drive thirst into the "low" band (<=25, >0).
    await page.evaluate(() => {
        const s = window.game.stats;
        s.restoreThirst(100); // reset to known full
        s.decreaseThirst(80); // -> 20
    });
    await new Promise(r => setTimeout(r, 300));
    let texts = await notifTexts(page);
    assert(texts.some(t => /thirsty/i.test(t)), 'low-thirst warning shown');

    // Drive thirst to zero -> depleted danger warning.
    await page.evaluate(() => window.game.stats.decreaseThirst(100));
    await new Promise(r => setTimeout(r, 300));
    texts = await notifTexts(page);
    assert(texts.some(t => /parched/i.test(t)), 'depleted-thirst danger warning shown');

    // Recover above 40 then deplete again -> warning should re-arm and re-fire.
    await page.evaluate(() => window.game.stats.restoreThirst(100));
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => window.game.stats.decreaseThirst(100));
    await new Promise(r => setTimeout(r, 300));
    texts = await notifTexts(page);
    const parchedCount = texts.filter(t => /parched/i.test(t)).length;
    assert(parchedCount >= 1, 'warning re-arms after recovery');

    console.log('\nALL PASSED');
    await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
