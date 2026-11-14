import puppeteer from '/tmp/estimate-pdf-qa/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import superjson from 'superjson';
import { sdk } from '../server/_core/sdk';
import { COOKIE_NAME } from '../shared/const';
const db=await mysql.createConnection(process.env.DATABASE_URL!);
const dir='/tmp/responsibility-roster-qa';fs.mkdirSync(dir,{recursive:true});
let browser:any;const errors:string[]=[];let saves=0;
// UI state is simulated; real DB save/rollback is covered in responsibilityRoster.test.ts.
// Never replace the live company's responsibility configuration during browser QA.
const candidates=Array.from({length:6},(_,i)=>({id:9901000+i,name:`合成責任者${i+1}`,email:`roster-${i}@example.test`,role:'user'}));
let management:any={version:0,current:candidates.slice(0,5).map((person,i)=>({key:`qa_${i}`,name:person.name,userId:person.id,userIds:[person.id],eligible:true})),candidates,archived:[],history:[]};
async function click(page:any,text:string,selector='button') {await page.bringToFront();const h=await page.evaluateHandle((t:string,s:string)=>Array.from(document.querySelectorAll<HTMLElement>(s)).find(e=>e.textContent?.trim()===t&&!e.hasAttribute('disabled')),text,selector);const el=h.asElement();if(!el)throw new Error('Missing '+text);await el.evaluate((e:any)=>e.scrollIntoView({block:'center'}));await el.click();await h.dispose();}
async function waitAnimations(page:any){await page.evaluate(()=>Promise.all(Array.from(document.querySelectorAll('[role="dialog"]')).flatMap(el=>el.getAnimations({subtree:true})).map(a=>a.finished.catch(()=>undefined))));}
try {
 const [people]:any=await db.query("SELECT * FROM users WHERE disabled_at IS NULL AND role IN ('owner','admin','user')");const owner=people.find((p:any)=>p.role==='owner');const staff=people.find((p:any)=>p.role!=='owner');if(!owner||!staff)throw new Error('Missing authenticated users');
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 async function pageFor(user:any,mock=false){const context=await browser.createBrowserContext();const page=await context.newPage();page.on('pageerror',(e:any)=>errors.push(String(e)));await page.setViewport({width:1280,height:1000});await page.setCookie({name:COOKIE_NAME,value:await sdk.createSessionToken(user.openId,{name:user.name,expiresInMs:600000}),domain:'127.0.0.1',path:'/'});
 if(mock){await page.setRequestInterception(true);page.on('request',async(req:any)=>{try{const u=new URL(req.url());const name=u.pathname.split('/api/trpc/')[1];let result:any;
 if(name==='responsibility.rosterManagement')result=management;
 else if(name==='responsibility.directory')result=[...management.current.map((m:any)=>({key:m.key,name:m.name,active:true,eligible:true})),...management.archived.map((m:any)=>({key:m.key,name:m.name,active:false,eligible:false}))];
 else if(name==='responsibility.replaceRoster'){
   const body=JSON.parse(req.postData()??'{}');const input=superjson.deserialize(body['0']??body);if((input as any).expectedVersion!==management.version)throw new Error('Unexpected confirmation version');
   const data=input as any;if(data.members[0]!==candidates[5].id||data.reason!=='合成の体制入替を確認')throw new Error('Frozen payload differs');
   const before=structuredClone(management);const after=data.members.map((id:number)=>{const p=candidates.find(p=>p.id===id)!;return management.current.find((m:any)=>m.userId===id)??{key:`qa_new_${id}`,name:p.name,userId:id,userIds:[id],eligible:true};});
   management={...management,version:management.version+1,current:after,archived:before.current.filter((m:any)=>!data.members.includes(m.userId)),history:[{id:1,beforeJson:JSON.stringify(before),afterJson:JSON.stringify({current:after}),reason:data.reason,changedByName:'合成確認',changedAt:new Date()}]};saves++;result={success:true,version:management.version};
 }
 if(result!==undefined){await req.respond({status:200,contentType:'application/json',body:JSON.stringify(u.searchParams.has('batch')?[{result:{data:superjson.serialize(result)}}]:{result:{data:superjson.serialize(result)}})});return;}await req.continue();}catch(e){errors.push(String(e));await req.abort();}});}
 await page.goto('http://127.0.0.1:3000/settings/responsibility',{waitUntil:'networkidle0',timeout:60000});return page;}
 const denied=await pageFor(staff);await denied.waitForFunction(()=>document.body.innerText.includes('アクセスできません'));if(await denied.evaluate(()=>Array.from(document.querySelectorAll('a')).some(a=>a.textContent?.trim()==='案件責任者の入替')))throw new Error('Nonowner menu leak');console.log('NONOWNER_ROUTE_MENU_DENIED');await denied.close();
 const page=await pageFor(owner,true);await page.waitForSelector('#responsibility-member-0',{visible:true});await page.screenshot({path:dir+'/roster-desktop.png'});
 await page.click('#responsibility-member-0');await click(page,`${candidates[5].name}（${candidates[5].email}）`,'[role="option"]');await page.click('#responsibility-reason');await page.type('#responsibility-reason','合成の体制入替を確認');await click(page,'内容を確認');await page.waitForSelector('[role="dialog"]',{visible:true});await waitAnimations(page);await page.setViewport({width:390,height:844});await page.screenshot({path:dir+'/roster-confirm-mobile.png'});await click(page,'入力に戻る','[role="dialog"] button');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));if(saves!==0||management.version!==0)throw new Error('Cancel saved changes');console.log('CONFIRM_CANCEL_SAFE');
 await click(page,'内容を確認');await page.waitForSelector('[role="dialog"][data-state="open"]',{visible:true});await waitAnimations(page);await click(page,'5名の入替を確定する','[role="dialog"] button');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));await page.waitForFunction(()=>document.body.innerText.includes('合成責任者6')&&document.body.innerText.includes('合成確認'));if(saves!==1)throw new Error('Duplicate save');await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.includes('更新中')));if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw new Error('Mobile overflow');await page.screenshot({path:dir+'/roster-mobile.png'});console.log('SIMULATED_SAVE_FROZEN_PAYLOAD_HISTORY_AND_MOBILE_PASSED');
 await page.goto('http://127.0.0.1:3000/cases/new',{waitUntil:'networkidle0',timeout:60000});await page.waitForSelector('[aria-label="登録時の案件責任者"]',{visible:true});const h=await page.evaluateHandle(()=>document.querySelector('[aria-label="登録時の案件責任者"]'));const el=h.asElement();if(!el)throw new Error('New-case responsibility selector missing');await el.evaluate((e:any)=>e.scrollIntoView({block:'center'}));await el.click();await page.waitForSelector('[role="option"]');const options=await page.$$eval('[role="option"]',(els:any[])=>els.map(e=>e.textContent));if(!options.includes('合成責任者6')||options.includes('合成責任者1'))throw new Error('New roster not propagated');console.log('NEW_CASE_DYNAMIC_ROSTER_AND_ARCHIVE_EXCLUSION_PASSED');
 if(errors.length)throw new Error(errors.join('\n'));console.log('ALL_UI_CHECKS_PASSED_REAL_ROSTER_NOT_MODIFIED');
} catch(error){if(browser)for(const[i,page]of(await browser.pages()).entries())try{await page.screenshot({path:dir+`/failure-${i}.png`});console.log('FAIL_BODY',(await page.$eval('body',(e:any)=>e.innerText)).slice(-2200));}catch{}throw error;}
finally {if(browser)await browser.close();await db.end();setTimeout(()=>process.exit(process.exitCode??0),100);}
