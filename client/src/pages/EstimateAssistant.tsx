import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  Download,
  ExternalLink,
  FileCheck2,
  FileUp,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  FORETIA_HEIGHT_CM,
  FORETIA_WIDTH_CM,
  FORETIA_PRICES_TAX_INCLUDED,
  FORETIA_PRICE_DATE,
  FORETIA_SOURCE,
  calculateEstimate,
  canUseEstimateAssistant,
  quoteForetia,
  type EstimateLine,
} from "../../../shared/estimateAssistant";
import {
  missingEstimateFields,
  resolveEstimateCandidates,
  type ReviewCandidate,
} from "../../../shared/estimateReview";

const yen = (value: number) => `¥${value.toLocaleString("ja-JP")}`;
const NO_PDF_SOURCE = { fileKey: "" } as const;
const blankLine = (): EstimateLine => ({
  name: "",
  specification: "",
  quantity: 1,
  unit: "式",
  unitPrice: null,
  source: "手入力（要確認）",
  note: "",
});
const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default function EstimateAssistant() {
  const { user } = useAuth();
  const canEdit = canUseEstimateAssistant(user?.role);
  const [, navigate] = useLocation();
  const initialCaseId =
    new URLSearchParams(window.location.search).get("caseId") ?? "";
  const [caseId, setCaseId] = useState(initialCaseId);
  const [title, setTitle] = useState("見積案");
  const [lines, setLines] = useState<EstimateLine[]>([]);
  const [reviewCandidates, setReviewCandidates] = useState<ReviewCandidate[]>(
    []
  );
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>(
    []
  );
  const candidateSequence = useRef(0);
  const [draftId, setDraftId] = useState<number | undefined>();
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<number | undefined>();
  const [draftStatus, setDraftStatus] = useState<"draft" | "approved">("draft");
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [sourcePdfKey, setSourcePdfKey] = useState<string | null>(null);
  const [sourcePdfName, setSourcePdfName] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<"manual" | "request_pdf">(
    "manual"
  );
  const [pdfContext, setPdfContext] = useState("");
  const [pdfMatchedCaseId, setPdfMatchedCaseId] = useState<number | null>(null);
  const [unitMode, setUnitMode] = useState<"mm" | "cm">("mm");
  const [width, setWidth] = useState("1800");
  const [height, setHeight] = useState("2000");
  const [quantity, setQuantity] = useState("1");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全て");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const pdfRef = useRef<HTMLInputElement>(null);
  const catalog = trpc.estimateAssistant.catalog.useQuery();
  const cases = trpc.cases.listMinimal.useQuery();
  const caseContext = trpc.estimateAssistant.caseContext.useQuery(
    { caseId: Number(caseId) },
    { enabled: Number(caseId) > 0 }
  );
  const draftQuery = trpc.estimateAssistant.listDrafts.useQuery(
    { caseId: Number(caseId) },
    { enabled: Number(caseId) > 0 }
  );
  const save = trpc.estimateAssistant.saveDraft.useMutation();
  const upload = trpc.estimateAssistant.uploadPdf.useMutation();
  const analyze = trpc.estimateAssistant.analyzePdf.useMutation();
  const analyzeRegisteredCase =
    trpc.estimateAssistant.analyzeCase.useMutation();
  const approve = trpc.estimateAssistant.approveDraft.useMutation();
  const pdfSource = useMemo(
    () =>
      draftId && sourcePdfKey
        ? { draftId }
        : sourcePdfKey?.startsWith("imports/case-") && Number(caseId) > 0
          ? { caseId: Number(caseId) }
          : sourcePdfKey
            ? { fileKey: sourcePdfKey }
            : null,
    [draftId, sourcePdfKey, caseId]
  );
  const pdfView = trpc.estimateAssistant.pdfPreviewUrl.useQuery(
    pdfSource ?? NO_PDF_SOURCE,
    { enabled: !!pdfSource }
  );
  const approvedQuote = trpc.estimateAssistant.approvedQuote.useQuery(
    { id: draftId ?? 0 },
    { enabled: !!draftId && draftStatus === "approved" }
  );
  const utils = trpc.useUtils();
  const amount = useMemo(() => calculateEstimate(lines), [lines]);
  const widthMm = Number(width) * (unitMode === "cm" ? 10 : 1);
  const heightMm = Number(height) * (unitMode === "cm" ? 10 : 1);
  const foretia = quoteForetia(widthMm, heightMm);
  const fingerprint = JSON.stringify({
    title,
    lines,
    sourceKind,
    sourcePdfKey,
    sourcePdfName,
  });
  const hasUnsavedChanges =
    draftId !== undefined &&
    draftStatus === "draft" &&
    savedFingerprint !== fingerprint;
  const canModify = canEdit && draftStatus === "draft";
  const selectedCount = reviewCandidates.filter(candidate =>
    selectedCandidateIds.includes(candidate.id)
  ).length;
  const reviewAllSelected =
    reviewCandidates.length > 0 && selectedCount === reviewCandidates.length;
  const stageCandidates = (items: EstimateLine[]) => {
    setReviewCandidates(
      items.map(line => ({ id: ++candidateSequence.current, line }))
    );
    setSelectedCandidateIds([]);
  };
  const clearCandidates = () => {
    setReviewCandidates([]);
    setSelectedCandidateIds([]);
  };
  const applyCandidateSelection = (action: "adopt" | "exclude") => {
    if (!canModify || !selectedCount) return;
    if (action === "adopt" && lines.length + selectedCount > 50)
      return toast.error(
        "保存できる明細は50件までです。候補の選択数を減らしてください"
      );
    if (
      action === "exclude" &&
      !window.confirm(
        `選択した候補 ${selectedCount}件を除外しますか？採用済み明細には影響しません。`
      )
    )
      return;
    const result = resolveEstimateCandidates(
      reviewCandidates,
      selectedCandidateIds,
      action
    );
    if (action === "adopt")
      setLines(current => [...current, ...result.adopted]);
    setReviewCandidates(result.remaining);
    setSelectedCandidateIds([]);
    toast.success(
      action === "adopt"
        ? `${selectedCount}件を見積明細に採用しました`
        : `${selectedCount}件を候補から除外しました`
    );
  };
  const categories = useMemo(
    () => [
      "全て",
      ...Array.from(
        new Set(catalog.data?.items.map(x => x.majorCategory) ?? [])
      ),
    ],
    [catalog.data]
  );
  const filtered = useMemo(
    () =>
      (catalog.data?.items ?? [])
        .filter(item => {
          if (category !== "全て" && category !== item.majorCategory)
            return false;
          const q = search.trim().normalize("NFKC").toLowerCase();
          return (
            !q ||
            `${item.name} ${item.specification ?? ""} ${item.category}`
              .normalize("NFKC")
              .toLowerCase()
              .includes(q)
          );
        })
        .slice(0, 60),
    [catalog.data, category, search]
  );
  const update = (i: number, change: Partial<EstimateLine>) =>
    canModify &&
    setLines(current =>
      current.map((line, j) => (i === j ? { ...line, ...change } : line))
    );
  const addForetia = () => {
    if (!canModify) return;
    if (!foretia)
      return toast.error("対応寸法・1cm単位・面積9㎡以下を確認してください");
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > 1000)
      return toast.error("台数を1～1000の整数で入力してください");
    setLines(current => [
      ...current,
      {
        name: "フォレティア50 ネイチャー／ラダーコード",
        specification: `幅${widthMm}×高さ${heightMm}mm (${foretia.widthBandCm}×${foretia.heightBandCm}cm帯)`,
        quantity: count,
        unit: "台",
        unitPrice: foretia.taxExcluded,
        source: `参考商品価格 ${FORETIA_PRICE_DATE} / ${FORETIA_SOURCE}（税込から換算・施工費別）`,
        note: "販売店価格・在庫・送料・取付条件を発注前に再確認",
      },
    ]);
    toast.success("見積案に追加しました");
  };
  const addStandard = (
    item: NonNullable<typeof catalog.data>["items"][number],
    band: "low" | "standard" | "high"
  ) => {
    if (!canModify) return;
    setLines(current => [
      ...current,
      {
        name: item.name,
        specification: item.specification ?? "",
        quantity: 1,
        unit: item.unit,
        unitPrice: item[band],
        source: `${item.id} / ${item.sourceRef ?? `標準施工単価表 ${catalog.data?.version}`}（税区分原本に明記なし・税抜試算）`,
        note: item.note ?? "",
      },
    ]);
    toast.success("見積案に追加しました");
  };
  const resetDraft = () => {
    clearCandidates();
    setDraftId(undefined);
    setDraftUpdatedAt(undefined);
    setDraftStatus("draft");
    setSavedFingerprint(null);
    setTitle("見積案");
    setLines([]);
    setSourcePdfKey(null);
    setSourcePdfName(null);
    setSourceKind("manual");
    setPdfContext("");
    setPdfMatchedCaseId(null);
    setPdfPage(1);
  };
  const persist = async () => {
    if (!canModify) return;
    if (reviewCandidates.length)
      return toast.error("候補をすべて採用または除外してから保存してください");
    if (!Number(caseId)) return toast.error("保存先の案件を選択してください");
    if (lines.length === 0 || lines.some(line => !line.name.trim()))
      return toast.error("空の明細名をなくしてください");
    if (
      sourceKind === "request_pdf" &&
      pdfMatchedCaseId &&
      Number(caseId) !== pdfMatchedCaseId &&
      !window.confirm(
        "PDFの依頼番号と保存先案件が異なります。この案件へ保存しますか？"
      )
    )
      return;
    try {
      const result = await save.mutateAsync({
        id: draftId,
        expectedUpdatedAt: draftUpdatedAt,
        caseId: Number(caseId),
        title,
        items: lines,
        sourceKind,
        sourcePdfKey,
        sourcePdfName,
      });
      setDraftId(result.id);
      setDraftUpdatedAt(result.updatedAt);
      setSavedFingerprint(fingerprint);
      await utils.estimateAssistant.listDrafts.invalidate({
        caseId: Number(caseId),
      });
      toast.success(
        "下書きを保存しました（案件金額・正式見積には反映していません）"
      );
    } catch (e: any) {
      toast.error(e?.message ?? "下書きを保存できませんでした");
    }
  };
  const approveAndDownload = async () => {
    if (!canModify || !draftId || !draftUpdatedAt) return;
    if (reviewCandidates.length)
      return toast.error("未判定の候補があります。採用または除外してください");
    if (hasUnsavedChanges)
      return toast.error("変更した明細を先に保存してください");
    if (amount.missing || amount.total <= 0)
      return toast.error("全明細の数量と単価を確定してから承認してください");
    if (
      !window.confirm(
        "現在の見積内容を承認し、編集できない正式見積書として固定します。よろしいですか？"
      )
    )
      return;
    let snapshot;
    try {
      snapshot = await approve.mutateAsync({
        id: draftId,
        expectedUpdatedAt: draftUpdatedAt,
      });
      setDraftStatus("approved");
      await utils.estimateAssistant.listDrafts.invalidate({
        caseId: Number(caseId),
      });
      toast.success("見積書を承認しました。PDFを生成します");
    } catch (e: any) {
      return toast.error(e?.message ?? "承認できませんでした");
    }
    try {
      const { downloadApprovedEstimatePdf } = await import(
        "@/lib/approvedEstimatePdf"
      );
      await downloadApprovedEstimatePdf(snapshot);
    } catch (e: any) {
      toast.error(
        `承認は完了しましたがPDFの出力に失敗しました。再ダウンロードをお試しください。${e?.message ?? ""}`
      );
    }
  };
  const downloadAgain = async () => {
    if (!approvedQuote.data)
      return toast.error("承認済みデータを読み込めませんでした");
    try {
      const { downloadApprovedEstimatePdf } = await import(
        "@/lib/approvedEstimatePdf"
      );
      await downloadApprovedEstimatePdf(approvedQuote.data);
    } catch (e: any) {
      toast.error(e?.message ?? "PDFを出力できませんでした");
    }
  };
  const handleRegisteredCase = async () => {
    if (!canModify || !Number(caseId)) return;
    if (
      (lines.length || reviewCandidates.length) &&
      !window.confirm(
        "表示中の見積明細と未判定の候補を案件情報からの候補に置き換えますか？未保存の変更は消えます。"
      )
    )
      return;
    setPdfBusy(true);
    try {
      const result = await analyzeRegisteredCase.mutateAsync({
        caseId: Number(caseId),
      });
      setDraftId(undefined);
      setDraftUpdatedAt(undefined);
      setSavedFingerprint(null);
      setLines([]);
      stageCandidates(result.items);
      setTitle(`${result.storeName} 見積案`);
      setSourcePdfKey(result.sourcePdfKey);
      setSourcePdfName(result.sourcePdfName);
      setSourceKind(result.sourcePdfKey ? "request_pdf" : "manual");
      setPdfMatchedCaseId(Number(caseId));
      setPdfPage(1);
      setPdfContext(
        `依頼番号: ${result.requestNumber} ／ 案件登録済みの依頼内容から抽出。${result.sourcePdfKey ? "左の元PDFと照合してください。" : "元PDFは案件登録時に保存されていないため表示できません。"}`
      );
      toast.success(
        `${result.items.length}件の候補を生成しました。採用・除外を選んでください`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "案件情報からの見積案作成に失敗しました");
    } finally {
      setPdfBusy(false);
    }
  };
  const handlePdf = async (file: File) => {
    if (!canModify) return;
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size > 12 * 1024 * 1024
    )
      return toast.error("12MB以内のPDFを選択してください");
    if (
      (lines.length || reviewCandidates.length) &&
      !window.confirm(
        "現在の画面上の明細と未判定の候補をPDFからの見積案で置き換えますか？未保存の内容は消えます。"
      )
    )
      return;
    setPdfBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const up = await upload.mutateAsync({
        fileName: file.name,
        fileBase64: base64,
      });
      const result = await analyze.mutateAsync({ fileKey: up.fileKey });
      if (!result.items.length) {
        toast.warning("見積候補を抽出できませんでした。PDFの画質・依頼内容を確認してください。表示中の明細は保持しています");
        return;
      }
      setDraftId(undefined);
      setDraftUpdatedAt(undefined);
      setSavedFingerprint(null);
      setLines([]);
      stageCandidates(result.items);
      setTitle(`${result.storeName || "案件"} 見積案`);
      setSourcePdfKey(up.fileKey);
      setSourcePdfName(up.fileName);
      setSourceKind("request_pdf");
      setPdfPage(1);
      setPdfContext(
        `依頼番号: ${result.requestNumber || "未抽出"} ／ 店舗: ${result.storeName || "未抽出"}`
      );
      setPdfMatchedCaseId(result.matchedCase?.id ?? null);
      if (result.matchedCase && !caseId)
        setCaseId(String(result.matchedCase.id));
      if (
        result.matchedCase &&
        caseId &&
        Number(caseId) !== result.matchedCase.id
      )
        toast.warning(
          "PDFの依頼番号と選択案件が一致しません。保存前に案件を確認してください"
        );
      toast.success(
        `${result.items.length}件の候補を抽出しました。採用・除外を選んでください`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "PDFから見積案を作成できませんでした");
    } finally {
      setPdfBusy(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 px-4 py-6 md:px-7">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-[.18em] text-slate-500">
          STORE OSX / ESTIMATE STUDIO
        </p>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
          見積支援
        </h1>
        <p className="text-sm text-slate-600">
          寸法別商品単価・施工標準単価・依頼PDFから見積案を作成。承認後は内容を固定し、正式見積書PDFを出力します。案件金額や既存見積には自動反映しません。
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/estimates/unit-prices")}
        >
          標準施工単価マスタを管理 <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_365px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-end">
              <label className="block flex-1 text-sm font-medium">
                保存先の案件
                <select
                  aria-label="保存先の案件"
                  className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={caseId}
                  onChange={e => {
                    if (
                      (lines.length || reviewCandidates.length) &&
                      !confirm(
                        "案件を切り替えると見積明細と未判定の候補を閉じます。未保存の変更は消えます。よろしいですか？"
                      )
                    )
                      return;
                    setCaseId(e.target.value);
                    resetDraft();
                  }}
                >
                  <option value="">案件を選択（PDF解析後も選べます）</option>
                  {cases.data?.map(row => (
                    <option key={row.id} value={row.id}>
                      {row.requestNumber}｜{row.storeName}
                    </option>
                  ))}
                </select>
              </label>
              {caseId && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/cases/${caseId}`)}
                >
                  案件詳細へ <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
          {caseId && (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  この案件の登録情報から見積案を作る
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {caseContext.isLoading ? (
                  <p>案件情報を読み込み中...</p>
                ) : caseContext.error ? (
                  <p className="text-red-700">{caseContext.error.message}</p>
                ) : caseContext.data ? (
                  <>
                    <p className="font-medium">
                      {caseContext.data.requestNumber} ／{" "}
                      {caseContext.data.storeName}
                    </p>
                    <p className="whitespace-pre-wrap rounded-md bg-white p-3 text-slate-700">
                      {caseContext.data.requestContent ||
                        [
                          caseContext.data.categoryLarge,
                          caseContext.data.categoryMedium,
                          caseContext.data.categorySmall,
                        ]
                          .filter(Boolean)
                          .join(" / ") ||
                        "依頼内容が未登録です"}
                    </p>
                    <p className="text-xs text-slate-600">
                      {caseContext.data.hasSourcePdf
                        ? `元PDF: ${caseContext.data.sourcePdfName}（再アップロード不要・生成後に左右で照合可能）`
                        : "過去に登録された案件の元PDFは紐付けがないため表示できません。保存済み依頼内容から案を作成できます。"}
                    </p>
                    <Button
                      onClick={() => void handleRegisteredCase()}
                      disabled={
                        !canModify ||
                        pdfBusy ||
                        ![
                          caseContext.data.requestContent,
                          caseContext.data.categoryLarge,
                          caseContext.data.categoryMedium,
                          caseContext.data.categorySmall,
                        ].some(Boolean)
                      }
                    >
                      {pdfBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Calculator className="mr-2 h-4 w-4" />
                      )}
                      案件情報から見積案を生成
                    </Button>
                    <p className="text-xs text-slate-600">
                      生成は確認用の候補のみ。案件金額・正式見積は更新しません。
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}
          <Tabs defaultValue="foretia" className="space-y-4">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="foretia">寸法別商品単価</TabsTrigger>
              <TabsTrigger value="standard">標準施工単価</TabsTrigger>
              <TabsTrigger value="pdf">依頼PDF → 見積案</TabsTrigger>
            </TabsList>
            <TabsContent value="foretia" className="space-y-4">
              <Card className="overflow-hidden">
                <div className="grid md:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-5 p-5 md:p-7">
                    <div>
                      <p className="text-xs text-slate-500">
                        タチカワブラインド
                      </p>
                      <h2 className="text-xl font-bold text-slate-900">
                        フォレティア50 単価計算
                      </h2>
                      <p className="text-xs text-slate-500">
                        ネイチャー／ラダーコード仕様／ループ・チェーン操作
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span>単位</span>
                      {(["mm", "cm"] as const).map(mode => (
                        <Button
                          key={mode}
                          size="sm"
                          variant={unitMode === mode ? "default" : "outline"}
                          onClick={() => {
                            if (mode === unitMode) return;
                            setWidth(
                              String(Number(width) * (mode === "cm" ? 0.1 : 10))
                            );
                            setHeight(
                              String(
                                Number(height) * (mode === "cm" ? 0.1 : 10)
                              )
                            );
                            setUnitMode(mode);
                          }}
                        >
                          {mode}
                        </Button>
                      ))}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-medium">
                        幅 W{" "}
                        <Input
                          className="mt-2"
                          aria-label="幅"
                          type="number"
                          min={unitMode === "mm" ? 280 : 28}
                          max={unitMode === "mm" ? 2400 : 240}
                          step={unitMode === "mm" ? 10 : 1}
                          value={width}
                          onChange={e => setWidth(e.target.value)}
                        />
                        <span className="text-xs text-slate-500">
                          280～2,400 mm
                        </span>
                      </label>
                      <label className="text-sm font-medium">
                        高さ H{" "}
                        <Input
                          className="mt-2"
                          aria-label="高さ"
                          type="number"
                          min={unitMode === "mm" ? 250 : 25}
                          max={unitMode === "mm" ? 2800 : 280}
                          step={unitMode === "mm" ? 10 : 1}
                          value={height}
                          onChange={e => setHeight(e.target.value)}
                        />
                        <span className="text-xs text-slate-500">
                          250～2,800 mm
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-slate-600">
                      仕上がり寸法を1cm単位で入力。幅58cm未満は高さ250cm以下、最大面積9㎡。窓寸法の差し引きはしません。
                    </p>
                    {canModify && (
                      <div className="flex items-end gap-3">
                        <label className="text-sm font-medium">
                          台数{" "}
                          <Input
                            aria-label="台数"
                            className="mt-2 w-24"
                            type="number"
                            min="1"
                            step="1"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                          />
                        </label>
                        <Button onClick={addForetia} disabled={!foretia}>
                          <Plus className="mr-1 h-4 w-4" />
                          見積案に追加
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-between bg-[#17304c] p-6 text-white md:p-8">
                    <div>
                      <p className="text-xs text-blue-100">
                        参考商品単価｜1台あたり・税込
                      </p>
                      <p className="mt-5 text-4xl font-bold tabular-nums">
                        {foretia ? yen(foretia.taxIncluded) : "算定不可"}
                      </p>
                      <p className="mt-3 text-xs text-blue-100">
                        {Number.isFinite(widthMm) ? widthMm : "–"} ×{" "}
                        {Number.isFinite(heightMm) ? heightMm : "–"} mm
                      </p>
                    </div>
                    <div className="mt-8 space-y-3 border-t border-white/20 pt-4 text-sm">
                      <div className="flex justify-between">
                        <span>税抜換算</span>
                        <strong>
                          {foretia ? yen(foretia.taxExcluded) : "–"}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>消費税10%</span>
                        <strong>{foretia ? yen(foretia.tax) : "–"}</strong>
                      </div>
                      <p className="border-t border-white/20 pt-3 text-xs text-blue-100">
                        適用価格帯:{" "}
                        {foretia
                          ? `幅 ${foretia.widthBandCm}cm以下 × 高さ ${foretia.heightBandCm}cm以下`
                          : "対象外"}
                      </p>
                      <p className="text-xs text-blue-100">
                        本体のみ。施工費・送料・オプションは別途。
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
              <details className="rounded-lg border bg-white p-4 text-sm">
                <summary className="cursor-pointer font-semibold">
                  寸法別の価格表を見る（税込・円）
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[710px] border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border p-2">高さ＼幅</th>
                        {FORETIA_WIDTH_CM.map(cm => (
                          <th className="border p-2" key={cm}>
                            ～{cm}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {FORETIA_HEIGHT_CM.map((cm, i) => (
                        <tr key={cm}>
                          <th className="border bg-slate-50 p-2">～{cm}</th>
                          {FORETIA_PRICES_TAX_INCLUDED[i].map((price, j) => (
                            <td
                              className="border p-2 text-right tabular-nums"
                              key={j}
                            >
                              {price.toLocaleString("ja-JP")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="text-xs text-slate-600">
                販売店の商品番号1001631。価格確認日 {FORETIA_PRICE_DATE}
                ／自動更新なし。
                <a
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                  href={FORETIA_SOURCE}
                >
                  販売店の商品情報
                </a>
                で最新価格・送料・仕様を確認してください。
              </p>
            </TabsContent>
            <TabsContent value="standard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    標準施工単価から探す
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-600">
                    {catalog.data?.sourceFile}（{catalog.data?.date}）。
                    {catalog.data?.taxNote}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      aria-label="工事項目を検索"
                      placeholder="例：コンセント、建具、防水"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    <select
                      aria-label="工事分類"
                      className="h-10 rounded-md border bg-background px-2 text-sm"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                    >
                      {categories.map(c => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-slate-500">
                    検索結果 {filtered.length} 件（最大60件表示）
                  </p>
                  <div className="max-h-[520px] space-y-2 overflow-y-auto">
                    {filtered.map(item => (
                      <div
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                        key={item.id}
                      >
                        <div>
                          <p className="font-medium">
                            {item.name}{" "}
                            <span className="text-xs text-slate-500">
                              {item.specification}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.majorCategory}／{item.unit}　下限{" "}
                            {yen(item.low)} · 標準 {yen(item.standard)} · 上限{" "}
                            {yen(item.high)}
                          </p>
                          <p className="text-xs text-slate-500">
                            根拠：{item.sourceRef}
                          </p>
                        </div>
                        {canModify && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addStandard(item, "low")}
                            >
                              下限
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => addStandard(item, "standard")}
                            >
                              標準
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addStandard(item, "high")}
                            >
                              上限
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="pdf">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileUp className="h-5 w-5" />
                    依頼PDFから見積案
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600">
                    依頼内容・数量・寸法を抽出し、明確に一致した価格だけ候補に入れます。曖昧な項目は単価未設定です。提出・正式見積登録・案件金額変更はしません。
                  </p>
                  {canModify ? (
                    <>
                      <input
                        ref={pdfRef}
                        aria-label="依頼PDF"
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={pdfBusy}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) void handlePdf(file);
                        }}
                        className="block w-full text-sm"
                      />
                      <p className="text-xs text-slate-500">
                        PDFのみ・最大12MB。スキャンは画質が低いと抽出に失敗する場合があります。
                      </p>
                      {pdfBusy && (
                        <p className="flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          PDFを解析中です。結果が出るまでお待ちください。
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm">
                      承認済み見積は編集できません。新しい案を作成してください。
                    </p>
                  )}
                  {pdfContext && (
                    <p className="rounded-md bg-blue-50 p-3 text-sm">
                      {pdfContext}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          {reviewCandidates.length > 0 && (
            <Card
              className="border-blue-300 bg-blue-50/40"
              aria-label="AI見積候補の確認"
            >
              <CardHeader className="space-y-2 pb-3">
                <CardTitle className="text-base">
                  AI見積候補の確認（未採用 {reviewCandidates.length}件）
                </CardTitle>
                <p className="text-sm text-slate-700">
                  必要な候補にチェックを入れ、選択分を一括採用または除外してください。判定するまで保存・承認されません。
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                  <div className="mr-auto flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      id="estimate-select-all"
                      aria-label="候補をすべて選択"
                      checked={
                        reviewAllSelected
                          ? true
                          : selectedCount > 0
                            ? "indeterminate"
                            : false
                      }
                      disabled={!canModify}
                      onCheckedChange={checked =>
                        setSelectedCandidateIds(
                          checked === true
                            ? reviewCandidates.map(candidate => candidate.id)
                            : []
                        )
                      }
                    />
                    <label
                      htmlFor="estimate-select-all"
                      className="cursor-pointer"
                    >
                      すべて選択（{selectedCount} / {reviewCandidates.length}
                      件）
                    </label>
                  </div>
                  <Button
                    size="sm"
                    disabled={
                      !canModify ||
                      selectedCount === 0 ||
                      lines.length + selectedCount > 50
                    }
                    onClick={() => applyCandidateSelection("adopt")}
                  >
                    選択した{selectedCount}件を一括採用
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canModify || selectedCount === 0}
                    onClick={() => applyCandidateSelection("exclude")}
                  >
                    選択した{selectedCount}件を一括除外
                  </Button>
                </div>
                <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                  {reviewCandidates.map((candidate, index) => (
                    <div
                      key={candidate.id}
                      className="flex items-start gap-3 rounded-md border bg-white p-3 text-sm"
                    >
                      <Checkbox
                        id={`estimate-candidate-${candidate.id}`}
                        className="mt-1"
                        aria-label={`候補${index + 1} ${candidate.line.name}を選択`}
                        checked={selectedCandidateIds.includes(candidate.id)}
                        disabled={!canModify}
                        onCheckedChange={checked =>
                          setSelectedCandidateIds(current =>
                            checked === true
                              ? [...current, candidate.id]
                              : current.filter(id => id !== candidate.id)
                          )
                        }
                      />
                      <label
                        htmlFor={`estimate-candidate-${candidate.id}`}
                        className="min-w-0 cursor-pointer space-y-1"
                      >
                        <strong className="block break-words">
                          候補 {index + 1}｜{candidate.line.name}
                        </strong>
                        <span className="block text-xs text-slate-600">
                          {candidate.line.specification || "規格未記載"} ／
                          数量: {candidate.line.quantity ?? "未入力"}{" "}
                          {candidate.line.unit || "単位未入力"} ／ 単価:{" "}
                          {candidate.line.unitPrice == null
                            ? "未入力"
                            : yen(candidate.line.unitPrice)}
                        </span>
                        {candidate.line.evidence && (
                          <span className="block break-words text-xs text-slate-600">
                            根拠: {candidate.line.evidence}
                            {candidate.line.pageNumber
                              ? `（PDF ${candidate.line.pageNumber}ページ）`
                              : ""}
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
                {lines.length + selectedCount > 50 && (
                  <p className="text-xs text-red-700">
                    採用すると明細50件の上限を超えます。選択数を減らしてください。
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          <div
            className={
              sourcePdfKey
                ? "grid items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
                : ""
            }
          >
            {sourcePdfKey && (
              <Card className="min-w-0 overflow-hidden xl:sticky xl:top-4">
                <CardHeader className="border-b bg-slate-50 py-3">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span>元の依頼PDF</span>
                    <span className="text-xs font-normal text-slate-600">
                      {sourcePdfName}
                    </span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label>
                      ページ
                      <Input
                        aria-label="元PDFのページ"
                        className="ml-2 inline-flex h-8 w-16"
                        type="number"
                        min="1"
                        max="2000"
                        value={pdfPage}
                        onChange={e =>
                          setPdfPage(Math.max(1, Number(e.target.value) || 1))
                        }
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void pdfView.refetch()}
                    >
                      表示を更新
                    </Button>
                    {pdfView.data?.url && (
                      <a
                        className="inline-flex items-center gap-1 underline"
                        href={pdfView.data.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        別画面で原本を開く <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  {pdfView.isLoading ? (
                    <p className="p-4 text-sm">元PDFを読み込み中...</p>
                  ) : pdfView.error ? (
                    <p className="p-4 text-sm text-red-700">
                      元PDFを表示できません: {pdfView.error.message}
                    </p>
                  ) : pdfView.data?.url ? (
                    <iframe
                      key={`${pdfView.data.url}:${pdfPage}`}
                      title="元の依頼PDF"
                      src={`${pdfView.data.url}#page=${pdfPage}&view=FitH`}
                      className="h-[680px] w-full rounded-md border bg-slate-100"
                    />
                  ) : (
                    <p className="p-4 text-sm">原本の表示を準備しています。</p>
                  )}
                  <p className="mt-2 text-xs text-slate-600">
                    左の原本を見ながら右の抽出値を修正してください。
                    {sourcePdfKey.startsWith("imports/case-")
                      ? "明細は案件に保存された依頼内容から作成した候補です。PDFからの直接抽出ではありません。"
                      : "ページ番号はAIの推定です。"}
                    原本と相違する場合は原本を優先します。
                  </p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  {sourcePdfKey ? "抽出した見積明細・照合" : "見積案の明細"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  aria-label="見積案の件名"
                  value={title}
                  disabled={!canModify}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="見積案の件名"
                />
                {lines.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                    寸法別商品、標準施工単価、または依頼PDFから明細を追加してください。
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lines.map((line, i) => {
                      const missing = missingEstimateFields(line);
                      const invalidQuantity = missing.includes("数量");
                      const invalidUnit = missing.includes("単位");
                      const invalidPrice = missing.includes("単価");
                      return (
                        <div
                          key={i}
                          className={`rounded-lg border p-3 ${missing.length ? "border-red-300 bg-red-50/40" : "bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                              明細 {i + 1}
                              {missing.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-red-300 bg-red-100 text-red-800"
                                >
                                  要入力: {missing.join("・")}
                                </Badge>
                              )}
                            </span>
                            {canModify && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`明細${i + 1}を削除`}
                                onClick={() =>
                                  setLines(current =>
                                    current.filter((_, j) => j !== i)
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="text-xs">
                              工事項目
                              <Input
                                value={line.name}
                                disabled={!canModify}
                                onChange={e =>
                                  update(i, { name: e.target.value })
                                }
                              />
                            </label>
                            <label className="text-xs">
                              規格・寸法
                              <Input
                                value={line.specification}
                                disabled={!canModify}
                                onChange={e =>
                                  update(i, { specification: e.target.value })
                                }
                              />
                            </label>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <label className="text-xs">
                              数量
                              <Input
                                type="number"
                                step="any"
                                min="0.001"
                                aria-invalid={invalidQuantity}
                                className={
                                  invalidQuantity
                                    ? "border-red-500 bg-white ring-1 ring-red-200"
                                    : ""
                                }
                                placeholder={
                                  invalidQuantity ? "数量を入力" : undefined
                                }
                                value={line.quantity ?? ""}
                                disabled={!canModify}
                                onChange={e =>
                                  update(i, {
                                    quantity:
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="text-xs">
                              単位
                              <Input
                                value={line.unit}
                                aria-invalid={invalidUnit}
                                className={
                                  invalidUnit
                                    ? "border-red-500 bg-white ring-1 ring-red-200"
                                    : ""
                                }
                                placeholder={
                                  invalidUnit ? "単位を入力" : undefined
                                }
                                disabled={!canModify}
                                onChange={e =>
                                  update(i, { unit: e.target.value })
                                }
                              />
                            </label>
                            <label className="text-xs">
                              単価・税抜試算
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                aria-invalid={invalidPrice}
                                className={
                                  invalidPrice
                                    ? "border-red-500 bg-white ring-1 ring-red-200"
                                    : ""
                                }
                                placeholder={
                                  invalidPrice ? "単価を入力" : undefined
                                }
                                value={line.unitPrice ?? ""}
                                disabled={!canModify}
                                onChange={e =>
                                  update(i, {
                                    unitPrice:
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                          </div>
                          {(sourcePdfKey || line.evidence) && (
                            <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-slate-700">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                                <strong>
                                  {sourcePdfKey?.startsWith("imports/case-") ||
                                  !sourcePdfKey
                                    ? "案件に保存された記述（PDFの直接抽出ではありません）"
                                    : "PDFの原文根拠"}
                                </strong>
                                {sourcePdfKey && line.pageNumber && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setPdfPage(line.pageNumber || 1)
                                    }
                                  >
                                    PDF {line.pageNumber}ページを開く
                                  </Button>
                                )}
                              </div>
                              <Input
                                aria-label={`明細${i + 1}の原文引用`}
                                value={line.evidence ?? ""}
                                disabled={!canModify}
                                placeholder="依頼内容を確認してください"
                                onChange={e =>
                                  update(i, { evidence: e.target.value })
                                }
                              />
                              {canModify &&
                                sourcePdfKey &&
                                !sourcePdfKey.startsWith("imports/case-") && (
                                  <label className="mt-2 flex items-center gap-2">
                                    原文のページ番号
                                    <Input
                                      aria-label={`明細${i + 1}のページ番号`}
                                      className="h-8 w-20"
                                      type="number"
                                      min="1"
                                      max="2000"
                                      value={line.pageNumber ?? ""}
                                      onChange={e =>
                                        update(i, {
                                          pageNumber: e.target.value
                                            ? Number(e.target.value)
                                            : null,
                                        })
                                      }
                                    />
                                  </label>
                                )}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="break-all text-slate-500">
                              根拠: {line.source}
                              {line.note ? ` / ${line.note}` : ""}
                            </span>
                            <strong className="whitespace-nowrap text-sm">
                              {!missing.length &&
                              line.quantity != null &&
                              line.unitPrice != null ? (
                                yen(Math.round(line.quantity * line.unitPrice))
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-red-300 bg-red-100 text-red-800"
                                >
                                  {missing.join("・")}を要確認
                                </Badge>
                              )}
                            </strong>
                          </div>
                          <label className="mt-2 block text-xs text-slate-600">
                            補足・施工条件
                            <Input
                              className="mt-1"
                              value={line.note}
                              disabled={!canModify}
                              onChange={e =>
                                update(i, { note: e.target.value })
                              }
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
                {canModify && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setLines(current => [...current, blankLine()])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    手入力の明細を追加
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        <aside className="min-w-0 space-y-4">
          <Card className="border-[#17304c]">
            <CardHeader className="bg-[#17304c] text-white">
              <CardTitle>試算サマリー</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5 text-sm">
              <div className="flex justify-between">
                <span>税抜小計（入力済みのみ）</span>
                <strong>{yen(amount.subtotal)}</strong>
              </div>
              <div className="flex justify-between">
                <span>消費税10%（概算）</span>
                <strong>{yen(amount.tax)}</strong>
              </div>
              <div className="flex justify-between border-t pt-3 text-lg font-bold">
                <span>税込試算額</span>
                <span>{yen(amount.total)}</span>
              </div>
              {amount.missing > 0 && (
                <p className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  数量・単位・単価が未確定の明細 {amount.missing}{" "}
                  件。上記額は総見積額ではありません。
                </p>
              )}
              {reviewCandidates.length > 0 && (
                <p className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
                  未判定のAI候補 {reviewCandidates.length}
                  件を採用または除外してください。候補は下書き・合計に含まれていません。
                </p>
              )}
              <p className="text-xs text-slate-600">
                税区分・諸経費・施工範囲・地域差を確認してください。承認するとこの案を固定し、正式見積書PDFを出力します（外部送信はしません）。
              </p>
              {canModify && (
                <Button
                  className="w-full"
                  disabled={
                    save.isPending ||
                    reviewCandidates.length > 0 ||
                    !caseId ||
                    lines.length === 0
                  }
                  onClick={() => void persist()}
                >
                  {save.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  案件の見積案として保存
                </Button>
              )}
              {canModify && draftId && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={
                    approve.isPending ||
                    save.isPending ||
                    reviewCandidates.length > 0 ||
                    amount.missing > 0 ||
                    hasUnsavedChanges ||
                    amount.total <= 0
                  }
                  onClick={() => void approveAndDownload()}
                >
                  {approve.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileCheck2 className="mr-2 h-4 w-4" />
                  )}
                  内容を承認して正式見積書PDFを出力
                </Button>
              )}
              {hasUnsavedChanges && (
                <p className="text-xs text-amber-800">
                  修正した明細を先に保存すると承認できます。
                </p>
              )}
              {draftStatus === "approved" && (
                <>
                  <p className="rounded-md bg-green-50 p-2 text-xs text-green-900">
                    承認済み・編集不可。内容は承認時点で固定されています。
                  </p>
                  <Button
                    className="w-full"
                    disabled={approvedQuote.isLoading || !approvedQuote.data}
                    onClick={() => void downloadAgain()}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    正式見積書PDFを再ダウンロード
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          {caseId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  この案件の保存済み見積案
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {draftQuery.isLoading ? (
                  <p className="text-sm">読み込み中...</p>
                ) : draftQuery.data?.length ? (
                  draftQuery.data.map(draft => (
                    <button
                      key={draft.id}
                      className="w-full rounded-md border p-3 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        if (
                          (lines.length || reviewCandidates.length) &&
                          !window.confirm(
                            "表示中の明細と未判定の候補を保存済み見積案で置き換えますか？"
                          )
                        )
                          return;
                        clearCandidates();
                        setDraftId(draft.id);
                        setDraftUpdatedAt(draft.updatedAt);
                        setDraftStatus(draft.status);
                        setSavedFingerprint(
                          JSON.stringify({
                            title: draft.title,
                            lines: draft.items,
                            sourceKind: draft.sourceKind,
                            sourcePdfKey: draft.sourcePdfKey,
                            sourcePdfName: draft.sourcePdfName,
                          })
                        );
                        setTitle(draft.title);
                        setLines(draft.items);
                        setSourceKind(draft.sourceKind);
                        setSourcePdfKey(draft.sourcePdfKey);
                        setSourcePdfName(draft.sourcePdfName);
                        setPdfMatchedCaseId(null);
                        setPdfPage(1);
                        setPdfContext(
                          draft.sourcePdfName
                            ? `元PDF: ${draft.sourcePdfName}`
                            : ""
                        );
                      }}
                    >
                      <span className="block font-medium">
                        {draft.title}{" "}
                        {draft.status === "approved" && (
                          <Badge className="ml-1 bg-green-700">承認済み</Badge>
                        )}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(draft.updatedAt).toLocaleString("ja-JP")} ／{" "}
                        {draft.missingPriceCount} 件要確認
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    保存済みの見積案はありません
                  </p>
                )}
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        !(lines.length || reviewCandidates.length) ||
                        window.confirm(
                          "新しい見積案を開きますか？未保存の明細・未判定の候補は消えます。"
                        )
                      )
                        resetDraft();
                    }}
                  >
                    新しい見積案
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
