const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  page.on('requestfailed', req => console.log('FAILED:', req.url()));

  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    await page.click('#startGame');
  } catch (e) {
    console.log("Could not click start game:", e.message);
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Also dump Babylon scene info
  const sceneInfo = await page.evaluate(() => {
     if (window.game && window.game.scene) {
         const s = window.game.scene;
         return `Meshes: ${s.meshes.length}, Camera Y: ${s.activeCamera ? s.activeCamera.position.y : 'none'}`;
     }
     return "No window.game";
  });
  console.log("Scene Info:", sceneInfo);
  
  await browser.close();
})();
