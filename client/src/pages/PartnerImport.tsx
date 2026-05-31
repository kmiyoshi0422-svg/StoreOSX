import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ImageIcon,
  Table as TableIcon,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";

const CATEGORIES = [
  "電気",
  "給排水",
  "空調",
  "厨房設備",
  "排気・換気",
  "内装",
  "床",
  "看板",
  "外壁",
  "建具",
  "防水",
  "その他",
] as const;
type Category = (typeof CATEGORIES)[number];

type Row = {
  name: string;
  category: Category;
  phone?: string;
  pic?: string;
  picPhone?: string;
  email?: string;
  address?: string;
  area?: string;
  notes?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function isCategory(v: string): v is Category {
  return (CATEGORIES as readonly string[]).includes(v);
}

// Excelシートを行配列に変換
async function parseExcel(file: File): Promise<Row[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  return json
    .map((r) => {
      const get = (...keys: string[]): string => {
        for (const k of keys) {
          const v = r[k] ?? r[k.trim()];
          if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
        }
        return "";
      };
      const cat = get("業種", "カテゴリ", "category");
      return {
        name: get("会社名", "協力会社", "name"),
        category: isCategory(cat) ? cat : "その他",
        phone: get("電話", "TEL", "phone") || undefined,
        pic: get("担当者", "担当", "pic") || undefined,
        picPhone: get("担当携帯", "担当者携帯", "picPhone") || undefined,
        email: get("メール", "Email", "email") || undefined,
        address: get("住所", "address") || undefined,
        area: get("エリア", "対応エリア", "area") || undefined,
        notes: get("備考", "メモ", "notes") || undefined,
      } as Row;
    })
    .filter((r) => r.name.length > 0);
}

export default function PartnerImport() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [result, setResult] = useState<{ name: string; ok: boolean; error?: string }[] | null>(null);

  const uploadMutation = trpc.partners.uploadFile.useMutation();
  const extractMutation = trpc.partners.extractFromFile.useMutation();
  const importMutation = trpc.partners.bulkCreate.useMutation({
    onSuccess: ({ results, inserted, failed }) => {
      setResult(results);
      if (inserted > 0) toast.success(`${inserted}件を登録しました${failed > 0 ? `（失敗 ${failed}件）` : ""}`);
      else toast.error("登録できませんでした");
      utils.partners.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    setRows([]);

    const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

    try {
      if (isExcel) {
        toast.info("Excel/CSVを解析中...");
        const parsed = await parseExcel(file);
        if (parsed.length === 0) {
          toast.error("協力会社データが見つかりませんでした");
          return;
        }
        setRows(parsed);
        toast.success(`${parsed.length}件を読み取りました`);
      } else if (isImage || isPdf) {
        toast.info(`${isImage ? "画像" : "PDF"}をアップロード中...`);
        const base64 = await fileToBase64(file);
        const { fileKey, mimeType } = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
        });
        toast.info("AIが協力会社情報を抽出中...");
        const res = await extractMutation.mutateAsync({ fileKey, mimeType });
        const extracted = (res.partners ?? []).map((p) => ({
          ...p,
          category: isCategory(p.category) ? (p.category as Category) : "その他",
        })) as Row[];
        if (extracted.length === 0) {
          toast.error("協力会社情報を抽出できませんでした");
          return;
        }
        setRows(extracted);
        toast.success(`${extracted.length}件を抽出しました`);
      } else {
        toast.error("対応形式: Excel(.xlsx/.xls/.csv)、画像、PDF");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "ファイル処理に失敗しました");
    }
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const removeRow = (i: number) => {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  };

  const addBlankRow = () => {
    setRows((rs) => [...rs, { name: "", category: "その他" }]);
  };

  const handleImport = () => {
    const valid = rows.filter((r) => r.name.trim().length > 0);
    if (valid.length === 0) {
      toast.error("会社名が必要です");
      return;
    }
    importMutation.mutate({ rows: valid });
  };

  const reset = () => {
    setRows([]);
    setFileName("");
    setResult(null);
  };

  const loading = uploadMutation.isPending || extractMutation.isPending;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Partner Import</p>
        <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">協力会社の一括取り込み</h1>
        <p className="text-sm text-muted-foreground mt-2">
          名刺・会社一覧表（Excel）・PDF・写真から、協力会社マスタにまとめて登録できます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif-jp text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" />
            ファイルを選択
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded border p-3 bg-muted/20">
              <div className="flex items-center gap-2 mb-1">
                <TableIcon className="h-3.5 w-3.5" />
                <span className="font-medium">Excel / CSV</span>
              </div>
              <p className="text-muted-foreground">列名: 会社名 / 業種 / 電話 / 担当者 / 住所 / エリア / 備考</p>
            </div>
            <div className="rounded border p-3 bg-muted/20">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="font-medium">画像（名刺・写真）</span>
              </div>
              <p className="text-muted-foreground">名刺の写真や一覧表のスクショからAIが抽出します</p>
            </div>
            <div className="rounded border p-3 bg-muted/20">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-3.5 w-3.5" />
                <span className="font-medium">PDF</span>
              </div>
              <p className="text-muted-foreground">業者リスト・契約書PDFから抽出します</p>
            </div>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,image/*,application/pdf,.pdf"
            hidden
            ref={fileRef}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await handleFile(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => fileRef.current?.click()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              ファイルを選択
            </Button>
            {fileName && (
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <FileText className="h-3 w-3" />
                {fileName}
              </Badge>
            )}
            {(rows.length > 0 || fileName) && (
              <Button variant="outline" onClick={reset} disabled={loading}>
                クリア
              </Button>
            )}
          </div>
          {loading && <p className="text-xs text-muted-foreground">AIが解析中... 数秒〜十数秒かかります</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif-jp text-lg">プレビュー（{rows.length}件・編集可）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-2 text-left">会社名 *</th>
                    <th className="px-2 py-2 text-left">業種</th>
                    <th className="px-2 py-2 text-left">電話</th>
                    <th className="px-2 py-2 text-left">担当者</th>
                    <th className="px-2 py-2 text-left">担当携帯</th>
                    <th className="px-2 py-2 text-left">エリア</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-1 py-1">
                        <Input
                          className="h-8 text-xs"
                          value={r.name}
                          onChange={(e) => updateRow(i, { name: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <select
                          className="border rounded h-8 px-2 text-xs bg-background w-full"
                          value={r.category}
                          onChange={(e) => updateRow(i, { category: e.target.value as Category })}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          className="h-8 text-xs"
                          value={r.phone ?? ""}
                          onChange={(e) => updateRow(i, { phone: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          className="h-8 text-xs"
                          value={r.pic ?? ""}
                          onChange={(e) => updateRow(i, { pic: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          className="h-8 text-xs"
                          value={r.picPhone ?? ""}
                          onChange={(e) => updateRow(i, { picPhone: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          className="h-8 text-xs"
                          value={r.area ?? ""}
                          onChange={(e) => updateRow(i, { area: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeRow(i)}
                          aria-label="削除"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-4">
              <Button size="sm" variant="outline" onClick={addBlankRow}>
                <Plus className="h-3.5 w-3.5" />
                行を追加
              </Button>
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {rows.filter((r) => r.name).length}件を登録
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif-jp text-lg">登録結果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <Stat label="合計" value={result.length} />
              <Stat label="成功" value={result.filter((r) => r.ok).length} tone="emerald" />
              <Stat label="失敗" value={result.filter((r) => !r.ok).length} tone="red" />
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
                  <span>{r.name}</span>
                  {r.error && <span className="text-red-600 truncate">{r.error}</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={reset}>
                続けて取り込む
              </Button>
              <Button onClick={() => setLocation("/partners")}>協力会社マスタへ</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "red" }) {
  const cls =
    tone === "emerald"
      ? "border bg-emerald-50/40 text-emerald-700"
      : tone === "red"
        ? "border bg-red-50/40 text-red-700"
        : "border";
  return (
    <div className={`rounded p-3 ${cls}`}>
      <p className="text-[10px] uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-2xl font-serif-jp font-semibold">{value}</p>
    </div>
  );
}
