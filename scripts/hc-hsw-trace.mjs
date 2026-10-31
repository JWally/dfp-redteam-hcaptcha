#!/usr/bin/env node
/** hc-hsw-trace.mjs — load the REAL hsw.js, patch aIW() to capture every
 *  decoded string (WASM import names, signal fields). All local. */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
let sdk = readFileSync('/tmp/opencode/hc/assets/hsw.js', 'utf-8');

// patch aIW to log decoded results: original returns Oj[anr] or decodes. We wrap at the end.
// Insert logging after the decode: find the return of the decoded string. Simplest: patch the entry.
const from = 'function aIW(anr){';
const to   = 'function aIW(anr){var __r=(self.__hswstrs=self.__hswstrs||[]);';
if (sdk.includes(from)) sdk = sdk.replace(from, to);
// also patch the two returns to log: 'return Oj[anr]' -> log + return; and the final return
const r1 = 'if(void 0!==Oj[anr])return Oj[anr];';
const r1p = 'if(void 0!==Oj[anr]){var v0=Oj[anr];if((self.__hswstrs=self.__hswstrs||[]).length<5000)self.__hswstrs.push([anr,v0]);return v0;}';
if (sdk.includes(r1)) sdk = sdk.replace(r1, r1p);
// the tail: find the end of aIW - patch 'return baW' (accumulator). search for it near the aIW body end
console.log('patched entry');

const b = await chromium.launch({ headless:true });
const page = await b.newPage();
await page.route('**/*', async route => {
  const u = route.request().url();
  if (u.startsWith('data:') || u==='about:blank') return route.continue();
  await route.fulfill({ status:200, contentType:'application/json', body:'{}' });
});
await page.goto('about:blank');
await page.addScriptTag({ content: sdk });
await page.waitForTimeout(2500);
const r = await page.evaluate(() => ({
  hswstrs: (self.__hswstrs||[]).slice(0,200),
  hasWasm: typeof WebAssembly !== 'undefined',
  keys: Object.keys(self).filter(k=>/hsw|HC|_|aep|anF/i.test(k)).slice(0,20),
})).catch(e=>({err:String(e).slice(0,200)}));
writeFileSync('/tmp/opencode/hc/hsw-strings.json', JSON.stringify(r.hswstrs||[],null,0));
console.log('decoded strings:', (r.hswstrs||[]).length);
const printable=(r.hswstrs||[]).filter(([i,o])=>o&&/[\x20-\x7e]{2,}/.test(o));
const seen=new Set();
for (const [i,o] of printable){ if(seen.has(o))continue; seen.add(o); console.log(`  [${i}] ${o.slice(0,90)}`); }
console.log('\nerr:', r.err);
await b.close();
