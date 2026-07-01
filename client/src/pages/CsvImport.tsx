import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { Upload, Download, CheckCircle2, XCircle, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Row = {
  requestNumber: string;
  brand: "ほっともっと" | "やよい軒" | "その他";
  storeName: string;
  storeCode?: string;
  address?: string;
  storePhone?: string;
  requesterName?: string;
  requestContent?: string;
  workType: "入替" | "修理" | "納品" | "見積り" | "新規";
  costBearer: "店舗" | "営業部" | "その他";
  categoryLarge?: string;
  categoryMedium?: string;
  categorySmall?: string;
  urgency: "S" | "A" | "B" | "C";
  estimatedCost?: number;
  contractorName?: string;
};

const TEMPLATE_HEADERS = [
  "依頼番号",
  "ブランド",
  "店舗名",
  "店舗コード",
  "住所",
  "店舗電話",
  "依頼者",
  "依頼内容",
  "作業区分",
  "費用負担",
  "大項目",
  "中項目",
  "小項目",
  "緊急度",
  "見積金額",
  "協力会社",
];

// 簡易CSVパーサ（ダブルクォート対応）
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        value += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(value);
        value = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        current.push(value);
        rows.push(current);
        current = [];
        value = "";
      } else {
        value += ch;
      }
    }
  }
  if (value !== "" || current.length > 0) {
    current.push(value);
    rows.push(current);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function isUrgency(v: string): v is "S" | "A" | "B" | "C" {
  return ["S", "A", "B", "C"].includes(v);
}
function isWorkType(v: string): v is "入替" | "修理" | "納品" | "見積り" | "新規" {
  return ["入替", "修理", "納品", "見積り", "新規"].includes(v);
}
function isBrand(v: string): v is "ほっともっと" | "やよい軒" | "その他" {
  return ["ほっともっと", "やよい軒", "その他"].includes(v);
}
function isCostBearer(v: string): v is "店舗" | "営業部" | "その他" {
  return ["店舗", "営業部", "その他"].includes(v);
}

export default function CsvImport() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ requestNumber: string; ok: boolean; error?: string }[] | null>(null);

  const importMutation = trpc.cases.bulkImport.useMutation({
    onSuccess: ({ results, inserted, failed }) => {
      setResult(results);
      if (inserted > 0) toast.success(`${inserted}件を登録しました${failed > 0 ? ` 失敗 ${failed}件` : ""}`);
      else toast.error("登録できませんでした");
      utils.cases.list.invalidate();
      utils.cases.summary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    const text = await file.text();
    const data = parseCSV(text);
    if (data.length < 2) {
      toast.error("CSVが空、またはヘッダー行のみです");
      return;
    }
    const headers = data[0].map((h) => h.trim());
    const errs: string[] = [];
    const parsed: Row[] = [];
    for (let i = 1; i < data.length; i++) {
      const cols = data[i];
      const get = (key: string) => {
        const idx = headers.indexOf(key);
        return idx >= 0 ? (cols[idx] ?? "").trim() : "";
      };
      const requestNumber = get("依頼番号");
      const storeName = get("店舗名");
      if (!requestNumber || !storeName) {
        errs.push(`行${i + 1}: 依頼番号と店舗名は必須です`);
        continue;
      }
      const brandRaw = get("ブランド") || "ほっともっと";
      const workTypeRaw = get("作業区分") || "修理";
      const costBearerRaw = get("費用負担") || "店舗";
      const urgencyRaw = get("緊急度") || "B";
      const estCostRaw = get("見積金額");
      parsed.push({
        requestNumber,
        brand: isBrand(brandRaw) ? brandRaw : "その他",
        storeName,
        storeCode: get("店舗コード") || undefined,
        address: get("住所") || undefined,
        storePhone: get("店舗電話") || undefined,
        requesterName: get("依頼者") || undefined,
        requestContent: get("依頼内容") || undefined,
        workType: isWorkType(workTypeRaw) ? workTypeRaw : "修理",
        costBearer: isCostBearer(costBearerRaw) ? costBearerRaw : "店舗",
        categoryLarge: get("大項目") || undefined,
        categoryMedium: get("中項目") || undefined,
        categorySmall: get("小項目") || undefined,
        urgency: isUrgency(urgencyRaw) ? urgencyRaw : "B",
        estimatedCost: estCostRaw ? Number(estCostRaw.replace(/[,¥\s]/g, "")) : undefined,
        contractorName: get("協力会社") || undefined,
      });
    }
    setRows(parsed);
    setErrors(errs);
    setResult(null);
  };

  const downloadTemplate = () => {
    const bom = "\uFEFF";
    const sample = [
      "284909-1",
      "ほっともっと",
      "ほっともっと八女井延店",
      "0000",
      "山口県下関市古ヶ峠1-10",
      "0832XX-XXXX",
      "店長",
      "自動ドアセンサー故障",
      "修理",
      "店舗",
      "内外装",
      "サッシ・自動ドア",
      "修理交換",
      "S",
      "85000",
      "株式会社小林工房",
    ];
    const csv = bom + TEMPLATE_HEADERS.join(",") + "\n" + sample.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "案件一括インポート_テンプレート.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (rows.length === 0) {
      toast.error("CSVを読み込んでください");
      return;
    }
    importMutation.mutate({ rows });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">CSV Import</p>
        <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">CSV一括インポート</h1>
        <p className="text-sm text-muted-foreground mt-2">
          プレナス案件をまとめてCSVから登録できます
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif-jp text-lg">手順</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>テンプレートCSVをダウンロード</li>
            <li>必要事項を入力。依頼番号・店舗名は必須</li>
            <li>CSVをアップロードしてプレビュー → 取り込み実行</li>
          </ol>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />
              テンプレートをダウンロード
            </Button>
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              ref={fileRef}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              CSVファイルを選択
            </Button>
          </div>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card className="border-destructive/30">
          <CardContent className="p-5">
            <p className="font-medium text-sm text-destructive mb-2">エラー</p>
            <ul className="text-xs text-destructive space-y-1">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif-jp text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              プレビュー・{rows.length}件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-2 text-left">依頼番号</th>
                    <th className="px-2 py-2 text-left">店舗名</th>
                    <th className="px-2 py-2 text-left">大項目</th>
                    <th className="px-2 py-2 text-left">作業区分</th>
                    <th className="px-2 py-2 text-left">緊急度</th>
                    <th className="px-2 py-2 text-right">見積金額</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5 font-mono">{r.requestNumber}</td>
                      <td className="px-2 py-1.5">{r.storeName}</td>
                      <td className="px-2 py-1.5">{r.categoryLarge ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.workType}</td>
                      <td className="px-2 py-1.5">{r.urgency}</td>
                      <td className="px-2 py-1.5 text-right">
                        {r.estimatedCost ? `¥${r.estimatedCost.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">
                ...他 {rows.length - 50} 件
              </p>
            )}
            <div className="flex justify-end mt-4">
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {rows.length}件を取り込む
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif-jp text-lg">取込結果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded border p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">合計</p>
                <p className="text-2xl font-serif-jp font-semibold">{result.length}</p>
              </div>
              <div className="rounded border p-3 bg-emerald-50/40">
                <p className="text-[10px] uppercase tracking-widest text-emerald-700">成功</p>
                <p className="text-2xl font-serif-jp font-semibold text-emerald-700">
                  {result.filter((r) => r.ok).length}
                </p>
              </div>
              <div className="rounded border p-3 bg-red-50/40">
                <p className="text-[10px] uppercase tracking-widest text-red-700">失敗</p>
                <p className="text-2xl font-serif-jp font-semibold text-red-700">
                  {result.filter((r) => !r.ok).length}
                </p>
              </div>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {result.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs py-1 px-2 border-b border-border/40"
                >
                  {r.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  )}
                  <span className="font-mono">{r.requestNumber}</span>
                  {r.error && <span className="text-red-600 truncate">{r.error}</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setLocation("/cases")}>
                案件一覧へ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
