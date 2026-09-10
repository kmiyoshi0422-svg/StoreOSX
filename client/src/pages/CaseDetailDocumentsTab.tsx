import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { fileToUprightDataUrl } from "@/lib/imageOrientation";
import { Lightbox, useLightbox } from "@/components/Lightbox";
import {
  syncStatusFromStage,
  syncStageFromStatus,
  type ProgressStage,
  type CaseStatus,
} from "@shared/stageStatus";
import { useLocation } from "wouter";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Trash2,
  FileText,
  ImageIcon,
  ListChecks,
  Info,
  Loader2,
  Phone,
  MapPin,
  Save,
  Download,
  Wallet,
  Users,
  Camera,
  Briefcase,
  Smartphone,
  Receipt,
  Link2,
  Copy,
  Sparkles,
  PenLine,
  Wand2,
  RotateCw,
  RotateCcw,
  Clock,
  CheckSquare,
  CalendarDays,
  Calendar,
  ExternalLink,
  X,
  FolderOpen,
  Plus,
  Folder,
  FileUp,
  Eye,
  Globe,
  Tag,
  Repeat,
  ShieldCheck,
  Minus as MinusIcon,
  Plus as PlusIcon,
  Building2,
  SkipForward,
} from "lucide-react";
import { generateQuotePDF, generateCompletionReportPDF } from "@/lib/documentPdf";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import html2canvas from "html2canvas-pro";
import {
  CATEGORY_LARGE_OPTIONS,
  CATEGORY_MEDIUM_OPTIONS,
  recommendPartnerCategories,
} from "../../../shared/checklist-template";
import type { Case, ChecklistItem, Photo } from "../../../drizzle/schema";
import { PREFECTURES, detectPrefecture } from "@shared/prefecture";
import { StoreEquipmentPanel } from "./StoreEquipmentPanel";
import { StoreMasterLinkPanel } from "./StoreMasterLinkPanel";

const STATUS_COLORS: Record<string, string> = {
  受付: "bg-slate-100 text-slate-700 border-slate-200",
  現調中: "bg-amber-50 text-amber-700 border-amber-200",
  見積中: "bg-blue-50 text-blue-700 border-blue-200",
  施工待ち: "bg-purple-50 text-purple-700 border-purple-200",
  施工中: "bg-orange-50 text-orange-700 border-orange-200",
  完了: "bg-emerald-50 text-emerald-700 border-emerald-200",
  クローズ: "bg-zinc-100 text-zinc-600 border-zinc-200",
};
const URGENCY_COLORS: Record<string, string> = {
  S: "bg-red-600 text-white",
  A: "bg-orange-500 text-white",
  B: "bg-yellow-500 text-white",
  C: "bg-emerald-500 text-white",
};
const URGENCY_LABEL: Record<string, string> = { S: "緊急", A: "高", B: "中", C: "低" };

const PHOTO_TYPES = [
  "施工前A",
  "施工前B",
  "施工中",
  "施工後A",
  "施工後B",
  "設置状況",
  "メーカー型番",
  "現調",
  "その他",
] as const;

const DOCUMENT_CATEGORIES = ["図面", "仕様書", "見積書", "報告書", "写真", "その他"] as const;

