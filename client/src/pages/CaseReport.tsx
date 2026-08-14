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
  Eye,
  GripVertical,
  LayoutGrid,
  Grid3x3,
  List,
  CheckCircle2,
} from "lucide-react";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { inlineImages } from "@/lib/imageDataUrl";
import { fileToUprightDataUrl } from "@/lib/imageOrientation";
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
import {
  toFullWidthDigits as _toFullWidthDigits,
  reportLabel as _reportLabel,
} from "../../../shared/reportText";

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
    // 施工前（現調）系と施工後系の両方を掲載対象にし、グループ見出し付きで羅列する
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
  "施工中",
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

// 完了報告書のグループ定義（施工前 / 施工中 / 施工後）
type PhotoGroupKey = "before" | "process" | "after";
const BEFORE_TYPES: PhotoTypeTag[] = ["現調", "施工前A", "施工前B"];
const PROCESS_TYPES: PhotoTypeTag[] = ["施工中"];
const AFTER_TYPES: PhotoTypeTag[] = ["施工後A", "施工後B", "設置状況"];
const groupOfType = (t: PhotoTypeTag): PhotoGroupKey =>
  AFTER_TYPES.includes(t) ? "after" : PROCESS_TYPES.includes(t) ? "process" : "before";
// グループをまたいで移動した際に割り当てる代表区分
const DEFAULT_TYPE_OF_GROUP: Record<PhotoGroupKey, PhotoTypeTag> = {
  before: "現調",
  process: "施工中",
  after: "施工後A",
};
const GROUP_LABEL: Record<PhotoGroupKey, string> = {
  before: "施工前（現調）",
  process: "施工中",
  after: "施工後",
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
  const { data: exclusionRows = [] } = trpc.fullwidthExclusions.list.useQuery();
  setReportExclusions(exclusionRows.map((r) => r.term));

  const containerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [editingSig, setEditingSig] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

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

  // 所感管理
  const [impressionText, setImpressionText] = useState(caseData?.surveyImpression ?? "");
  const [impressionAuthor, setImpressionAuthor] = useState(caseData?.surveyImpressionAuthor ?? "");
  const [generatingImpression, setGeneratingImpression] = useState(false);
  const [savingImpression, setSavingImpression] = useState(false);
  const generateImpressionMut = trpc.cases.generateImpression.useMutation();
  const updateCaseMut = trpc.cases.update.useMutation();

  // 報告書完了mutation
  const markCompleteMut = trpc.cases.markReportComplete.useMutation({
    onSuccess: () => {
      toast.success("報告書を「作成完了」にしました。夜間にPDFが自動生成され管理者に通知されます。");
      utils.cases.get.invalidate({ id });
      setConfirmComplete(false);
    },
    onError: (e: any) => toast.error(e.message || "完了処理に失敗しました"),
  });

  // 保留中のAIタスクを取得
  const { data: pendingTasks = [], refetch: refetchPending } = trpc.pendingAiTasks.listByCase.useQuery(
    { caseId: id },
    { enabled: reportType === "survey" }
  );
  const dismissTaskMut = trpc.pendingAiTasks.dismiss.useMutation({
    onSuccess: () => refetchPending(),
  });

  // 設定からAI生成トーン・文章量を取得
  const { data: impressionConfigData } = trpc.appSettings.get.useQuery({ key: "impression_config" });
  const { data: impressionAuthorsData } = trpc.appSettings.get.useQuery({ key: "impression_authors" });
  const presetAuthors: string[] = (impressionAuthorsData?.value as string[] | null) ?? [];
  const { data: impressionTemplatesData } = trpc.appSettings.get.useQuery({ key: "impression_templates" });
  const presetTemplates: string[] = (impressionTemplatesData?.value as string[] | null) ?? [];

  const handleGenerateImpression = async (pendingTaskId?: number) => {
    setGeneratingImpression(true);
    try {
      const cfg = impressionConfigData?.value as { tone?: string; length?: string } | null;
      const result = await generateImpressionMut.mutateAsync({
        caseId: id,
        tone: (cfg?.tone as "polite" | "standard" | "concise") || "standard",
        length: (cfg?.length as "short" | "standard" | "long") || "standard",
        pendingTaskId,
      });
      setImpressionText(result.impression);
      toast.success("AIが所感を生成しました。内容を確認・編集して保存してください。");
      refetchPending();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "AI生成に失敗しました";
      if (errMsg.includes("QUOTA_EXCEEDED")) {
        toast.error("ℹ️ AI利用上限に達したため一時保存しました。後で「再試行」ボタンから実行できます。", { duration: 6000 });
        refetchPending();
      } else {
        toast.error(errMsg.replace("QUOTA_EXCEEDED:", ""));
      }
    } finally {
      setGeneratingImpression(false);
    }
  };

  const handleSaveImpression = async () => {
    setSavingImpression(true);
    try {
      await updateCaseMut.mutateAsync({
        id,
        data: {
          surveyImpression: impressionText.trim() || null,
          surveyImpressionAuthor: impressionAuthor.trim() || null,
        },
      });
      utils.cases.get.invalidate({ id });
      toast.success("所感を保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSavingImpression(false);
    }
  };

  const handleClearImpression = async () => {
    setSavingImpression(true);
    try {
      await updateCaseMut.mutateAsync({
        id,
        data: { surveyImpression: null, surveyImpressionAuthor: null },
      });
      setImpressionText("");
      setImpressionAuthor("");
      utils.cases.get.invalidate({ id });
      toast.success("所感を削除しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setSavingImpression(false);
    }
  };

  // 写真管理
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [addType, setAddType] = useState<PhotoTypeTag>(DEFAULT_ADD_TYPE[reportType]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [perPage, setPerPage] = useState<4 | 6>(4);
  const [photoViewMode, setPhotoViewMode] = useState<"grid" | "card">("grid");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // タッチDnD用state
  const touchState = useRef<{
    active: boolean;
    startIndex: number | null;
    timer: ReturnType<typeof setTimeout> | null;
    startX: number;
    startY: number;
    ghost: HTMLElement | null;
  }>({ active: false, startIndex: null, timer: null, startX: 0, startY: 0, ghost: null });
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
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
    const fileArr = Array.from(files);
    setUploading(true);
    setUploadProgress({ current: 0, total: fileArr.length });
    let successCount = 0;
    let failCount = 0;
    try {
      for (let i = 0; i < fileArr.length; i++) {
        const file = fileArr[i];
        setUploadProgress({ current: i + 1, total: fileArr.length });
        try {
          const { dataUrl, mimeType } = await fileToUprightDataUrl(file);
          await uploadPhoto.mutateAsync({
            caseId: id,
            fileName: file.name,
            fileBase64: dataUrl,
            mimeType,
            photoType: addType,
          });
          successCount++;
        } catch {
          failCount++;
        }
      }
      if (failCount === 0) {
        toast.success(`${successCount}枚を「${addType}」として追加しました`);
      } else {
        toast.warning(`${successCount}枚追加、${failCount}枚失敗しました`);
      }
      await refetchPhotos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const isCompletion = reportType === "completion";

  // 該当区分の写真を抽出。
  // ・完了報告書: グループ（施工前→施工後）→ orderNo 順
  // ・現場調査報告書: config.photoTypes の順 → orderNo
  const reportPhotos = useMemo(() => {
    const order = config.photoTypes;
    const filtered = [...photos].filter((p) => order.includes(p.photoType));
    if (isCompletion) {
      const groupRank = (t: PhotoTypeTag) => groupOfType(t) === "before" ? 0 : groupOfType(t) === "process" ? 1 : 2;
      return filtered.sort((a, b) => {
        const ga = groupRank(a.photoType);
        const gb = groupRank(b.photoType);
        if (ga !== gb) return ga - gb;
        return a.orderNo - b.orderNo;
      });
    }
    return filtered.sort((a, b) => {
      const ai = order.indexOf(a.photoType);
      const bi = order.indexOf(b.photoType);
      if (ai !== bi) return ai - bi;
      return a.orderNo - b.orderNo;
    });
  }, [photos, config.photoTypes, isCompletion]);

  // 表示順を from → to に並べ替え、orderNoを表示順に合わせて一括更新する。
  // 完了報告書でグループをまたいで移動した場合は、ドロップ先グループの代表区分に photoType も更新する。
  const reorderPhotos = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const arr = [...reportPhotos];
    const [moved] = arr.splice(from, 1);
    if (!moved) return;
    arr.splice(to, 0, moved);

    // 完了報告書：移動先位置の前後から属すべきグループを推定し、区分が変わるなら更新する。
    if (isCompletion) {
      const prev = arr[to - 1];
      const next = arr[to + 1];
      const targetGroup: PhotoGroupKey | null = prev
        ? groupOfType(prev.photoType)
        : next
          ? groupOfType(next.photoType)
          : null;
      if (targetGroup && groupOfType(moved.photoType) !== targetGroup) {
        updatePhoto.mutate({
          id: moved.id,
          photoType: DEFAULT_TYPE_OF_GROUP[targetGroup],
        });
      }
    }

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

  // --- タッチDnDハンドラ ---
  const touchCleanup = () => {
    const ts = touchState.current;
    if (ts.timer) { clearTimeout(ts.timer); ts.timer = null; }
    if (ts.ghost) { ts.ghost.remove(); ts.ghost = null; }
    ts.active = false;
    ts.startIndex = null;
  };

  const findItemAtPoint = (x: number, y: number): number | null => {
    let found: number | null = null;
    itemRefs.current.forEach((el, idx) => {
      if (found !== null) return;
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) found = idx;
    });
    return found;
  };

  const onTouchStart = (index: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const ts = touchState.current;
    ts.startX = touch.clientX;
    ts.startY = touch.clientY;
    ts.startIndex = index;
    ts.timer = setTimeout(() => {
      // ロングプレス成功
      if (navigator.vibrate) navigator.vibrate(30);
      ts.active = true;
      setDragIndex(index);
      setOverIndex(index);
      // ゴースト作成
      const el = itemRefs.current.get(index);
      if (el) {
        const rect = el.getBoundingClientRect();
        const ghost = el.cloneNode(true) as HTMLElement;
        ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;opacity:0.85;transform:scale(1.03);z-index:9999;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.18);border-radius:8px;`;
        document.body.appendChild(ghost);
        ts.ghost = ghost;
      }
    }, 300);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const ts = touchState.current;
    const touch = e.touches[0];
    const dx = touch.clientX - ts.startX;
    const dy = touch.clientY - ts.startY;
    if (!ts.active) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (ts.timer) { clearTimeout(ts.timer); ts.timer = null; }
      }
      return;
    }
    e.preventDefault();
    // ゴースト移動
    if (ts.ghost) {
      const curTop = parseFloat(ts.ghost.style.top);
      const curLeft = parseFloat(ts.ghost.style.left);
      ts.ghost.style.top = `${curTop + (touch.clientY - ts.startY)}px`;
      ts.ghost.style.left = `${curLeft + (touch.clientX - ts.startX)}px`;
    }
    ts.startX = touch.clientX;
    ts.startY = touch.clientY;
    // ドロップ先検出
    const overIdx = findItemAtPoint(touch.clientX, touch.clientY);
    if (overIdx !== null) setOverIndex(overIdx);
    // 自動スクロール
    const threshold = 60;
    if (touch.clientY < threshold) window.scrollBy(0, -6);
    else if (touch.clientY > window.innerHeight - threshold) window.scrollBy(0, 6);
  };

  const onTouchEnd = () => {
    const ts = touchState.current;
    if (ts.active && ts.startIndex !== null && overIndex !== null && ts.startIndex !== overIndex) {
      reorderPhotos(ts.startIndex, overIndex);
    }
    touchCleanup();
    setDragIndex(null);
    setOverIndex(null);
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

  // 写真管理カードの描画（index は reportPhotos 全体の通し番号）
  const renderPhotoCard = (photo: Photo, index: number) => {
    const d = draftOf(photo);
    const dirty =
      d.workItem !== (photo.workItem ?? "") || d.memo !== (photo.memo ?? "");
    const isDropTarget = overIndex === index && dragIndex !== null && dragIndex !== index;
    const isDragging = dragIndex === index;
    return (
      <div
        key={photo.id}
        className="relative"
        ref={(el) => { if (el) itemRefs.current.set(index, el); else itemRefs.current.delete(index); }}
      >
        {/* 挿入位置インジケーター（上側） */}
        {isDropTarget && dragIndex !== null && dragIndex > index && (
          <div className="absolute -top-1.5 left-2 right-2 h-0.5 bg-primary rounded-full z-10 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
        )}
        <div
          draggable
          onDragStart={(e) => {
            setDragIndex(index);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnter={() => setOverIndex(index)}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDragEnd={() => {
            if (dragIndex !== null && overIndex !== null) {
              reorderPhotos(dragIndex, overIndex);
            }
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragIndex !== null) reorderPhotos(dragIndex, index);
            setDragIndex(null);
            setOverIndex(null);
          }}
          className={`rounded-lg border overflow-hidden bg-card transition-all duration-150 ${
            isDropTarget
              ? "border-primary ring-2 ring-primary/40 scale-[1.02]"
              : "border-border/60"
          } ${isDragging ? "opacity-40 scale-95" : ""}`}
        >
        <div className="flex">
          <div
            className="flex items-center justify-center px-2 bg-muted/60 cursor-grab active:cursor-grabbing"
            title="ドラッグして並び替え"
            onTouchStart={(e) => onTouchStart(index, e)}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
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
                transform: photo.rotation ? `rotate(${photo.rotation}deg)` : undefined,
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
                  updatePhoto.mutate({ id: photo.id, photoType: v as PhotoTypeTag })
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
                disabled={index === reportPhotos.length - 1 || updatePhoto.isPending}
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
        {/* 挿入位置インジケーター（下側） */}
        {isDropTarget && dragIndex !== null && dragIndex < index && (
          <div className="absolute -bottom-1.5 left-2 right-2 h-0.5 bg-primary rounded-full z-10 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
        )}
      </div>
    );
  };

  // 写真ページ（perPage 枚／ページ）— 現場調査報告書で使用
  const photoPages = useMemo(() => {
    const result: Photo[][] = [];
    for (let i = 0; i < reportPhotos.length; i += perPage) {
      result.push(reportPhotos.slice(i, i + perPage));
    }
    return result;
  }, [reportPhotos, perPage]);

  const handleDownloadPDF = async () => {
    if (!containerRef.current || !caseData) return;
    setGenerating(true);
    setPdfProgress("画像を準備中...");
    const restore = await inlineImages(containerRef.current).catch(() => () => {});
    try {
      // フォントの読み込みを待つ（日本語フォントが未ロードだと文字化けする）
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 100));

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const pages = containerRef.current.querySelectorAll<HTMLElement>(".report-page");
      const totalPages = pages.length;
      // 写真が多い場合はscaleを下げて高速化
      // 印刷品質を維持しつつ速度を優先: 1.5で十分な品質（A4 300dpi相当）
      const renderScale = totalPages > 15 ? 1.2 : totalPages > 8 ? 1.4 : totalPages > 4 ? 1.6 : 1.8;
      // JPEG品質: ページ数が多い場合は品質を下げて高速化
      const jpegQuality = totalPages > 10 ? 0.72 : totalPages > 5 ? 0.78 : 0.85;

      for (let i = 0; i < totalPages; i++) {
        setPdfProgress(`ページ ${i + 1} / ${totalPages} を処理中...`);
        // UIを更新するためにイベントループに制御を戻す
        await new Promise((r) => setTimeout(r, 0));
        const canvas = await html2canvas(pages[i], {
          scale: renderScale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 800,
          imageTimeout: 5000,
          removeContainer: true,
        });
        const imgData = canvas.toDataURL("image/jpeg", jpegQuality);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
        // メモリ解放: 大きなcanvasを即座にGC対象にする
        canvas.width = 0;
        canvas.height = 0;
      }
      setPdfProgress("PDFを保存中...");
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
      setPdfProgress("");
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" />
              プレビュー
            </Button>
            <Button onClick={handleDownloadPDF} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {generating ? (pdfProgress || "PDF生成中...") : "PDFダウンロード"}
            </Button>
            {caseData.reportStatus !== "completed" ? (
              <Button
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setConfirmComplete(true)}
              >
                <CheckCircle2 className="h-4 w-4" />
                作成完了
              </Button>
            ) : (
              <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50 px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                完了済み
                {caseData.reportPdfUrl && (
                  <a href={caseData.reportPdfUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline text-xs">
                    PDF
                  </a>
                )}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* 差し戻しコメント表示 */}
      {caseData.reportRejectComment && caseData.reportStatus === "draft" && (
        <div className="no-print max-w-[800px] mx-auto mb-4">
          <div className="border border-red-300 bg-red-50 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-semibold text-sm">⚠️ 差し戻しコメント</span>
            </div>
            <p className="text-sm text-red-800 mt-1 whitespace-pre-wrap">{caseData.reportRejectComment}</p>
            <p className="text-xs text-red-500 mt-2">
              {caseData.reportRejectedBy && `差し戻し者: ${caseData.reportRejectedBy}`}
              {caseData.reportRejectedAt && ` / ${new Date(caseData.reportRejectedAt).toLocaleDateString("ja-JP")}`}
            </p>
          </div>
        </div>
      )}

      {/* 作成完了確認ダイアログ */}
      {confirmComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="font-semibold text-lg mb-2">報告書を「作成完了」にしますか？</h3>
            <p className="text-sm text-muted-foreground mb-4">
              完了にすると、夜間（2〜5時）にPDFが自動生成され、管理者全員にアプリ内通知が送信されます。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmComplete(false)}>
                キャンセル
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => markCompleteMut.mutate({ caseId: id, reportType })}
                disabled={markCompleteMut.isPending}
              >
                {markCompleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                完了にする
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 所感入力セクション（現調報告書のみ） */}
      {reportType === "survey" && (
        <div className="no-print max-w-[800px] mx-auto mb-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-serif-jp text-base font-semibold">所感</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                現場調査後の所感を自由に記入できます。AIによる文章生成も利用可能です。
              </p>
              <div className="grid gap-1.5 max-w-xs">
                <Label className="text-xs">記入者</Label>
                <div className="flex gap-2">
                  <Input
                    value={impressionAuthor}
                    onChange={(e) => setImpressionAuthor(e.target.value)}
                    placeholder="例）山田 太郎"
                    className="h-9 flex-1"
                  />
                  {presetAuthors.length > 0 && (
                    <Select
                      value=""
                      onValueChange={(v) => setImpressionAuthor(v)}
                    >
                      <SelectTrigger className="h-9 w-[120px]">
                        <SelectValue placeholder="選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {presetAuthors.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <Textarea
                value={impressionText}
                onChange={(e) => setImpressionText(e.target.value)}
                placeholder="現場の状況、推定原因、推奨対応策などを記入..."
                rows={5}
                className="text-sm"
              />
              {/* テンプレート挿入 */}
              {presetTemplates.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">テンプレートから挿入</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {presetTemplates.map((tpl, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="h-auto py-1 px-2 text-xs text-left whitespace-normal max-w-[280px] bg-background"
                        onClick={() => {
                          setImpressionText((prev) => prev ? prev + "\n" + tpl : tpl);
                          toast.success("テンプレートを挿入しました");
                        }}
                      >
                        {tpl.length > 40 ? tpl.slice(0, 40) + "…" : tpl}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateImpression()}
                  disabled={generatingImpression}
                >
                  {generatingImpression ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <span className="mr-1">✨</span>
                  )}
                  AIで所感を生成
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveImpression}
                  disabled={savingImpression}
                >
                  {savingImpression ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  保存
                </Button>
                {caseData?.surveyImpression && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={handleClearImpression}
                    disabled={savingImpression}
                  >
                    削除
                  </Button>
                )}
              </div>
              {/* 保留中AIタスクの再試行UI */}
              {pendingTasks.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-medium">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    一時保存済みのAIタスクがあります
                  </div>
                  {pendingTasks.filter(t => t.taskType === "impression").map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {new Date(task.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {" "}— {task.errorMessage || "AI生成失敗"}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs border-amber-300 hover:bg-amber-100"
                          onClick={() => handleGenerateImpression(task.id)}
                          disabled={generatingImpression}
                        >
                          {generatingImpression ? <Loader2 className="h-3 w-3 animate-spin" /> : "↻"} 再試行
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => dismissTaskMut.mutate({ id: task.id })}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
                {/* 表示モード切り替え */}
                <div className="flex items-center rounded-md border border-border/60 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPhotoViewMode("grid")}
                    className={`h-8 px-2.5 flex items-center gap-1 text-xs transition-colors ${
                      photoViewMode === "grid"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                    title="グリッド表示"
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoViewMode("card")}
                    className={`h-8 px-2.5 flex items-center gap-1 text-xs transition-colors ${
                      photoViewMode === "card"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                    title="カード表示（編集）"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-[11px] text-muted-foreground">
                  1ページの枚数
                </Label>
                <Select
                  value={String(perPage)}
                  onValueChange={(v) => setPerPage(Number(v) as 4 | 6)}
                >
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4枚</SelectItem>
                    <SelectItem value="6">6枚</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              {reportType === "survey"
                ? "現調・施工前の写真が載ります。ドラッグで並び替え、各写真のコメントも編集できます。"
                : "「施工前（現調）」「施工中」「施工後」に振り分けて写真を取り込めます。各グループ内はドラッグで並び替えでき、報告書には施工前→施工中→施工後の順で上から羅列されます。区分を変更するとグループも移動します。"}
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
                ファイルから追加（複数可）
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
            {/* アップロード進捗表示 */}
            {uploading && uploadProgress.total > 0 && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300 mb-1">
                    <span>アップロード中...</span>
                    <span>{uploadProgress.current} / {uploadProgress.total}枚</span>
                  </div>
                  <div className="h-1.5 bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 写真一覧 */}
            {reportPhotos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                この報告書に載る写真はまだありません。上のボタンから追加してください。
              </p>
            ) : photoViewMode === "grid" ? (
              /* グリッド表示モード：シンプルなサムネイルギャラリー */
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {reportPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted cursor-zoom-in hover:ring-2 hover:ring-primary/50 transition-all duration-150"
                    onClick={() => lightbox.open(index)}
                  >
                    <img
                      src={photo.fileUrl}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      style={{
                        imageOrientation: "from-image",
                        transform: photo.rotation ? `rotate(${photo.rotation}deg)` : undefined,
                      }}
                    />
                    {/* 番号バッジ */}
                    <span className="absolute top-1 left-1 z-10 text-[10px] font-bold bg-black/70 text-white rounded px-1.5 py-0.5 backdrop-blur-sm">
                      {index + 1}
                    </span>
                    {/* 区分バッジ */}
                    <span className="absolute bottom-1 left-1 z-10 text-[9px] font-medium bg-white/90 dark:bg-black/70 text-foreground rounded px-1.5 py-0.5 backdrop-blur-sm truncate max-w-[calc(100%-8px)]">
                      {photo.photoType}
                    </span>
                    {/* ホバー時の拡大アイコン */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-150 flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-80 transition-opacity duration-150 drop-shadow-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isCompletion ? (
              /* カード表示モード（完了報告書：グループ分け） */
              <div className="space-y-4">
                {(["before", "process", "after"] as PhotoGroupKey[]).map((gkey) => {
                  const items = reportPhotos
                    .map((photo, index) => ({ photo, index }))
                    .filter(({ photo }) => groupOfType(photo.photoType) === gkey);
                  return (
                    <div
                      key={gkey}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex === null) return;
                        const lastInGroup = items.length
                          ? items[items.length - 1].index
                          : reportPhotos.length - 1;
                        reorderPhotos(dragIndex, lastInGroup);
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      className="rounded-xl border border-border/60 bg-muted/20 p-3"
                    >
                      <div className="mb-2.5 flex items-center gap-2">
                        <span
                          className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-bold ${
                            gkey === "before"
                              ? "bg-muted text-foreground"
                              : gkey === "process"
                                ? "bg-blue-600 text-white"
                                : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {gkey === "before" ? "BEFORE" : gkey === "process" ? "PROCESS" : "AFTER"}
                        </span>
                        <h3 className="text-sm font-semibold font-serif-jp">
                          {GROUP_LABEL[gkey]}
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          {items.length}枚
                        </span>
                      </div>
                      {items.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground py-4 text-center border border-dashed border-border/60 rounded-lg">
                          ここにドラッグすると「{GROUP_LABEL[gkey]}」に移します。
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {items.map(({ photo, index }) => renderPhotoCard(photo, index))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* カード表示モード（現調報告書） */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reportPhotos.map((photo, index) => renderPhotoCard(photo, index))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* 報告書本体（PDFソース） */}
      <div ref={containerRef} className="report-container mx-auto">
        {/* 1ページ目：基本情報 */}
        {(() => {
          // 本文の行数でページ分割を判定（約800文字以上または15行以上で分割）
          const bodyText = caseData.requestContent || "";
          const notesText = caseData.notes || "";
          const impText = (reportType === "survey" ? caseData.surveyImpression : null) || "";
          const bodyLines = bodyText.split("\n").length;
          const notesLines = notesText.split("\n").length;
          const impLines = impText ? impText.split("\n").length + 2 : 0;
          const totalTextLines = bodyLines + (notesText ? notesLines + 2 : 0) + impLines;
          const totalChars = bodyText.length + notesText.length + impText.length;
          const needsSplit = totalTextLines > 15 || totalChars > 800;

          const headerBlock = (
            <>
              <div className="text-center pb-3 mb-6">
                <h1 className="font-serif-jp text-[28px] font-bold tracking-[0.18em] text-primary">
                  {config.title}
                </h1>
                <p className="text-[10.5px] tracking-[0.3em] text-muted-foreground uppercase mt-1">
                  {config.eyebrow}
                </p>
                <div className="mt-3 h-[3px] bg-primary rounded-full" />
              </div>
              <div className="flex items-end justify-between mb-5">
                <div>
                  <p className="text-[15.5px] mb-1">
                    <strong className="font-serif-jp">{caseData.storeName}</strong>　御中
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">{config.leadText}</p>
                </div>
                <div className="text-[11.5px] text-muted-foreground text-right space-y-0.5 tabular-nums">
                  <p>案件番号：{toFullWidthDigits(caseData.requestNumber)}</p>
                  <p>報告日：{fmtDate(new Date())}</p>
                </div>
              </div>
            </>
          );

          const tableBlock = (
            <>
              <SectionBand>物件情報</SectionBand>
              <table className="w-full border-collapse text-[12.5px] mb-7 table-fixed">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[24%]" />
                  <col className="w-[26%]" />
                  <col className="w-[24%]" />
                </colgroup>
                <tbody>
                  <tr>
                    <ReportTh>ブランド</ReportTh>
                    <ReportTd>{reportLabel(caseData.brand)}</ReportTd>
                    <ReportTh>店舗名</ReportTh>
                    <ReportTd>{reportLabel(caseData.storeName)}</ReportTd>
                  </tr>
                  <tr>
                    <ReportTh>店舗住所</ReportTh>
                    <ReportTd colSpan={3}>{caseData.address ? toFullWidthDigits(caseData.address) : "—"}</ReportTd>
                  </tr>
                  <tr>
                    <ReportTh>店舗電話</ReportTh>
                    <ReportTd>{caseData.storePhone ? toFullWidthDigits(caseData.storePhone) : "—"}</ReportTd>
                    <ReportTh>作業区分</ReportTh>
                    <ReportTd>{caseData.workType ? reportLabel(caseData.workType) : "—"}</ReportTd>
                  </tr>
                  <tr>
                    <ReportTh>工事種別</ReportTh>
                    <ReportTd colSpan={3}>
                      {[caseData.categoryLarge, caseData.categoryMedium, caseData.categorySmall]
                        .filter(Boolean)
                        .map((v) => reportLabel(v as string))
                        .join("　・　") || "—"}
                    </ReportTd>
                  </tr>
                  <tr>
                    <ReportTh>{config.dateLabel}</ReportTh>
                    <ReportTd>{fmtDate(config.dateField(caseData))}</ReportTd>
                    <ReportTh>協力会社</ReportTh>
                    <ReportTd>{caseData.contractorName ? reportLabel(caseData.contractorName) : "—"}</ReportTd>
                  </tr>
                  {reportType === "completion" && (
                    <tr>
                      <ReportTh>完了日</ReportTh>
                      <ReportTd colSpan={3}>{fmtDate(caseData.completedAt ?? caseData.updatedAt)}</ReportTd>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          );

          const bodyBlock = (
            <>
              <SectionBand>{reportType === "survey" ? "調査内容・依頼内容" : "作業内容"}</SectionBand>
              <p className="text-[12.5px] whitespace-pre-wrap leading-[1.7] mb-7 px-0.5">
                {caseData.requestContent ? reportLabel(caseData.requestContent) : "—"}
              </p>
              {caseData.notes && (
                <>
                  <SectionBand>備考</SectionBand>
                  <p className="text-[12.5px] whitespace-pre-wrap leading-[1.7] mb-7 px-0.5">
                    {reportLabel(caseData.notes)}
                  </p>
                </>
              )}
            </>
          );

          const impressionBlock = reportType === "survey" && caseData.surveyImpression ? (
            <section className="report-page bg-white border border-border/60 shadow-sm mb-6 flex flex-col">
              <div className="flex-1 min-h-0 overflow-hidden">
                <SectionBand>所感</SectionBand>
                <p className="text-[12.5px] whitespace-pre-wrap leading-[1.7] mb-4 px-0.5">
                  {reportLabel(caseData.surveyImpression)}
                </p>
                {caseData.surveyImpressionAuthor && (
                  <p className="text-[11px] text-right text-muted-foreground mb-7 px-0.5">
                    記入者：{caseData.surveyImpressionAuthor}
                  </p>
                )}
              </div>
            </section>
          ) : null;

          if (!needsSplit) {
            // 1ページに収まる場合
            return (
              <>
                <section className="report-page bg-white border border-border/60 shadow-sm mb-6 flex flex-col">
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {headerBlock}
                    {tableBlock}
                    {bodyBlock}
                  </div>
                  <div className="shrink-0 pt-4">
                    <SignatureBlock signature={signature} />
                  </div>
                </section>
                {impressionBlock}
              </>
            );
          } else {
            // 2ページに分割：1ページ目=ヘッダー+テーブル、2ページ目=本文+確認欄
            return (
              <>
                <section className="report-page bg-white border border-border/60 shadow-sm mb-6 flex flex-col">
                  <div className="flex-1 min-h-0">
                    {headerBlock}
                    {tableBlock}
                  </div>
                </section>
                <section className="report-page bg-white border border-border/60 shadow-sm mb-6 flex flex-col">
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {bodyBlock}
                  </div>
                  <div className="shrink-0 pt-4">
                    <SignatureBlock signature={signature} />
                  </div>
                </section>
                {impressionBlock}
              </>
            );
          }
        })()}

        {/* 写真ページ：両報告書とも羅列レイアウト（A4縦固定） */}
        {photoPages.length === 0 ? (
          <section className="report-page bg-white border border-border/60 shadow-sm mb-6">
            <p className="text-center text-sm text-muted-foreground py-12">
              {reportType === "completion"
                ? "掲載する写真が登録されていません。施工前（現調）・施工後の写真を取り込んでください。"
                : "現場調査写真（現調／施工前）が登録されていません。"}
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
                    {toFullWidthDigits(caseData.requestNumber)}
                  </span>
                </h2>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  ページ {toFullWidthDigits(pi + 1)} / {toFullWidthDigits(photoPages.length)}
                </span>
              </div>

              <div
                className={`grid grid-cols-2 ${perPage === 6 ? "gap-x-4 gap-y-3" : "gap-x-5 gap-y-4"}`}
                style={{ gridTemplateRows: `repeat(${perPage / 2}, 1fr)`, height: "265mm" }}
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
                    <div className="text-[11.5px] px-2 py-1.5 space-y-0.5 border-t border-border/60 shrink-0">
                      <p className="font-semibold font-serif-jp text-primary">▲ {photo.photoType}</p>
                      {photo.workItem && (
                        <p className="text-muted-foreground truncate">{reportLabel(photo.workItem)}</p>
                      )}
                      {photo.memo && (
                        <p className="text-muted-foreground leading-snug whitespace-pre-wrap line-clamp-2">
                          {reportLabel(photo.memo)}
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
          padding: 8mm 10mm;
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
            padding: 8mm 10mm !important;
            overflow: hidden;
          }
          .report-page:last-child { page-break-after: auto; }
        }
      `}</style>

      {/* PDFプレビューモーダル */}
      <PdfPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        containerRef={containerRef}
        fileName={`${reportType === "survey" ? "現調報告書" : "工事完了報告書"}_${caseData?.requestNumber ?? ""}_${caseData?.storeName ?? ""}`}
        pageSelector=".report-page"
      />
    </div>
  );
}

function SectionBand({ children }: { children: ReactNode }) {
  return (
    <div className="bg-primary text-primary-foreground font-serif-jp text-[14px] font-semibold px-3 py-1.5 mb-3 rounded-sm">
      {children}
    </div>
  );
}

function ReportTh({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  return (
    <th
      colSpan={colSpan}
      className="py-2 px-2.5 border border-border/70 bg-muted/50 text-left font-semibold align-middle whitespace-nowrap"
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
    <td colSpan={colSpan} className={`py-2 px-2.5 border border-border/70 align-middle ${className}`}>
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
                {signature ? toFullWidthDigits(new Date(signature.signedAt).toLocaleDateString("ja-JP")) : "　年　月　日"}
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
