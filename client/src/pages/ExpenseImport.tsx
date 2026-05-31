import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/PageHeader";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  Sparkles,
  Trash2,
  Save,
  AlertCircle,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type Category = "材料費" | "外注費" | "交通費" | "消耗品" | "その他";
const CATEGORIES: Category[] = ["材料費", "外注費", "交通費", "消耗品", "その他"];

type Row = {
  localId: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  status: "uploading" | "extracting" | "ready" | "saved" | "error";
  caseId: number | null;
  vendorName: string;
  amount: number | null;
  taxAmount: number | null;
  expenseDate: string;
  category: Category;
  note: string;
  extractedRequestNumber: string | null;
  extractedStoreName: string | null;
  extractedCaseHint: string | null;
  matches: { caseId: number; requestNumber: string | null; storeName: string | null; score: number }[];
};

export default function ExpenseImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const utils = trpc.useUtils();

  const uploadMutation = trpc.expenses.uploadFile.useMutation();
  const extractMutation = trpc.expenses.extractAndMatch.useMutation();
  const bulkSaveMutation = trpc.expenses.bulkSave.useMutation();
  const allCases = trpc.cases.list.useQuery();

  async function handleFiles(files: FileList) {
    const newRows: Row[] = [];
    for (const file of Array.from(files)) {
      const localId = Math.random().toString(36).slice(2);
      newRows.push({
        localId,
        fileName: file.name,
        fileKey: "",
        fileUrl: "",
        mimeType: file.type || "application/pdf",
        status: "uploading",
        caseId: null,
        vendorName: "",
        amount: null,
        taxAmount: null,
        expenseDate: "",
        category: "その他",
        note: "",
        extractedRequestNumber: null,
        extractedStoreName: null,
        extractedCaseHint: null,
        matches: [],
      });
    }
    setRows((prev) => [...prev, ...newRows]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const localId = newRows[i].localId;
      try {
        const base64 = await fileToBase64(file);
        const up = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || "application/pdf",
        });
        setRows((prev) =>
          prev.map((r) =>
            r.localId === localId
              ? {
                  ...r,
                  fileKey: up.fileKey,
                  fileUrl: up.url,
                  status: "extracting",
                }
              : r,
          ),
        );
        const ext = await extractMutation.mutateAsync({
          fileKey: up.fileKey,
          fileUrl: up.url,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
        });
        setRows((prev) =>
          prev.map((r) =>
            r.localId === localId
              ? {
                  ...r,
                  status: "ready",
                  caseId: ext.autoMatchCaseId ?? null,
                  vendorName: ext.extracted.vendorName ?? "",
                  amount: ext.extracted.amount ?? null,
                  taxAmount: ext.extracted.taxAmount ?? null,
                  expenseDate: ext.extracted.expenseDate ?? "",
                  category: (CATEGORIES.includes(ext.extracted.category as Category)
                    ? ext.extracted.category
                    : "その他") as Category,
                  note: ext.extracted.note ?? "",
                  extractedRequestNumber: ext.extracted.requestNumber,
                  extractedStoreName: ext.extracted.storeName,
                  extractedCaseHint: ext.extracted.caseHint,
                  matches: ext.matches,
                }
              : r,
          ),
        );
      } catch (e: any) {
        toast.error(`${file.name}: ${e?.message || "失敗"}`);
        setRows((prev) =>
          prev.map((r) =>
            r.localId === localId ? { ...r, status: "error" } : r,
          ),
        );
      }
    }
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.localId === id ? { ...r, ...patch } : r)),
    );
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.localId !== id));
  }

  const readyRows = rows.filter(
    (r) => r.status === "ready" && r.caseId && r.amount && r.amount > 0,
  );
  async function handleBulkSave() {
    if (readyRows.length === 0) {
      toast.error("案件と金額が確定した行がありません");
      return;
    }
    try {
      const res = await bulkSaveMutation.mutateAsync({
        items: readyRows.map((r) => ({
          caseId: r.caseId!,
          fileKey: r.fileKey,
          fileUrl: r.fileUrl,
          fileName: r.fileName,
          mimeType: r.mimeType,
          vendorName: r.vendorName || null,
          amount: r.amount!,
          taxAmount: r.taxAmount ?? null,
          expenseDate: r.expenseDate || null,
          category: r.category,
          note: r.note || null,
        })),
      });
      toast.success(`${res.count}件の経費を登録しました`);
      utils.expenses.list.invalidate();
      utils.cases.list.invalidate();
      setRows((prev) =>
        prev.map((r) =>
          readyRows.find((x) => x.localId === r.localId)
            ? { ...r, status: "saved" }
            : r,
        ),
      );
    } catch (e: any) {
      toast.error(e?.message || "保存に失敗しました");
    }
  }

  const cases = allCases.data ?? [];

  return (
    <div className="space-y-5">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />
      <PageHeader
        eyebrow="Expense Import"
        title="経費取込"
        icon={<Receipt className="h-7 w-7 text-primary" />}
        description="領収書・請求書（PDF / 画像）をドラッグ＆ドロップすると、AI が金額・支払先・関連案件を抽出し、案件の実績原価に自動反映します。"
        actions={
          <>
            <Button onClick={() => fileRef.current?.click()} variant="outline">
              <Upload className="h-4 w-4 mr-2" /> ファイル追加
            </Button>
            <Button
              onClick={handleBulkSave}
              disabled={readyRows.length === 0 || bulkSaveMutation.isPending}
            >
              {bulkSaveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              一括登録（{readyRows.length}件）
            </Button>
          </>
        }
      />

      <div
        data-testid="expense-dropzone"
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.types.includes("Files")) {
            e.dataTransfer.dropEffect = "copy";
            setIsDragging(true);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.currentTarget === e.target) setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          const dropped = e.dataTransfer.files;
          if (dropped && dropped.length > 0) {
            const accepted: File[] = [];
            for (const f of Array.from(dropped)) {
              if (
                f.type === "application/pdf" ||
                f.type.startsWith("image/")
              ) {
                accepted.push(f);
              }
            }
            if (accepted.length === 0) {
              toast.error("PDFまたは画像のみ対応しています");
              return;
            }
            const dt = new DataTransfer();
            accepted.forEach((f) => dt.items.add(f));
            handleFiles(dt.files);
            toast.success(`${accepted.length}件のファイルを追加しました`);
          }
        }}
        className={`rounded-lg border-2 border-dashed transition-all duration-200 ${
          isDragging
            ? "border-primary bg-primary/5 shadow-inner"
            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full py-10 md:py-12 text-center cursor-pointer"
        >
          <div
            className={`mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full ${
              isDragging ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            <Upload className="h-7 w-7" />
          </div>
          <div className="font-semibold text-base">
            {isDragging
              ? "ここにドロップしてください"
              : "ファイルをドラッグ＆ドロップ"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            またはクリックして選択・PDF / 画像を複数同時可
          </div>
        </button>
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center flex flex-col items-center gap-3">
            <Sparkles className="h-10 w-10 opacity-60 text-muted-foreground" />
            <div className="font-medium">まだファイルがありません</div>
            <div className="text-sm text-muted-foreground max-w-sm">
              上のエリアにドロップするか、「ファイル追加」ボタンから投入してください。複数ファイル同時可、AI が順次解析します。
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">取込候補</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.localId}
                className="rounded-lg border bg-card p-3 md:p-4 space-y-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{r.fileName}</span>
                    {r.status === "uploading" && (
                      <Badge variant="outline" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        アップロード中
                      </Badge>
                    )}
                    {r.status === "extracting" && (
                      <Badge variant="outline" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        AI解析中
                      </Badge>
                    )}
                    {r.status === "ready" && (
                      <Badge className="gap-1 bg-blue-600 text-white">
                        <Sparkles className="h-3 w-3" />
                        解析済
                      </Badge>
                    )}
                    {r.status === "saved" && (
                      <Badge className="gap-1 bg-green-600 text-white">
                        <CheckCircle2 className="h-3 w-3" />
                        登録済
                      </Badge>
                    )}
                    {r.status === "error" && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        失敗
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeRow(r.localId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {r.status === "ready" && (
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                          AI 抽出情報
                        </Label>
                        <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">支払先</span>
                            <span className="font-medium truncate">{r.vendorName || "—"}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">依頼番号</span>
                            <span className="font-mono">{r.extractedRequestNumber ?? "—"}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">店舗</span>
                            <span className="truncate">{r.extractedStoreName ?? "—"}</span>
                          </div>
                          {r.extractedCaseHint && (
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">ヒント</span>
                              <span className="truncate">{r.extractedCaseHint}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                          紐付け案件
                        </Label>
                        <Select
                          value={r.caseId ? String(r.caseId) : ""}
                          onValueChange={(v) =>
                            updateRow(r.localId, { caseId: Number(v) })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="案件を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {r.matches.map((m) => (
                              <SelectItem
                                key={m.caseId}
                                value={String(m.caseId)}
                              >
                                {m.requestNumber}・{m.storeName}（一致度{m.score}）
                              </SelectItem>
                            ))}
                            {cases
                              .filter(
                                (c) =>
                                  !r.matches.find((m) => m.caseId === c.id),
                              )
                              .map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  {c.requestNumber}・{c.storeName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                          金額（税込・円）
                        </Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={r.amount ?? ""}
                          onChange={(e) =>
                            updateRow(r.localId, {
                              amount: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-9 font-mono text-right"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                          支払日
                        </Label>
                        <Input
                          type="date"
                          value={r.expenseDate}
                          onChange={(e) =>
                            updateRow(r.localId, {
                              expenseDate: e.target.value,
                            })
                          }
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">区分</Label>
                        <Select
                          value={r.category}
                          onValueChange={(v) =>
                            updateRow(r.localId, { category: v as Category })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                          消費税
                        </Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={r.taxAmount ?? ""}
                          onChange={(e) =>
                            updateRow(r.localId, {
                              taxAmount: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-9 font-mono text-right"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">摘要</Label>
                        <Input
                          value={r.note}
                          onChange={(e) =>
                            updateRow(r.localId, { note: e.target.value })
                          }
                          className="h-9"
                          placeholder="メモ（任意）"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground border-t border-border/60 pt-3">
        ・ 登録すると、紐付けた案件の実績原価が自動で再計算されます（actualCost = 経費合計）。
      </div>
    </div>
  );
}
