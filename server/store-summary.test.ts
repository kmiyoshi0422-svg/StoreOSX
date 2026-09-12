import { drizzle } from "drizzle-orm/mysql2";
import { describe, expect, it } from "vitest";
import { buildStoreSummariesQuery } from "./db";

describe("店舗一覧DB集約（提案44）", () => {
  const database = drizzle.mock();
  const compiled = buildStoreSummariesQuery(database).toSQL();
  const normalizedSql = compiled.sql.toLowerCase().replace(/\s+/g, " ");

  it("店舗コード優先・店舗名フォールバックのキーをDB側で生成する", () => {
    expect(normalizedSql).toContain("coalesce(nullif(trim(");
    expect(normalizedSql).toContain("storecode");
    expect(normalizedSql).toContain("storename");
  });

  it("最新案件をウィンドウ関数で確定して店舗単位に集約する", () => {
    expect(normalizedSql).toContain("row_number() over");
    expect(normalizedSql).toContain("partition by");
    expect(normalizedSql).toContain("group by");
    expect(normalizedSql).toContain("latest_rank");
  });

  it("件数・完了・緊急度・金額を条件付き集計する", () => {
    expect(normalizedSql).toContain("count(*)");
    expect(normalizedSql).toContain("sum(case when");
    expect(normalizedSql).toContain("'完了'");
    expect(normalizedSql).toContain("'クローズ'");
    expect(normalizedSql).toContain("'s'");
    expect(normalizedSql).toContain("'a'");
    expect(normalizedSql).toContain("coalesce(sum(");
  });

  it("案件全列を取得せず、店舗集約結果だけを返す", () => {
    expect(normalizedSql).not.toContain("select *");
    expect(normalizedSql).toContain(
      "order by max(case when `latest_rank` = 1 then `request_at` end) desc",
    );
  });
});
