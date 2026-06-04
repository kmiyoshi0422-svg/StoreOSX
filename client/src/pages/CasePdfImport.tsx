import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, Sparkles, ArrowRight, RotateCcw, ImageIcon, Trash2 } from "lucide-react";
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

export default function CasePdfImport() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdfName, setPdfName] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [pdfFileKey, setPdfFileKey] = useState<string>("");
  const [data, setData] = useState<Extracted | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  // PDFから抽出した現況写真（保存済）
  const [extractedPhotos, setExtractedPhotos] = useState<{ id: number; url: string }[]>([]);
  const [photoExtracting, setPhotoExtracting] = useState(false);

  const uploadMutation = trpc.cases.uploadPdf.useMutation();
  const extractMutation = trpc.cases.extractFromPdf.useMutation();
  const extractPhotosMutation = trpc.cases.extractPhotosFromPdf.useMutation();
  const deletePhotoMutation = trpc.photos.delete.useMutation();
  const createMutation = trpc.cases.create.useMutation({
    onSuccess: ({ id }) => {
      setCreatedId(id);
      toast.success("案件を登録しました");
      utils.cases.list.invalidate();
      // 登録した案件に対して、同じPDFから現況写真を自動抽出
      void runPhotoExtraction(id);
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
      setPdfFileKey(fileKey);
      toast.info("PDFをアップロードしました。抽出を実行します...");
      const res = await extractMutation.mutateAsync({ fileKey });
      const ex = res.extracted as any;
      setData({
        ...ex,
        requestDate: ex.requestDate ? new Date(ex.requestDate) : null,
      });
      if ((res as any).parseFailed) {
        toast.warning(
          "自動抽出がうまくいきませんでした。下のフォームに手入力して登録してください。"
        );
      } else {
        toast.success("PDFから案件情報を抽出しました");
      }
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

  // 案件登録後に、同じPDFから現況写真を自動抽出・保存する
  const runPhotoExtraction = async (caseId: number) => {
    if (!pdfFileKey) return;
    setPhotoExtracting(true);
    try {
      const res = await extractPhotosMutation.mutateAsync({ caseId, fileKey: pdfFileKey });
      setExtractedPhotos(res.photos);
      if (res.saved > 0) {
        toast.success(`現況写真を ${res.saved} 枚取り込みました`);
      } else {
        toast.info("PDF内に現況写真は見つかりませんでした");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "現況写真の抽出に失敗しました");
    } finally {
      setPhotoExtracting(false);
    }
  };

  const handleDeletePhoto = async (id: number) => {
    // 楽観的にUIから即時除去
    const prev = extractedPhotos;
    setExtractedPhotos((list) => list.filter((p) => p.id !== id));
    try {
      await deletePhotoMutation.mutateAsync({ id });
      if (createdId) utils.photos.listByCase.invalidate({ caseId: createdId });
    } catch (e: any) {
      setExtractedPhotos(prev);
      toast.error(e?.message ?? "削除に失敗しました");
    }
  };

  const reset = () => {
    setData(null);
    setPdfName("");
    setPdfUrl("");
    setPdfFileKey("");
    setCreatedId(null);
    setExtractedPhotos([]);
  };

  const loading = uploadMutation.isPending || extractMutation.isPending;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">PDF Import</p>
        <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">PDFから案件登録</h1>
        <p className="text-sm text-muted-foreground mt-2">
          「依頼進捗更新」のPDFをアップロードすると、AIが店舗情報・依頼内容・取引先を読み取ります。
        </p>
      </div>

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
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground self-center underline underline-offset-2">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="依頼番号 *">
                <Input value={data.requestNumber} onChange={(e) => update("requestNumber", e.target.value)} />
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
                <Input value={data.storeName} onChange={(e) => update("storeName", e.target.value)} />
              </Field>
              <Field label="店舗コード">
                <Input value={data.storeCode} onChange={(e) => update("storeCode", e.target.value)} />
              </Field>
              <Field label="SHOP-ID">
                <Input value={data.shopId} onChange={(e) => update("shopId", e.target.value)} />
              </Field>
              <Field label="店舗電話">
                <Input value={data.storePhone} onChange={(e) => update("storePhone", e.target.value)} />
              </Field>
              <Field label="住所" className="md:col-span-2">
                <Input value={data.address} onChange={(e) => update("address", e.target.value)} />
              </Field>
              <Field label="営業時間">
                <Input value={data.businessHours} onChange={(e) => update("businessHours", e.target.value)} />
              </Field>
              <Field label="依頼者">
                <Input value={data.requesterName} onChange={(e) => update("requesterName", e.target.value)} />
              </Field>
              <Field label="依頼者連絡先">
                <Input value={data.requesterPhone} onChange={(e) => update("requesterPhone", e.target.value)} />
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
                <Input value={data.categoryLarge} onChange={(e) => update("categoryLarge", e.target.value)} />
              </Field>
              <Field label="中項目">
                <Input value={data.categoryMedium} onChange={(e) => update("categoryMedium", e.target.value)} />
              </Field>
              <Field label="小項目">
                <Input value={data.categorySmall} onChange={(e) => update("categorySmall", e.target.value)} />
              </Field>
              <div />
              <Field label="取引先名">
                <Input value={data.contractorName} onChange={(e) => update("contractorName", e.target.value)} />
              </Field>
              <Field label="取引先責任者">
                <Input value={data.contractorPic} onChange={(e) => update("contractorPic", e.target.value)} />
              </Field>
              <Field label="取引先連絡先">
                <Input value={data.contractorPhone} onChange={(e) => update("contractorPhone", e.target.value)} />
              </Field>
            </div>

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
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="font-medium text-sm">案件を登録しました</p>
                  <p className="text-xs text-muted-foreground">PDFから抽出した内容で案件 #{createdId} が作成されました</p>
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
            </div>

            {/* PDFから自動抽出した現況写真 */}
            <div className="rounded-lg border bg-white/70 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-medium">PDFから取り込んだ現況写真（現調）</p>
                {photoExtracting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {photoExtracting ? (
                <p className="text-xs text-muted-foreground">PDFから現況写真を抽出しています...</p>
              ) : extractedPhotos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  PDF内に現況写真は見つかりませんでした。案件詳細の「写真」タブから手動で追加できます。
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    {extractedPhotos.length} 枚を現調写真として保存しました。不要なものはゴミ箱ボタンで削除できます。
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {extractedPhotos.map((p) => (
                      <div key={p.id} className="relative group aspect-square overflow-hidden rounded-md border bg-muted">
                        <img src={p.url} alt="現況写真" className="h-full w-full object-cover" loading="lazy" />
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(p.id)}
                          className="absolute top-1 right-1 rounded-md bg-black/55 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          aria-label="写真を削除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
