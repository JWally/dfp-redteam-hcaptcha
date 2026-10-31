#!/usr/bin/env node
/** hc-capture3.mjs — surgical: block only checkcaptcha/getcookies/getcaptcha,
 *  capture ALL newassets responses (js/wasm/html). Force challenge via click. */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext();
const page = await ctx.newPage();
const bundles = {};
const nets = [];
page.on('request', req => { const u=req.url(); if(/newassets/.test(u)) nets.push([req.method(), u.slice(0,150)]); });
page.on('response', async r => {
  const u = r.url();
  if (/newassets\.hcaptcha\.com/.test(u)) {
    try { const ct=r.headers()['content-type']||''; const body=await r.body(); if(body.length>1500) bundles[u]={ct,body}; } catch(_){}
  }
});
await page.route(/\/checkcaptcha\/|\/getcookies\/|\/getcaptcha\/|\/task\/|\/siteconfig|\/checksiteconfig/, async route => {
  await route.fulfill({ status:200, contentType:'application/json', body:'{}' });
});
await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(9000);

const frames = page.frames();
for (const f of frames) {
  if (/hcaptcha\.html/.test(f.url())) {
    try {
      const sel = f.locator('#checkbox, [role="checkbox"], [id="checkbox"], .switch, [aria-checked]').first();
      await sel.click({ timeout:4000 }).catch(async ()=>{ await f.locator('body').click({position:{x:80,y:80}}).catch(()=>{}); });
      console.log('clicked in', f.url().slice(-40));
    } catch(e){ console.log('click fail'); }
  }
}
await page.waitForTimeout(18000);
// second pass: try to trigger challenge via the main page's iframe
for (const f of frames) {
  if (/hcaptcha\.html/.test(f.url())) {
    try { await f.locator('body').click({position:{x:100,y:150}}).catch(()=>{}); } catch(_){}
  }
}
await page.waitForTimeout(8000);

mkdirSync('/tmp/opencode/hc/assets',{recursive:true});
console.log('\nbundles captured:', Object.keys(bundles).length);
for (const [u,{ct,body}] of Object.entries(bundles)) {
  let name = u.split('/').pop().split('?')[0] || 'asset';
  // detect wasm by magic
  const magic = body[0]===0x00&&body[1]===0x61&&body[2]===0x73&&body[3]===0x6d;
  if (magic) name = name.replace(/[^a-z0-9_.]/g,'_') + '.wasm';
  if (!magic && !/javascript|json|html/.test(ct)) continue;
  writeFileSync('/tmp/opencode/hc/assets/'+name, body);
  console.log('saved:', name, Math.round(body.length/1024)+'KB', ct.split(';')[0]);
}
console.log('\nnewassets requests:');
for (const n of nets.slice(0,20)) console.log(' ', n[0], n[1]);
await b.close();
