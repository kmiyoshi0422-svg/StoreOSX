import puppeteer from '/tmp/estimate-pdf-qa/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import mysql from 'mysql2/promise';
import { sdk } from '../server/_core/sdk';
import { COOKIE_NAME } from '../shared/const';
import fs from 'node:fs';
const db=await mysql.createConnection(process.env.DATABASE_URL!);let browser:any;const folder='/tmp/assignee-roster-qa';fs.mkdirSync(folder,{recursive:true});
try {
 const [owners]:any=await db.query("SELECT openId,name FROM users WHERE role='owner' LIMIT 1");const owner=owners[0];const [rows]:any=await db.query('SELECT id FROM cases ORDER BY createdAt DESC LIMIT 1');const id=rows[0].id;
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',(e:any)=>errors.push(String(e)));await page.setViewport({width:1280,height:1000});await page.setCookie({name:COOKIE_NAME,value:await sdk.createSessionToken(owner.openId,{name:owner.name,expiresInMs:600000}),domain:'127.0.0.1',path:'/'});
 for(const [route,label] of [[`/cases/${id}`,'detail'],['/cases','list']]){
  await page.goto(`http://127.0.0.1:3000${route}`,{waitUntil:'networkidle0',timeout:60000});await page.waitForSelector('[aria-label="社内担当者を割り当てる"]');await page.click('[aria-label="社内担当者を割り当てる"]');await page.waitForSelector('[role="option"]');
  const options=await page.$$eval('[role="option"]',(els:any[])=>els.map(e=>({text:e.textContent,disabled:e.getAttribute('data-disabled')!==null})));
  const kihara=options.find((x:any)=>x.text.includes('木原'));if(!kihara||!kihara.disabled)throw new Error('Missing pending Kihara');if(options.some((x:any)=>x.text.includes('藤原')))throw new Error('Fujiwara leaked into selectable options');console.log(label,'OPTIONS_OK',kihara);
  await page.screenshot({path:folder+`/${label}-desktop.png`});await page.keyboard.press('Escape');await page.setViewport({width:390,height:844});await page.click('[aria-label="社内担当者を割り当てる"]');await page.screenshot({path:folder+`/${label}-mobile.png`});await page.keyboard.press('Escape');await page.setViewport({width:1280,height:1000});
 }
 if(errors.length)throw new Error(errors.join('\n'));console.log('READ_ONLY_BROWSER_OK',id,'ERRORS',errors);
}finally{if(browser)await browser.close();await db.end();}
