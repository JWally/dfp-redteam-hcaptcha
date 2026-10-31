#!/usr/bin/env node
/** hc-getcaptcha.mjs — trigger the real getcaptcha (read-only observation,
 *  no solve, no verify) to learn the challenge response shape. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext();
const page = await ctx.newPage();
const api = [];
page.on('response', async r => {
  const u = r.url();
  if (/getcaptcha|checksiteconfig|checkcaptcha/.test(u)) {
    try { const b = await r.text(); api.push({ url: u.slice(0,130), status: r.status(), body: b.slice(0,3000) }); } catch(_){}
  }
});
await page.route(/\/checkcaptcha\//, async route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(9000);

// find hcaptcha iframe and drive it via its global API (window.hcaptcha or the iframe's postMessage)
const frames = page.frames();
for (const f of frames) {
  if (/hcaptcha\.html/.test(f.url())) {
    const r = await f.evaluate(() => {
      const out = { globals: [] };
      for (const k of Object.keys(window)) if (/hcaptcha|_hc|HCaptcha|challenge/i.test(k)) out.globals.push(k);
      // try to invoke the challenge renderer
      try {
        if (window.hcaptcha) out.hcaptchaKeys = Object.keys(window.hcaptcha);
      } catch(e){}
      return out;
    }).catch(()=>({}));
    console.log('iframe globals:', JSON.stringify(r));
  }
}
await page.waitForTimeout(10000);
console.log('\napi calls:', api.length);
for (const a of api) {
  console.log('\n===', a.url);
  console.log('status:', a.status);
  console.log(a.body.slice(0,2800));
}
writeFileSync('/tmp/opencode/hc/getcaptcha2.json', JSON.stringify(api,null,2));
await b.close();
