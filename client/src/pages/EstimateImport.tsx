import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, Sparkles, Trash2, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type Row = {
  localId: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  status: "uploading" | "extracting" | "ready" | "saved" | "error";
  caseId: number | null;
  extractedRequestNumber: string | null;
  extractedCaseTitle: string | null;
  extractedStoreName: string | null;
  totalAmount: number | null;
  materialAmount: number | null;
  laborAmount: number | null;
  vendorName: string;
  estimateDate: string;
  note: string;
  matches: { caseId: number; requestNumber: string; storeName: string; score: number }[];
};

export default function EstimateImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const utils = trpc.useUtils();

  const uploadMutation = trpc.estimates.uploadFile.useMutation();
  const matchMutation = trpc.estimates.extractAndMatch.useMutation();
  const bulkSaveMutation = trpc.estimates.bulkSave.useMutation();
  const allCases = trpc.cases.listMinimal.useQuery();

  async function handleFiles(files: FileList) {
    const newRows: Row[] = [];
    for (const file of Array.from(files)) {
      const localId = Math.random().toString(36).slice(2);
      const initial: Row = {
        localId,
        fileName: file.name,
        fileKey: "",
        fileUrl: "",
        mimeType: file.type || "application/pdf",
        status: "uploading",
        caseId: null,
        extractedRequestNumber: null,
        extractedCaseTitle: null,
        extractedStoreName: null,
        totalAmount: null,
        materialAmount: null,
        laborAmount: null,
        vendorName: "",
        estimateDate: "",
        note: "",
        matches: [],
      };
      newRows.push(initial);
    }
    setRows((prev) => [...prev, ...newRows]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const localId = newRows[i].localId;
      try {
        const base64 = await fileToBase64(file);
        // tRPCにはcaseIdが必須なので0をダミー渡し→bulkSave時に確定
        const up = await uploadMutation.mutateAsync({
          caseId: 0,
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || "application/pdf",
        });
        setRows((prev) => prev.map((r) => (r.localId === localId
          ? { ...r, fileKey: up.fileKey, fileUrl: up.url, status: "extracting" }
          : r)));
        const ext = await matchMutation.mutateAsync({
          fileKey: up.fileKey,
          mimeType: file.type || "application/pdf",
        });
        setRows((prev) => prev.map((r) => (r.localId === localId
          ? {
              ...r,
              status: "ready",
              caseId: ext.bestMatchCaseId ?? null,
              extractedRequestNumber: ext.extracted.requestNumber,
              extractedCaseTitle: ext.extracted.caseTitle,
              extractedStoreName: ext.extracted.storeName,
              totalAmount: ext.extracted.totalAmount,
              materialAmount: ext.extracted.materialAmount,
              laborAmount: ext.extracted.laborAmount,
              vendorName: ext.extracted.vendorName ?? "",
              estimateDate: ext.extracted.estimateDate ?? "",
              note: ext.extracted.note ?? "",
              matches: ext.matches,
            }
          : r)));
      } catch (e: any) {
        toast.error(`${file.name}: ${e?.message || "失敗"}`);
        setRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, status: "error" } : r)));
      }
    }
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.localId === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.localId !== id));
  }

  const readyRows = rows.filter((r) => r.status === "ready" && r.caseId);
  async function handleBulkSave() {
    if (readyRows.length === 0) {
      toast.error("案件を選択した行がありません");
      return;
    }
    try {
      const res = await bulkSaveMutation.mutateAsync({
        rows: readyRows.map((r) => ({
          caseId: r.caseId!,
          fileKey: r.fileKey,
          fileUrl: r.fileUrl,
          fileName: r.fileName,
          mimeType: r.mimeType,
          totalAmount: r.totalAmount,
          materialAmount: r.materialAmount,
          laborAmount: r.laborAmount,
          vendorName: r.vendorName || null,
          estimateDate: r.estimateDate || null,
          note: r.note || null,
        })),
      });
      toast.success(`${res.count}件の見積書を登録しました`);
      utils.cases.listMinimal.invalidate();
      // 保存済みは表示変更
      setRows((prev) => prev.map((r) => (readyRows.find((x) => x.localId === r.localId)
        ? { ...r, status: "saved" }
        : r)));
    } catch (e: any) {
      toast.error(e?.message || "保存に失敗しました");
    }
  }

  const cases = allCases.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">見積書取込</h1>
          <p className="text-sm text-muted-foreground">
            プレナス向け見積書をPDF・画像で一括投入。AIが金額と依頼番号・案件名・店舗名を抽出し、既存案件にマッチさせます。
          </p>
        </div>
        <div className="flex gap-2">
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
          <Button onClick={() => fileRef.current?.click()} variant="outline">
            <Upload className="h-4 w-4 mr-2" /> ファイル追加
          </Button>
          <Button onClick={handleBulkSave} disabled={readyRows.length === 0 || bulkSaveMutation.isPending}>
            {bulkSaveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            一括登録・{readyRows.length}件
          </Button>
        </div>
      </div>

      <div
        data-testid="estimate-dropzone"
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
              if (f.type === "application/pdf" || f.type.startsWith("image/")) {
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
        className={`rounded-md border-2 border-dashed transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/40"
        }`}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full py-8 text-center cursor-pointer"
        >
          <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          <div className="font-medium text-sm">
            {isDragging ? "ここにドロップしてください" : "ファイルをドラッグ＆ドロップ または クリックして選択"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">PDF / 画像・複数同時可</div>
        </button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-60" />
            <div className="font-medium">まだファイルがありません</div>
            <div className="text-xs mt-1">上のエリアにドロップするか、ファイル追加ボタンから投入してください。</div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">取込候補</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.map((r) => (
              <div key={r.localId} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{r.fileName}</span>
                    {r.status === "uploading" && <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />アップロード中</Badge>}
                    {r.status === "extracting" && <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />AI解析中</Badge>}
                    {r.status === "ready" && <Badge className="gap-1 bg-blue-600 text-white"><Sparkles className="h-3 w-3" />解析済</Badge>}
                    {r.status === "saved" && <Badge className="gap-1 bg-green-600 text-white"><CheckCircle2 className="h-3 w-3" />登録済</Badge>}
                    {r.status === "error" && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />失敗</Badge>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeRow(r.localId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {r.status === "ready" && (
                  <div className="grid md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-2">
                      <div>
                        <div className="text-muted-foreground mb-1">AI抽出情報</div>
                        <div className="rounded-sm border bg-muted/30 p-2 space-y-0.5">
                          <div>依頼番号: <b>{r.extractedRequestNumber ?? "—"}</b></div>
                          <div>案件名: {r.extractedCaseTitle ?? "—"}</div>
                          <div>店舗: {r.extractedStoreName ?? "—"}</div>
                          <div>業者: {r.vendorName || "—"}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">マッチング案件</div>
                        <Select
                          value={r.caseId ? String(r.caseId) : ""}
                          onValueChange={(v) => updateRow(r.localId, { caseId: Number(v) })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="案件を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {r.matches.map((m) => (
                              <SelectItem key={m.caseId} value={String(m.caseId)}>
                                {m.requestNumber}・{m.storeName}・一致度{m.score}
                              </SelectItem>
                            ))}
                            {cases.filter((c) => !r.matches.find((m) => m.caseId === c.id)).map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.requestNumber}・{c.storeName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-muted-foreground mb-1">合計金額・円</div>
                        <Input
                          type="number"
                          value={r.totalAmount ?? ""}
                          onChange={(e) => updateRow(r.localId, { totalAmount: e.target.value ? Number(e.target.value) : null })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">見積日</div>
                        <Input
                          type="date"
                          value={r.estimateDate}
                          onChange={(e) => updateRow(r.localId, { estimateDate: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">材料費</div>
                        <Input
                          type="number"
                          value={r.materialAmount ?? ""}
                          onChange={(e) => updateRow(r.localId, { materialAmount: e.target.value ? Number(e.target.value) : null })}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">作業費</div>
                        <Input
                          type="number"
                          value={r.laborAmount ?? ""}
                          onChange={(e) => updateRow(r.localId, { laborAmount: e.target.value ? Number(e.target.value) : null })}
                          className="h-8"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="text-muted-foreground mb-1">業者名</div>
                        <Input
                          value={r.vendorName}
                          onChange={(e) => updateRow(r.localId, { vendorName: e.target.value })}
                          className="h-8"
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
    </div>
  );
}
