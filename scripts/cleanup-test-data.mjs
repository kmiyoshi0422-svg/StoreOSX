// テスト実行で生成された TEST-/HIST-/AUTO- プレフィックスの案件と関連レコードを削除する
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

try {
  // 対象案件IDを取得（requestNumber がテストプレフィックス、または storeName にテスト文字を含む）
  const [rows] = await conn.query(
    "SELECT id, requestNumber, storeName FROM cases WHERE requestNumber LIKE 'TEST-%' OR requestNumber LIKE 'HIST-%' OR requestNumber LIKE 'AUTO-%' OR storeName LIKE '%テスト%'"
  );
  const ids = rows.map((r) => r.id);
  console.log("Target cases:", rows.map((r) => `${r.id}:${r.requestNumber}`).join(" | "));
  console.log("count:", ids.length);

  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    for (const table of ["photos", "estimates", "expenses", "route_assignments"]) {
      const [res] = await conn.query(
        `DELETE FROM ${table} WHERE caseId IN (${placeholders})`,
        ids
      );
      console.log(`Deleted from ${table}:`, res.affectedRows);
    }
    const [res] = await conn.query(
      `DELETE FROM cases WHERE id IN (${placeholders})`,
      ids
    );
    console.log("Deleted cases:", res.affectedRows);
  }

  // テスト用パートナー（協力会社）も削除
  const [pres] = await conn.query(
    "DELETE FROM partners WHERE name LIKE '%テスト%' OR name LIKE 'HIST-%' OR name LIKE 'TEST-%'"
  );
  console.log("Deleted partners:", pres.affectedRows);

  // 最終状態
  const [[c]] = await conn.query("SELECT COUNT(*) AS cnt FROM cases");
  const [remain] = await conn.query("SELECT id, requestNumber, storeName FROM cases ORDER BY id");
  console.log("Remaining cases:", c.cnt);
  for (const r of remain) console.log(`  ${r.id}: ${r.requestNumber} / ${r.storeName}`);
} finally {
  await conn.end();
}