export default function DocumentsTab({ caseId, caseData }: { caseId: number; caseData: any }) {
  const utils = trpc.useUtils();
  const { data: docs = [], isLoading } = trpc.documents.list.useQuery({ caseId });
  // Fetch shared documents that may be relevant to this case
  const { data: sharedDocs } = trpc.documents.listAll.useQuery({ scope: "shared", limit: 50 });
  // Fetch project folders linked to this case
  const { data: caseFolders } = trpc.projectFolders.listByCaseId.useQuery({ caseId });
  const folderIds = useMemo(() => (caseFolders || []).map((f: any) => f.id), [caseFolders]);
  const { data: folderDocs } = trpc.projectFolders.listDocumentsByFolders.useQuery(
    { folderIds },
    { enabled: folderIds.length > 0 }
  );
  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate({ caseId });
      toast.success("ファイルをアップロードしました");
      setUploading(false);
    },
    onError: (err) => {
      toast.error(`アップロード失敗: ${err.message}`);
      setUploading(false);
    },
  });
  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate({ caseId });
      toast.success("削除しました");
    },
  });
  const memoMutation = trpc.documents.updateMemo.useMutation({
    onSuccess: () => utils.documents.list.invalidate({ caseId }),
  });

  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = useMemo(() => {
    if (filterCategory === "all") return docs;
    return docs.filter((d) => d.category === filterCategory);
  }, [docs, filterCategory]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      // Auto-detect category from file name/type
      let category: typeof DOCUMENT_CATEGORIES[number] = "その他";
      const name = file.name.toLowerCase();
      if (name.includes("図面") || name.includes("drawing") || name.includes("plan")) category = "図面";
      else if (name.includes("仕様") || name.includes("spec")) category = "仕様書";
      else if (name.includes("見積") || name.includes("estimate")) category = "見積書";
      else if (name.includes("報告") || name.includes("report")) category = "報告書";
      else if (file.type.startsWith("image/")) category = "写真";

      await uploadMutation.mutateAsync({
        caseId,
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
        fileSize: file.size,
        category,
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getCategoryColor(cat: string) {
    switch (cat) {
      case "図面": return "bg-blue-100 text-blue-800";
      case "仕様書": return "bg-purple-100 text-purple-800";
      case "見積書": return "bg-green-100 text-green-800";
      case "報告書": return "bg-orange-100 text-orange-800";
      case "写真": return "bg-pink-100 text-pink-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: Upload + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="カテゴリ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {DOCUMENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filteredDocs.length}件</span>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.zip,.txt"
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileUp className="h-4 w-4 mr-1" />}
            アップロード
          </Button>
        </div>
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Folder className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>ドキュメントがありません</p>
            <p className="text-xs mt-1">図面・仕様書・資料をアップロードしてください</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-shrink-0">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{doc.fileName}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${getCategoryColor(doc.category)}`}>
                      {doc.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString("ja-JP")}</span>
                    {doc.memo && <span className="truncate max-w-[200px]">📝 {doc.memo}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => window.open(doc.fileUrl, "_blank")}
                    title="プレビュー / ダウンロード"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        title="削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ファイルを削除</AlertDialogTitle>
                        <AlertDialogDescription>
                          「{doc.fileName}」を削除します。この操作は取り消せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate({ id: doc.id })}
                        >
                          削除する
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Project Folder Documents */}
      {caseFolders && caseFolders.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">プロジェクトフォルダ資料</h3>
            <span className="text-xs text-muted-foreground">（この案件が属するフォルダの共通資料）</span>
          </div>
          {caseFolders.map((folder: any) => (
            <div key={folder.id} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium">{folder.name}</span>
              </div>
              {folderDocs && folderDocs.filter((d: any) => d.folderId === folder.id).length > 0 ? (
                <div className="space-y-1.5 ml-5">
                  {folderDocs.filter((d: any) => d.folderId === folder.id).map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg border bg-amber-50/50 hover:bg-amber-50">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs flex-1 truncate">{doc.fileName}</span>
                      <Badge className={`text-[9px] px-1 py-0 ${getCategoryColor(doc.category)}`}>
                        {doc.category}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => window.open(doc.fileUrl, "_blank")}>
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground ml-5">資料なし</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Shared Documents Section */}
      {sharedDocs && sharedDocs.items && sharedDocs.items.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold">共通資料</h3>
            <span className="text-xs text-muted-foreground">（全案件共通で参照可能）</span>
          </div>
          <div className="space-y-2">
            {sharedDocs.items.map((doc: any) => {
              const tags: string[] = doc.tags ? (() => { try { return JSON.parse(doc.tags); } catch { return []; } })() : [];
              return (
                <Card key={doc.id} className="hover:shadow-sm transition-shadow border-l-4 border-l-blue-400">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Globe className="h-7 w-7 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-medium truncate">{doc.fileName}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${getCategoryColor(doc.category)}`}>
                          {doc.category}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700 bg-blue-50">
                          共通
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString("ja-JP")}</span>
                        {doc.memo && <span className="truncate max-w-[200px]">📝 {doc.memo}</span>}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          {tags.map((t: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => window.open(doc.fileUrl, "_blank")}
                        title="プレビュー / ダウンロード"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

