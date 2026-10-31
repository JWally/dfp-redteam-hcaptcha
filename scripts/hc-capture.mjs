#!/usr/bin/env node
/** hc-capture.mjs — load a REAL hCaptcha widget (public demo), capture the
 *  challenge bundle (hcaptcha.js), hsw.js, and wasm from the network. All
 *  hCaptcha API calls fulfilled locally. */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const b = await chromium.launch({ headless:true });
const ctx = await b.newContext();
const page = await ctx.newPage();
const bundles = {};
const nets = [];

page.on('request', req => {
  const u = req.url();
  if (/hcaptcha|newassets|hsw|\.wasm/.test(u)) nets.push([req.method(), u.slice(0,160)]);
});
page.on('response', async r => {
  const u = r.url();
  if (/newassets\.hcaptcha\.com/.test(u) && (/\.js/.test(u) || /\.wasm/.test(u))) {
    try { const body = await r.body(); if (body && body.length > 2000) bundles[u] = body; } catch(_) {}
  }
});
// fulfill hcaptcha API calls locally (checkcaptcha, getcookies etc), let assets through
await page.route('**/*', async route => {
  const u = route.request().url();
  if (/hcaptcha\.com\/(checkcaptcha|getcookies|getcaptcha|task|configuration|api)/.test(u) || /api2\.hcaptcha\.com/.test(u)) {
    await route.fulfill({ status:200, contentType:'application/json', body:'{}' });
  } else await route.continue();
});

// public demo page: hCaptcha has a docs/demo widget
await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(12000);

// also try their jsfiddle-like demo on hcaptcha.com
if (Object.keys(bundles).length === 0) {
  await page.goto('https://www.hcaptcha.com/', { waitUntil:'load', timeout:60000 }).catch(()=>{});
  await page.waitForTimeout(8000);
}

mkdirSync('/tmp/opencode/hc/assets',{recursive:true});
for (const [u,body] of Object.entries(bundles)) {
  const name = u.split('/').pop().split('?')[0];
  writeFileSync('/tmp/opencode/hc/assets/'+name, body);
  console.log('saved:', name, lenKB(body));
}
function lenKB(b){ return Math.round(b.length/1024)+'KB'; }
console.log('\n=== network (hcaptcha-ish) ===');
for (const n of nets.slice(0,25)) console.log(' ', n[0], n[1]);
console.log('\nrequests seen:', nets.length, '| bundles captured:', Object.keys(bundles).length);
await b.close();
