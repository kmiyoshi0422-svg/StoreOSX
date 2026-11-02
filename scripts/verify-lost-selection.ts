import puppeteer from '/tmp/estimate-pdf-qa/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { sdk } from '../server/_core/sdk';
import { COOKIE_NAME } from '../shared/const';
import { deleteCase } from '../server/db';
const db = await mysql.createConnection(process.env.DATABASE_URL!);
const stamp = Date.now(), marker = `TEST-LOST-UI-${stamp}`, folder = '/tmp/lost-selection-qa';
fs.mkdirSync(folder, { recursive: true });
let cid = 0, browser: any;
const errors: string[] = [];
async function click(page: any, text: string, selector = 'button') {
  await page.bringToFront();
  const h = await page.evaluateHandle((text: string, selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector)).find(e => e.textContent?.trim() === text && !e.hasAttribute('disabled')), text, selector);
  const el = h.asElement(); if (!el) throw new Error(`Missing ${selector}: ${text}`); await el.click(); await h.dispose();
}
async function dialog(page: any) { await page.waitForSelector('[role="dialog"]', { visible: true }); await page.evaluate(() => Promise.all(Array.from(document.querySelectorAll('[role="dialog"]')).flatMap(el => el.getAnimations({ subtree: true })).map(a => a.finished.catch(() => undefined)))); }
async function state() { const [rows]: any = await db.query('SELECT status,progressStage,assigneeId,completedAt,constructionDate,lostReason,lostReasonDetail,preLostStatus FROM cases WHERE id=?', [cid]); return rows[0]; }
async function expectState(status: string) { const row = await state(); if (row.status !== status || row.progressStage !== '現調済' || row.assigneeId !== 1 || row.completedAt !== null || !row.constructionDate) throw new Error('Unexpected state: ' + JSON.stringify(row)); return row; }
try {
  const [real]: any = await db.query("SELECT * FROM cases WHERE requestNumber NOT LIKE 'TEST-%' AND requestNumber NOT LIKE 'HIST-%' ORDER BY id");
  fs.writeFileSync('/tmp/lost-select-real-baseline.json', JSON.stringify(real)); console.log('BASELINE', real.length, createHash('sha256').update(JSON.stringify(real)).digest('hex'));
  const [owners]: any = await db.query("SELECT openId,name FROM users WHERE id=1 AND role='owner'"); if (!owners.length) throw new Error('Owner unavailable');
  const [created]: any = await db.query("INSERT INTO cases(requestNumber,storeName,prefecture,status,progressStage,assigneeId,constructionDate,requestDate) VALUES(?,?,'福岡県','見積中','現調済',1,'2026-12-01 03:00:00','2026-11-01 03:00:00')", [marker, marker + '店舗']); cid = created.insertId;
  browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.createBrowserContext(), page = await context.newPage();
  page.on('pageerror', (e: any) => errors.push(String(e)));
  await page.setViewport({ width: 1280, height: 1000 });
  await page.setCookie({ name: COOKIE_NAME, value: await sdk.createSessionToken(owners[0].openId, { name: owners[0].name, expiresInMs: 600000 }), domain: '127.0.0.1', path: '/' });
  await page.goto(`http://127.0.0.1:3000/cases/${cid}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await click(page, '編集'); await click(page, '見積中', '[role="combobox"]'); await click(page, '失注', '[role="option"]'); await dialog(page);
  for (const [value, label] of [['高額なため', '① 高額なため'], ['対応に不備', '② 対応に不備（遅いなど）'], ['別業者手配', '③ 別業者手配'], ['その他', '④ その他']]) {
    await click(page, label, 'label'); await page.waitForFunction((value: string) => (document.querySelector('input[name="case-lost-reason"]:checked') as HTMLInputElement)?.value === value, {}, value);
  }
  const disabled = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(e => e.textContent?.trim() === '失注にする')?.disabled);
  if (!disabled) throw new Error('Other reason should be required');
  await page.setViewport({ width: 390, height: 844 }); await page.screenshot({ path: folder + '/lost-reason-mobile.png' });
  await click(page, 'キャンセル', '[role="dialog"] button'); await expectState('見積中'); console.log('ALL_FOUR_REASONS_SELECTABLE_OTHER_REQUIRED_CANCEL_SAFE');
  await click(page, '見積中', '[role="combobox"]'); await click(page, '失注', '[role="option"]'); await dialog(page); await click(page, '④ その他', 'label'); await page.type('#case-lost-detail', '再提出条件の確認');
  const markResponse = page.waitForResponse((r: any) => r.url().includes('dashboard.markCaseLost') && r.status() === 200); await click(page, '失注にする', '[role="dialog"] button'); await markResponse;
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  const marked = await expectState('失注'); if (marked.lostReason !== 'その他' || marked.lostReasonDetail !== '再提出条件の確認' || marked.preLostStatus !== '見積中') throw new Error('Reason missing');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(e => e.textContent?.trim() === '失注前の状態へ復活'));
  await click(page, '失注前の状態へ復活'); await dialog(page); await click(page, 'キャンセル', '[role="dialog"] button'); await expectState('失注');
  await click(page, '失注前の状態へ復活'); await dialog(page); const reviveResponse = page.waitForResponse((r: any) => r.url().includes('dashboard.reviveLostCase') && r.status() === 200); await click(page, '復活する', '[role="dialog"] button'); await reviveResponse; await page.waitForFunction(() => !document.querySelector('[role="dialog"]')); await expectState('見積中'); console.log('DETAIL_LOST_REASON_SAVED_REVIVE_CANCEL_SAFE_STATUS_STAGE_DATES_ASSIGNEE_PRESERVED');
  for (const mode of ['card', 'compact', 'table']) {
    await page.setViewport({ width: 1280, height: 1000 }); await page.evaluate((mode: string) => localStorage.setItem('cases-view-mode', mode), mode);
    await page.goto('http://127.0.0.1:3000/cases', { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('input[placeholder*="店舗名"]'); await page.type('input[placeholder*="店舗名"]', marker);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="combobox"]')).filter(e => e.textContent?.trim() === '見積中').length === 1);
    await click(page, '見積中', '[role="combobox"]'); await click(page, '失注', '[role="option"]'); await dialog(page); await click(page, '② 対応に不備（遅いなど）', 'label');
    const response = page.waitForResponse((r: any) => r.url().includes('dashboard.markCaseLost') && r.status() === 200); await click(page, '失注にする', '[role="dialog"] button'); await response; await page.waitForFunction(() => !document.querySelector('[role="dialog"]')); await expectState('失注');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="combobox"]')).some(e => e.textContent?.trim() === '失注'));
    await click(page, '失注', '[role="combobox"]'); await click(page, '失注前の状態へ復活', '[role="option"]'); await dialog(page);
    const rr = page.waitForResponse((r: any) => r.url().includes('dashboard.reviveLostCase') && r.status() === 200); await click(page, '復活する', '[role="dialog"] button'); await rr; await page.waitForFunction(() => !document.querySelector('[role="dialog"]')); await expectState('見積中'); console.log('LIST_MODE', mode, 'LOST_REVIVE_OK');
  }
  if (errors.length) throw new Error(errors.join('\n')); console.log('PAGE_ERRORS', errors);
} catch (error) {
  if (browser) for (const [i, page] of (await browser.pages()).entries()) try { await page.screenshot({ path: folder + `/failure-${i}.png` }); console.log('FAILURE', i, (await page.$eval('body', (el: any) => el.innerText)).slice(-1400)); } catch {}
  throw error;
} finally {
  if (browser) await browser.close(); if (cid) await deleteCase(cid); await db.end(); console.log('FIXTURE_CLEANED', cid); setTimeout(() => process.exit(process.exitCode ?? 0), 100);
}
