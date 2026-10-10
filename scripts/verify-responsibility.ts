import puppeteer from '/tmp/estimate-pdf-qa/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import mysql from 'mysql2/promise';
import {sdk} from '../server/_core/sdk';
import {COOKIE_NAME} from '../shared/const';
import {deleteCase} from '../server/db';
import fs from 'node:fs';
const db=await mysql.createConnection(process.env.DATABASE_URL!);
const [accounts]:any=await db.query('SELECT u.id,u.openId,u.name,u.role,a.officer_key FROM users u LEFT JOIN responsible_officer_accounts a ON a.user_id=u.id');
const owner=accounts.find((x:any)=>x.role==='owner');const other=accounts.find((x:any)=>x.role==='admin'&&!x.officer_key);
const [partners]:any=await db.query("SELECT u.id,u.openId,u.name,u.role FROM users u JOIN partners p ON p.userId=u.id JOIN cases c ON c.partnerId=p.id WHERE u.role='partner' GROUP BY u.id LIMIT 1");
const suffix=Date.now().toString();const [insert]:any=await db.query('INSERT INTO cases (requestNumber,storeName,prefecture,requestDate,createdAt,assigneeId) VALUES (?,?,?,?,?,?)',[`TEST-RESPONSIBILITY-BROWSER-${suffix}`,'責任者ブラウザ検証店','山口県',new Date('2026-10-01T00:00:00+09:00'),new Date(Date.now()-5*24*60*60*1000-60_000),owner.id]);
const fixtureId=insert.insertId;const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let testUserId=0,testPartnerId=0,testPartnerCaseId=0;
if(!partners[0]){
  const [userResult]:any=await db.query("INSERT INTO users (openId,name,email,role) VALUES (?,?,?,'partner')",[`responsibility-browser-partner-${suffix}`,'責任者検証協力業者',`responsibility-browser-${suffix}@example.test`]);testUserId=userResult.insertId;
  const [partnerResult]:any=await db.query('INSERT INTO partners (name,userId) VALUES (?,?)',[`TEST-RESPONSIBILITY-BROWSER-PARTNER-${suffix}`,testUserId]);testPartnerId=partnerResult.insertId;
  const [caseResult]:any=await db.query('INSERT INTO cases (requestNumber,storeName,prefecture,partnerId,requestContent) VALUES (?,?,?,?,?)',[`TEST-RESPONSIBILITY-BROWSER-PARTNER-CASE-${suffix}`,'協力業者本人担当検証店','山口県',testPartnerId,'配線修理 見積120000円']);testPartnerCaseId=caseResult.insertId;
  partners.push({id:testUserId,openId:`responsibility-browser-partner-${suffix}`,name:'責任者検証協力業者',role:'partner'});
}
const folder='/tmp/storeosx-responsibility-qa';fs.mkdirSync(folder,{recursive:true});
try{
 async function pageFor(user:any){const page=await browser.newPage();await page.setViewport({width:1280,height:1000});const token=await sdk.createSessionToken(user.openId,{name:user.name,expiresInMs:600000});await page.setCookie({name:COOKIE_NAME,value:token,domain:'127.0.0.1',path:'/'});return page;}
 const page=await pageFor(owner);const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle0',timeout:60000});await page.waitForSelector('[aria-label="案件責任者未決定アラート"]',{timeout:40000});console.log('OWNER_ALERT',await page.$eval('[aria-label="案件責任者未決定アラート"]',el=>el.textContent?.slice(0,220)));await page.screenshot({path:folder+'/owner-alert.png'});
 await page.goto(`http://127.0.0.1:3000/cases/${fixtureId}`,{waitUntil:'networkidle0',timeout:60000});await page.waitForSelector('[aria-label="案件責任者を選択"]');await page.click('[aria-label="案件責任者を選択"]');await page.waitForSelector('[role="option"]');console.log('OPTIONS',await page.$$eval('[role="option"]',els=>els.map(x=>x.textContent)));
 const selection=await page.evaluateHandle(()=>Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(el=>el.textContent?.includes('三好 慶'))!);await (selection.asElement() as any).click();await page.waitForFunction(()=>document.body.innerText.includes('案件責任者を決定しました'),{timeout:20000});
 const [after]:any=await db.query('SELECT responsible_officer,assigneeId,status FROM cases WHERE id=?',[fixtureId]);if(after[0].responsible_officer!=='miyoshi'||after[0].assigneeId!==owner.id||after[0].status!=='受付')throw new Error('Responsibility write changed other fields');console.log('FIXTURE_UI_SAVED',after[0]);await page.screenshot({path:folder+'/detail-responsibility.png'});
 await page.goto('http://127.0.0.1:3000/my-cases',{waitUntil:'networkidle0',timeout:60000});await page.waitForFunction(()=>document.body.innerText.includes('責任者ブラウザ検証店'),{timeout:30000});console.log('PERSONAL_FIXTURE_VISIBLE',true);await page.setViewport({width:390,height:844});await page.screenshot({path:folder+'/personal-mobile.png',fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);console.log('MOBILE_OVERFLOW',overflow);if(overflow)throw new Error('Mobile overflow');
 await page.goto('http://127.0.0.1:3000/cases',{waitUntil:'networkidle0',timeout:60000});await page.waitForSelector('[aria-label="案件責任者を選択"]');await page.screenshot({path:folder+'/card-mobile.png'});
 const card=await page.$('[aria-label="案件責任者を選択"]');await card!.evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:folder+'/card-responsibility-mobile.png'});const cardOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);console.log('CARD_MOBILE_OVERFLOW',cardOverflow);if(cardOverflow)throw new Error('Card mobile overflow');
 if(other){const otherPage=await pageFor(other);await otherPage.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle0',timeout:60000});if(await otherPage.$('[aria-label="案件責任者未決定アラート"]'))throw new Error('Other admin sees alert');console.log('OTHER_ADMIN_ALERT_HIDDEN',true);await otherPage.close();}
 if(partners[0]){const partnerPage=await pageFor(partners[0]);await partnerPage.goto('http://127.0.0.1:3000/my-cases',{waitUntil:'networkidle0',timeout:60000});await partnerPage.waitForSelector('[aria-label="担当案件一覧"]');const txt=await partnerPage.$eval('main',el=>el.textContent??'');if(txt.includes('責任者ブラウザ検証店'))throw new Error('Partner sees unrelated personal case');console.log('PARTNER_PERSONAL_READY',true);await partnerPage.screenshot({path:folder+'/partner-personal.png'});await partnerPage.close();}
 if(errors.length)throw new Error(errors.join('\n'));console.log('BROWSER_ERRORS',errors);
}finally{await browser.close();await deleteCase(fixtureId);if(testPartnerCaseId)await deleteCase(testPartnerCaseId);if(testPartnerId)await db.query('DELETE FROM partners WHERE id=? AND name=?',[testPartnerId,`TEST-RESPONSIBILITY-BROWSER-PARTNER-${suffix}`]);if(testUserId)await db.query('DELETE FROM users WHERE id=? AND openId=?',[testUserId,`responsibility-browser-partner-${suffix}`]);await db.end();console.log('FIXTURE_REMOVED',fixtureId,testPartnerCaseId,testPartnerId,testUserId);}
