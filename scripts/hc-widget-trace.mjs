#!/usr/bin/env node
/** hc-widget-trace.mjs — run hsw in its real context: load the hcaptcha.html
 *  iframe (served locally), patch aIW, capture decoded strings + WASM state. */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
import http from 'node:http';

let hsw = readFileSync('/tmp/opencode/hc/assets/hsw.js','utf-8');
let html = readFileSync('/tmp/opencode/hc/assets/hcaptcha.html','utf-8');
// patch hsw aIW decode logging
const from='function aIW(anr){';
hsw = hsw.includes(from) ? hsw.replace(from,'function aIW(anr){var __a=anr;') : hsw;
hsw = hsw.replace('return Oj[anr]=baW}', 'var __s=baW;if((self.__hswstrs=self.__hswstrs||[]).length<8000)self.__hswstrs.push([__a,__s]);return Oj[anr]=__s}');

// serve locally: html + hsw on same origin
const srv = http.createServer((req,res)=>{
  const u = req.url;
  if (u.includes('hsw')) { res.setHeader('Content-Type','application/javascript'); res.end(hsw); }
  else { res.setHeader('Content-Type','text/html'); res.end(html); }
});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const port = srv.address().port;

const b = await chromium.launch({ headless:true });
const page = await b.newPage();
await page.route('**/*', async route => {
  const u = route.request().url();
  if (u.startsWith('http://127.0.0.1') || u==='about:blank' || u.startsWith('data:')) return route.continue();
  await route.fulfill({ status:200, contentType:'application/json', body:'{}' });
});
const errs=[];
page.on('pageerror', e=>errs.push(String(e).slice(0,200)));
page.on('console', m=>{ if(m.type()==='error') errs.push('c:'+m.text().slice(0,120)); });

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForTimeout(6000);
const r = await page.evaluate(() => ({
  strs: (self.__hswstrs||[]),
  wasm: typeof WebAssembly,
  inst: Object.keys(self).filter(k=>/hsw|aep|anF|_0x/i.test(k)).slice(0,20),
})).catch(e=>({err:String(e).slice(0,200)}));
writeFileSync('/tmp/opencode/hc/widget-strings.json', JSON.stringify(r.strs||[],null,0));
console.log('decoded:', (r.strs||[]).length);
const seen=new Set();
for (const [i,o] of (r.strs||[])){ if(o&&/[\x20-\x7e]{2,}/.test(o)&&!seen.has(o)){seen.add(o);console.log(`  [${i}] ${o.slice(0,100)}`);} }
console.log('errs:', errs.slice(0,4));
srv.close(); await b.close();
