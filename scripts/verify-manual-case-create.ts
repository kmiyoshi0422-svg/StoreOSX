import puppeteer from '/tmp/estimate-pdf-qa/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import mysql from 'mysql2/promise';
import { sdk } from '../server/_core/sdk';
import { COOKIE_NAME } from '../shared/const';
import { deleteCase } from '../server/db';
import fs from 'node:fs';
const db=await mysql.createConnection(process.env.DATABASE_URL!);
const prefix=`TEST-MANUAL-CREATE-${Date.now()}`;
const folder='/home/ubuntu/security-audit-storeosx/manual-create';fs.mkdirSync(folder,{recursive:true});
let browser:any;
try {
 const [accounts]:any=await db.query("SELECT id,openId,name,role,areaAccessMode,allowedPrefectures FROM users WHERE role IN ('owner','user') ORDER BY FIELD(role,'owner','user'),id");
 const selected=[accounts.find((x:any)=>x.role==='owner'),accounts.find((x:any)=>x.role==='user')].filter(Boolean);
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const [index,u] of selected.entries()){
  const context=await browser.createBrowserContext();const page=await context.newPage();const errors:string[]=[];page.on('pageerror',(e:any)=>errors.push(String(e)));
  await page.setViewport({width:index===0?1280:390,height:900});
  await page.setCookie({name:COOKIE_NAME,value:await sdk.createSessionToken(u.openId,{name:u.name,expiresInMs:600000}),domain:'127.0.0.1',path:'/'});
  await page.goto('http://127.0.0.1:3000/cases/new',{waitUntil:'networkidle0',timeout:60000});
  await page.waitForSelector('input[placeholder="例: 284909-1"]');
  const number=`${prefix}-${u.role}`;
  await page.type('input[placeholder="例: 284909-1"]',number);
  await page.type('input[placeholder="例: ほっともっと八女井延店"]',`TEST手入力検証店舗-${u.role}`);
  let prefs=u.allowedPrefectures;if(typeof prefs==='string'){try{prefs=JSON.parse(prefs);}catch{prefs=[];}}
  const prefecture=u.areaAccessMode==='selected'&&Array.isArray(prefs)&&prefs.length?prefs[0]:'福岡県';
  await page.type('input[placeholder="例: 山口県下関市古ヶ峠1-10"]',`${prefecture}テスト住所`);
  await page.screenshot({path:`${folder}/${u.role}-before.png`,fullPage:true});
  const response=page.waitForResponse((r:any)=>r.url().includes('/api/trpc/cases.create')&&r.request().method()==='POST',{timeout:60000});
  const button=await page.evaluateHandle(()=>Array.from(document.querySelectorAll('button')).find(x=>x.textContent?.trim()==='登録'));
  await (button as any).click();
  const r=await response;console.log('CREATE_RESPONSE',u.role,r.status(),(await r.text()).slice(0,1200));
  await page.waitForFunction(()=>/^\/cases\/\d+$/.test(location.pathname),{timeout:30000});
  console.log('CREATE_NAVIGATED',u.role,new URL(page.url()).pathname,'PAGE_ERRORS',errors);
  await page.screenshot({path:`${folder}/${u.role}-saved.png`,fullPage:false});
  const [saved]:any=await db.query('SELECT id,requestNumber,status,prefecture FROM cases WHERE requestNumber=?',[number]);
  if(saved.length!==1)throw new Error('Expected one synthetic case');console.log('SAVED',JSON.stringify(saved[0]));
  await context.close();
 }
 console.log('MANUAL_CREATE_BROWSER_OK');
} catch(e){console.error(e);process.exitCode=1;}
finally {
 if(browser)await browser.close();
 const [rows]:any=await db.query('SELECT id,requestNumber FROM cases WHERE requestNumber LIKE ?',[prefix+'%']);
 for(const x of rows){if(!x.requestNumber.startsWith(prefix))throw new Error('Unsafe cleanup');await deleteCase(x.id);}
 console.log('CLEANED_OWN_SYNTHETIC_CASES',rows.length);await db.end();
 setTimeout(()=>process.exit(process.exitCode??0),100);
}
