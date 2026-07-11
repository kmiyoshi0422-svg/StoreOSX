import mysql from 'mysql2/promise';

async function test() {
  const url = process.env.DATABASE_URL;
  const conn = await mysql.createConnection(url);
  
  // テスト案件を検索
  const [testCases] = await conn.execute("SELECT id, storeName, requestNumber FROM cases WHERE storeName LIKE '%テスト%' OR requestNumber LIKE '%テスト%' OR requestContent LIKE '%テスト%'");
  console.log('Test cases:', JSON.stringify(testCases, null, 2));
  
  // テスト協力会社を検索
  const [testPartners] = await conn.execute("SELECT id, name FROM partners WHERE name LIKE '%テスト%'");
  console.log('Test partners:', JSON.stringify(testPartners, null, 2));
  
  await conn.end();
}
test();
