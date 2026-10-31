#!/usr/bin/env node
/** hc-probe2.mjs — screenshot the real demo widget, try multiple hCaptcha demo
 *  pages, capture whether a challenge ever initializes. */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
const page = await ctx.newPage();
await page.route(/\/checkcaptcha\//, async route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));

const targets = [
  ['https://accounts.hcaptcha.com/demo', 12000],
  ['https://www.hcaptcha.com/', 9000],
  ['https://docs.hcaptcha.com/', 9000],
];
for (const [url, wait] of targets) {
  await page.goto(url, { waitUntil:'load', timeout:60000 }).catch(()=>{});
  await page.waitForTimeout(wait);
  const info = await page.evaluate(() => ({
    url: location.href,
    iframes: [...document.querySelectorAll('iframe')].map(f=>f.src.slice(0,90)),
    hasHC: typeof window.hcaptcha !== 'undefined',
    hasWidget: !!document.querySelector('.h-captcha, [data-sitekey], iframe[src*="hcaptcha"]'),
    hcKeys: typeof window.hcaptcha==='object' ? Object.keys(window.hcaptcha) : null,
  })).catch(e=>({err:String(e).slice(0,150)}));
  console.log('\n===', url, '===');
  console.log(JSON.stringify(info,null,1));
  if (info.iframes?.length || info.hasWidget) {
    await page.screenshot({ path:`/tmp/opencode/hc/shot-${url.replace(/[^a-z]/gi,'_')}.png` });
  }
}
await b.close();
