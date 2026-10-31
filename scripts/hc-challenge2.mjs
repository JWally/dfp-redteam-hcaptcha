#!/usr/bin/env node
/** hc-challenge2.mjs — attach to clean Chrome, enumerate ALL frames, find the
 *  one showing the shape challenge, dump + screenshot it. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('hcaptcha')) || ctx.pages()[0];
await page.waitForTimeout(2000);
for (const f of page.frames()) {
  if (!/hcaptcha\.html/.test(f.url())) continue;
  let info = {};
  try {
    info = await f.evaluate(() => ({
      url: location.href.slice(0,80),
      text: (document.body?.innerText||'').replace(/\n+/g,' | ').slice(0,250),
      imgs: [...document.querySelectorAll('img')].map(i=>i.src.slice(0,70)).slice(0,5),
      canvases: document.querySelectorAll('canvas').length,
    }));
  } catch(e){ info = {err:String(e).slice(0,80)}; }
  console.log('frame:', JSON.stringify(info));
}
// screenshot the whole page (the challenge is a popup within the page)
await page.screenshot({ path:'/tmp/opencode/hc/clean3-full.png' });
console.log('page screenshot saved');
writeFileSync('/tmp/opencode/hc/challenge2.json', '{}');
await b.close();
