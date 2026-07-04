import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  Sparkles,
  FileText,
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { inlineImages } from "@/lib/imageDataUrl";
import { fileToUprightDataUrl } from "@/lib/imageOrientation";
import { SignaturePad } from "@/components/SignaturePad";
import { Lightbox, useLightbox } from "@/components/Lightbox";
import type { Photo, Case, CaseSignature } from "../../../drizzle/schema";
import {
  toFullWidthDigits as _toFullWidthDigits,
  reportLabel as _reportLabel,
} from "../../../shared/reportText";
import {
  COMPANY_INFO,
  EMPTY_COMPLETION_CONTENT,
  type CompletionReportContent,
  type EvaluationRow,
  type MeasurementRow,
  type MaterialRow,
  type ProcedureRow,
  type InspectionRow,
  type RiskRow,
} from "../../../shared/completionReport";

// PDF/報告書の全角化・括弧除去の対象外にする除外辞書（コンポーネントからsetReportExclusionsで注入）。
let _exclusions: string[] = [];
function setReportExclusions(terms: string[]) {
  _exclusions = terms;
}
function toFullWidthDigits(input: string | number | null | undefined): string {
  return _toFullWidthDigits(input, _exclusions);
}
function reportLabel(input: string | number | null | undefined): string {
  return _reportLabel(input, _exclusions);
}

// ---- 写真区分（APIのenumと一致） ----
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

// 写真の3区分（Before / Process / After）
type PhotoPhase = "before" | "process" | "after";
const phaseOfType = (t: string): PhotoPhase => {
  if (["施工後A", "施工後B", "設置状況"].includes(t)) return "after";
  if (["施工中"].includes(t)) return "process"; // enumには無いが将来用
  return "before";
};
const PHASE_META: Record<
  PhotoPhase,
  { label: string; sub: string; band: string; text: string }
> = {
  before: {
    label: "施工前の状態　Before",
    sub: "BEFORE",
    band: "bg-[#c0392b]",
    text: "text-[#c0392b]",
  },
  process: {
    label: "施工中の状況　Process",
    sub: "PROCESS",
    band: "bg-[#2471a3]",
    text: "text-[#2471a3]",
  },
  after: {
    label: "施工後の状態　After",
    sub: "AFTER",
    band: "bg-[#1e8449]",
    text: "text-[#1e8449]",
  },
};

const DEFAULT_TYPE_OF_PHASE: Record<PhotoPhase, PhotoTypeTag> = {
  before: "現調",
  process: "その他",
  after: "施工後A",
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return toFullWidthDigits(
    new Date(d).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );
}

