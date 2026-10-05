import { eq } from "drizzle-orm";
import {
  estimatePresetCategories,
  estimatePresetItems,
} from "../drizzle/schema";
import { getDb } from "../server/db";

/** 初期値は価格を持たない。追加後の変更は運用画面で行い、再シードで上書きしない。 */
const categories = [
  { id: "blind", name: "ブラインド", sortOrder: 1 },
  { id: "grease-trap", name: "GT蓋・GT内かご", sortOrder: 2 },
  { id: "insect-trap", name: "捕虫器取付", sortOrder: 3 },
  { id: "haihai", name: "はいはい店番取付", sortOrder: 4 },
];
const items = [
  {
    id: "foretia50",
    categoryId: "blind",
    name: "フォレティア50 ネイチャー／ラダーコード",
    unit: "台",
    note: "寸法別参考価格はブラインドの計算欄で確認。価格・仕様は手入力も可能",
  },
  {
    id: "gt-lid",
    categoryId: "grease-trap",
    name: "GT蓋",
    unit: "枚",
    note: "材質・寸法・現場条件を確認",
  },
  {
    id: "gt-basket",
    categoryId: "grease-trap",
    name: "GT内かご",
    unit: "個",
    note: "型番・寸法を確認",
  },
  {
    id: "insect-install",
    categoryId: "insect-trap",
    name: "捕虫器取付",
    unit: "台",
    note: "機器代・電源工事の範囲を確認",
  },
  {
    id: "haihai-install",
    categoryId: "haihai",
    name: "はいはい店番取付",
    unit: "台",
    note: "機器仕様・既設の状況を確認",
  },
];
async function main() {
  const db = await getDb();
  if (!db) throw new Error("DB接続がありません");
  const at = Date.now();
  for (const category of categories) {
    const [found] = await db
      .select({ id: estimatePresetCategories.id })
      .from(estimatePresetCategories)
      .where(eq(estimatePresetCategories.id, category.id))
      .limit(1);
    if (!found)
      await db
        .insert(estimatePresetCategories)
        .values({ ...category, createdAt: at, updatedAt: at });
  }
  for (const item of items) {
    const [found] = await db
      .select({ id: estimatePresetItems.id })
      .from(estimatePresetItems)
      .where(eq(estimatePresetItems.id, item.id))
      .limit(1);
    if (!found)
      await db
        .insert(estimatePresetItems)
        .values({
          ...item,
          specification: "",
          unitPrice: null,
          sortOrder: items.indexOf(item) + 1,
          createdAt: at,
          updatedAt: at,
        });
  }
  console.log(
    `定型見積: 初期分類${categories.length}件・項目${items.length}件（既存値を変更せず）`
  );
}
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
