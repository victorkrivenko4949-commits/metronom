const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  async function readAnswer(page) {
    return page.evaluate(() => {
      const el = document.querySelector('[data-role="core"] svg ellipse');
      if (!el) return null;
      const y = Number(el.getAttribute('cy'));
      // Inverse of staffY: dia = (100 - y)/7 + 30 ... use table
      const TABLE = {100:60,93:61,86:62,79:63,72:64,65:65,58:66,51:67,44:68};
      return TABLE[y] !== undefined ? TABLE[y] : null;
    });
  }

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.click('#tabTraining');
  await page.click('#trCardList .card >> nth=0');
  await page.locator('.tr-intro [data-start], .tr-intro button >> nth=0').first().click();
  await page.waitForTimeout(200);
  console.log('KEYS', (await page.$$eval('.piano .pkey', e => e.length)));

  // swipe right: progress must advance
  const core = await page.$('[data-role="core"]');
  const box = await core.boundingBox();
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width/2 + 100, box.y + box.height/2, {steps: 12});
  await page.mouse.up();
  console.log('PROGRESS after swipe', await page.textContent('[data-role="progress"]'));

  // swipe left back
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width/2 - 100, box.y + box.height/2, {steps: 12});
  await page.mouse.up();
  console.log('PROGRESS back', await page.textContent('[data-role="progress"]'));

  // full correct round
  let attempts = 0;
  while (true) {
    const ans = await readAnswer(page);
    if (ans === null) break;
    await page.click(`.piano .pkey[data-midi="${ans}"]`);
    await page.waitForTimeout(120);
    attempts++;
    if (await page.locator('.tr-summary').count()) break;
    if (attempts > 30) break;
  }
  console.log('ATTEMPTS', attempts, 'SUMMARY', await page.locator('.tr-summary').count());
  console.log('SUMMARY TEXT', (await page.locator('.tr-summary').innerText().catch(()=>'-')).replace(/\n/g,' | '));
  await page.screenshot({ path: '../qa-summary.png' });
  console.log('ERRORS', JSON.stringify(errors));
  await context.close(); await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
