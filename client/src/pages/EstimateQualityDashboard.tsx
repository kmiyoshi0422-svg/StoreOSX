import { useState } from "react";
import { Link } from "wouter";
import { Activity, ArrowLeft, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const labels: Record<string, string> = {
  name: "工事項目",
  specification: "規格・寸法",
  quantity: "数量",
  unit: "単位",
  unitPrice: "単価",
  evidence: "引用",
  pageNumber: "PDFページ",
  note: "施工条件",
  removed: "採用後削除",
};
const sourceLabels: Record<string, string> = {
  case_pdf: "保存済みPDF＋案件情報",
  case_text: "案件テキストのみ",
  uploaded_pdf: "手動追加PDF",
};
const fmt = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);

export default function EstimateQualityDashboard() {
  const [days, setDays] = useState<7 | 30 | 90 | 365>(30);
  const { data, isLoading, error, refetch } =
    trpc.estimateAssistant.qualityReport.useQuery({ days });
  const peak = Math.max(1, ...(data?.trend.map(row => row.generated) ?? []));
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Activity className="h-4 w-4" /> 見積支援 / 品質モニタリング
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            AI見積候補の判定・修正履歴
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            案件の依頼PDF・登録情報から生成した候補に対する人の採用、除外、保存後修正を追跡します。対象は閲覧を許可された案件のみです。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/estimates/assistant">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              見積支援へ
            </Button>
          </Link>
          <label className="text-xs font-medium">
            期間（生成日）
            <select
              className="ml-2 h-9 rounded-md border bg-white px-2 text-sm"
              aria-label="集計期間"
              value={days}
              onChange={e =>
                setDays(Number(e.target.value) as 7 | 30 | 90 | 365)
              }
            >
              <option value={7}>7日</option>
              <option value={30}>30日</option>
              <option value={90}>90日</option>
              <option value={365}>365日</option>
            </select>
          </label>
        </div>
      </header>
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <strong>AIの真の正答率ではありません。</strong>{" "}
          採用・除外・修正は人の操作の傾向です。人が見逃した誤りや未抽出項目は測れません。以前の見積には履歴がないため、記録開始後の生成分だけ集計します。
        </span>
      </div>
      {isLoading && <p className="text-sm">集計を読み込み中...</p>}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          集計を取得できません: {error.message}{" "}
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            再試行
          </Button>
        </div>
      )}
      {data && (
        <>
          {data.truncated && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              生成実行が5,000件を超えています。以下の指標は期間全体ではなく最新5,000件の部分集計です。
            </div>
          )}
          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="判定指標"
          >
            {[
              [
                "生成候補",
                `${data.generated}件`,
                `${data.runs}回の生成（未判定 ${data.pending}件）`,
              ],
              [
                "採用率",
                fmt(data.acceptanceRate),
                `${data.adopted}件 / 判定済み ${data.adopted + data.excluded}件`,
              ],
              [
                "除外率",
                fmt(data.exclusionRate),
                `${data.excluded}件 / 判定済み ${data.adopted + data.excluded}件`,
              ],
              [
                "採用後修正率",
                fmt(data.editRate),
                `${data.editedAdopted}件 / 採用 ${data.adopted}件`,
              ],
            ].map(([title, value, caption]) => (
              <Card key={title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-600">
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-[#17304c]">{value}</p>
                  <p className="mt-1 text-xs text-slate-500">{caption}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">抽出元の内訳</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {Object.entries(data.sourceCounts).map(([source, count]) => (
                  <div
                    className="flex justify-between border-b pb-2"
                    key={source}
                  >
                    <span>{sourceLabels[source]}</span>
                    <strong>{count}回</strong>
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  保存済み元PDFがない旧案件はテキストのみで生成します。
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  保存時に修正された項目
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {Object.entries(data.corrections).sort((a, b) => b[1] - a[1])
                  .length ? (
                  Object.entries(data.corrections)
                    .sort((a, b) => b[1] - a[1])
                    .map(([field, count]) => (
                      <div
                        key={field}
                        className="flex items-center justify-between gap-3"
                      >
                        <span>{labels[field] ?? field}</span>
                        <span className="font-semibold">{count}回</span>
                      </div>
                    ))
                ) : (
                  <p className="text-slate-500">
                    まだ保存済みの修正はありません。
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  修正率は候補の重複を除いて計算し、項目別回数は保存時の差分を数えます。
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                日別の生成・判定（生成日基準）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.trend.length ? (
                data.trend.map(row => (
                  <div
                    key={row.date}
                    className="grid grid-cols-[6rem_1fr_8rem] items-center gap-3 text-xs"
                  >
                    <time>{row.date}</time>
                    <div className="h-3 rounded bg-slate-100">
                      <div
                        className="h-3 rounded bg-[#34658a]"
                        style={{
                          width: `${Math.max(2, (row.generated / peak) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-right">
                      {row.generated}件生成 · {row.adopted}採用
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  この期間の生成履歴はありません。
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                最近の採用・除外・修正履歴
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[550px] space-y-2 overflow-y-auto">
                {data.history.length ? (
                  data.history.map((row, index) => (
                    <div
                      key={`${row.candidateId}-${row.at}-${index}`}
                      className="rounded-md border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            row.kind === "exclude"
                              ? "border-red-300 text-red-800"
                              : row.kind === "edit"
                                ? "border-amber-300 text-amber-900"
                                : "border-green-300 text-green-800"
                          }
                        >
                          {row.kind === "exclude"
                            ? "除外"
                            : row.kind === "edit"
                              ? "修正"
                              : "採用"}
                        </Badge>
                        <strong>{row.itemName}</strong>
                        <span className="ml-auto text-xs text-slate-500">
                          {new Date(row.at).toLocaleString("ja-JP")}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {row.requestNumber}・{row.storeName} ／{" "}
                        {sourceLabels[row.sourceKind]} ／ 操作者ID{" "}
                        {row.actorId ?? "—"}
                      </div>
                      {row.fields.length > 0 && (
                        <p className="mt-1 text-xs">
                          変更:{" "}
                          {row.fields
                            .map(field => labels[field] ?? field)
                            .join("・")}
                        </p>
                      )}
                      {row.kind === "edit" && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-blue-700">
                            修正前後を表示
                          </summary>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2">
                            {JSON.stringify(
                              { before: row.before, after: row.after },
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    採用・除外・修正の履歴はまだありません。
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