export default function CompletionReport({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const reportType = "completion" as const;

  const { data: caseData, isLoading: caseLoading } = trpc.cases.get.useQuery({ id });
  const { data: photos = [], isLoading: photosLoading } = trpc.photos.listByCase.useQuery({
    caseId: id,
  });
  const { data: signature, isLoading: sigLoading } = trpc.signatures.get.useQuery({
    caseId: id,
    reportType,
  });
  const { data: draftData, isLoading: draftLoading } = trpc.reportDraft.get.useQuery({
    caseId: id,
  });
  const { data: exclusionRows = [] } = trpc.fullwidthExclusions.list.useQuery();
  // 除外辞書をモジュールスコープに反映（レンダリング前に同期的に適用）
  setReportExclusions(exclusionRows.map((r) => r.term));

  const containerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [editingSig, setEditingSig] = useState(false);

  // ---- 報告書本文（AI生成 + 手編集） ----
  const [content, setContent] = useState<CompletionReportContent>(EMPTY_COMPLETION_CONTENT);
  const [contentDirty, setContentDirty] = useState(false);
  useEffect(() => {
    if (draftData?.content) {
      setContent(draftData.content);
      setContentDirty(false);
    }
  }, [draftData?.content]);

  const patch = <K extends keyof CompletionReportContent>(
    key: K,
    value: CompletionReportContent[K]
  ) => {
    setContent((prev) => ({ ...prev, [key]: value }));
    setContentDirty(true);
  };

  const saveDraft = trpc.reportDraft.save.useMutation({
    onSuccess: () => {
      toast.success("報告書の内容を保存しました");
      setContentDirty(false);
      utils.reportDraft.get.invalidate({ caseId: id });
    },
    onError: (e) => toast.error(e.message || "保存に失敗しました"),
  });
  const generateDraft = trpc.reportDraft.generate.useMutation({
    onSuccess: (res) => {
      setContent(res.content);
      setContentDirty(false);
      utils.reportDraft.get.invalidate({ caseId: id });
      toast.success("AIが報告書の内容を生成しました");
    },
    onError: (e) => toast.error(e.message || "自動生成に失敗しました"),
  });

  // ---- 署名 ----
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

  // ---- 写真管理 ----
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [addType, setAddType] = useState<PhotoTypeTag>("施工後A");
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [photoDrafts, setPhotoDrafts] = useState<Record<number, { workItem: string; memo: string }>>({});
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

  // 完了報告書に載る写真: 全区分対象。Before→Process→After順、各内 orderNo 順。
  const reportPhotos = useMemo(() => {
    const phaseRank = (t: string) =>
      phaseOfType(t) === "before" ? 0 : phaseOfType(t) === "process" ? 1 : 2;
    return [...photos]
      .filter((p) =>
        ["現調", "施工前A", "施工前B", "施工後A", "施工後B", "設置状況"].includes(p.photoType)
      )
      .sort((a, b) => {
        const r = phaseRank(a.photoType) - phaseRank(b.photoType);
        if (r !== 0) return r;
        return a.orderNo - b.orderNo;
      });
  }, [photos]);

  const reorderPhotos = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const arr = [...reportPhotos];
    const [moved] = arr.splice(from, 1);
    if (!moved) return;
    arr.splice(to, 0, moved);
    // 移動先の前後フェーズに合わせて区分も更新
    const prev = arr[to - 1];
    const next = arr[to + 1];
    const targetPhase: PhotoPhase | null = prev
      ? phaseOfType(prev.photoType)
      : next
        ? phaseOfType(next.photoType)
        : null;
    if (targetPhase && phaseOfType(moved.photoType) !== targetPhase) {
      updatePhoto.mutate({ id: moved.id, photoType: DEFAULT_TYPE_OF_PHASE[targetPhase] });
    }
    arr.forEach((p, i) => {
      if (p.orderNo !== i) updatePhoto.mutate({ id: p.id, orderNo: i });
    });
  };
  const movePhoto = (index: number, dir: -1 | 1) => reorderPhotos(index, index + dir);

  const photoDraftOf = (photo: Photo) =>
    photoDrafts[photo.id] ?? { workItem: photo.workItem ?? "", memo: photo.memo ?? "" };
  const savePhotoComment = (photo: Photo) => {
    const d = photoDrafts[photo.id];
    if (!d) return;
    const workItem = d.workItem.trim();
    const memo = d.memo.trim();
    if (workItem === (photo.workItem ?? "") && memo === (photo.memo ?? "")) return;
    updatePhoto.mutate(
      { id: photo.id, workItem: workItem || null, memo: memo || null },
      {
        onSuccess: () => {
          toast.success("写真コメントを保存しました");
          setPhotoDrafts((prev) => {
            const next = { ...prev };
            delete next[photo.id];
            return next;
          });
        },
      }
    );
  };

  // ライトボックス
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

  // 写真キャプション（photoId -> caption）
  const captionMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of content.photoCaptions) m.set(c.photoId, c.caption);
    return m;
  }, [content.photoCaptions]);

  // 写真をフェーズごとにグルーピング（PDF本文用）
  const photosByPhase = useMemo(() => {
    const groups: Record<PhotoPhase, Photo[]> = { before: [], process: [], after: [] };
    for (const p of reportPhotos) groups[phaseOfType(p.photoType)].push(p);
    return groups;
  }, [reportPhotos]);

  // ---- PDF生成 ----
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
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }
      const safe = `${caseData.requestNumber}_${caseData.storeName}`.replace(/[\\/:*?"<>|]/g, "_");
      pdf.save(`工事完了報告書_${safe}.pdf`);
      toast.success("PDFをダウンロードしました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF生成に失敗しました");
    } finally {
      restore();
      setGenerating(false);
    }
  };

  if (caseLoading || photosLoading || sigLoading || draftLoading) {
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
  const workName =
    content.workName ||
    [caseData.categoryMedium, caseData.categorySmall].filter(Boolean).join(" ") ||
    caseData.requestContent ||
    "工事";
  const headerLine = `${COMPANY_INFO.companyName}　工事完了報告書｜${caseData.storeName}`;
  const footerLine = `${COMPANY_INFO.companyName}　${COMPANY_INFO.personName} ｜ TEL: ${toFullWidthDigits(COMPANY_INFO.tel)}`;
  const completedAt = caseData.completedAt ?? caseData.constructionDate ?? caseData.updatedAt;

  return (
    <CompletionReportView
      id={id}
      caseData={caseData}
      photos={photos}
      reportPhotos={reportPhotos}
      photosByPhase={photosByPhase}
      captionMap={captionMap}
      content={content}
      contentDirty={contentDirty}
      patch={patch}
      setContent={(c) => {
        setContent(c);
        setContentDirty(true);
      }}
      saveDraft={() => saveDraft.mutate({ caseId: id, content })}
      savingDraft={saveDraft.isPending}
      generateDraft={() => generateDraft.mutate({ caseId: id })}
      generatingDraft={generateDraft.isPending}
      signature={signature}
      hasSig={hasSig}
      editingSig={editingSig}
      setEditingSig={setEditingSig}
      signerName={signerName}
      setSignerName={setSignerName}
      saveSig={saveSig}
      deleteSig={deleteSig}
      fileRef={fileRef}
      cameraRef={cameraRef}
      addType={addType}
      setAddType={setAddType}
      uploading={uploading}
      handleAddFiles={handleAddFiles}
      dragIndex={dragIndex}
      setDragIndex={setDragIndex}
      reorderPhotos={reorderPhotos}
      movePhoto={movePhoto}
      removePhoto={removePhoto}
      updatePhoto={updatePhoto}
      photoDraftOf={photoDraftOf}
      setPhotoDrafts={setPhotoDrafts}
      savePhotoComment={savePhotoComment}
      lightbox={lightbox}
      lightboxItems={lightboxItems}
      containerRef={containerRef}
      generating={generating}
      handleDownloadPDF={handleDownloadPDF}
      setLocation={setLocation}
      workName={workName}
      headerLine={headerLine}
      footerLine={footerLine}
      completedAt={completedAt}
    />
  );
}

