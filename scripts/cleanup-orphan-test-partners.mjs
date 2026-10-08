import mysql from 'mysql2/promise';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [beforeCases] = await db.query('SELECT id,requestNumber,status,progressStage,partnerId FROM cases ORDER BY id');
  const hash = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const beforeHash = hash(beforeCases);
  await db.beginTransaction();
  const [candidates] = await db.query("SELECT * FROM partners WHERE name REGEXP '^(履歴テスト[0-9]{13}|テスト(電気|給排水)[0-9]{13}[AB]?)$' FOR UPDATE");
  if (candidates.some(row => row.userId != null)) throw new Error('Test candidate linked to a real user');
  if (candidates.length) {
    const ids = candidates.map(row => row.id), marks = ids.map(()=>'?').join(',');
    const [columns] = await db.query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME IN ('partnerId','partner_id')");
    for (const col of columns) {
      const [[r]] = await db.query(`SELECT COUNT(*) n FROM \`${col.TABLE_NAME}\` WHERE \`${col.COLUMN_NAME}\` IN (${marks})`, ids);
      if (r.n) throw new Error(`Referenced by ${col.TABLE_NAME}: ${r.n}`);
    }
    fs.mkdirSync('/home/ubuntu/private-backups',{recursive:true,mode:0o700});
    const backup = `/home/ubuntu/private-backups/orphan-test-partners-${Date.now()}.json`;
    fs.writeFileSync(backup,JSON.stringify(candidates,null,2)+'\n',{mode:0o600});
    const [deleted] = await db.query(`DELETE FROM partners WHERE id IN (${marks}) AND name REGEXP '^(履歴テスト[0-9]{13}|テスト(電気|給排水)[0-9]{13}[AB]?)$'`,ids);
    if (deleted.affectedRows!==candidates.length) throw new Error('Deletion count mismatch');
    console.log('Deleted test partners',deleted.affectedRows,'Private backup',backup);
  } else console.log('No orphan test partners');
  const [afterCases] = await db.query('SELECT id,requestNumber,status,progressStage,partnerId FROM cases ORDER BY id');
  if(hash(afterCases)!==beforeHash)throw new Error('Real case state changed');
  await db.commit();
  const [[remaining]] = await db.query("SELECT COUNT(*) n FROM partners WHERE name LIKE '%テスト%'");
  const [[caseTests]] = await db.query("SELECT COUNT(*) n FROM cases WHERE requestNumber REGEXP '^(TEST|HIST|E2E|PDFTEST|SMOKE|AUTO)[-_]' OR storeName LIKE '%テスト%'");
  console.log('Verified cases',afterCases.length,'State hash unchanged',beforeHash,'Test partners remaining',remaining.n,'Test cases remaining',caseTests.n);
} catch (e) { await db.rollback(); console.error(e); process.exitCode=1; }
finally { await db.end(); }
