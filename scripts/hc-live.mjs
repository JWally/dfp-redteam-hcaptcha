#!/usr/bin/env node
/** hc-live.mjs — observe the REAL hCaptcha widget: load demo, click, capture
 *  the challenge bundle + hsw + what happens. Only checkcaptcha API blocked. */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext();
const page = await ctx.newPage();
const bundles = {};
const nets = [];
page.on('request', req => {
  const u = req.url();
  if (/newassets|hcaptcha|\.wasm/.test(u)) nets.push([req.method(), u.slice(0,150)]);
});
page.on('response', async r => {
  const u = r.url();
  if (/newassets\.hcaptcha\.com/.test(u)) {
    try { const ct=r.headers()['content-type']||''; const body=await r.body(); if(body.length>1500) bundles[u]={ct,body}; } catch(_){}
  }
});
// block ONLY the actual verify/check endpoints; let checksiteconfig through so the widget configures
await page.route(/\/checkcaptcha\//, async route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));

await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(10000);
console.log('loaded demo. frames:', page.frames().map(f=>f.url().slice(0,70)));

// try clicking the checkbox inside the hcaptcha iframe
for (const f of page.frames()) {
  if (/hcaptcha\.html/.test(f.url())) {
    try {
      const el = f.locator('#checkbox, [role="checkbox"], [id="checkbox"]').first();
      await el.click({ timeout:3000 }).catch(()=>{ console.log('  no checkbox found'); });
      console.log('  clicked in', f.url().slice(-30));
    } catch(e){}
  }
}
await page.waitForTimeout(15000);
// capture page state: did a challenge render? any console?
const st = await page.evaluate(() => ({
  iframes: document.querySelectorAll('iframe').length,
  forms: document.querySelectorAll('form').length,
  body: document.body.innerText.slice(0,300),
})).catch(()=>({}));
console.log('\npage state:', JSON.stringify(st).slice(0,400));

mkdirSync('/tmp/opencode/hc/assets',{recursive:true});
console.log('\nbundles:', Object.keys(bundles).length);
for (const [u,{ct,body}] of Object.entries(bundles)) {
  let name = u.split('/').pop().split('?')[0];
  const magic = body[0]===0 && body[1]===0x61 && body[2]===0x73 && body[3]===0x6d;
  if (magic) name += '.wasm';
  if (!magic && !/javascript|html|json/.test(ct)) continue;
  writeFileSync('/tmp/opencode/hc/assets/'+name, body);
  console.log('saved:', name, Math.round(body.length/1024)+'KB', ct.split(';')[0]);
}
console.log('\nrequests:');
for (const n of nets.slice(0,25)) console.log(' ', n[0], n[1]);
await b.close();
