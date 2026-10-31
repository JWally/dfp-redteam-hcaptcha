#!/usr/bin/env node
/** hc-clean-drive.mjs — in the CLEAN manually-launched Chrome: hook crypto/
 *  atob/WebAssembly at the page, click the checkbox, drive execute(), capture
 *  whether hsw initializes + any decoded strings. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('hcaptcha')) || ctx.pages()[0];

// hook the top page first (hsw may run in the main page or an iframe)
await page.evaluate(() => {
  if (!self.__hooked) {
    self.__hooked = true;
    self.__hswLog = [];
    const ob = window.atob;
    window.atob = function(s){ const r = ob.call(window,s); if(self.__hswLog.length<200) self.__hswLog.push(['atob',s.slice(0,60),r.slice(0,60)]); return r; };
    const sfc = String.fromCharCode;
    String.fromCharCode = function(...a){ const r = sfc.apply(String,a); if(self.__hswLog.length<200 && a.length>8) self.__hswLog.push(['fCC', a.length]); return r; };
    const wi = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(...a){ self.__hswLog.push(['wasm.instantiate']); return wi.apply(this,a); };
    const grv = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = function(a){ self.__hswLog.push(['grv', a.length]); return grv(a); };
  }
});
// also hook in each hcaptcha iframe
for (const f of page.frames()) {
  if (/hcaptcha\.html/.test(f.url())) {
    await f.evaluate(() => {
      if (!self.__hooked) {
        self.__hooked=true; self.__hswLog=[];
        const ob=atob; atob=function(s){const r=ob.call(self,s); if((self.__hswLog.length<200)) self.__hswLog.push(['atob',s.slice(0,60),r.slice(0,60)]); return r;};
        const wi=WebAssembly.instantiate; WebAssembly.instantiate=async function(...a){ self.__hswLog.push(['wasm.instantiate']); return wi.apply(this,a); };
      }
    }).catch(()=>{});
  }
}

// click the checkbox
for (const f of page.frames()) {
  if (/hcaptcha\.html/.test(f.url())) {
    try {
      const cb = f.locator('#checkbox, [role="checkbox"], [id="checkbox"]').first();
      await cb.click({ timeout:4000 }).catch(()=>console.log('no checkbox in this frame'));
      console.log('clicked checkbox in', f.url().slice(-25));
    } catch(e){}
  }
}
await page.waitForTimeout(8000);
// also call execute from the page
await page.evaluate(() => new Promise(res=>{ try{ window.hcaptcha.execute().then(res).catch(()=>res()); }catch(e){ res(); } })).catch(()=>{});
await page.waitForTimeout(10000);

// collect logs from all frames
const logs = [];
for (const f of page.frames()) {
  if (/hcaptcha\.html/.test(f.url())) {
    const l = await f.evaluate(() => self.__hswLog || []).catch(()=>[]);
    logs.push({ frame: f.url().slice(-25), log: l });
  }
}
const plog = await page.evaluate(() => self.__hswLog || []).catch(()=>[]);
logs.push({ frame: 'top', log: plog });
for (const {frame,log} of logs) {
  console.log(`\n=== ${frame} — ${log.length} entries ===`);
  for (const e of log.slice(0,15)) console.log('  ', JSON.stringify(e).slice(0,130));
}
// screenshot
await page.screenshot({ path:'/tmp/opencode/hc/clean4.png' });
writeFileSync('/tmp/opencode/hc/clean-drive.json', JSON.stringify(logs,null,2));
await b.close();
