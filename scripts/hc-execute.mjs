#!/usr/bin/env node
/** hc-execute.mjs — drive window.hcaptcha.execute() on the real widget,
 *  patched hsw, capture decoded strings + WASM + token. */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
let hsw = readFileSync('/tmp/opencode/hc/assets/hsw.js','utf-8');
hsw = hsw.replace('function aIW(anr){','function aIW(anr){var __a=anr;');
hsw = hsw.replace('return Oj[anr]=baW}', 'var __s=baW;if((self.__hswstrs=self.__hswstrs||[]).length<8000)self.__hswstrs.push([__a,__s]);return Oj[anr]=__s}');
hsw = hsw.replace('WebAssembly.instantiate', '(self.__wasmCalled=true,WebAssembly.instantiate)');

const b = await chromium.launch({ headless:true });
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
const page = await ctx.newPage();
const api=[];
page.on('response', async r => { const u=r.url(); if(/getcaptcha|checkcaptcha|checksiteconfig|task/.test(u)){ try{ api.push([u.slice(0,110), r.status(), (await r.text()).slice(0,400)]); }catch(_){} } });
await page.route(/\/checkcaptcha\//, async route => route.fulfill({ status:200, contentType:'application/json', body:'{}' }));
await page.route('**/hsw.js', async route => route.fulfill({ status:200, contentType:'application/javascript', body: hsw }));
await page.route('**/hcaptcha.html', async route => route.fulfill({ status:200, contentType:'text/html', body: readFileSync('/tmp/opencode/hc/assets/hcaptcha.html','utf-8') }));

await page.goto('https://accounts.hcaptcha.com/demo', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(8000);
// drive execute() from the main page
const res = await page.evaluate(() => {
  return new Promise(resolve => {
    let done=false;
    const timer=setTimeout(()=>{ if(!done){done=true;resolve({timeout:true});} }, 15000);
    try {
      window.hcaptcha.execute().then(tok=>{ if(!done){done=true;clearTimeout(timer);resolve({token:tok});} }).catch(e=>{ if(!done){done=true;clearTimeout(timer);resolve({err:String(e).slice(0,150)});} });
    } catch(e){ if(!done){done=true;clearTimeout(timer);resolve({throwErr:String(e).slice(0,150)});} }
  });
}).catch(e=>({evalErr:String(e).slice(0,150)}));
console.log('execute result:', JSON.stringify(res).slice(0,300));
await page.waitForTimeout(6000);
const out = await page.evaluate(() => ({
  wasmCalled: self.__wasmCalled||false,
  strs: (self.__hswstrs||[]),
})).catch(e=>({err:String(e).slice(0,150)}));
console.log('\nwasm called:', out.wasmCalled);
console.log('decoded strings:', (out.strs||[]).length);
const seen=new Set();
for (const [i,o] of (out.strs||[])){ if(o&&/[\x20-\x7e]{2,}/.test(o)&&!seen.has(o)){seen.add(o);console.log(`  [${i}] ${o.slice(0,100)}`);} }
console.log('\napi calls:');
for (const a of api) console.log(' ', a[0], a[1], a[2].slice(0,150));
writeFileSync('/tmp/opencode/hc/execute-results.json', JSON.stringify({res,out,api},null,2));
await b.close();
