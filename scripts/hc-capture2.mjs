#!/usr/bin/env node
/** hc-capture2.mjs — interact with the real widget to force the challenge
 *  bundle (hcaptcha.js + wasm) to load. All API calls fulfilled locally. */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext();
const page = await ctx.newPage();
const bundles = {};

page.on('response', async r => {
  const u = r.url();
  if (/newassets\.hcaptcha\.com/.test(u) && (/\.js/.test(u) || /\.wasm/.test(u))) {
    try { const ct = r.headers()['content-type']||''; const body = await r.body(); if (body && body.length > 1500) bundles[u] = {ct, body}; } catch(_){}
  }
});
await page.route('**/*', async route => {
  const u = route.request().url();
  if (/hcaptcha\.com\/(checkcaptcha|getcookies|getcaptcha|task|configuration|api|checksiteconfig|siteconfig)/.test(u) || /api2?\.hcaptcha\.com/.test(u) || /\.w\.hcaptcha\.com/.test(u)) {
    await route.fulfill({ status:200, contentType:'application/json', body:'{}' });
  } else await route.continue();
});

await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(8000);

// find and click the checkbox iframe content
const frames = page.frames();
console.log('frames:', frames.map(f=>f.url().slice(0,90)));
for (const f of frames) {
  if (/hcaptcha\.html/.test(f.url())) {
    try {
      // click the checkbox
      const chk = f.locator('#checkbox, .checkbox, [role="checkbox"], iframe[src*="checkbox"], .rc-anchor-content, [aria-label*="checkbox"]').first();
      await chk.click({ timeout:5000 }).catch(()=>{});
      console.log('clicked checkbox');
    } catch(e) { console.log('click fail:', String(e).slice(0,80)); }
  }
}
await page.waitForTimeout(15000);

mkdirSync('/tmp/opencode/hc/assets',{recursive:true});
console.log('\nbundles:', Object.keys(bundles).length);
for (const [u,{ct,body}] of Object.entries(bundles)) {
  const name = (u.split('/').pop().split('?')[0] || 'asset') + (body[0]===0x7f||body[0]===0 ? '.wasm':'');
  if (body[0] !== 0x7f && body[0] !== 0 && !/text|javascript/.test(ct)) continue;
  writeFileSync('/tmp/opencode/hc/assets/'+name, body);
  console.log('saved:', name, Math.round(body.length/1024)+'KB', ct.split(';')[0]);
}
await b.close();
