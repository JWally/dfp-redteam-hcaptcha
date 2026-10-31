#!/usr/bin/env node
/** hc-flow.mjs — capture the REAL getcaptcha response (fulfilled locally but
 *  recorded) + observe the widget flow. Get the full challenge structure. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext();
const page = await ctx.newPage();
const api = [];
page.on('response', async r => {
  const u = r.url();
  if (/getcaptcha|checksiteconfig|checkcaptcha|task/.test(u)) {
    try { const b = await r.text(); api.push({ url: u.slice(0,120), status: r.status(), body: b.slice(0,2500) }); } catch(_){}
  }
});
await page.route(/\/checkcaptcha\//, async route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(10000);
for (const f of page.frames()) {
  if (/hcaptcha\.html/.test(f.url())) {
    try { await f.locator('body').click({position:{x:120,y:120}}).catch(()=>{}); } catch(_){}
  }
}
await page.waitForTimeout(12000);
console.log('api calls:', api.length);
for (const a of api) {
  console.log('\n===', a.url);
  console.log('status:', a.status);
  console.log(a.body.slice(0,2200));
}
writeFileSync('/tmp/opencode/hc/getcaptcha-real.json', JSON.stringify(api,null,2));
await b.close();
