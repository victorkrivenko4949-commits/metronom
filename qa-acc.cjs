const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage();
  await page.goto('http://localhost:3000');
  await page.click('#tabTraining');
  await page.click('#trCardList .card >> nth=0');
  await page.locator('.tr-levels button >> nth=0').click();
  await page.waitForTimeout(300);
  const NAMES = ['До','До♯','Ре','Ре♯','Ми','Фа','Фа♯','Соль','Соль♯','Ля','Ля♯','Си'];
  const midiOf = (n) => 60 + NAMES.indexOf(n);
  const coreLbl = async () => page.$eval('[data-role=core]', el => el.getAttribute('aria-label'));
  const playRound = async () => {
    let iter = 0;
    while (true) {
      iter++;
      if (iter > 40) throw new Error('round did not finish');
      const lbl = await coreLbl();
      const m = /Нота ([А-Яа-я]+♯?)/.exec(lbl);
      if (!m) return 'finished';
      await page.locator(`[data-midi="${midiOf(m[1])}"]`).click();
      await page.waitForTimeout(60);
    }
  };
  // Round 1: all correct
  await playRound();
  const acc1 = await page.textContent('[data-role=acc]');
  // Round 2 (Ещё раз): answer correct, then replay the same answered prompt via back-arrow + re-answer, then finish
  await page.click('[data-role=again]');
  await page.waitForTimeout(200);
  // first prompt
  let lbl = await coreLbl();
  let m = /Нота ([А-Яа-я]+♯?)/.exec(lbl);
  await page.locator(`[data-midi="${midiOf(m[1])}"]`).click();
  await page.waitForTimeout(100);
  const accMid = await page.textContent('[data-role=acc]');
  const progMid = await page.textContent('[data-role=progress]');
  // replay prompt 1: go back then forward, then answer again
  await page.click('[data-role=prev]'); await page.waitForTimeout(80);
  await page.click('[data-role=next]'); await page.waitForTimeout(80);
  lbl = await coreLbl();
  m = /Нота ([А-Яа-я]+♯?)/.exec(lbl);
  const fbBefore = await page.textContent('[data-role=feedback]');
  await page.locator(`[data-midi="${midiOf(m[1])}"]`).click();
  await page.waitForTimeout(100);
  const fbAfter = await page.textContent('[data-role=feedback]');
  const accReplay = await page.textContent('[data-role=acc]');
  const streak = await page.textContent('[data-role=streak]');
  console.log(JSON.stringify({ accMid, progMid, fbBefore, fbAfter, accReplay, streak }, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
