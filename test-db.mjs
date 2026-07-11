import mysql from 'mysql2/promise';

async function test() {
  const url = process.env.DATABASE_URL;
  console.log('URL exists:', !!url);
  if (!url) {
    console.log('No DATABASE_URL set');
    return;
  }
  console.log('URL prefix:', url.substring(0, 40));
  try {
    const conn = await mysql.createConnection(url);
    const [cols] = await conn.execute('SHOW COLUMNS FROM cases');
    console.log('Cases columns:', cols.map(c => c.Field));
    const [rows] = await conn.execute('SELECT * FROM cases LIMIT 5');
    console.log('Cases:', JSON.stringify(rows, null, 2));
    const [pcols] = await conn.execute('SHOW COLUMNS FROM partners');
    console.log('Partners columns:', pcols.map(c => c.Field));
    const [partners] = await conn.execute('SELECT * FROM partners LIMIT 5');
    console.log('Partners:', JSON.stringify(partners, null, 2));
    await conn.end();
  } catch (e) {
    console.error('DB Error:', e.message);
  }
}
test();
