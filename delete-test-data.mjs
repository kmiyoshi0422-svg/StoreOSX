import mysql from 'mysql2/promise';

async function run() {
  const url = process.env.DATABASE_URL;
  const conn = await mysql.createConnection(url);
  
  // Delete test cases (related data first due to FK constraints)
  // Check for related tables
  const [tables] = await conn.execute("SHOW TABLES");
  console.log('Tables:', tables.map(t => Object.values(t)[0]));
  
  // Get test case IDs
  const [testCases] = await conn.execute("SELECT id FROM cases WHERE storeName LIKE '%テスト%' OR storeName LIKE '%履歴テスト%'");
  const caseIds = testCases.map(c => c.id);
  console.log('Test case IDs to delete:', caseIds.length);
  
  if (caseIds.length > 0) {
    const idList = caseIds.join(',');
    // Delete related data first
    try { await conn.execute(`DELETE FROM photos WHERE caseId IN (${idList})`); console.log('Deleted photos'); } catch(e) { console.log('photos skip:', e.message); }
    try { await conn.execute(`DELETE FROM check_items WHERE caseId IN (${idList})`); console.log('Deleted check_items'); } catch(e) { console.log('check_items skip:', e.message); }
    try { await conn.execute(`DELETE FROM estimates WHERE caseId IN (${idList})`); console.log('Deleted estimates'); } catch(e) { console.log('estimates skip:', e.message); }
    try { await conn.execute(`DELETE FROM case_schedules WHERE caseId IN (${idList})`); console.log('Deleted case_schedules'); } catch(e) { console.log('case_schedules skip:', e.message); }
    try { await conn.execute(`DELETE FROM expenses WHERE caseId IN (${idList})`); console.log('Deleted expenses'); } catch(e) { console.log('expenses skip:', e.message); }
    try { await conn.execute(`DELETE FROM case_history WHERE caseId IN (${idList})`); console.log('Deleted case_history'); } catch(e) { console.log('case_history skip:', e.message); }
    // Delete cases
    const [result] = await conn.execute(`DELETE FROM cases WHERE id IN (${idList})`);
    console.log('Deleted cases:', result.affectedRows);
  }
  
  // Delete test partners
  const [testPartners] = await conn.execute("SELECT id FROM partners WHERE name LIKE '%テスト%' OR name LIKE '%履歴テスト%'");
  const partnerIds = testPartners.map(p => p.id);
  console.log('Test partner IDs to delete:', partnerIds.length);
  
  if (partnerIds.length > 0) {
    const idList = partnerIds.join(',');
    try { await conn.execute(`DELETE FROM partner_history WHERE partnerId IN (${idList})`); console.log('Deleted partner_history'); } catch(e) { console.log('partner_history skip:', e.message); }
    const [result] = await conn.execute(`DELETE FROM partners WHERE id IN (${idList})`);
    console.log('Deleted partners:', result.affectedRows);
  }
  
  await conn.end();
  console.log('Done!');
}
run().catch(e => console.error('Error:', e.message));