// ============================================================
// 小さな編集行コンポーネント群（PDF外の編集UI用テーブル行）
// ============================================================
type RowsEditorProps<T> = {
  title: string;
  rows: T[];
  columns: { key: keyof T; label: string; placeholder?: string }[];
  onChange: (rows: T[]) => void;
  emptyRow: T;
};
function RowsEditor<T extends Record<string, string>>({
  title,
  rows,
  columns,
  onChange,
  emptyRow,
}: RowsEditorProps<T>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{title}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-background h-7"
          onClick={() => onChange([...rows, { ...emptyRow }])}
        >
          + 行を追加
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">（未入力。空欄のままなら報告書に表示されません）</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              {columns.map((col) => (
                <Input
                  key={String(col.key)}
                  value={row[col.key] ?? ""}
                  placeholder={col.placeholder ?? col.label}
                  className="h-8 text-xs"
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...next[i], [col.key]: e.target.value };
                    onChange(next);
                  }}
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// PDF: セクション帯見出し（薄グレー＋左に黒四角＋番号）
function SectionBar({ no, children }: { no?: string; children: ReactNode }) {
  return (
    <div className="flex items-stretch mb-3">
      <div className="w-1.5 bg-[#1f2937]" />
      <div className="flex-1 bg-[#f1f3f5] px-3 py-1.5 flex items-center gap-2">
        {no && (
          <span className="inline-flex items-center justify-center w-5 h-5 bg-[#1f2937] text-white text-[10px] font-bold">
            {toFullWidthDigits(no)}
          </span>
        )}
        <span className="text-[14px] font-bold tracking-wide text-[#1f2937]">{children}</span>
      </div>
    </div>
  );
}

// PDF: 左赤縦線付き小見出し
function SubHead({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1.5 mt-3">
      <div className="w-1 h-4 bg-[#c0392b]" />
      <span className="text-[12.5px] font-bold text-[#1f2937]">{children}</span>
    </div>
  );
}

// PDF: 本文ブロック。空なら非表示。数字は全角化して表示する。
function Body({ text }: { text: string }) {
  if (!text?.trim()) return null;
  return <p className="text-[11.5px] leading-[1.7] text-[#222] whitespace-pre-wrap mb-1">{toFullWidthDigits(text)}</p>;
}

