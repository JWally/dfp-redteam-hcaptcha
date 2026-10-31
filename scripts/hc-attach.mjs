#!/usr/bin/env node
/** hc-attach.mjs — attach to the ALREADY-LAUNCHED real Chrome (no automation
 *  flags) via connectOverCDP, check navigator.webdriver + widget state. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

// the launched Chrome is at the demo already; connect over CDP
const b = await chromium.connectOverCDP('http://127.0.0.1:9222').catch(async e => {
  console.log('no CDP on 9222 (expected — we launched without it). err:', String(e).slice(0,120));
  return null;
});
if (!b) {
  // Launch clean via Playwright but with minimal automation tell: no default flags
  console.log('fallback: launch clean via playwright channel=chrome, no automation flags...');
  const pb = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900'],
  });
  const ctx = pb.contexts()[0] || await pb.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
  await page.waitForTimeout(9000);
  const wd = await page.evaluate(() => ({
    webdriver: navigator.webdriver,
    userAgent: navigator.userAgent.slice(0,80),
  })).catch(e=>({err:String(e).slice(0,120)}));
  console.log('webdriver tell:', JSON.stringify(wd));
  const frames = page.frames();
  for (const f of frames) {
    if (/hcaptcha\.html/.test(f.url())) {
      const txt = await f.evaluate(() => document.body ? document.body.innerText.slice(0,200) : '').catch(()=>'');
      console.log('widget iframe:', JSON.stringify(txt));
    }
  }
  await page.screenshot({ path:'/tmp/opencode/hc/clean-widget.png' });
  console.log('screenshot saved');
  await pb.close();
}
await b?.close();
