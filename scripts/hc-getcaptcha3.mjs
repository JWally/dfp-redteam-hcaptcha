#!/usr/bin/env node
/** hc-getcaptcha3.mjs — capture the FULL getcaptcha response (read-only),
 *  decode both JWT tickets (hsw + hsj). */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
const page = await ctx.newPage();
const api=[];
page.on('response', async r => {
  const u=r.url();
  if (/getcaptcha|checksiteconfig/.test(u)){ try{ api.push({url:u.slice(0,110), status:r.status(), body:await r.text()}); }catch(_){} }
});
await page.route(/\/checkcaptcha\//, async route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(8000);
await page.evaluate(() => new Promise(res=>{ try{ window.hcaptcha.execute().then(res).catch(()=>res()); }catch(e){ res(); } })).catch(()=>{});
await page.waitForTimeout(6000);
writeFileSync('/tmp/opencode/hc/getcaptcha-full.json', JSON.stringify(api,null,1));
for (const a of api) {
  console.log('\n===', a.url, a.status);
  try {
    const body=JSON.parse(a.body);
    const req=body.c && body.c.req;
    if (req) {
      const parts=req.split('.');
      const h=JSON.parse(Buffer.from(parts[0],'base64url').toString());
      const p=JSON.parse(Buffer.from(parts[1],'base64url').toString());
      console.log('ticket type:', body.c.type, '| header:', JSON.stringify(h));
      console.log('payload:', JSON.stringify({...p, d:p.d?('len '+p.d.length):null}, null, 1));
    } else {
      console.log('raw keys:', Object.keys(body));
      console.log('raw:', JSON.stringify(body).slice(0,800));
    }
  } catch(e){ console.log('non-JSON or error:', a.body.slice(0,300)); }
}
await b.close();
