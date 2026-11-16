const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.click('#tabTraining');
  await page.click('#trCardList .card >> nth=0');
  await page.locator('.tr-intro [data-start], .tr-intro button >> nth=0').first().click();
  await page.waitForTimeout(200);
  const ans = await page.evaluate(() => {
    const el = document.querySelector('[data-role="core"] svg ellipse');
    return el ? {cy: Number(el.getAttribute('cy')), count: document.querySelectorAll('.piano .pkey').length} : null;
  });
  console.log('FIRST', JSON.stringify(ans));
  // Try pressing several known answers
  for (const midi of [60, 62, 64, 65, 67, 69, 71, 61, 63, 66, 68, 70]) {
    await page.click(`.piano .pkey[data-midi="${midi}"]`);
    await page.waitForTimeout(100);
    const fb = await page.textContent('[data-role="feedback"]').catch(()=>null);
    const prog = await page.textContent('[data-role="progress"]').catch(()=>null);
    console.log(midi, '->', prog, '|', fb && fb.slice(0, 30));
  }
  await context.close(); await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
