import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  Files,
  Pencil,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Extracted = {
  requestNumber: string;
  brand: "ほっともっと" | "やよい軒" | "その他";
  storeName: string;
  storeCode: string;
  shopId: string;
  address: string;
  storePhone: string;
  businessHours: string;
  requestDate: Date | null;
  requesterName: string;
  requesterPhone: string;
  requestContent: string;
  workType: "入替" | "修理" | "納品" | "見積り" | "新規";
  costBearer: "店舗" | "営業部" | "その他";
  categoryLarge: string;
  categoryMedium: string;
  categorySmall: string;
  contractorName: string;
  contractorPic: string;
  contractorPhone: string;
  urgency: "S" | "A" | "B" | "C";
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function emptyExtracted(): Extracted {
  return {
    requestNumber: "",
    brand: "ほっともっと",
    storeName: "",
    storeCode: "",
    shopId: "",
    address: "",
    storePhone: "",
    businessHours: "",
    requestDate: null,
    requesterName: "",
    requesterPhone: "",
    requestContent: "",
    workType: "修理",
    costBearer: "店舗",
    categoryLarge: "",
    categoryMedium: "",
    categorySmall: "",
    contractorName: "",
    contractorPic: "",
    contractorPhone: "",
    urgency: "B",
  };
}

export default function CasePdfImport() {
  const [tab, setTab] = useState<"single" | "bulk">("single");

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-2 font-medium">
          PDF Import
        </p>
        <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">
          PDFから案件登録
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
          「依頼進捗更新」のPDFから、AIが店舗情報・依頼内容・取引先を読み取ります。
          1件ずつ確認したい時は<strong className="text-foreground">単票</strong>、まとめて取り込みたい時は
          <strong className="text-foreground">一括</strong>モードをご利用ください。
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-5">
        <TabsList className="grid grid-cols-2 w-full md:w-auto md:inline-flex">
          <TabsTrigger value="single" className="gap-1.5">
            <FileText className="h-4 w-4" />
            単票モード
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-1.5">
            <Files className="h-4 w-4" />
            一括モード
          </TabsTrigger>
        </TabsList>

        {/* 両モードを常時マウントし、表示をCSSで切り替えることで
            タブ切替時にRadix Portal/DialogがアンマウントされるremoveChildエラーを防ぐ。 */}
        <div className={tab === "single" ? "space-y-6" : "hidden"} aria-hidden={tab !== "single"}>
          <SingleMode />
        </div>
        <div className={tab === "bulk" ? "space-y-6" : "hidden"} aria-hidden={tab !== "bulk"}>
          <BulkMode />
        </div>
      </Tabs>
    </div>
  );
}

/* ============================================================
   単票モード（従来の体験）
   ============================================================ */
