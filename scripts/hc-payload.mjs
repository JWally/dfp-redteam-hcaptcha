#!/usr/bin/env node
/** hc-payload.mjs — capture the hCaptcha getcaptcha/checkcaptcha REQUEST
 *  bodies (the hsw proof payload the client ships) in a clean session. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9999');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p=>p.url().includes('hcaptcha')) || ctx.pages()[0];
const posts = [];
page.on('request', req => {
  const u = req.url();
  if (/hcaptcha\.com\/(getcaptcha|checkcaptcha|checksiteconfig|task)/.test(u) && /POST/.test(req.method())) {
    posts.push({ url: u.slice(0,140), postData: (req.postData()||'').slice(0,1500) });
  }
});
const resps = [];
page.on('response', async r => {
  const u = r.url();
  if (/hcaptcha\.com\/(getcaptcha|checkcaptcha)/.test(u)) {
    try { resps.push({ url: u.slice(0,120), status: r.status(), body: (await r.text()).slice(0,600) }); } catch(_){}
  }
});
await page.waitForTimeout(4000);
// drive the checkbox with human-ish input to trigger getcaptcha
for (const f of page.frames()) {
  if (/hcaptcha\.html/.test(f.url())) {
    const txt = await f.evaluate(()=>document.body?.innerText.slice(0,60)).catch(()=>"");
    if (/human/i.test(txt)) {
      const cb = await f.locator('#checkbox').boundingBox().catch(()=>null);
      if (cb) {
        const cx=cb.x+15, cy=cb.y+15;
        for (let i=1;i<=10;i++){const t=i/10,e=t*t*(3-2*t); await page.mouse.move(cb.x-120+(cx-(cb.x-120))*e, cb.y-80+(cy-(cb.y-80))*e); await new Promise(r=>setTimeout(r,35+Math.random()*30));}
        await page.mouse.move(cx,cy); await new Promise(r=>setTimeout(r,250)); await page.mouse.down(); await new Promise(r=>setTimeout(r,90)); await page.mouse.up();
        console.log('clicked checkbox');
      }
    }
  }
}
await page.waitForTimeout(12000);
console.log('posts:', posts.length, '| resps:', resps.length);
for (const p of posts) {
  console.log('\n=== POST', p.url);
  console.log(p.postData.slice(0,1200));
}
for (const r of resps) {
  console.log('\n=== RESP', r.status, r.url);
  console.log(r.body.slice(0,400));
}
writeFileSync('/tmp/opencode/hc/hc-payload.json', JSON.stringify({posts,resps},null,2));
await b.close();
