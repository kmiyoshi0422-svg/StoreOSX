import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  PenLine,
  RotateCcw,
  RotateCw,
  ImagePlus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Camera,
  ImageIcon,
  GripVertical,
  LayoutGrid,
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { inlineImages } from "@/lib/imageDataUrl";
import { fileToUprightDataUrl } from "@/lib/imageOrientation";
import { buildBeforeAfterPairs, paginatePairs } from "@shared/beforeAfter";
import { SignaturePad } from "@/components/SignaturePad";
import { Lightbox, useLightbox } from "@/components/Lightbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { Case, Photo } from "../../../drizzle/schema";

export type ReportType = "survey" | "completion";

// 報告書ごとの設定
const REPORT_CONFIG: Record<
  ReportType,
  {
    title: string;
    eyebrow: string;
    leadText: string;
    photoTypes: string[]; // 採用する写真区分
    fileLabel: string;
    dateLabel: string;
    dateField: (c: Case) => Date | null | undefined;
  }
> = {
  survey: {
    title: "現場調査報告書",
    eyebrow: "SITE SURVEY REPORT",
    leadText: "下記のとおり現場調査を実施いたしましたのでご報告いたします。",
    photoTypes: ["現調", "施工前A", "施工前B"],
    fileLabel: "現場調査報告書",
    dateLabel: "現調日",
    dateField: (c) => c.surveyDate,
  },
  completion: {
    title: "施工完了報告書",
    eyebrow: "COMPLETION REPORT",
    leadText: "下記のとおり施工が完了いたしましたのでご報告いたします。",
    // ビフォーアフター比較のため、現調（施工前）系と施工後系の両方を採用する
    photoTypes: ["現調", "施工前A", "施工前B", "施工後A", "施工後B", "設置状況"],
    fileLabel: "施工完了報告書",
    dateLabel: "施工日",
    dateField: (c) => c.constructionDate,
  },
};

// 全写真区分（APIのenumと一致）
const ALL_PHOTO_TYPES = [
  "現調",
  "施工前A",
  "施工前B",
  "施工後A",
  "施工後B",
  "設置状況",
  "メーカー型番",
  "その他",
] as const;
type PhotoTypeTag = (typeof ALL_PHOTO_TYPES)[number];

