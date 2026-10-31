#!/usr/bin/env node
/** hc-headed.mjs — HEADED browser, real demo + patched hsw, click checkbox,
 *  capture decoded strings + WASM. */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
let hsw = readFileSync('/tmp/opencode/hc/assets/hsw.js','utf-8');
const from='function aIW(anr){';
hsw = hsw.replace(from,'function aIW(anr){var __a=anr;');
hsw = hsw.replace('return Oj[anr]=baW}', 'var __s=baW;if((self.__hswstrs=self.__hswstrs||[]).length<8000)self.__hswstrs.push([__a,__s]);return Oj[anr]=__s}');
hsw = hsw.replace('WebAssembly.instantiate', '(self.__wasmCalled=true,WebAssembly.instantiate)');

const b = await chromium.launch({ headless:false });
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
const page = await ctx.newPage();
await page.route(/\/checkcaptcha\//, async route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
await page.route('**/hsw.js', async route => route.fulfill({ status:200, contentType:'application/javascript', body: hsw }));
await page.route('**/hcaptcha.html', async route => route.fulfill({ status:200, contentType:'text/html', body: readFileSync('/tmp/opencode/hc/assets/hcaptcha.html','utf-8') }));

await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(8000);
console.log('frames:', page.frames().map(f=>f.url().slice(0,60)));
for (const f of page.frames()) {
  if (/hcaptcha\.html/.test(f.url())) {
    try {
      const el = f.locator('#checkbox, [role="checkbox"], [id="checkbox"]').first();
      await el.click({ timeout:4000 });
      console.log('clicked checkbox');
    } catch(e){ console.log('no checkbox:', String(e).slice(0,60)); }
  }
}
await page.waitForTimeout(15000);
const out = await page.evaluate(() => ({
  wasmCalled: self.__wasmCalled||false,
  strs: (self.__hswstrs||[]),
})).catch(e=>({err:String(e).slice(0,200)}));
console.log('\nwasm called:', out.wasmCalled);
console.log('decoded strings:', (out.strs||[]).length);
const seen=new Set();
for (const [i,o] of (out.strs||[])){ if(o&&/[\x20-\x7e]{2,}/.test(o)&&!seen.has(o)){seen.add(o);console.log(`  [${i}] ${o.slice(0,100)}`);} }
writeFileSync('/tmp/opencode/hc/headed-strings.json', JSON.stringify(out,null,2));
await b.close();
