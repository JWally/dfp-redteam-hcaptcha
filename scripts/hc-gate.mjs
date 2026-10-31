#!/usr/bin/env node
/** hc-gate.mjs — what does the widget actually show under automation?
 *  Screenshot the widget + check if the checkbox iframe is interactable. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext({ viewport:{width:1280,height:900}, locale:'en-US' });
const page = await ctx.newPage();
await page.route(/\/checkcaptcha\//, async route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(10000);
// screenshot the widget area (the checkbox iframe is on the right side)
await page.screenshot({ path:'/tmp/opencode/hc/widget-shot.png' });
const state = await page.evaluate(() => {
  const w = document.querySelector('.h-captcha, [data-sitekey]');
  const ifr = [...document.querySelectorAll('iframe')].map(f=>({src:f.src.slice(-50), w:f.width, h:f.height, style:f.style.cssText}));
  return { hasWidget: !!w, widgetHTML: w?w.outerHTML.slice(0,300):null, iframes: ifr };
}).catch(e=>({err:String(e).slice(0,150)}));
console.log('widget state:', JSON.stringify(state,null,1).slice(0,1200));
// try clicking where the checkbox should be (right side, centered vertically)
const frames = page.frames();
for (const f of frames) {
  if (/hcaptcha\.html/.test(f.url())) {
    const desc = await f.evaluate(() => document.body ? document.body.innerText.slice(0,300) : 'nobody').catch(()=>'?');
    console.log('\niframe content:', desc.slice(0,300));
    const boxes = await f.evaluate(() => [...document.querySelectorAll('*')].filter(el=>{const r=el.getBoundingClientRect();return r.width>20&&r.height>20;}).slice(0,15).map(el=>({t:el.tagName, id:el.id, cls:el.className, w:Math.round(el.getBoundingClientRect().width), h:Math.round(el.getBoundingClientRect().height)}))).catch(()=>[]);
    console.log('elements:', JSON.stringify(boxes).slice(0,600));
  }
}
writeFileSync('/tmp/opencode/hc/gate-state.json', JSON.stringify(state,null,2));
await b.close();
