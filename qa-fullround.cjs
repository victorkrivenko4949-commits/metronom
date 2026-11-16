const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.click('#tabTraining');
  await page.click('#trCardList .card >> nth=0');
  await page.locator('.tr-levels .primary >> nth=0').click();
  await page.waitForTimeout(300);
  let attempts = 0;
  while (attempts < 40) {
    // Enable names via checkbox to parse answers
    const nm = await page.evaluate(() => {
      const el = document.querySelector('[data-role="core"] .tr-note-name');
      return el ? el.textContent : null;
    });
    if (!nm) { console.log('no note name at attempt', attempts); break; }
    let target = nm;
    if (target === 'Какая это нота?') {
      // toggle reveal via wrong answer once
      await page.click('.piano .pkey[data-midi="60"]');
      await page.waitForTimeout(150);
      target = await page.evaluate(() => document.querySelector('[data-role="core"] .tr-note-name').textContent);
    }
    const midi = await page.evaluate((n) => 60 + ["До","До♯","Ре","Ре♯","Ми","Фа","Фа♯","Соль","Соль♯","Ля","Ля♯","Си"].indexOf(n), target);
    if (midi < 60) { console.log('bad midi', target); break; }
    if (target !== nm) {
      // we already made a wrong attempt; press right key now
      await page.click(`.piano .pkey[data-midi="${midi}"]`);
      await page.waitForTimeout(120);
    }
    if (midi !== 60 || target === nm) {
      await page.click(`.piano .pkey[data-midi="${midi}"]`);
      await page.waitForTimeout(120);
    }
    attempts++;
    if (await page.locator('.tr-summary').count()) break;
  }
  console.log('ATTEMPTS', attempts);
  console.log('SUMMARY', (await page.locator('.tr-summary').innerText().catch(()=>'-')).replace(/\n/g,' | '));
  await page.screenshot({ path: '../qa-summary.png' });
  await page.click('#trBack');
  console.log('CARDS RECORDS', (await page.locator('#trCardList .card').first().innerText()).replace(/\n/g,' | '));
  console.log('ERRORS', JSON.stringify(errors));
  await context.close(); await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