// 報告書種別ごとの追加時初期区分
const DEFAULT_ADD_TYPE: Record<ReportType, PhotoTypeTag> = {
  survey: "現調",
  completion: "施工後A",
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function CaseReport({
  id,
  reportType,
}: {
  id: number;
  reportType: ReportType;
}) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const config = REPORT_CONFIG[reportType];

  const { data: caseData, isLoading: caseLoading } = trpc.cases.get.useQuery({ id });
  const { data: photos = [], isLoading: photosLoading } = trpc.photos.listByCase.useQuery({
    caseId: id,
  });
  const { data: signature, isLoading: sigLoading } = trpc.signatures.get.useQuery({
    caseId: id,
    reportType,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [editingSig, setEditingSig] = useState(false);

  const saveSig = trpc.signatures.save.useMutation({
    onSuccess: () => {
      toast.success("サインを保存しました");
      setEditingSig(false);
      utils.signatures.get.invalidate({ caseId: id, reportType });
      utils.signatures.getByCase.invalidate({ caseId: id });
    },
    onError: (e) => toast.error(e.message || "サインの保存に失敗しました"),
  });
  const deleteSig = trpc.signatures.delete.useMutation({
    onSuccess: () => {
      toast.success("サインを削除しました");
      utils.signatures.get.invalidate({ caseId: id, reportType });
      utils.signatures.getByCase.invalidate({ caseId: id });
    },
    onError: (e) => toast.error(e.message || "サインの削除に失敗しました"),
  });

  // 写真管理
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [addType, setAddType] = useState<PhotoTypeTag>(DEFAULT_ADD_TYPE[reportType]);
  const [uploading, setUploading] = useState(false);
  const [perPage, setPerPage] = useState<4 | 6>(4);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // コメント編集のローカル下書き（photoId -> { workItem, memo }）
  const [drafts, setDrafts] = useState<Record<number, { workItem: string; memo: string }>>({});
  const refetchPhotos = () => utils.photos.listByCase.invalidate({ caseId: id });

  const uploadPhoto = trpc.photos.upload.useMutation();
  const updatePhoto = trpc.photos.update.useMutation({
    onSuccess: () => refetchPhotos(),
    onError: (e) => toast.error(e.message || "更新に失敗しました"),
  });
  const removePhoto = trpc.photos.delete.useMutation({
    onSuccess: () => {
      toast.success("写真を削除しました");
      refetchPhotos();
    },
    onError: (e) => toast.error(e.message || "削除に失敗しました"),
  });

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { dataUrl, mimeType } = await fileToUprightDataUrl(file);
        await uploadPhoto.mutateAsync({
          caseId: id,
          fileName: file.name,
          fileBase64: dataUrl,
          mimeType,
          photoType: addType,
        });
      }
      toast.success(`${files.length}枚を「${addType}」として追加しました`);
      await refetchPhotos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  // 該当区分の写真を抽出（順序: config.photoTypes の順 → orderNo）
  const reportPhotos = useMemo(() => {
    const order = config.photoTypes;
    return [...photos]
      .filter((p) => order.includes(p.photoType))
      .sort((a, b) => {
        const ai = order.indexOf(a.photoType);
        const bi = order.indexOf(b.photoType);
        if (ai !== bi) return ai - bi;
        return a.orderNo - b.orderNo;
      });
  }, [photos, config.photoTypes]);

  // 表示順を from → to に並べ替え、区分とorderNoを表示順に合わせて一括更新する。
  const reorderPhotos = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const arr = [...reportPhotos];
    const [moved] = arr.splice(from, 1);
    if (!moved) return;
    arr.splice(to, 0, moved);
    // 並び替え後の表示順を 「区分スロット×orderNo」に写し戻す。
    // 区分は各スロット（現調/施工後など）の並びを保ちつつorderNoだけを連番にして全体順を確定させる。
    arr.forEach((p, i) => {
      if (p.orderNo !== i) {
        updatePhoto.mutate({ id: p.id, orderNo: i });
      }
    });
  };

  // 上下ボタンによる移動（D&Dと同じロジックに集約）
  const movePhoto = (index: number, dir: -1 | 1) => {
    reorderPhotos(index, index + dir);
  };

  // コメント（工事項目/メモ）の保存
  const saveComment = (photo: Photo) => {
    const d = drafts[photo.id];
    if (!d) return;
    const workItem = d.workItem.trim();
    const memo = d.memo.trim();
    if (workItem === (photo.workItem ?? "") && memo === (photo.memo ?? "")) return;
    updatePhoto.mutate(
      { id: photo.id, workItem: workItem || null, memo: memo || null },
      {
        onSuccess: () => {
          toast.success("コメントを保存しました");
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[photo.id];
            return next;
          });
        },
      }
    );
  };

  const draftOf = (photo: Photo) =>
    drafts[photo.id] ?? { workItem: photo.workItem ?? "", memo: photo.memo ?? "" };

  // ライトボックス（拡大プレビュー）
  const lightbox = useLightbox();
  const lightboxItems = useMemo(
    () =>
      reportPhotos.map((p) => ({
        url: p.fileUrl,
        title: [p.photoType, p.workItem].filter(Boolean).join(" / "),
        subtitle: p.memo ?? undefined,
        rotation: p.rotation ?? 0,
      })),
    [reportPhotos]
  );

  // 写真ページ（perPage 枚／ページ）— 現場調査報告書で使用
  const photoPages = useMemo(() => {
    const result: Photo[][] = [];
    for (let i = 0; i < reportPhotos.length; i += perPage) {
      result.push(reportPhotos.slice(i, i + perPage));
    }
    return result;
  }, [reportPhotos, perPage]);

  // 施工完了報告書：ビフォーアフター比較ページ
  // 1ページあたりの比較組数（perPage 4→2組 / 6→3組）
  const pairsPerPage = perPage === 6 ? 3 : 2;
  const beforeAfterPairs = useMemo(
    () => buildBeforeAfterPairs(reportPhotos),
    [reportPhotos],
  );
  const comparePages = useMemo(
    () => paginatePairs(beforeAfterPairs, pairsPerPage),
    [beforeAfterPairs, pairsPerPage],
  );

  const handleDownloadPDF = async () => {
    if (!containerRef.current || !caseData) return;
    setGenerating(true);
    const restore = await inlineImages(containerRef.current).catch(() => () => {});
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const pages = containerRef.current.querySelectorAll<HTMLElement>(".report-page");
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage();
        // 各ページはA4縦に正確固定（210x297mm）。ページ要素自体がA4比率なので全面に貼り付ける。
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }
      const safe = `${caseData.requestNumber}_${caseData.storeName}`.replace(
        /[\\/:*?"<>|]/g,
        "_",
      );
      pdf.save(`${config.fileLabel}_${safe}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF生成に失敗しました");
    } finally {
      restore();
      setGenerating(false);
    }
  };

  if (caseLoading || photosLoading || sigLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!caseData) {
    return <div className="text-center py-12 text-muted-foreground">案件が見つかりません</div>;
  }

  const hasSig = !!signature;

  return (
    <div>
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border/60 mb-6">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/cases/${id}`)}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            案件詳細に戻る
          </Button>
          <Button onClick={handleDownloadPDF} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating ? "PDF生成中..." : "PDFダウンロード"}
          </Button>
        </div>
      </div>

      {/* 署名コントロール（PDFには含めない） */}
      <div className="no-print max-w-[800px] mx-auto mb-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <PenLine className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-serif-jp text-base font-semibold">プレナス責任者サイン</h3>
            </div>

            {hasSig && !editingSig ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="rounded-lg border border-border bg-white p-2">
                    <img
                      src={signature!.fileUrl}
                      alt="サイン"
                      className="h-20 object-contain"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {signature!.signerName && (
                      <p>
                        署名者：<span className="text-foreground font-medium">{signature!.signerName}</span>
                      </p>
                    )}
                    <p>サイン日時：{new Date(signature!.signedAt).toLocaleString("ja-JP")}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingSig(true)}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    サインし直す
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteSig.mutate({ caseId: id, reportType })}
                    disabled={deleteSig.isPending}
                  >
                    削除
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-1.5 max-w-xs">
                  <Label htmlFor="signerName" className="text-xs">
                    署名者名（任意）
                  </Label>
                  <Input
                    id="signerName"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="例）プレナス 山田"
                    className="h-9"
                  />
                </div>
                <SignaturePad
                  saving={saveSig.isPending}
                  onConfirm={(dataUrl) =>
                    saveSig.mutate({
                      caseId: id,
                      reportType,
                      signerName: signerName.trim() || null,
                      imageBase64: dataUrl,
                    })
                  }
                />
                {hasSig && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingSig(false)}>
                    キャンセル
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 掲載写真の管理（PDFには出さない） */}
      <div className="no-print max-w-[800px] mx-auto mb-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-serif-jp text-base font-semibold">
                  掲載写真の管理
                </h3>
                <Badge variant="secondary" className="ml-1">
                  {reportPhotos.length}枚
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-[11px] text-muted-foreground">
                  {reportType === "completion" ? "1ページの比較組数" : "1ページの枚数"}
                </Label>
                <Select
                  value={String(perPage)}
                  onValueChange={(v) => setPerPage(Number(v) as 4 | 6)}
                >
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">
                      {reportType === "completion" ? "2組" : "4枚"}
                    </SelectItem>
                    <SelectItem value="6">
                      {reportType === "completion" ? "3組" : "6枚"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              {reportType === "survey"
                ? "現調・施工前の写真が載ります。ドラッグで並び替え、各写真のコメントも編集できます。"
                : "現調（施工前）と施工後の写真を取り込むと、「工事項目」をキーにビフォーアフターで自動比較します。同じ工事項目名を付けると正しく対になります。"}
            </p>

            {/* 追加コントロール */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleAddFiles(e.target.files)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => handleAddFiles(e.target.files)}
            />
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border/70 bg-muted/30 p-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">追加する写真の区分</Label>
                <Select
                  value={addType}
                  onValueChange={(v) => setAddType(v as PhotoTypeTag)}
                >
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_PHOTO_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-background"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                ファイルから追加
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-background"
                disabled={uploading}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                撮影して追加
              </Button>
            </div>

            {/* 写真一覧（ドラッグ＆ドロップ並び替え） */}
            {reportPhotos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                この報告書に載る写真はまだありません。上のボタンから追加してください。
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reportPhotos.map((photo, index) => {
                  const d = draftOf(photo);
                  const dirty =
                    d.workItem !== (photo.workItem ?? "") || d.memo !== (photo.memo ?? "");
                  return (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragEnter={() => setOverIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnd={() => {
                        if (dragIndex !== null && overIndex !== null) {
                          reorderPhotos(dragIndex, overIndex);
                        }
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null) reorderPhotos(dragIndex, index);
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      className={`rounded-lg border overflow-hidden bg-card transition-all ${
                        overIndex === index && dragIndex !== null && dragIndex !== index
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border/60"
                      } ${dragIndex === index ? "opacity-50" : ""}`}
                    >
                      <div className="flex">
                        <div
                          className="flex items-center justify-center px-1 bg-muted/60 cursor-grab active:cursor-grabbing touch-none"
                          title="ドラッグして並び替え"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="relative w-28 shrink-0 aspect-[4/3] bg-muted overflow-hidden">
                          <span className="absolute top-1 left-1 z-10 text-[10px] font-bold bg-foreground/80 text-background rounded px-1.5 py-0.5">
                            {index + 1}
                          </span>
                          <img
                            src={photo.fileUrl}
                            alt=""
                            className="w-full h-full object-cover cursor-zoom-in transition-transform duration-200"
                            style={{
                              imageOrientation: "from-image",
                              transform: photo.rotation
                                ? `rotate(${photo.rotation}deg)`
                                : undefined,
                            }}
                            onClick={() => lightbox.open(index)}
                          />
                          <div className="absolute bottom-1 right-1 z-10 flex items-center rounded-full bg-black/70 backdrop-blur-sm overflow-hidden">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updatePhoto.mutate({
                                  id: photo.id,
                                  rotation: (((photo.rotation ?? 0) + 270) % 360),
                                });
                              }}
                              disabled={updatePhoto.isPending}
                              title="左に90°回転"
                              className="h-6 w-6 flex items-center justify-center text-white hover:bg-white/20 transition-colors active:scale-95"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                            <span className="w-px h-3.5 bg-white/30" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updatePhoto.mutate({
                                  id: photo.id,
                                  rotation: (((photo.rotation ?? 0) + 90) % 360),
                                });
                              }}
                              disabled={updatePhoto.isPending}
                              title="右に90°回転"
                              className="h-6 w-6 flex items-center justify-center text-white hover:bg-white/20 transition-colors active:scale-95"
                            >
                              <RotateCw className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 p-2 space-y-1.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={photo.photoType}
                              onValueChange={(v) =>
                                updatePhoto.mutate({
                                  id: photo.id,
                                  photoType: v as PhotoTypeTag,
                                })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ALL_PHOTO_TYPES.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 bg-background shrink-0"
                              disabled={index === 0 || updatePhoto.isPending}
                              onClick={() => movePhoto(index, -1)}
                              title="上へ"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 bg-background shrink-0"
                              disabled={
                                index === reportPhotos.length - 1 || updatePhoto.isPending
                              }
                              onClick={() => movePhoto(index, 1)}
                              title="下へ"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive shrink-0"
                              disabled={removePhoto.isPending}
                              onClick={() => {
                                if (confirm("この写真を削除しますか？")) {
                                  removePhoto.mutate({ id: photo.id });
                                }
                              }}
                              title="削除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Input
                            value={d.workItem}
                            placeholder="工事項目（例：照明交換）"
                            className="h-7 text-xs"
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [photo.id]: { ...draftOf(photo), workItem: e.target.value },
                              }))
                            }
                            onBlur={() => saveComment(photo)}
                          />
                          <Textarea
                            value={d.memo}
                            placeholder="コメント・メモ"
                            rows={2}
                            className="text-xs min-h-0 resize-none"
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [photo.id]: { ...draftOf(photo), memo: e.target.value },
                              }))
                            }
                            onBlur={() => saveComment(photo)}
                          />
                          {dirty && (
                            <p className="text-[10px] text-amber-600">未保存（フォーカスを外すと保存）</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 報告書本体（PDFソース） */}
      <div ref={containerRef} className="report-container mx-auto">
        {/* 1ページ目：基本情報 */}
        <section className="report-page bg-white border border-border/60 shadow-sm mb-6 flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
          <div className="text-center pb-3 mb-6">
            <h1 className="font-serif-jp text-[26px] font-bold tracking-[0.18em] text-primary">
              {config.title}
            </h1>
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase mt-1">
              {config.eyebrow}
            </p>
            <div className="mt-3 h-[3px] bg-primary rounded-full" />
          </div>

          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[15px] mb-1">
                <strong className="font-serif-jp">{caseData.storeName}</strong>　御中
              </p>
              <p className="text-[11px] text-muted-foreground">{config.leadText}</p>
            </div>
            <div className="text-[11px] text-muted-foreground text-right space-y-0.5 tabular-nums">
              <p>案件番号：{caseData.requestNumber}</p>
              <p>報告日：{fmtDate(new Date())}</p>
            </div>
          </div>

          <SectionBand>物件情報</SectionBand>
          <table className="w-full border-collapse text-[12px] mb-7 table-fixed">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[24%]" />
              <col className="w-[26%]" />
              <col className="w-[24%]" />
            </colgroup>
            <tbody>
              <tr>
                <ReportTh>ブランド</ReportTh>
                <ReportTd>{caseData.brand}</ReportTd>
                <ReportTh>店舗名</ReportTh>
                <ReportTd>{caseData.storeName}</ReportTd>
              </tr>
              <tr>
                <ReportTh>店舗住所</ReportTh>
                <ReportTd colSpan={3}>{caseData.address || "—"}</ReportTd>
              </tr>
              <tr>
                <ReportTh>店舗電話</ReportTh>
                <ReportTd>{caseData.storePhone || "—"}</ReportTd>
                <ReportTh>作業区分</ReportTh>
                <ReportTd>{caseData.workType || "—"}</ReportTd>
              </tr>
              <tr>
                <ReportTh>工事種別</ReportTh>
                <ReportTd colSpan={3}>
                  {[caseData.categoryLarge, caseData.categoryMedium, caseData.categorySmall]
                    .filter(Boolean)
                    .join("　/　") || "—"}
                </ReportTd>
              </tr>
              <tr>
                <ReportTh>{config.dateLabel}</ReportTh>
                <ReportTd>{fmtDate(config.dateField(caseData))}</ReportTd>
                <ReportTh>協力会社</ReportTh>
                <ReportTd>{caseData.contractorName || "—"}</ReportTd>
              </tr>
              {reportType === "completion" && (
                <tr>
                  <ReportTh>完了日</ReportTh>
                  <ReportTd colSpan={3}>{fmtDate(caseData.completedAt ?? caseData.updatedAt)}</ReportTd>
                </tr>
              )}
            </tbody>
          </table>

          <SectionBand>{reportType === "survey" ? "調査内容・依頼内容" : "作業内容"}</SectionBand>
          <p className="text-[12px] whitespace-pre-wrap leading-relaxed mb-7 px-0.5">
            {caseData.requestContent || "—"}
          </p>

          {caseData.notes && (
            <>
              <SectionBand>備考</SectionBand>
              <p className="text-[12px] whitespace-pre-wrap leading-relaxed mb-7 px-0.5">
                {caseData.notes}
              </p>
            </>
          )}

          </div>
          {/* 確認欄はページ下部に固定配置 */}
          <div className="shrink-0 pt-4">
            <SignatureBlock signature={signature} />
          </div>
        </section>

        {/* 写真ページ：施工完了報告書はビフォーアフター比較 */}
        {reportType === "completion" ? (
          comparePages.length === 0 ? (
            <section className="report-page bg-white border border-border/60 shadow-sm mb-6">
              <p className="text-center text-sm text-muted-foreground py-12">
                比較する写真が登録されていません。現調（施工前）および施工後の写真を取り込んでください。
              </p>
            </section>
          ) : (
            comparePages.map((pagePairs, pi) => (
              <section
                key={`cmp-${pi}`}
                className="report-page bg-white border border-border/60 shadow-sm mb-6"
              >
                <div className="flex items-end justify-between mb-4 pb-2 border-b-2 border-primary">
                  <h2 className="font-serif-jp text-[15px] font-semibold text-primary">
                    {config.title}　ビフォーアフター写真
                    <span className="ml-2 text-[10px] tracking-widest text-muted-foreground font-sans">
                      {caseData.requestNumber}
                    </span>
                  </h2>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    Page {pi + 1} / {comparePages.length}
                  </span>
                </div>

                <div
                  className="grid gap-y-4"
                  style={{
                    gridTemplateRows: `repeat(${pairsPerPage}, 1fr)`,
                    height: "248mm",
                  }}
                >
                  {pagePairs.map((pair, idx) => (
                    <div
                      key={`pair-${pi}-${idx}`}
                      className="flex flex-col min-h-0 border border-border/60 rounded overflow-hidden"
                    >
                      {/* 工事項目見出し帯 */}
                      <div className="shrink-0 bg-primary/5 border-b border-border/60 px-3 py-1">
                        <p className="font-serif-jp text-[12px] font-semibold text-primary truncate">
                          {pair.workItem || `比較 ${pi * pairsPerPage + idx + 1}`}
                        </p>
                      </div>
                      {/* 左＝施工前 / 右＝施工後 */}
                      <div className="flex-1 min-h-0 grid grid-cols-2">
                        {([
                          { side: "before" as const, label: "施工前（現調）", photo: pair.before },
                          { side: "after" as const, label: "施工後", photo: pair.after },
                        ]).map(({ side, label, photo }) => (
                          <div
                            key={side}
                            className={`flex flex-col min-h-0 ${side === "before" ? "border-r border-border/60" : ""}`}
                          >
                            <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-muted/60 border-b border-border/40">
                              <span
                                className={`text-[10px] font-semibold ${side === "before" ? "text-muted-foreground" : "text-primary"}`}
                              >
                                {side === "before" ? "BEFORE" : "AFTER"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">・ {label}</span>
                            </div>
                            <div className="flex-1 min-h-0 bg-muted overflow-hidden flex items-center justify-center">
                              {photo ? (
                                <img
                                  src={photo.fileUrl}
                                  alt=""
                                  className="w-full h-full object-contain cursor-zoom-in"
                                  style={{
                                    imageOrientation: "from-image",
                                    transform: photo.rotation
                                      ? `rotate(${photo.rotation}deg)`
                                      : undefined,
                                  }}
                                  onClick={() => {
                                    const li = reportPhotos.findIndex((rp) => rp.id === photo.id);
                                    if (li >= 0) lightbox.open(li);
                                  }}
                                />
                              ) : (
                                <span className="text-[11px] text-muted-foreground">該当なし</span>
                              )}
                            </div>
                            {photo?.memo && (
                              <div className="shrink-0 text-[10px] px-2 py-1 border-t border-border/40 text-muted-foreground line-clamp-2 whitespace-pre-wrap leading-snug">
                                {photo.memo}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )
        ) : photoPages.length === 0 ? (
          <section className="report-page bg-white border border-border/60 shadow-sm mb-6">
            <p className="text-center text-sm text-muted-foreground py-12">
              現場調査写真（現調／施工前）が登録されていません。
            </p>
          </section>
        ) : (
          photoPages.map((pagePhotos, pi) => (
            <section
              key={pi}
              className="report-page bg-white border border-border/60 shadow-sm mb-6"
            >
              <div className="flex items-end justify-between mb-4 pb-2 border-b-2 border-primary">
                <h2 className="font-serif-jp text-[15px] font-semibold text-primary">
                  {config.title}　写真
                  <span className="ml-2 text-[10px] tracking-widest text-muted-foreground font-sans">
                    {caseData.requestNumber}
                  </span>
                </h2>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  Page {pi + 1} / {photoPages.length}
                </span>
              </div>

              <div
                className={`grid grid-cols-2 ${perPage === 6 ? "gap-x-4 gap-y-3" : "gap-x-5 gap-y-4"}`}
                style={{ gridTemplateRows: `repeat(${perPage / 2}, 1fr)`, height: "248mm" }}
              >
                {pagePhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="border border-border/60 rounded overflow-hidden flex flex-col min-h-0"
                  >
                    <div className="flex-1 min-h-0 bg-muted overflow-hidden">
                      <img
                        src={photo.fileUrl}
                        alt=""
                        className="w-full h-full object-contain cursor-zoom-in"
                        style={{
                          imageOrientation: "from-image",
                          transform: photo.rotation
                            ? `rotate(${photo.rotation}deg)`
                            : undefined,
                        }}
                        onClick={() => {
                          const idx = reportPhotos.findIndex((rp) => rp.id === photo.id);
                          if (idx >= 0) lightbox.open(idx);
                        }}
                      />
                    </div>
                    <div className="text-[11px] px-2 py-1.5 space-y-0.5 border-t border-border/60 shrink-0">
                      <p className="font-semibold font-serif-jp text-primary">▲ {photo.photoType}</p>
                      {photo.workItem && (
                        <p className="text-muted-foreground truncate">{photo.workItem}</p>
                      )}
                      {photo.memo && (
                        <p className="text-muted-foreground leading-snug whitespace-pre-wrap line-clamp-2">
                          {photo.memo}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <Lightbox
        items={lightboxItems}
        index={lightbox.index}
        onClose={lightbox.close}
        onIndexChange={lightbox.setIndex}
      />

      <style>{`
        .report-container { width: 210mm; }
        .report-page {
          width: 210mm;
          height: 297mm;
          padding: 14mm 12mm;
          box-sizing: border-box;
          overflow: hidden;
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .report-container { width: 210mm !important; }
          .report-page {
            box-shadow: none !important;
            border: none !important;
            page-break-after: always;
            margin: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            padding: 14mm 12mm !important;
            overflow: hidden;
          }
          .report-page:last-child { page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}

function SectionBand({ children }: { children: ReactNode }) {
  return (
    <div className="bg-primary text-primary-foreground font-serif-jp text-[13px] font-semibold px-3 py-1.5 mb-3 rounded-sm">
      {children}
    </div>
  );
}

function ReportTh({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  return (
    <th
      colSpan={colSpan}
      className="py-1.5 px-2.5 border border-border/70 bg-muted/50 text-left font-semibold align-middle whitespace-nowrap"
    >
      {children}
    </th>
  );
}

function ReportTd({
  children,
  colSpan,
  className = "",
}: {
  children: ReactNode;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td colSpan={colSpan} className={`py-1.5 px-2.5 border border-border/70 align-middle ${className}`}>
      {children}
    </td>
  );
}

/**
 * 署名欄。電子サインがあれば画像を表示し、無ければ紙に手書きでサインできる
 * 記入枠（氏名・日付）を残す。印刷運用を想定。
 */
function SignatureBlock({
  signature,
}: {
  signature: { fileUrl: string; signerName: string | null; signedAt: Date } | null | undefined;
}) {
  return (
    <div>
      <SectionBand>確認欄</SectionBand>
      <div className="grid grid-cols-2 gap-5">
        {/* プレナス責任者 */}
        <div className="border border-border/70 rounded-sm p-3">
          <p className="text-[11px] font-semibold mb-2">プレナス責任者</p>
          <div className="relative h-20 border-b border-foreground/40 flex items-end justify-center">
            {signature ? (
              <img
                src={signature.fileUrl}
                alt="サイン"
                className="max-h-[72px] object-contain pb-0.5"
              />
            ) : (
              <span className="absolute left-1 bottom-1 text-[10px] text-muted-foreground/50">
                サイン
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
            <span>
              氏名：
              <span className="text-foreground">{signature?.signerName ?? "　　　　　　"}</span>
            </span>
            <span>
              日付：
              <span className="text-foreground tabular-nums">
                {signature ? new Date(signature.signedAt).toLocaleDateString("ja-JP") : "　年　月　日"}
              </span>
            </span>
          </div>
        </div>
        {/* 先方確認欄（手書き用） */}
        <div className="border border-border/70 rounded-sm p-3">
          <p className="text-[11px] font-semibold mb-2">先方確認サイン</p>
          <div className="h-20 border-b border-foreground/40" />
          <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
            <span>氏名：　　　　　　</span>
            <span>日付：　年　月　日</span>
          </div>
        </div>
      </div>
    </div>
  );
}
