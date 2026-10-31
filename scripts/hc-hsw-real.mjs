#!/usr/bin/env node
/** hc-hsw-real.mjs — patch the REAL hashed hsw URL, drive execute(), wait
 *  for full module init, capture aIW decodes + WASM. */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
let hsw = readFileSync('/tmp/opencode/hc/assets/hsw.js','utf-8');
hsw = hsw.replace('function aIW(anr){','function aIW(anr){var __a=anr;');
hsw = hsw.replace('return Oj[anr]=baW}', 'var __s=baW;if((self.__hswstrs=self.__hswstrs||[]).length<8000)self.__hswstrs.push([__a,__s]);return Oj[anr]=__s}');
hsw = hsw.replace('WebAssembly.instantiate', '(self.__wasmCalled=true,WebAssembly.instantiate)');

const b = await chromium.launch({ headless:true });
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
const page = await ctx.newPage();
await page.route(/\/checkcaptcha\//, async route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
// patch the hashed hsw URL that the widget actually requests
await page.route(/newassets\.hcaptcha\.com\/c\/[a-f0-9]+\/hsw\.js/, async route => {
  await route.fulfill({ status:200, contentType:'application/javascript', body: hsw });
});
await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(8000);
await page.evaluate(() => new Promise(res=>{ try{ window.hcaptcha.execute().then(res).catch(()=>res()); }catch(e){ res(); } })).catch(()=>{});
await page.waitForTimeout(20000);
const out = await page.evaluate(() => ({
  wasmCalled: self.__wasmCalled||false,
  strs: (self.__hswstrs||[]),
})).catch(e=>({err:String(e).slice(0,150)}));
console.log('wasm called:', out.wasmCalled);
console.log('decoded strings:', (out.strs||[]).length);
const seen=new Set();
for (const [i,o] of (out.strs||[])){ if(o&&/[\x20-\x7e]{2,}/.test(o)&&!seen.has(o)){seen.add(o);console.log(`  [${i}] ${o.slice(0,110)}`);} }
writeFileSync('/tmp/opencode/hc/hsw-real.json', JSON.stringify(out,null,2));
await b.close();
