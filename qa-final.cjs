const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const mobile = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await mobile.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // metronome playing then switch tab: must stop
  await page.click('#playBtn');
  await page.click('#tabTraining');
  const playingAfterSwitch = await page.evaluate(() => document.querySelector('#playBtn').textContent);
  console.log('METRONOME after tab switch:', playingAfterSwitch);
  await page.click('#tabMetronome');
  await page.click('#playBtn'); // ensure stopped

  await page.click('#tabTraining');
  await page.click('#trCardList .card >> nth=0');
  const intro = await page.locator('.tr-intro').innerText();
  console.log('INTRO has arrows text:', /свайпом/.test(intro), '| keyboard text:', /A.*W.*S/.test(intro.replace(/\n/g,' ')));
  // melody picker
  await page.locator('.tr-levels button >> nth=1').click();
  await page.waitForTimeout(700);
  const melodies = await page.$$eval('[data-role="melody-list"] button, .tr-melodies button', els => els.map(e => e.textContent.trim().replace(/\s+/g,' '))).catch(()=>null);
  console.log('MELODY PICKER', melodies ? melodies.slice(0, 5) : 'NOT FOUND');
  // play happy birthday
  const happy = await page.locator('button:has-text("С днём рождения")').first();
  await happy.click();
  await page.waitForTimeout(300);
  console.log('MELODY ROUND PROGRESS', await page.textContent('[data-role="progress"]').catch(()=> '-'));
  await page.screenshot({ path: '../qa-melody-round.png' });
  // random notes full round with skip/replay semantics
  await page.click('#trBack');
  await page.locator('.tr-levels button >> nth=0').click();
  await page.waitForTimeout(300);
  // answer prompts by reading aria-label of prompt core
  let answered = 0;
  for (let i = 0; i < 30; i++) {
    const label = await page.getAttribute('[data-role="core"]', 'aria-label').catch(()=>null);
    if (!label) break;
    const m = label.match(/Нота ([А-Яа-я]+♯?)/);
    if (!m) break;
    const midi = await page.evaluate((n) => 60 + ["До","До♯","Ре","Ре♯","Ми","Фа","Фа♯","Соль","Соль♯","Ля","Ля♯","Си"].indexOf(n), m[1]);
    if (midi < 60) break;
    await page.click(`.piano .pkey[data-midi="${midi}"]`);
    await page.waitForTimeout(90);
    answered++;
    if (await page.locator('.tr-summary').count()) break;
  }
  console.log('ANSWERED', answered);
  console.log('SUMMARY', (await page.locator('.tr-summary').innerText().catch(()=>'-')).replace(/\n/g,' | '));
  // skip semantics: restart round, swipe forward 3, check progress and acc denominator
  await page.click('.tr-summary [data-again], .tr-summary button >> nth=0').catch(()=>{});
  const core = await page.$('[data-role="core"]');
  const box = await core.boundingBox();
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width/2 + 90, box.y + box.height/2, {steps: 10});
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  console.log('AFTER 3 SWIPES', await page.textContent('[data-role="progress"]'));
  await page.click('#trBack');
  console.log('CARD RECORDS', (await page.locator('#trCardList .card').first().innerText()).replace(/\n/g,' | '));
  await page.screenshot({ path: '../qa-mobile-final.png' });

  // desktop
  const desktop = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const dp = await desktop.newPage();
  await dp.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await dp.click('#tabTraining');
  await dp.click('#trCardList .card >> nth=0');
  await dp.locator('.tr-levels button >> nth=0').click();
  await dp.waitForTimeout(300);
  // arrow keys navigate
  await dp.keyboard.press('ArrowRight');
  await dp.keyboard.press('ArrowRight');
  console.log('DESKTOP arrows', await dp.textContent('[data-role="progress"]'));
  await dp.screenshot({ path: '../qa-desktop-final.png' });
  console.log('ERRORS', JSON.stringify(errors));
  await mobile.close(); await desktop.close(); await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
