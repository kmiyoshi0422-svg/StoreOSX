import { useState, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { SendHorizontal, Upload, Camera, Loader2, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["材料費", "外注費", "交通費", "消耗品", "車両費", "宿泊費", "接待交際費", "人件費", "現調費", "その他"] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ExpenseSubmit() {
  const [scope, setScope] = useState<"案件" | "全体">("案件");
  const [caseId, setCaseId] = useState<string>("");
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("その他");
  const [note, setNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const uploadFileMutation = trpc.expenses.uploadFile.useMutation();
  const submitMutation = trpc.expenses.submit.useMutation({
    onSuccess: () => {
      toast.success("経費申請を送信しました");
      resetForm();
      utils.expenses.listPending.invalidate();
    },
    onError: (err) => toast.error(`申請失敗: ${err.message}`),
  });

  // 案件一覧（セレクト用）
  const { data: cases } = trpc.cases.listMinimal.useQuery();

  function resetForm() {
    setCaseId("");
    setVendorName("");
    setAmount("");
    setTaxAmount("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setCategory("その他");
    setNote("");
    setReceiptFile(null);
    setReceiptPreview(null);
  }

  function handleFileSelect(file: File | null) {
    if (!file) return;
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("金額を入力してください");
      return;
    }

    let fileKey: string | null = null;
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let mimeType: string | null = null;

    // レシート画像アップロード（tRPC経由）
    if (receiptFile) {
      setUploading(true);
      try {
        const base64 = await fileToBase64(receiptFile);
        const uploadResult = await uploadFileMutation.mutateAsync({
          fileName: receiptFile.name,
          fileBase64: base64,
          mimeType: receiptFile.type,
        });
        fileKey = uploadResult.fileKey;
        fileUrl = uploadResult.url;
        fileName = receiptFile.name;
        mimeType = uploadResult.mimeType;
      } catch (err) {
        toast.error("レシート画像のアップロードに失敗しました");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    submitMutation.mutate({
      caseId: scope === "案件" && caseId ? Number(caseId) : null,
      scope,
      vendorName: vendorName || null,
      amount: Number(amount),
      taxAmount: taxAmount ? Number(taxAmount) : null,
      expenseDate: expenseDate || null,
      category,
      note: note || null,
      fileKey,
      fileUrl,
      fileName,
      mimeType,
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="経費申請" icon={<SendHorizontal className="h-5 w-5" />} description="経費を申請します。レシート画像を添付して送信してください。" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">申請フォーム</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* スコープ */}
            <div className="space-y-1.5">
              <Label>区分</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={scope === "案件" ? "default" : "outline"} onClick={() => setScope("案件")}>案件</Button>
                <Button type="button" size="sm" variant={scope === "全体" ? "default" : "outline"} onClick={() => setScope("全体")}>全体</Button>
              </div>
            </div>

            {/* 案件選択 */}
            {scope === "案件" && (
              <div className="space-y-1.5">
                <Label>案件</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {cases?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.requestNumber ? `${c.requestNumber} - ` : ""}{c.storeName ?? `案件#${c.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 金額 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>金額（税込）*</Label>
                <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" />
              </div>
              <div className="space-y-1.5">
                <Label>内消費税</Label>
                <Input type="number" min="0" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="909" />
              </div>
            </div>

            {/* 日付・業者名 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>支払日</Label>
                <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>支払先</Label>
                <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="業者名" />
              </div>
            </div>

            {/* カテゴリ */}
            <div className="space-y-1.5">
              <Label>費目</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* 備考 */}
            <div className="space-y-1.5">
              <Label>摘要・メモ</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="用途や詳細を記入" rows={2} />
            </div>

            {/* レシート画像 */}
            <div className="space-y-1.5">
              <Label>レシート画像</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> ファイル選択
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-1" /> カメラ撮影
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)} />
              </div>
              {receiptPreview && (
                <div className="relative mt-2 inline-block">
                  <img src={receiptPreview} alt="レシート" className="max-h-40 rounded-md border" />
                  <button type="button" className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5" onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* 送信ボタン */}
            <Button type="submit" className="w-full" disabled={submitMutation.isPending || uploading}>
              {(submitMutation.isPending || uploading) ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> 送信中…</>
              ) : (
                <><SendHorizontal className="h-4 w-4 mr-2" /> 経費を申請</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
