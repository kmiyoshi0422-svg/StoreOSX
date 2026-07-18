import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Loader2,
  Download,
  Sparkles,
  Trash2,
  Camera,
  Table2,
  Pencil,
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

type LineItem = {
  no: number | null;
  name: string;
  specification: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number | null;
  remarks: string | null;
};

type Header = {
  vendorName: string | null;
  estimateDate: string | null;
  estimateNumber: string | null;
  customerName: string | null;
  projectName: string | null;
  validUntil: string | null;
  paymentTerms: string | null;
};

type Summary = {
  subtotal: number | null;
  tax: number | null;
  total: number | null;
};

type ExtractedData = {
  header: Header;
  items: LineItem[];
  summary: Summary;
  fileName: string;
};

export default function EstimateOcrExcel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [editingItem, setEditingItem] = useState<number | null>(null);

  const uploadMutation = trpc.estimates.uploadFile.useMutation();
  const extractMutation = trpc.estimates.extractLineItems.useMutation();
  const excelMutation = trpc.estimates.generateExcel.useMutation();

  async function handleFile(file: File) {
    setIsExtracting(true);
    setExtracted(null);
    try {
      const base64 = await fileToBase64(file);
      const up = await uploadMutation.mutateAsync({
        caseId: 0,
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type || "application/pdf",
      });
      const result = await extractMutation.mutateAsync({
        fileKey: up.fileKey,
        mimeType: file.type || "application/pdf",
      });
      setExtracted({
        header: result.header as Header,
        items: (result.items as LineItem[]).map((item, idx) => ({
          ...item,
          no: item.no ?? idx + 1,
        })),
        summary: result.summary as Summary,
        fileName: file.name.replace(/\.[^.]+$/, ""),
      });
      toast.success("見積書の読み取りが完了しました");
    } catch (e: any) {
      toast.error(e?.message || "読み取りに失敗しました");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleExport() {
    if (!extracted) return;
    setIsExporting(true);
    try {
      const result = await excelMutation.mutateAsync({
        header: extracted.header as any,
        items: extracted.items.map((item) => ({
          ...item,
          name: item.name || "",
        })),
        summary: extracted.summary as any,
        fileName: extracted.fileName,
      });
      // ダウンロード
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Excelファイルをダウンロードしました");
    } catch (e: any) {
      toast.error(e?.message || "Excel生成に失敗しました");
    } finally {
      setIsExporting(false);
    }
  }

  function updateItem(idx: number, patch: Partial<LineItem>) {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      items: extracted.items.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    });
  }

  function updateHeader(patch: Partial<Header>) {
    if (!extracted) return;
    setExtracted({ ...extracted, header: { ...extracted.header, ...patch } });
  }

  function updateSummary(patch: Partial<Summary>) {
    if (!extracted) return;
    setExtracted({ ...extracted, summary: { ...extracted.summary, ...patch } });
  }

  function removeItem(idx: number) {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      items: extracted.items.filter((_, i) => i !== idx),
    });
  }

  function addItem() {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      items: [
        ...extracted.items,
        { no: extracted.items.length + 1, name: "", specification: null, quantity: null, unit: null, unitPrice: null, amount: null, remarks: null },
      ],
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">見積書OCR → Excel出力</h1>
          <p className="text-sm text-muted-foreground">
            紙の見積書を写真・スキャン・PDFで読み取り、明細行をExcelデータとして出力します。
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFile(e.target.files[0]);
                e.target.value = "";
              }
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFile(e.target.files[0]);
                e.target.value = "";
              }
            }}
          />
          <Button onClick={() => cameraRef.current?.click()} variant="outline" size="sm">
            <Camera className="h-4 w-4 mr-1" /> 撮影
          </Button>
          <Button onClick={() => fileRef.current?.click()} variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" /> ファイル選択
          </Button>
          {extracted && (
            <Button onClick={handleExport} disabled={isExporting} size="sm">
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Excel出力
            </Button>
          )}
        </div>
      </div>

      {/* ドロップゾーン */}
      {!extracted && !isExtracting && (
        <div
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget === e.target) setIsDragging(false); }}
          onDrop={(e) => {
            e.preventDefault(); e.stopPropagation(); setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && (file.type === "application/pdf" || file.type.startsWith("image/"))) {
              handleFile(file);
            } else {
              toast.error("PDFまたは画像ファイルのみ対応しています");
            }
          }}
          className={`rounded-md border-2 border-dashed transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/40"
          }`}
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full py-16 text-center cursor-pointer"
          >
            <FileText className={`h-12 w-12 mx-auto mb-3 ${isDragging ? "text-primary" : "text-muted-foreground/50"}`} />
            <div className="font-medium text-sm">
              {isDragging ? "ここにドロップしてください" : "見積書をドラッグ＆ドロップ または クリックして選択"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">PDF / 画像（写真・スキャン）に対応</div>
            <div className="text-xs text-muted-foreground mt-1">スマートフォンの場合は「撮影」ボタンでカメラ起動できます</div>
          </button>
        </div>
      )}

      {/* 解析中 */}
      {isExtracting && (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
            <div className="font-medium">AIが見積書を解析中...</div>
            <div className="text-xs text-muted-foreground mt-1">明細行・金額を読み取っています。少々お待ちください。</div>
          </CardContent>
        </Card>
      )}

      {/* 抽出結果プレビュー */}
      {extracted && (
        <div className="space-y-4">
          {/* ヘッダー情報 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                ヘッダー情報
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">見積作成会社</label>
                  <Input
                    value={extracted.header.vendorName ?? ""}
                    onChange={(e) => updateHeader({ vendorName: e.target.value || null })}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">見積日</label>
                  <Input
                    type="date"
                    value={extracted.header.estimateDate ?? ""}
                    onChange={(e) => updateHeader({ estimateDate: e.target.value || null })}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">見積番号</label>
                  <Input
                    value={extracted.header.estimateNumber ?? ""}
                    onChange={(e) => updateHeader({ estimateNumber: e.target.value || null })}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">宛先</label>
                  <Input
                    value={extracted.header.customerName ?? ""}
                    onChange={(e) => updateHeader({ customerName: e.target.value || null })}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">件名</label>
                  <Input
                    value={extracted.header.projectName ?? ""}
                    onChange={(e) => updateHeader({ projectName: e.target.value || null })}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">有効期限</label>
                  <Input
                    type="date"
                    value={extracted.header.validUntil ?? ""}
                    onChange={(e) => updateHeader({ validUntil: e.target.value || null })}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">支払条件</label>
                  <Input
                    value={extracted.header.paymentTerms ?? ""}
                    onChange={(e) => updateHeader({ paymentTerms: e.target.value || null })}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 明細テーブル */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-primary" />
                  明細行（{extracted.items.length}件）
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addItem}>
                  + 行追加
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-center w-10">No</th>
                      <th className="px-2 py-2 text-left min-w-[160px]">項目名</th>
                      <th className="px-2 py-2 text-left min-w-[120px]">仕様・規格</th>
                      <th className="px-2 py-2 text-right w-16">数量</th>
                      <th className="px-2 py-2 text-center w-12">単位</th>
                      <th className="px-2 py-2 text-right w-20">単価</th>
                      <th className="px-2 py-2 text-right w-24">金額</th>
                      <th className="px-2 py-2 text-left min-w-[100px]">備考</th>
                      <th className="px-2 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {extracted.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        {editingItem === idx ? (
                          <>
                            <td className="px-2 py-1.5">
                              <Input
                                type="number"
                                value={item.no ?? ""}
                                onChange={(e) => updateItem(idx, { no: e.target.value ? Number(e.target.value) : null })}
                                className="h-7 w-10 text-xs text-center"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                value={item.name}
                                onChange={(e) => updateItem(idx, { name: e.target.value })}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                value={item.specification ?? ""}
                                onChange={(e) => updateItem(idx, { specification: e.target.value || null })}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                type="number"
                                value={item.quantity ?? ""}
                                onChange={(e) => updateItem(idx, { quantity: e.target.value ? Number(e.target.value) : null })}
                                className="h-7 w-16 text-xs text-right"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                value={item.unit ?? ""}
                                onChange={(e) => updateItem(idx, { unit: e.target.value || null })}
                                className="h-7 w-12 text-xs text-center"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                type="number"
                                value={item.unitPrice ?? ""}
                                onChange={(e) => updateItem(idx, { unitPrice: e.target.value ? Number(e.target.value) : null })}
                                className="h-7 w-20 text-xs text-right"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                type="number"
                                value={item.amount ?? ""}
                                onChange={(e) => updateItem(idx, { amount: e.target.value ? Number(e.target.value) : null })}
                                className="h-7 w-24 text-xs text-right"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                value={item.remarks ?? ""}
                                onChange={(e) => updateItem(idx, { remarks: e.target.value || null })}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)} className="h-6 px-2 text-xs">
                                完了
                              </Button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-1.5 text-center text-muted-foreground">{item.no ?? ""}</td>
                            <td className="px-2 py-1.5 font-medium">{item.name}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{item.specification ?? ""}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{item.quantity ?? ""}</td>
                            <td className="px-2 py-1.5 text-center">{item.unit ?? ""}</td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {item.unitPrice != null ? `¥${item.unitPrice.toLocaleString()}` : ""}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono font-medium">
                              {item.amount != null ? `¥${item.amount.toLocaleString()}` : ""}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground text-xs">{item.remarks ?? ""}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex gap-0.5">
                                <Button size="sm" variant="ghost" onClick={() => setEditingItem(idx)} className="h-6 w-6 p-0">
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => removeItem(idx)} className="h-6 w-6 p-0 text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 合計 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">合計情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">小計（税抜）</label>
                  <Input
                    type="number"
                    value={extracted.summary.subtotal ?? ""}
                    onChange={(e) => updateSummary({ subtotal: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">消費税</label>
                  <Input
                    type="number"
                    value={extracted.summary.tax ?? ""}
                    onChange={(e) => updateSummary({ tax: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">合計（税込）</label>
                  <Input
                    type="number"
                    value={extracted.summary.total ?? ""}
                    onChange={(e) => updateSummary({ total: e.target.value ? Number(e.target.value) : null })}
                    className="h-8 mt-1 font-mono font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* アクションバー */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setExtracted(null);
                setEditingItem(null);
              }}
            >
              別の見積書を読み取る
            </Button>
            <Button onClick={handleExport} disabled={isExporting} className="gap-2">
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Excelファイルをダウンロード
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
