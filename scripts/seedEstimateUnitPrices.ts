import { sql } from "drizzle-orm";
import { unitPriceMaster } from "../drizzle/schema";
import { getDb } from "../server/db";
import catalog from "../server/catalog/standardUnitPrices.json";

/** 原本に記録された値だけを投入する。既存の価格や非表示設定は変更しない。 */
async function main() {
  const db = await getDb();
  if (!db) throw new Error("DB接続がありません");
  if (catalog.items.length !== 117) throw new Error("元表の件数が異なります");
  if (new Set(catalog.items.map(item => item.id)).size !== catalog.items.length)
    throw new Error("元表のIDが重複しています");
  const now = Date.now();
  const rows = catalog.items.map(item => {
    if (
      !(item.low > 0 && item.low <= item.standard && item.standard <= item.high)
    )
      throw new Error(`単価の大小関係が不正: ${item.id}`);
    return {
      id: item.id,
      majorCategory: item.majorCategory,
      category: item.category,
      name: item.name,
      specification: item.specification ?? "",
      unit: item.unit,
      low: item.low,
      standard: item.standard,
      high: item.high,
      note: item.note ?? null,
      sourceRef: `${catalog.sourceFile} / ${catalog.version}`,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  });
  await db.transaction(async tx => {
    await tx
      .insert(unitPriceMaster)
      .values(rows)
      .onDuplicateKeyUpdate({
        set: { id: sql`${unitPriceMaster.id}` },
      });
  });
  console.log(`元表${rows.length}件の単価マスタ投入を確認（既存行は非変更）`);
}
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
