import puppeteer from '/tmp/estimate-pdf-qa/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import mysql from 'mysql2/promise';
import { sdk } from '../server/_core/sdk';
import { COOKIE_NAME } from '../shared/const';
import fs from 'node:fs';
const db = await mysql.createConnection(process.env.DATABASE_URL!);
const [rows]: any = await db.query(process.env.REPRO_PARTNER ? "SELECT openId,name FROM users WHERE role='partner' AND areaAccessMode='selected' AND allowedPrefectures LIKE '%神奈川県%' LIMIT 1" : "SELECT openId,name FROM users WHERE role='owner' LIMIT 1");
await db.end();
const token = await sdk.createSessionToken(rows[0].openId, { name: rows[0].name, expiresInMs: 600_000 });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport(process.env.REPRO_MOBILE ? { width:390,height:844 } : { width:1280,height:950 });
await page.setCookie({name:COOKIE_NAME,value:token,domain:'127.0.0.1',path:'/'});
fs.mkdirSync('/tmp/report-export-downloads',{recursive:true});
const cdp = await page.createCDPSession();
await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:'/tmp/report-export-downloads'});
await page.setRequestInterception(true);
page.on('request',request=>{
 if(request.url().includes('pdfHistory.upload')) request.respond({status:200,contentType:'application/json',body:'[{"result":{"data":{"json":{"id":-1}}}}]'});
 else request.continue();
});
const errors: string[] = [];
page.on('console', msg => {if(msg.type()==='error')errors.push(msg.text());});
page.on('pageerror', e => errors.push(String(e)));
page.on('response', r => {if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url().split('?')[0]}`)});
for (const report of ['survey','completion']) {
 errors.length=0;
 await page.goto(`http://127.0.0.1:3000/cases/${process.env.REPRO_CASE_ID || '18810001'}/${report}-report`,{waitUntil:'networkidle0',timeout:60_000});
 await page.waitForSelector('[data-a4-layout-preview-trigger]',{timeout:40_000});
 console.log('BEFORE',report, await page.evaluate(()=>({pages:document.querySelectorAll('.report-page').length,images:document.querySelectorAll('.report-container img').length})));
 const output = await page.evaluateHandle(() => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(x=>x.textContent==='PDF出力') ?? document.querySelector('[data-a4-layout-preview-trigger]'));
 await (output.asElement() as any).click();
 try { await page.waitForFunction(()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).some(b=>b.textContent?.includes('PDFダウンロード') && !b.disabled),{timeout:80_000}); }catch(e){errors.push('PREVIEW_TIMEOUT')}
 await page.screenshot({path:`/tmp/report-${report}-${process.env.REPRO_MOBILE ? 'mobile' : 'desktop'}-repro.png`});
 console.log('AFTER',report,await page.evaluate(()=>({text:document.querySelector('[role="dialog"]')?.textContent,buttons:Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).map(x=>({text:x.textContent,disabled:x.disabled})),images:document.querySelectorAll('[role="dialog"] img').length})), 'ERRORS',errors);
 if(process.env.REPRO_DOWNLOAD){
  const handle = await page.evaluateHandle(()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(x=>x.textContent?.includes('PDFダウンロード')));
  const btn = handle.asElement()!;
  const bounds = await btn.boundingBox();
  console.log('BUTTON_IN_VIEW',report,bounds);
  if(!bounds || bounds.x<0 || bounds.x+bounds.width>(process.env.REPRO_MOBILE?390:1280)) throw new Error('PDF download button outside viewport');
  await (btn as any).click();
  await new Promise(r=>setTimeout(r,2500));
  console.log('DOWNLOADS',fs.readdirSync('/tmp/report-export-downloads'), 'TOASTS', await page.evaluate(()=>Array.from(document.querySelectorAll('[data-sonner-toast]')).map(x=>x.textContent)));
 }
}
await browser.close();