// ============================================================
// View 本体
// ============================================================
type ViewProps = {
  id: number;
  caseData: Case;
  photos: Photo[];
  reportPhotos: Photo[];
  photosByPhase: Record<PhotoPhase, Photo[]>;
  captionMap: Map<number, string>;
  content: CompletionReportContent;
  contentDirty: boolean;
  patch: <K extends keyof CompletionReportContent>(key: K, value: CompletionReportContent[K]) => void;
  setContent: (c: CompletionReportContent) => void;
  saveDraft: () => void;
  savingDraft: boolean;
  generateDraft: () => void;
  generatingDraft: boolean;
  signature: SignatureData;
  hasSig: boolean;
  editingSig: boolean;
  setEditingSig: (v: boolean) => void;
  signerName: string;
  setSignerName: (v: string) => void;
  saveSig: ReturnType<typeof trpc.signatures.save.useMutation>;
  deleteSig: ReturnType<typeof trpc.signatures.delete.useMutation>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  cameraRef: React.RefObject<HTMLInputElement | null>;
  addType: PhotoTypeTag;
  setAddType: (t: PhotoTypeTag) => void;
  uploading: boolean;
  handleAddFiles: (files: FileList | null) => void;
  dragIndex: number | null;
  setDragIndex: (i: number | null) => void;
  reorderPhotos: (from: number, to: number) => void;
  movePhoto: (index: number, dir: -1 | 1) => void;
  removePhoto: ReturnType<typeof trpc.photos.delete.useMutation>;
  updatePhoto: ReturnType<typeof trpc.photos.update.useMutation>;
  photoDraftOf: (photo: Photo) => { workItem: string; memo: string };
  setPhotoDrafts: React.Dispatch<
    React.SetStateAction<Record<number, { workItem: string; memo: string }>>
  >;
  savePhotoComment: (photo: Photo) => void;
  lightbox: ReturnType<typeof useLightbox>;
  lightboxItems: { url: string; title: string; subtitle?: string; rotation: number }[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  generating: boolean;
  handleDownloadPDF: () => void;
  setLocation: (to: string) => void;
  workName: string;
  headerLine: string;
  footerLine: string;
  completedAt: Date | null;
};

function CompletionReportView(props: ViewProps) {
  const {
    id,
    caseData,
    reportPhotos,
    photosByPhase,
    captionMap,
    content,
    contentDirty,
    patch,
    saveDraft,
    savingDraft,
    generateDraft,
    generatingDraft,
    signature,
    hasSig,
    editingSig,
    setEditingSig,
    signerName,
    setSignerName,
    saveSig,
    deleteSig,
    fileRef,
    cameraRef,
    addType,
    setAddType,
    uploading,
    handleAddFiles,
    dragIndex,
    setDragIndex,
    reorderPhotos,
    movePhoto,
    removePhoto,
    updatePhoto,
    photoDraftOf,
    setPhotoDrafts,
    savePhotoComment,
    lightbox,
    lightboxItems,
    containerRef,
    generating,
    handleDownloadPDF,
    setLocation,
    workName,
    headerLine,
    footerLine,
    completedAt,
  } = props;

  const totalPhotos = reportPhotos.length;

  return (
    <div className="pb-16">
      {/* 操作バー（印刷されない） */}
      <div className="no-print sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border mb-6">
        <div className="max-w-[900px] mx-auto px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/cases/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            案件へ戻る
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-background"
              onClick={generateDraft}
              disabled={generatingDraft}
            >
              {generatingDraft ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              AIで本文を生成
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-background"
              onClick={saveDraft}
              disabled={savingDraft || !contentDirty}
            >
              {savingDraft ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
              内容を保存
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              PDFダウンロード
            </Button>
          </div>
        </div>
      </div>

      {/* AI生成のヒント */}
      <div className="no-print max-w-[900px] mx-auto px-4 mb-4">
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          「AIで本文を生成」で、案件情報と写真から各セクションの文章と写真キャプションを自動作成します（金額は記載せず、断定が必要な原因等は空欄になります）。生成後はすべて手で編集でき、「内容を保存」で確定します。
        </div>
      </div>

      {/* ===== 編集パネル：本文セクション ===== */}
      <div className="no-print max-w-[900px] mx-auto px-4 mb-6 space-y-5">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              報告書本文（編集可）
            </h3>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm">工事名</Label>
                <Input value={content.workName} onChange={(e) => patch("workName", e.target.value)} placeholder="例）自動ドア センサー不良の修理交換" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">ステータスバッジ文言</Label>
                <Input value={content.statusBadge} onChange={(e) => patch("statusBadge", e.target.value)} placeholder="例）工事完了" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">1. 工事概要</Label>
                <Textarea value={content.overview} onChange={(e) => patch("overview", e.target.value)} rows={2} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">1-1. 施工目的</Label>
                <Textarea value={content.purpose} onChange={(e) => patch("purpose", e.target.value)} rows={2} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">1-2. 工事範囲</Label>
                <Textarea value={content.scope} onChange={(e) => patch("scope", e.target.value)} rows={2} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">2. 工事総評</Label>
                <Textarea value={content.summary} onChange={(e) => patch("summary", e.target.value)} rows={3} />
              </div>
            </div>

            <RowsEditor<EvaluationRow>
              title="3. 施工前後の状態評価"
              rows={content.evaluations}
              emptyRow={{ item: "", before: "", after: "", judgment: "" }}
              columns={[
                { key: "item", label: "評価項目" },
                { key: "before", label: "施工前" },
                { key: "after", label: "施工後" },
                { key: "judgment", label: "判定" },
              ]}
              onChange={(rows) => patch("evaluations", rows)}
            />
            <RowsEditor<MeasurementRow>
              title="5. 採寸データ（実測値）"
              rows={content.measurements}
              emptyRow={{ name: "", value: "" }}
              columns={[
                { key: "name", label: "計測箇所" },
                { key: "value", label: "実測値" },
              ]}
              onChange={(rows) => patch("measurements", rows)}
            />
            <RowsEditor<MaterialRow>
              title="6-1. 使用材料"
              rows={content.materials}
              emptyRow={{ name: "", spec: "", qty: "" }}
              columns={[
                { key: "name", label: "材料・部材名" },
                { key: "spec", label: "規格・仕様" },
                { key: "qty", label: "数量" },
              ]}
              onChange={(rows) => patch("materials", rows)}
            />
            <RowsEditor<ProcedureRow>
              title="6-2. 実施工法・施工手順"
              rows={content.procedures}
              emptyRow={{ step: "", detail: "" }}
              columns={[
                { key: "step", label: "手順", placeholder: "1" },
                { key: "detail", label: "作業内容" },
              ]}
              onChange={(rows) => patch("procedures", rows)}
            />
            <div className="grid gap-1.5">
              <Label className="text-sm">7. 工事完了結論および次のアクション</Label>
              <Textarea value={content.conclusion} onChange={(e) => patch("conclusion", e.target.value)} rows={3} />
            </div>
            <RowsEditor<InspectionRow>
              title="8. 次回点検・予防保全プラン"
              rows={content.inspections}
              emptyRow={{ timing: "", target: "", note: "" }}
              columns={[
                { key: "timing", label: "推奨時期" },
                { key: "target", label: "点検対象" },
                { key: "note", label: "観点" },
              ]}
              onChange={(rows) => patch("inspections", rows)}
            />
            <RowsEditor<RiskRow>
              title="9. 周辺部位の連鎖リスク評価"
              rows={content.risks}
              emptyRow={{ part: "", risk: "", level: "" }}
              columns={[
                { key: "part", label: "周辺部位" },
                { key: "risk", label: "想定リスク" },
                { key: "level", label: "注意度" },
              ]}
              onChange={(rows) => patch("risks", rows)}
            />
          </CardContent>
        </Card>

        {/* ===== 写真管理 ===== */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-base">掲載写真の管理</h3>
                <Badge variant="secondary" className="ml-1">{totalPhotos}枚</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select value={addType} onValueChange={(v) => setAddType(v as PhotoTypeTag)}>
                  <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_PHOTO_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleAddFiles(e.target.files)} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleAddFiles(e.target.files)} />
                <Button variant="outline" size="sm" className="bg-background" onClick={() => cameraRef.current?.click()} disabled={uploading}>
                  <Camera className="h-4 w-4 mr-1" />撮影
                </Button>
                <Button variant="outline" size="sm" className="bg-background" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}追加
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              写真は「施工前（現調）→施工後」の順に上から並びます。ドラッグ＆ドロップまたは上下ボタンで並べ替えでき、各写真の区分を変更すると施工前／施工後のグループが移動します。
            </p>

            {totalPhotos === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                写真がありません。「撮影」または「追加」から写真を登録してください。
              </div>
            ) : (
              <div className="grid gap-2">
                {reportPhotos.map((photo, index) => {
                  const draft = photoDraftOf(photo);
                  const phase = phaseOfType(photo.photoType);
                  return (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) reorderPhotos(dragIndex, index);
                        setDragIndex(null);
                      }}
                      className={`flex gap-3 items-start rounded-lg border p-2 bg-card ${dragIndex === index ? "opacity-50" : ""} ${phase === "after" ? "border-l-4 border-l-[#1e8449]" : phase === "process" ? "border-l-4 border-l-[#2471a3]" : "border-l-4 border-l-[#c0392b]"}`}
                    >
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" onClick={() => movePhoto(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" onClick={() => movePhoto(index, 1)} disabled={index === totalPhotos - 1}><ArrowDown className="h-3.5 w-3.5" /></button>
                      </div>
                      <button className="shrink-0" onClick={() => lightbox.open(index)}>
                        <img src={photo.fileUrl} alt="" className="h-20 w-20 object-cover rounded border border-border" style={{ transform: photo.rotation ? `rotate(${photo.rotation}deg)` : undefined }} />
                      </button>
                      <div className="flex-1 grid gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Select value={photo.photoType} onValueChange={(v) => updatePhoto.mutate({ id: photo.id, photoType: v as PhotoTypeTag })}>
                            <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ALL_PHOTO_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Badge variant="outline" className={`text-[10px] ${PHASE_META[phase].text}`}>{PHASE_META[phase].sub}</Badge>
                          <button className="text-muted-foreground hover:text-foreground" onClick={() => updatePhoto.mutate({ id: photo.id, rotation: (((photo.rotation ?? 0) - 90 + 360) % 360) })}><RotateCcw className="h-3.5 w-3.5" /></button>
                          <button className="text-muted-foreground hover:text-foreground" onClick={() => updatePhoto.mutate({ id: photo.id, rotation: (((photo.rotation ?? 0) + 90) % 360) })}><RotateCw className="h-3.5 w-3.5" /></button>
                          <button className="text-destructive ml-auto" onClick={() => { if (confirm("この写真を削除しますか？")) removePhoto.mutate({ id: photo.id }); }}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        <Input
                          value={draft.workItem}
                          placeholder="工事項目（任意）"
                          className="h-7 text-xs"
                          onChange={(e) => setPhotoDrafts((prev) => ({ ...prev, [photo.id]: { workItem: e.target.value, memo: (prev[photo.id]?.memo ?? photo.memo ?? "") } }))}
                          onBlur={() => savePhotoComment(photo)}
                        />
                        <Input
                          value={captionMap.get(photo.id) ?? draft.memo}
                          placeholder="確認内容（PDFの【写真N 確認内容】。AI生成・編集可）"
                          className="h-7 text-xs"
                          onChange={(e) => {
                            // captionとして content.photoCaptions を更新
                            const next = content.photoCaptions.filter((c) => c.photoId !== photo.id);
                            next.push({ photoId: photo.id, caption: e.target.value });
                            patch("photoCaptions", next);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== 署名 ===== */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <PenLine className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-base">確認サイン（任意）</h3>
            </div>
            {hasSig && !editingSig ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="rounded-lg border border-border bg-white p-2">
                    <img src={signature!.fileUrl} alt="サイン" className="h-20 object-contain" />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {signature!.signerName && (<p>署名者：<span className="text-foreground font-medium">{signature!.signerName}</span></p>)}
                    <p>サイン日時：{new Date(signature!.signedAt).toLocaleString("ja-JP")}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="bg-background" onClick={() => setEditingSig(true)}><RotateCcw className="h-4 w-4 mr-1" />サインし直す</Button>
                  <Button variant="outline" size="sm" className="bg-background text-destructive" onClick={() => deleteSig.mutate({ caseId: id, reportType: "completion" })} disabled={deleteSig.isPending}>削除</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-1.5 max-w-xs">
                  <Label htmlFor="signerName" className="text-xs">署名者名（任意）</Label>
                  <Input id="signerName" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="例）プレナス 山田" className="h-9" />
                </div>
                <SignaturePad
                  saving={saveSig.isPending}
                  onConfirm={(dataUrl) => saveSig.mutate({ caseId: id, reportType: "completion", signerName: signerName.trim() || null, imageBase64: dataUrl })}
                />
                {hasSig && (<Button variant="ghost" size="sm" onClick={() => setEditingSig(false)}>キャンセル</Button>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== PDFソース（参考PDF準拠） ===== */}
      <div className="flex justify-center">
        <div ref={containerRef} className="report-container bg-white text-black shadow-lg">
          <CompletionReportPages
            caseData={caseData}
            content={content}
            photosByPhase={photosByPhase}
            captionMap={captionMap}
            signature={signature}
            workName={workName}
            headerLine={headerLine}
            footerLine={footerLine}
            completedAt={completedAt}
          />
        </div>
      </div>

      <Lightbox items={lightboxItems} index={lightbox.index} onClose={lightbox.close} onIndexChange={lightbox.setIndex} />

      <style>{`
        .report-container { width: 210mm; }
        .report-page {
          width: 210mm;
          min-height: 297mm;
          max-height: 297mm;
          padding: 8mm 10mm;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
          page-break-after: always;
          background: #fff;
        }
        .report-page + .report-page { border-top: 1px dashed #ddd; }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// PDF本文：参考PDF準拠の多ページレイアウト
// ============================================================
type SignatureData = CaseSignature | null | undefined;

function PageFrame({
  headerLine,
  footerLine,
  pageNo,
  totalPages,
  children,
}: {
  headerLine: string;
  footerLine: string;
  pageNo: number;
  totalPages: number;
  children: ReactNode;
}) {
  return (
    <div className="report-page font-sans flex flex-col">
      <div className="flex items-center justify-center border-b border-[#999] pb-1 mb-3">
        <span className="text-[9.5px] text-[#555] tracking-wide">{headerLine}</span>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
      <div className="flex items-center justify-center border-t border-[#999] pt-1 mt-3">
        <span className="text-[8.5px] text-[#666]">
          {footerLine} ｜ ページ {toFullWidthDigits(pageNo)} / {toFullWidthDigits(totalPages)}
        </span>
      </div>
    </div>
  );
}

// 物件情報テーブル行
function InfoRow({ label, value, highlight }: { label: string; value: ReactNode; highlight?: boolean }) {
  // 値が文字列の場合は数字を全角化して表示する
  const display = typeof value === "string" || typeof value === "number" ? toFullWidthDigits(value) : value;
  return (
    <tr>
      <td className="bg-[#374151] text-white text-[11px] font-medium px-2 py-1.5 w-[28%] align-top border border-[#cbd5e1]">{label}</td>
      <td className={`text-[11px] px-2 py-1.5 align-top border border-[#cbd5e1] ${highlight ? "bg-[#fff7e6] font-semibold" : "bg-[#fbfcfd]"}`}>{display || "—"}</td>
    </tr>
  );
}

function PhotoBlock({ photo, caption }: { photo: Photo; caption?: string }) {
  const phase = phaseOfType(photo.photoType);
  const meta = PHASE_META[phase];
  return (
    <div className="border border-[#e2e8f0] rounded overflow-hidden flex flex-col break-inside-avoid">
      <div className="relative bg-[#f8f9fa] flex items-center justify-center" style={{ height: "46mm" }}>
        <img
          src={photo.fileUrl}
          alt=""
          className="max-w-full max-h-full object-contain"
          style={{ transform: photo.rotation ? `rotate(${photo.rotation}deg)` : undefined }}
          crossOrigin="anonymous"
        />
      </div>
      <div className={`${meta.band} text-white text-[9.5px] font-bold px-2 py-0.5 flex items-center justify-between`}>
        <span>{meta.sub}</span>
        {photo.workItem && <span className="font-normal opacity-90">{reportLabel(photo.workItem)}</span>}
      </div>
      <div className="px-2 py-1 text-[9.5px] leading-[1.5] text-[#333] min-h-[10mm]">
        {caption?.trim() ? reportLabel(caption) : photo.memo?.trim() ? reportLabel(photo.memo) : `${meta.sub === "BEFORE" ? "施工前" : meta.sub === "AFTER" ? "施工後" : "施工中"}の状態`}
      </div>
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function CompletionReportPages({
  caseData,
  content,
  photosByPhase,
  captionMap,
  signature,
  workName,
  headerLine,
  footerLine,
  completedAt,
}: {
  caseData: Case;
  content: CompletionReportContent;
  photosByPhase: Record<PhotoPhase, Photo[]>;
  captionMap: Map<number, string>;
  signature: SignatureData;
  workName: string;
  headerLine: string;
  footerLine: string;
  completedAt: Date | null;
}) {
  const issuedAt = new Date();

  // 写真ページ（フェーズごとに6枚=2列×3行で分割）
  const photoPagesData: { phase: PhotoPhase; photos: Photo[] }[] = [];
  (["before", "process", "after"] as PhotoPhase[]).forEach((ph) => {
    const list = photosByPhase[ph];
    if (list.length === 0) return;
    chunk(list, 6).forEach((c) => photoPagesData.push({ phase: ph, photos: c }));
  });

  // 後半セクションのうち実データがあるものだけ表示
  const hasEval = content.evaluations.length > 0;
  const hasMeasure = content.measurements.length > 0;
  const hasMaterial = content.materials.length > 0;
  const hasProc = content.procedures.length > 0;
  const hasInspect = content.inspections.length > 0;
  const hasRisk = content.risks.length > 0;

  // --- 後半セクションのページビン詰め ---
  // A4有効高さ ≈ 297mm - 8mm*2(padding) - 12mm(header+footer) = 269mm → px換算(96dpi): ~1017px
  // 簡易的にmm単位で見積もる（SectionBar≈8mm, SubHead≈6mm, テーブル行≈6mm, Body≈8mm/段落, 署名≈35mm）
  const PAGE_CONTENT_HEIGHT_MM = 260; // 安全マージン込み
  type TailSection = { key: string; heightMm: number; render: () => ReactNode };
  const tailSections: TailSection[] = [];

  if (hasMeasure) {
    tailSections.push({
      key: "measure",
      heightMm: 8 + content.measurements.length * 6 + 4,
      render: () => (
        <>
          <SectionBar no="5">採寸データ　実測値</SectionBar>
          <table className="w-full border-collapse mb-3">
            <tbody>
              {content.measurements.map((m, i) => (
                <tr key={i}>
                  <td className="bg-[#374151] text-white text-[10px] px-2 py-1 w-[40%] border border-[#cbd5e1]">{reportLabel(m.name)}</td>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd]">{m.value ? reportLabel(m.value) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    });
  }

  if (hasMaterial) {
    tailSections.push({
      key: "material",
      heightMm: 8 + 6 + 6 + content.materials.length * 6 + 4,
      render: () => (
        <>
          {!tailSections.some(s => s.key === "measure") && <SectionBar no="6">使用材料・実施工法詳細</SectionBar>}
          {tailSections.some(s => s.key === "measure") && <SectionBar no="6">使用材料・実施工法詳細</SectionBar>}
          <SubHead>６－１．使用材料</SubHead>
          <table className="w-full border-collapse mb-3">
            <thead>
              <tr>
                {["材料・部材名", "規格・仕様", "数量"].map((h) => (
                  <th key={h} className="bg-[#374151] text-white text-[10px] font-medium px-2 py-1 border border-[#cbd5e1]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.materials.map((m, i) => (
                <tr key={i}>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd]">{reportLabel(m.name)}</td>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd]">{m.spec ? reportLabel(m.spec) : "—"}</td>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd] text-center">{m.qty ? reportLabel(m.qty) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    });
  }

  if (hasProc) {
    tailSections.push({
      key: "proc",
      heightMm: 6 + content.procedures.length * 6 + 4,
      render: () => (
        <>
          <SubHead>６－２．実施工法・施工手順</SubHead>
          <table className="w-full border-collapse mb-3">
            <tbody>
              {content.procedures.map((p, i) => (
                <tr key={i}>
                  <td className="bg-[#374151] text-white text-[10px] px-2 py-1 w-[12%] text-center border border-[#cbd5e1]">{toFullWidthDigits(p.step || i + 1)}</td>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd]">{reportLabel(p.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    });
  }

  if (content.conclusion?.trim()) {
    tailSections.push({
      key: "conclusion",
      heightMm: 8 + 10 + 4,
      render: () => (
        <>
          <SectionBar no="7">工事完了結論および次のアクション</SectionBar>
          <Body text={content.conclusion} />
        </>
      ),
    });
  }

  if (hasInspect) {
    tailSections.push({
      key: "inspect",
      heightMm: 8 + 6 + content.inspections.length * 6 + 4,
      render: () => (
        <>
          <SectionBar no="8">次回点検・予防保全プラン</SectionBar>
          <table className="w-full border-collapse mb-3">
            <thead>
              <tr>
                {["推奨時期", "点検対象", "観点・内容"].map((h) => (
                  <th key={h} className="bg-[#374151] text-white text-[10px] font-medium px-2 py-1 border border-[#cbd5e1]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.inspections.map((r, i) => (
                <tr key={i}>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd]">{reportLabel(r.timing)}</td>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd]">{reportLabel(r.target)}</td>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd]">{reportLabel(r.note)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    });
  }

  if (hasRisk) {
    tailSections.push({
      key: "risk",
      heightMm: 8 + 6 + content.risks.length * 6 + 4,
      render: () => (
        <>
          <SectionBar no="9">周辺部位の連鎖リスク評価</SectionBar>
          <table className="w-full border-collapse mb-3">
            <thead>
              <tr>
                {["周辺部位", "想定される連鎖リスク", "注意度"].map((h) => (
                  <th key={h} className="bg-[#374151] text-white text-[10px] font-medium px-2 py-1 border border-[#cbd5e1]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.risks.map((r, i) => (
                <tr key={i}>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd]">{reportLabel(r.part)}</td>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd]">{reportLabel(r.risk)}</td>
                  <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd] text-center">{r.level ? reportLabel(r.level) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    });
  }

  // 署名は常に最後
  tailSections.push({
    key: "signature",
    heightMm: 35,
    render: () => (
      <div className="mt-6 flex justify-end">
        <div className="text-center">
          <p className="text-[9px] text-[#888] mb-1">確認サイン</p>
          <div className="border border-[#cbd5e1] rounded w-[50mm] h-[24mm] flex items-center justify-center bg-white">
            {signature ? (
              <img src={signature.fileUrl} alt="サイン" className="max-h-[22mm] max-w-[48mm] object-contain" crossOrigin="anonymous" />
            ) : (
              <span className="text-[9px] text-[#bbb]">　</span>
            )}
          </div>
          {signature?.signerName && <p className="text-[9px] text-[#555] mt-1">{signature.signerName}</p>}
        </div>
      </div>
    ),
  });

  // ビン詰め: セクションをページに分割
  const tailPages: ReactNode[][] = [[]];
  let currentHeight = 0;
  for (const sec of tailSections) {
    if (currentHeight + sec.heightMm > PAGE_CONTENT_HEIGHT_MM && tailPages[tailPages.length - 1].length > 0) {
      tailPages.push([]);
      currentHeight = 0;
    }
    tailPages[tailPages.length - 1].push(sec.render());
    currentHeight += sec.heightMm;
  }

  // 総ページ数を計算（表紙1 + 提出者1 + 物件情報1 + 範囲/総評/評価1 + 写真n + 後半ページ数）
  const basePages = 4;
  const totalPages = basePages + photoPagesData.length + tailPages.length;
  let pageNo = 0;
  const next = () => ++pageNo;

  const frame = (children: ReactNode) => (
    <PageFrame headerLine={headerLine} footerLine={footerLine} pageNo={next()} totalPages={totalPages}>
      {children}
    </PageFrame>
  );

  return (
    <>
      {/* ===== 1. 表紙 ===== */}
      {frame(
        <div className="h-full flex flex-col items-center justify-center text-center px-6">
          <div className="border border-[#374151] px-3 py-1 text-[10px] text-[#374151] mb-10">
            報告書番号：{toFullWidthDigits(caseData.requestNumber)}
          </div>
          <div className="w-full border-t-2 border-b-2 border-[#1f2937] py-5 mb-2">
            <h1 className="text-[32px] font-bold tracking-[0.3em] text-[#1f2937]">工事完了報告書</h1>
          </div>
          <p className="text-[11px] tracking-[0.25em] text-[#888] mb-12">Construction Completion Report</p>
          <p className="text-[15px] font-bold text-[#c0392b] mb-2">{caseData.brand}</p>
          <p className="text-[26px] font-bold text-[#1f2937] mb-3">{caseData.storeName}</p>
          <p className="text-[12px] text-[#444] mb-10">{reportLabel(workName)}</p>
          <div className="inline-flex items-center gap-1.5 bg-[#1e8449] text-white text-[12px] font-bold rounded-full px-5 py-2 mb-12">
            <span>✓</span>
            <span>{reportLabel(content.statusBadge || "工事完了")}</span>
          </div>
          <div className="text-[11px] text-[#333] space-y-1">
            <p>施工完了日：{fmtDate(completedAt)}</p>
            <p>発行日：{fmtDate(issuedAt)}</p>
          </div>
        </div>
      )}

      {/* ===== 2. 提出者情報 ===== */}
      {frame(
        <div className="h-full flex flex-col items-center justify-center px-8">
          <div className="w-full max-w-[150mm] border border-[#cbd5e1] rounded p-8 text-center">
            <p className="text-[12px] text-[#333] mb-8 leading-relaxed">
              下記のとおり工事を完了いたしましたので、ご報告申し上げます。
            </p>
            <div className="text-[12px] text-[#222] space-y-3">
              <p className="text-[15px] font-bold mb-6">{COMPANY_INFO.submitTo}</p>
              <div className="border-t border-[#e2e8f0] pt-6 space-y-2">
                <p className="text-[10px] text-[#888]">{COMPANY_INFO.builder}</p>
                <p className="text-[15px] font-bold">{COMPANY_INFO.companyName}</p>
                <p className="text-[13px]">{COMPANY_INFO.personName}</p>
                <p className="text-[11px] text-[#555]">TEL：{toFullWidthDigits(COMPANY_INFO.tel)}</p>
                <p className="text-[11px] text-[#555]">Email：{COMPANY_INFO.email}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 3. 物件情報＋工事概要 ===== */}
      {frame(
        <div className="h-full">
          <SectionBar no="■">物件情報</SectionBar>
          <table className="w-full border-collapse mb-4">
            <tbody>
              <InfoRow label="依頼番号" value={caseData.requestNumber} />
              <InfoRow label="ブランド" value={caseData.brand} />
              <InfoRow label="店舗名" value={caseData.storeName} />
              <InfoRow label="店舗コード" value={caseData.storeCode} />
              <InfoRow label="所在地" value={caseData.address} />
              <InfoRow label="店舗電話" value={caseData.storePhone} />
              <InfoRow label="工事種別" value={[caseData.categoryLarge, caseData.categoryMedium, caseData.categorySmall].filter(Boolean).join("　・　")} />
              <InfoRow label="施工日" value={fmtDate(caseData.constructionDate)} highlight />
              <InfoRow label="完了日" value={fmtDate(completedAt)} highlight />
              <InfoRow label="状態" value={<span className="inline-flex items-center gap-1 bg-[#1e8449] text-white text-[9px] font-bold rounded px-2 py-0.5">✓ 完了</span>} />
            </tbody>
          </table>

          <SectionBar no="1">工事概要</SectionBar>
          <Body text={content.overview} />
          {!content.overview?.trim() && (
            <p className="text-[10px] text-[#999] mb-1">「AIで本文を生成」で自動入力できます</p>
          )}
          <SubHead>１－１．施工目的</SubHead>
          <Body text={content.purpose} />
        </div>
      )}

      {/* ===== 4. 工事範囲・総評・評価表 ===== */}
      {frame(
        <div className="h-full">
          <SubHead>１－２．工事範囲</SubHead>
          <Body text={content.scope} />

          <SectionBar no="2">工事総評</SectionBar>
          <Body text={content.summary} />

          {hasEval && (
            <>
              <SectionBar no="3">施工前後の状態評価</SectionBar>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["評価項目", "施工前の状態", "施工後の状態", "判定"].map((h) => (
                      <th key={h} className="bg-[#374151] text-white text-[10px] font-medium px-2 py-1 border border-[#cbd5e1]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {content.evaluations.map((r, i) => (
                    <tr key={i}>
                      <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd] align-top">{reportLabel(r.item)}</td>
                      <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd] align-top">{reportLabel(r.before)}</td>
                      <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] bg-[#fbfcfd] align-top">{reportLabel(r.after)}</td>
                      <td className="text-[10px] px-2 py-1 border border-[#cbd5e1] align-top text-center bg-[#e9f7ef] text-[#1e8449] font-bold">{r.judgment ? `✓ ${reportLabel(r.judgment)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ===== 写真ページ ===== */}
      {photoPagesData.map((pg, idx) => {
        const meta = PHASE_META[pg.phase];
        const firstOfPhase =
          idx === 0 || photoPagesData[idx - 1].phase !== pg.phase;
        return (
          <div key={`photopage-${idx}`}>
            {frame(
              <div className="h-full flex flex-col">
                {firstOfPhase && idx === 0 && <SectionBar no="4">施工写真　ビフォー・施工中・アフター</SectionBar>}
                <SubHead>
                  <span className={meta.text}>４－{pg.phase === "before" ? "１" : pg.phase === "process" ? "２" : "３"}．{meta.label}</span>
                </SubHead>
                <div className="grid grid-cols-2 gap-3 flex-1 content-start">
                  {pg.photos.map((p) => (
                    <PhotoBlock key={p.id} photo={p} caption={captionMap.get(p.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ===== 後半：動的ページ分割 ===== */}
      {tailPages.map((sections, tpIdx) => (
        <div key={`tail-${tpIdx}`}>
          {frame(
            <div className="h-full">
              {sections.map((node, si) => <div key={si}>{node}</div>)}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
