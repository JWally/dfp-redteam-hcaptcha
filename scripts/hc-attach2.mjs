#!/usr/bin/env node
/** hc-attach2.mjs — attach to the MANUALLY-launched real Chrome (no automation
 *  flags, no --enable-automation), check the actual widget state. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('hcaptcha')) || ctx.pages()[0];
await page.waitForTimeout(3000);
const state = await page.evaluate(() => ({
  webdriver: navigator.webdriver,
  UA: navigator.userAgent.slice(0,80),
  hasHC: typeof window.hcaptcha !== 'undefined',
})).catch(e=>({err:String(e).slice(0,150)}));
console.log('page state:', JSON.stringify(state));
// read all frames
for (const f of page.frames()) {
  if (/hcaptcha\.html/.test(f.url())) {
    const txt = await f.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g,' | ').slice(0,200) : '').catch(()=>'?');
    console.log('widget:', JSON.stringify(txt));
  }
}
// screenshot via CDP (this is the real window)
await page.screenshot({ path:'/tmp/opencode/hc/clean2-widget.png' });
console.log('screenshot saved');
writeFileSync('/tmp/opencode/hc/attach2.json', JSON.stringify(state,null,2));
await b.close();
