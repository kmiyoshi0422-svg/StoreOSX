import puppeteer from '/tmp/estimate-pdf-qa/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import mysql from 'mysql2/promise';
import { sdk } from '../server/_core/sdk';
import { COOKIE_NAME } from '../shared/const';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
const db=await mysql.createConnection(process.env.DATABASE_URL!);
const [owners]:any=await db.query("SELECT openId,name FROM users WHERE role='owner' LIMIT 1");
const [rows]:any=await db.query("SELECT c.id,c.requestNumber,COUNT(p.id) n FROM cases c JOIN photos p ON p.caseId=c.id WHERE c.status='完了' GROUP BY c.id HAVING COUNT(p.id) BETWEEN 3 AND 10 ORDER BY COUNT(p.id) ASC LIMIT 2");
if(rows.length!==2)throw new Error('Two completed real cases required');
await db.end();
const token=await sdk.createSessionToken(owners[0].openId,{name:owners[0].name,expiresInMs:600_000});
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();
await page.setViewport({width:1280,height:1000});await page.setCookie({name:COOKIE_NAME,value:token,domain:'127.0.0.1',path:'/'});
const folder='/tmp/storeosx-bulkfilter-qa';fs.mkdirSync(folder,{recursive:true});
const existingFiles=new Set(fs.readdirSync(folder));
const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:folder});
const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url().split('?')[0]}`);});
let saved=0;await page.setRequestInterception(true);page.on('request',async request=>{
 if(request.url().includes('reportBulk.saveGenerated')){saved++;await new Promise(r=>setTimeout(r,200));await request.respond({status:200,contentType:'application/json',body:'[{"result":{"data":{"json":{"id":-1,"alreadySaved":false}}}}]'});}
 else await request.continue();
});
async function clickText(text:string,scope='body'){
 const handle=await page.evaluateHandle((text,scope)=>Array.from(document.querySelectorAll<HTMLButtonElement>(`${scope} button`)).find(b=>b.textContent?.includes(text)),text,scope);
 const el=handle.asElement();if(!el)throw new Error(`Button missing ${text}`);await (el as any).click();await handle.dispose();
}
if(!process.env.VERIFY_FILTERS_ONLY){
await page.goto('http://127.0.0.1:3000/reports/completed',{waitUntil:'networkidle0',timeout:60000});
await page.waitForFunction(()=>document.body.innerText.includes('完了報告書を選択：'),{timeout:40000});
for(const row of rows){const el=await page.$(`[aria-label="${row.requestNumber}の完了報告書を選択"]`);if(!el)throw new Error('Completed row missing');await el.click();}
await page.screenshot({path:folder+'/completion-selection.png',fullPage:true});
await clickText('選択した完了報告書を一括PDF出力');
await page.waitForFunction(()=>document.body.innerText.includes('選択済み 2 /'),{timeout:40000});
await page.waitForFunction(()=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).some(b=>b.textContent?.includes('選択した報告書のPDFを作成') && !b.disabled),{timeout:40000});
console.log('HANDOFF',page.url(),'REAL_CASES',rows);
await clickText('選択した報告書のPDFを作成');
await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role="status"]')).some(el=>el.textContent?.includes('作成中…')),{timeout:10000});
console.log('LOADING',await page.evaluate(()=>Array.from(document.querySelectorAll('[role="status"]')).map(el=>el.textContent)));
await page.screenshot({path:folder+'/bulk-creating.png'});
try { await page.waitForSelector('[title="A4報告書PDFプレビュー"]',{timeout:180000}); }
catch(e) { console.log('TIMEOUT_STATE',await page.evaluate(()=>document.body.innerText),'ERRORS',errors); await page.screenshot({path:folder+'/failure.png'}); for(const frame of page.frames()){console.log('FRAME',frame.url(),await frame.evaluate(()=>document.body?.innerText.slice(0,1800)).catch(()=>''));}await browser.close();throw e; }
const originals:number[]=[];
for(let index=0;index<2;index++){
 if(index)await clickText('2. 施工完了報告書','[role="dialog"]');
 const bytes:number[]=await page.evaluate(async()=>{const iframe=document.querySelector<HTMLIFrameElement>('[title="A4報告書PDFプレビュー"]')!;return Array.from(new Uint8Array(await (await fetch(iframe.src)).arrayBuffer()));});
 const doc=await PDFDocument.load(Uint8Array.from(bytes));originals.push(doc.getPageCount());
 await clickText('この報告書を確認しました','[role="dialog"]');
}
await page.screenshot({path:folder+'/bulk-verified.png'});
await clickText('確認した報告書を1つのPDFでダウンロード','[role="dialog"]');
await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'),{timeout:60000});
await new Promise(r=>setTimeout(r,800));
const file=fs.readdirSync(folder).find(name=>name.endsWith('.pdf') && !existingFiles.has(name));
if(!file)throw new Error('Merged PDF not downloaded');
const merged=await PDFDocument.load(fs.readFileSync(folder+'/'+file));
if(merged.getPageCount()!==originals.reduce((a,b)=>a+b,0)||saved!==2)throw new Error('Page loss or unexpected history writes');
console.log('MERGED_PDF',file,'pages',merged.getPageCount(),'sourcePages',originals,'historyWritesMocked',saved);
}
await page.goto('http://127.0.0.1:3000/cases',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForSelector('#case-date-field');
await page.waitForFunction(()=>document.querySelector('[aria-label="対応日検索フィルター"]')?.textContent?.includes('/ 588件'),{timeout:60000});
await clickText('次の30件');await page.waitForFunction(()=>document.body.innerText.includes('31〜60件を表示'),{timeout:10000});console.log('PAGE_NEXT_OK',true);
await page.select('#case-date-field','surveyDate');await page.select('#case-date-mode','set');
console.log('FILTER_SET',await page.$eval('[aria-label="対応日検索フィルター"]',el=>el.textContent));
await page.select('#case-date-mode','unset');
console.log('FILTER_UNSET',await page.$eval('[aria-label="対応日検索フィルター"]',el=>el.textContent));
await page.select('#case-date-mode','all');
await page.evaluate(()=>{const input=document.getElementById('case-date-from') as HTMLInputElement;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;setter.call(input,'2026-10-10');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));const end=document.getElementById('case-date-to') as HTMLInputElement;setter.call(end,'2026-10-01');end.dispatchEvent(new Event('input',{bubbles:true}));end.dispatchEvent(new Event('change',{bubbles:true}));});
await page.waitForFunction(()=>document.body.innerText.includes('終了日は開始日以降'),{timeout:10000});
console.log('INVALID_RANGE_VISIBLE',true);await clickText('すべての検索条件を解除');
await page.click('[aria-label="ステータス検索"]');await page.waitForSelector('[role="option"]');
const lost=await page.evaluateHandle(()=>Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(el=>el.textContent==='失注'));await (lost.asElement() as any).click();
console.log('STATUS_LOST',await page.$eval('[aria-label="対応日検索フィルター"]',el=>el.textContent));await clickText('すべての検索条件を解除');
await page.setViewport({width:390,height:844});await page.$eval('[aria-label="対応日検索フィルター"]',el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:folder+'/filters-mobile.png'});
console.log('ERRORS',errors);if(errors.length)throw new Error('Browser errors');await browser.close();