function SingleMode() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdfName, setPdfName] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [data, setData] = useState<Extracted | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const uploadMutation = trpc.cases.uploadPdf.useMutation();
  const extractMutation = trpc.cases.extractFromPdf.useMutation();
  const createMutation = trpc.cases.create.useMutation({
    onSuccess: ({ id }) => {
      setCreatedId(id);
      toast.success("案件を登録しました");
      utils.cases.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("PDFファイルを選択してください");
      return;
    }
    setPdfName(file.name);
    setData(null);
    setCreatedId(null);
    try {
      const base64 = await fileToBase64(file);
      const { url, fileKey } = await uploadMutation.mutateAsync({
        fileName: file.name,
        fileBase64: base64,
        mimeType: "application/pdf",
      });
      setPdfUrl(url);
      toast.info("PDFをアップロードしました。抽出を実行します...");
      const res = await extractMutation.mutateAsync({ fileKey });
      const ex = res.extracted as any;
      setData({
        ...ex,
        requestDate: ex.requestDate ? new Date(ex.requestDate) : null,
      });
      toast.success("PDFから案件情報を抽出しました");
    } catch (e: any) {
      toast.error(e?.message ?? "PDF処理に失敗しました");
    }
  };

  const update = <K extends keyof Extracted>(key: K, value: Extracted[K]) => {
    setData((d) => (d ? { ...d, [key]: value } : d));
  };

  const handleRegister = () => {
    if (!data) return;
    if (!data.requestNumber || !data.storeName) {
      toast.error("依頼番号と店舗名は必須です");
      return;
    }
    createMutation.mutate({
      requestNumber: data.requestNumber,
      brand: data.brand,
      storeName: data.storeName,
      storeCode: data.storeCode || null,
      shopId: data.shopId || null,
      address: data.address || null,
      storePhone: data.storePhone || null,
      businessHours: data.businessHours || null,
      requestDate: data.requestDate ?? new Date(),
      requesterName: data.requesterName || null,
      requesterPhone: data.requesterPhone || null,
      requestContent: data.requestContent || null,
      workType: data.workType,
      costBearer: data.costBearer,
      categoryLarge: data.categoryLarge || null,
      categoryMedium: data.categoryMedium || null,
      categorySmall: data.categorySmall || null,
      contractorName: data.contractorName || null,
      contractorPic: data.contractorPic || null,
      contractorPhone: data.contractorPhone || null,
      urgency: data.urgency,
      status: "受付",
    });
  };

  const reset = () => {
    setData(null);
    setPdfName("");
    setPdfUrl("");
    setCreatedId(null);
  };

  const loading = uploadMutation.isPending || extractMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-serif-jp text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" />
            PDFをアップロード
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>修理依頼システム書面（依頼進捗更新）のPDFを準備</li>
            <li>下のボタンから選択 → AIが自動で項目を抽出</li>
            <li>内容を確認・微修正して「この内容で登録」</li>
          </ol>
          <input
            type="file"
            accept="application/pdf,.pdf"
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
              PDFファイルを選択
            </Button>
            {pdfName && (
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <FileText className="h-3 w-3" />
                {pdfName}
              </Badge>
            )}
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground self-center underline underline-offset-2"
              >
                アップロード済PDFを確認
              </a>
            )}
            {(data || pdfName) && (
              <Button variant="outline" onClick={reset} disabled={loading}>
                <RotateCcw className="h-4 w-4" />
                クリア
              </Button>
            )}
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground">
              AI抽出中... 5〜15秒ほどかかります
            </p>
          )}
        </CardContent>
      </Card>

      {data && !createdId && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif-jp text-lg flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              抽出結果（編集可）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ExtractedFields data={data} update={update} />
            <div className="flex justify-end pt-2">
              <Button onClick={handleRegister} disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                この内容で案件登録
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {createdId && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-medium text-sm">案件を登録しました</p>
                <p className="text-xs text-muted-foreground">
                  PDFから抽出した内容で案件 #{createdId} が作成されました
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                続けて別のPDFを登録
              </Button>
              <Button onClick={() => setLocation(`/cases/${createdId}`)}>
                案件詳細へ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ============================================================
   一括モード
   ============================================================ */
type BulkRow = {
  id: string;
  fileName: string;
  size: number;
  status: "pending" | "uploading" | "extracting" | "ready" | "error" | "saving" | "saved" | "skipped";
  error?: string;
  fileKey?: string;
  pdfUrl?: string;
  data?: Extracted;
  include: boolean;
  duplicate?: boolean;
  existingId?: number;
  newId?: number;
};

function BulkMode() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const uploadMutation = trpc.cases.uploadPdf.useMutation();
  const extractMutation = trpc.cases.extractFromPdf.useMutation();
  const createMutation = trpc.cases.create.useMutation();
  // checkDuplicates は query 定義のため utils.fetch で呼ぶ

  const stats = useMemo(() => {
    const total = rows.length;
    const ready = rows.filter((r) => r.status === "ready" && r.include).length;
    const dups = rows.filter((r) => r.duplicate).length;
    const saved = rows.filter((r) => r.status === "saved").length;
    const errors = rows.filter((r) => r.status === "error").length;
    return { total, ready, dups, saved, errors };
  }, [rows]);

  const onPickFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (arr.length === 0) {
      toast.error("PDFファイルが選択されていません");
      return;
    }
    const newRows: BulkRow[] = arr.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: f.name,
      size: f.size,
      status: "pending",
      include: true,
    }));
    // ファイル本体をrowsには持たず、Mapで一時的に保持
    const fileMap = new Map(newRows.map((r, i) => [r.id, arr[i]]));
    setRows((prev) => [...prev, ...newRows]);
    await runExtraction(newRows, fileMap);
  };

  const updateRow = (id: string, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const runExtraction = async (targets: BulkRow[], fileMap: Map<string, File>) => {
    setIsExtracting(true);
    const concurrency = 3;
    const queue = [...targets];
    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(
        (async () => {
          while (queue.length) {
            const row = queue.shift();
            if (!row) break;
            const file = fileMap.get(row.id);
            if (!file) continue;
            try {
              updateRow(row.id, { status: "uploading" });
              const base64 = await fileToBase64(file);
              const up = await uploadMutation.mutateAsync({
                fileName: file.name,
                fileBase64: base64,
                mimeType: "application/pdf",
              });
              updateRow(row.id, {
                status: "extracting",
                fileKey: up.fileKey,
                pdfUrl: up.url,
              });
              const res = await extractMutation.mutateAsync({ fileKey: up.fileKey });
              const ex: any = res.extracted;
              const data: Extracted = {
                ...ex,
                requestDate: ex.requestDate ? new Date(ex.requestDate) : null,
              };
              updateRow(row.id, { status: "ready", data });
            } catch (e: any) {
              updateRow(row.id, {
                status: "error",
                error: e?.message ?? "抽出に失敗しました",
              });
            }
          }
        })()
      );
    }
    await Promise.all(workers);
    setIsExtracting(false);

    // 全件抽出後にまとめて重複チェック
    setRows((prev) => {
      const reqs = prev
        .filter((r) => r.status === "ready" && r.data?.requestNumber)
        .map((r) => r.data!.requestNumber);
      if (reqs.length === 0) return prev;
      utils.cases.checkDuplicates
        .fetch({ requestNumbers: reqs })
        .then((res) => {
          const map = new Map<string, number>(
            res.duplicates.map((d) => [d.requestNumber, d.existingId] as const)
          );
          setRows((cur) =>
            cur.map((r) => {
              if (r.data && map.has(r.data.requestNumber)) {
                return {
                  ...r,
                  duplicate: true,
                  existingId: map.get(r.data.requestNumber),
                };
              }
              return r;
            })
          );
        })
        .catch(() => {
          /* noop */
        });
      return prev;
    });
  };

  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const toggleInclude = (id: string, v: boolean) =>
    updateRow(id, { include: v });

  const onSaveAll = async () => {
    const targets = rows.filter((r) => r.status === "ready" && r.include && r.data);
    if (targets.length === 0) {
      toast.error("登録対象がありません");
      return;
    }
    setIsSaving(true);
    let okCount = 0;
    let ngCount = 0;
    for (const row of targets) {
      const data = row.data!;
      if (!data.requestNumber || !data.storeName) {
        updateRow(row.id, {
          status: "error",
          error: "依頼番号と店舗名は必須です",
        });
        ngCount++;
        continue;
      }
      try {
        updateRow(row.id, { status: "saving" });
        const r = await createMutation.mutateAsync({
          requestNumber: data.requestNumber,
          brand: data.brand,
          storeName: data.storeName,
          storeCode: data.storeCode || null,
          shopId: data.shopId || null,
          address: data.address || null,
          storePhone: data.storePhone || null,
          businessHours: data.businessHours || null,
          requestDate: data.requestDate ?? new Date(),
          requesterName: data.requesterName || null,
          requesterPhone: data.requesterPhone || null,
          requestContent: data.requestContent || null,
          workType: data.workType,
          costBearer: data.costBearer,
          categoryLarge: data.categoryLarge || null,
          categoryMedium: data.categoryMedium || null,
          categorySmall: data.categorySmall || null,
          contractorName: data.contractorName || null,
          contractorPic: data.contractorPic || null,
          contractorPhone: data.contractorPhone || null,
          urgency: data.urgency,
          status: "受付",
        });
        updateRow(row.id, { status: "saved", newId: r.id });
        okCount++;
      } catch (e: any) {
        updateRow(row.id, {
          status: "error",
          error: e?.message ?? "登録に失敗しました",
        });
        ngCount++;
      }
    }
    setIsSaving(false);
    utils.cases.list.invalidate();
    toast.success(`一括登録：成功 ${okCount}件 / 失敗 ${ngCount}件`);
  };

  // 編集中のダイアログを安定させるため、rowオブジェクトではなく
  // editingId(string|null) を単一の真実として使う。
  const editingRow = editingId ? rows.find((r) => r.id === editingId) ?? null : null;
  const editingData = editingRow?.data ?? null;

  return (
    <>
      {/* 投入エリア */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif-jp text-lg flex items-center gap-2">
            <Files className="h-4 w-4 text-amber-600" />
            複数PDFをまとめて取込
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) onPickFiles(e.dataTransfer.files);
            }}
            className="rounded-lg border-2 border-dashed border-border/70 hover:border-primary/50 transition-colors p-8 text-center bg-muted/20"
          >
            <Files className="h-9 w-9 mx-auto text-muted-foreground/70 mb-3" />
            <p className="text-sm text-foreground font-medium mb-1">
              PDFをここにドロップ
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              または下のボタンから複数選択。最大同時抽出数は3件です。
            </p>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              ref={fileRef}
              onChange={async (e) => {
                if (e.target.files) await onPickFiles(e.target.files);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={isExtracting || isSaving}
            >
              <Upload className="h-4 w-4" />
              PDFファイルを選択（複数可）
            </Button>
          </div>

          {/* サマリー */}
          {rows.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <Stat label="ファイル" value={`${stats.total}件`} />
              <Stat label="登録準備OK" value={`${stats.ready}件`} hue="emerald" />
              <Stat
                label="重複検知"
                value={`${stats.dups}件`}
                hue={stats.dups > 0 ? "amber" : "default"}
              />
              <Stat label="登録済" value={`${stats.saved}件`} hue="blue" />
              <Stat
                label="エラー"
                value={`${stats.errors}件`}
                hue={stats.errors > 0 ? "red" : "default"}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 進捗テーブル */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">取込キュー</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRows([])}
                disabled={isExtracting || isSaving}
              >
                <RotateCcw className="h-4 w-4" />
                すべてクリア
              </Button>
              <Button
                onClick={onSaveAll}
                disabled={isExtracting || isSaving || stats.ready === 0}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                チェック済 {stats.ready} 件を一括登録
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-muted/60 text-foreground/80">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-10"></th>
                    <th className="text-left px-3 py-2 font-medium">ファイル</th>
                    <th className="text-left px-3 py-2 font-medium">状態</th>
                    <th className="text-left px-3 py-2 font-medium">依頼番号</th>
                    <th className="text-left px-3 py-2 font-medium">店舗</th>
                    <th className="text-left px-3 py-2 font-medium">区分</th>
                    <th className="text-right px-3 py-2 font-medium w-32">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-2 align-top">
                        <Checkbox
                          checked={r.include}
                          disabled={r.status !== "ready"}
                          onCheckedChange={(v) => toggleInclude(r.id, !!v)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-start gap-2 min-w-0">
                          <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate max-w-[240px]">
                              {r.fileName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {(r.size / 1024).toFixed(0)} KB
                              {r.pdfUrl && (
                                <>
                                  {" · "}
                                  <a
                                    href={r.pdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-2"
                                  >
                                    PDFを開く
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <StatusBadge row={r} />
                        {r.duplicate && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            既存案件 #{r.existingId} と依頼番号が重複
                          </div>
                        )}
                        {r.error && (
                          <div className="mt-1 text-[11px] text-red-700 max-w-[260px]">
                            {r.error}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top tabular-nums">
                        {r.data?.requestNumber || "—"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="text-sm">
                          {r.data?.storeName || "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.data?.brand}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {r.data?.workType ? (
                          <Badge variant="outline">{r.data.workType}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <div className="inline-flex gap-1">
                          {r.status === "ready" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(r.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              編集
                            </Button>
                          )}
                          {r.status === "saved" && r.newId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/cases/${r.newId}`)}
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                              開く
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeRow(r.id)}
                            disabled={isSaving}
                            title="リストから外す"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 編集ダイアログ：openは editingId の有無（プリミティブ）で判定してオブジェクト参照を避ける */}
      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif-jp">抽出結果の編集</DialogTitle>
          </DialogHeader>
          {editingId && editingData ? (
            <ExtractedFields
              key={editingId}
              data={editingData}
              update={(k, v) => {
                // 状態更新は関数型 setRows で最新の row を参照してマージ
                setRows((prev) =>
                  prev.map((r) => {
                    if (r.id !== editingId || !r.data) return r;
                    return { ...r, data: { ...r.data, [k]: v } };
                  })
                );
              }}
            />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              読み込み中...
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              <X className="h-4 w-4" />
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ============================================================
   共通コンポーネント
   ============================================================ */
function ExtractedFields({
  data,
  update,
}: {
  data: Extracted;
  update: <K extends keyof Extracted>(key: K, value: Extracted[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="依頼番号 *">
        <Input
          value={data.requestNumber}
          onChange={(e) => update("requestNumber", e.target.value)}
        />
      </Field>
      <Field label="ブランド">
        <select
          className="border rounded h-9 px-3 text-sm bg-background w-full"
          value={data.brand}
          onChange={(e) => update("brand", e.target.value as Extracted["brand"])}
        >
          <option>ほっともっと</option>
          <option>やよい軒</option>
          <option>その他</option>
        </select>
      </Field>
      <Field label="店舗名 *">
        <Input
          value={data.storeName}
          onChange={(e) => update("storeName", e.target.value)}
        />
      </Field>
      <Field label="店舗コード">
        <Input
          value={data.storeCode}
          onChange={(e) => update("storeCode", e.target.value)}
        />
      </Field>
      <Field label="SHOP-ID">
        <Input value={data.shopId} onChange={(e) => update("shopId", e.target.value)} />
      </Field>
      <Field label="店舗電話">
        <Input
          value={data.storePhone}
          onChange={(e) => update("storePhone", e.target.value)}
        />
      </Field>
      <Field label="住所" className="md:col-span-2">
        <Input value={data.address} onChange={(e) => update("address", e.target.value)} />
      </Field>
      <Field label="営業時間">
        <Input
          value={data.businessHours}
          onChange={(e) => update("businessHours", e.target.value)}
        />
      </Field>
      <Field label="依頼者">
        <Input
          value={data.requesterName}
          onChange={(e) => update("requesterName", e.target.value)}
        />
      </Field>
      <Field label="依頼者連絡先">
        <Input
          value={data.requesterPhone}
          onChange={(e) => update("requesterPhone", e.target.value)}
        />
      </Field>
      <Field label="緊急度">
        <select
          className="border rounded h-9 px-3 text-sm bg-background w-full"
          value={data.urgency}
          onChange={(e) => update("urgency", e.target.value as Extracted["urgency"])}
        >
          <option value="S">S</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
      </Field>
      <Field label="依頼内容" className="md:col-span-2">
        <Textarea
          value={data.requestContent}
          onChange={(e) => update("requestContent", e.target.value)}
          rows={4}
        />
      </Field>
      <Field label="作業区分">
        <select
          className="border rounded h-9 px-3 text-sm bg-background w-full"
          value={data.workType}
          onChange={(e) => update("workType", e.target.value as Extracted["workType"])}
        >
          <option>入替</option>
          <option>修理</option>
          <option>納品</option>
          <option>見積り</option>
          <option>新規</option>
        </select>
      </Field>
      <Field label="費用負担">
        <select
          className="border rounded h-9 px-3 text-sm bg-background w-full"
          value={data.costBearer}
          onChange={(e) => update("costBearer", e.target.value as Extracted["costBearer"])}
        >
          <option>店舗</option>
          <option>営業部</option>
          <option>その他</option>
        </select>
      </Field>
      <Field label="大項目">
        <Input
          value={data.categoryLarge}
          onChange={(e) => update("categoryLarge", e.target.value)}
        />
      </Field>
      <Field label="中項目">
        <Input
          value={data.categoryMedium}
          onChange={(e) => update("categoryMedium", e.target.value)}
        />
      </Field>
      <Field label="小項目">
        <Input
          value={data.categorySmall}
          onChange={(e) => update("categorySmall", e.target.value)}
        />
      </Field>
      <div />
      <Field label="取引先名">
        <Input
          value={data.contractorName}
          onChange={(e) => update("contractorName", e.target.value)}
        />
      </Field>
      <Field label="取引先責任者">
        <Input
          value={data.contractorPic}
          onChange={(e) => update("contractorPic", e.target.value)}
        />
      </Field>
      <Field label="取引先連絡先">
        <Input
          value={data.contractorPhone}
          onChange={(e) => update("contractorPhone", e.target.value)}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ row }: { row: BulkRow }) {
  const map: Record<BulkRow["status"], { label: string; cls: string; icon?: any }> = {
    pending: { label: "待機", cls: "bg-muted text-foreground/70" },
    uploading: {
      label: "アップロード中…",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
    },
    extracting: {
      label: "AI抽出中…",
      cls: "bg-violet-50 text-violet-700 border-violet-200",
    },
    ready: {
      label: "抽出OK",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    skipped: { label: "スキップ", cls: "bg-muted text-foreground/70" },
    saving: { label: "登録中…", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    saved: {
      label: "登録済",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-300",
    },
    error: { label: "エラー", cls: "bg-red-50 text-red-700 border-red-200" },
  };
  const v = map[row.status];
  const spinning = row.status === "uploading" || row.status === "extracting" || row.status === "saving";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${v.cls}`}
    >
      {spinning && <Loader2 className="h-3 w-3 animate-spin" />}
      {v.label}
    </span>
  );
}

function Stat({
  label,
  value,
  hue = "default",
}: {
  label: string;
  value: string;
  hue?: "default" | "emerald" | "amber" | "red" | "blue";
}) {
  const palette: Record<string, string> = {
    default: "bg-muted/50 text-foreground border-border",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-800 border-red-200",
    blue: "bg-blue-50 text-blue-800 border-blue-200",
  };
  return (
    <div className={`rounded border px-3 py-2 ${palette[hue]}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
