#!/usr/bin/env node
/** hc-challenge.mjs — attach to the clean Chrome, dump the challenge state:
 *  iframe content, task prompt, available images, and try clicking shapes. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('hcaptcha')) || ctx.pages()[0];

// find the challenge iframe (the one with the task text, not the checkbox)
for (const f of page.frames()) {
  if (/hcaptcha\.html/.test(f.url())) {
    const info = await f.evaluate(() => {
      const out = { url: location.href.slice(0,90), text: (document.body?.innerText||'').slice(0,300) };
      // challenge images
      out.images = [...document.querySelectorAll('img')].map(i=>({src:i.src.slice(0,80), w:i.width, h:i.height}));
      out.canvases = [...document.querySelectorAll('canvas')].map(c=>{const r=c.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)};});
      out.task = document.querySelector('.prompt, .task, [class*="prompt"], [class*="task"]')?.innerText || null;
      return out;
    }).catch(e=>({err:String(e).slice(0,150)}));
    console.log('iframe:', JSON.stringify(info,null,1).slice(0,1500));
    // screenshot this frame
    await f.screenshot({ path:'/tmp/opencode/hc/challenge-frame.png' });
  }
}
// page-level screenshot
await page.screenshot({ path:'/tmp/opencode/hc/clean3-full.png', fullPage:false });
writeFileSync('/tmp/opencode/hc/challenge-state.json', JSON.stringify({},null,2));
await b.close();
