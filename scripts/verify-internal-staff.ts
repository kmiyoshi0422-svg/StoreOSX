import puppeteer from '/tmp/estimate-pdf-qa/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import mysql from 'mysql2/promise';
import { sdk } from '../server/_core/sdk';
import { COOKIE_NAME } from '../shared/const';
import { appRouter } from '../server/routers';
import fs from 'node:fs';
const db=await mysql.createConnection(process.env.DATABASE_URL!);let browser:any;const folder='/tmp/internal-staff-qa';fs.mkdirSync(folder,{recursive:true});
try {
 const [owners]:any=await db.query("SELECT * FROM users WHERE role='owner' LIMIT 1");const owner=owners[0];const errors:string[]=[];
 const caller=appRouter.createCaller({user:owner,req:{protocol:'https',headers:{}} as any,res:{} as any});const summary=await caller.internalStaff.summary();const target=summary.rows.find(x=>!x.legacy&&x.active>0);if(!target)throw new Error('No active assigned staff');
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 async function pageFor(who:any){const p=await browser.newPage();p.on('pageerror',(e:any)=>errors.push(String(e)));await p.setViewport({width:1280,height:1000});await p.setCookie({name:COOKIE_NAME,value:await sdk.createSessionToken(who.openId,{name:who.name,expiresInMs:600000}),domain:'127.0.0.1',path:'/'});await p.goto('http://127.0.0.1:3000/internal-staff',{waitUntil:'networkidle0',timeout:60000});return p;}
 const page=await pageFor(owner);await page.waitForSelector('[data-staff-key]');
 for(const person of summary.rows){const text=await page.$eval(`[data-staff-key="${person.key}"]`,(e:any)=>e.textContent);if(!text.includes(person.name)||!text.includes(`${person.active}件`))throw new Error('Count mismatch '+person.key);}
 console.log('VISIBLE_COUNTS_MATCH',summary.rows.length,'UNASSIGNED',summary.unassignedActive);
 await page.screenshot({path:folder+'/staff-desktop.png'});
 const button=await page.evaluateHandle((key:string)=>document.querySelector(`[data-staff-key="${key}"] button`),target.key);await button.asElement()!.click();await page.waitForSelector('[role="dialog"]');await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent?.includes('件（許可エリア内の作業担当）'));
 const content=await page.$eval('[role="dialog"]',(e:any)=>e.textContent);if(!content.includes(`${target.active}件`))throw new Error('Details count mismatch');const links=await page.$$eval('[role="dialog"] a[href^="/cases/"]',(els:any[])=>els.map(x=>x.getAttribute('href')));if(links.length!==Math.min(30,target.active))throw new Error('Details rows mismatch');console.log('DETAILS_MATCH',target.key,target.active,links.length);await page.screenshot({path:folder+'/staff-details.png'});await page.keyboard.press('Escape');
 await page.type('[aria-label="担当者名で検索"]','木原');await page.waitForFunction(()=>document.querySelectorAll('[data-staff-key]').length===1);if(!await page.$eval('[data-staff-key]',(e:any)=>e.textContent.includes('初回ログイン待ち')))throw new Error('Pending Kihara missing');await page.setViewport({width:390,height:844});await page.screenshot({path:folder+'/staff-mobile.png',fullPage:true});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw new Error('Mobile overflow');console.log('SEARCH_MOBILE_OK');
 const [partners]:any=await db.query("SELECT openId,name FROM users WHERE role='partner' LIMIT 1");if(partners[0]){const p=await pageFor(partners[0]);await p.waitForFunction(()=>document.body.textContent?.includes('社員以上のみ閲覧できます。'));if(await p.$('[data-staff-key]'))throw new Error('Staff info leaked');console.log('PARTNER_PAGE_DENIED');}
 if(errors.length)throw new Error(errors.join('\n'));console.log('READ_ONLY_QA_OK',errors);
}finally{if(browser)await browser.close();await db.end();}
