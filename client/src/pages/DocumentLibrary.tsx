import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText, Search, Eye, Library, ExternalLink, Upload, Lock, Unlock, Plus, Tag, Globe } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const CATEGORIES = ["図面", "仕様書", "見積書", "報告書", "写真", "担当者一覧", "施工対象一覧", "マニュアル", "その他"] as const;

function getCategoryColor(cat: string) {
  switch (cat) {
    case "図面": return "bg-blue-100 text-blue-800";
    case "仕様書": return "bg-purple-100 text-purple-800";
    case "見積書": return "bg-green-100 text-green-800";
    case "報告書": return "bg-orange-100 text-orange-800";
    case "写真": return "bg-pink-100 text-pink-800";
    case "担当者一覧": return "bg-cyan-100 text-cyan-800";
    case "施工対象一覧": return "bg-teal-100 text-teal-800";
    case "マニュアル": return "bg-indigo-100 text-indigo-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectCategory(fileName: string, mimeType: string): typeof CATEGORIES[number] {
  const lower = fileName.toLowerCase();
  if (lower.includes("図面") || lower.includes("plan") || lower.includes("dwg") || lower.includes("cad")) return "図面";
  if (lower.includes("仕様") || lower.includes("spec")) return "仕様書";
  if (lower.includes("見積") || lower.includes("estimate") || lower.includes("quotation")) return "見積書";
  if (lower.includes("報告") || lower.includes("report")) return "報告書";
  if (lower.includes("担当") || lower.includes("一覧") || lower.includes("list")) return "担当者一覧";
  if (lower.includes("対象") || lower.includes("店舗一覧")) return "施工対象一覧";
  if (lower.includes("マニュアル") || lower.includes("manual")) return "マニュアル";
  if (mimeType.startsWith("image/")) return "写真";
  return "その他";
}

function parseTags(tagsStr: string | null | undefined): string[] {
  if (!tagsStr) return [];
  try { return JSON.parse(tagsStr); } catch { return []; }
}

export default function DocumentLibrary() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [scope, setScope] = useState<"all" | "case" | "shared">("all");
  const [page, setPage] = useState(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const limit = 30;

  const queryInput = useMemo(() => ({
    search: search || undefined,
    category: category === "all" ? undefined : category,
    scope: scope === "all" ? undefined : scope,
    limit,
    offset: page * limit,
  }), [search, category, scope, page]);

  const { data, isLoading } = trpc.documents.listAll.useQuery(queryInput);
  const { data: casesData } = trpc.cases.listSummary.useQuery();
  const utils = trpc.useUtils();
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: () => {
      utils.documents.listAll.invalidate();
      setShowUploadDialog(false);
      toast.success("ファイルをアップロードしました");
    },
    onError: () => toast.error("アップロードに失敗しました"),
  });

  const toggleLockMutation = trpc.documents.toggleLock.useMutation({
    onSuccess: () => {
      utils.documents.listAll.invalidate();
      toast.success("ロック状態を変更しました");
    },
    onError: () => toast.error("ロック変更に失敗しました"),
  });

  const updateTagsMutation = trpc.documents.updateTags.useMutation({
    onSuccess: () => {
      utils.documents.listAll.invalidate();
      toast.success("タグを更新しました");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">資料DB庫</h1>
          <span className="text-sm text-muted-foreground ml-2">{total}件</span>
        </div>
        <Button size="sm" onClick={() => setShowUploadDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          アップロード
        </Button>
      </div>

      {/* Scope Tabs */}
      <Tabs value={scope} onValueChange={(v) => { setScope(v as any); setPage(0); }}>
        <TabsList className="grid w-full grid-cols-3 max-w-sm">
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="case">
            <FileText className="h-3.5 w-3.5 mr-1" />
            案件紐づき
          </TabsTrigger>
          <TabsTrigger value="shared">
            <Globe className="h-3.5 w-3.5 mr-1" />
            共通資料
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ファイル名で検索..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9"
          />
        </div>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(0); }}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="カテゴリ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Info banner for shared scope */}
      {scope === "shared" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <Globe className="h-4 w-4 inline mr-1.5" />
          <strong>共通資料</strong>は案件に紐づかず、全案件から参照できる資料です。担当者一覧、仕様書、施工対象店舗一覧などを登録できます。
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Library className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>ドキュメントが見つかりません</p>
            <p className="text-xs mt-1">上の「アップロード」ボタンから直接追加できます</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((doc: any) => {
            const tags = parseTags(doc.tags);
            return (
              <Card key={doc.id} className={`hover:shadow-sm transition-shadow ${doc.isLocked ? "border-l-4 border-l-amber-500" : ""} ${!doc.caseId ? "border-l-4 border-l-blue-400" : ""}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {doc.caseId ? (
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <Globe className="h-8 w-8 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium truncate">{doc.fileName}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${getCategoryColor(doc.category)}`}>
                        {doc.category}
                      </Badge>
                      {!doc.caseId && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700 bg-blue-50">
                          共通
                        </Badge>
                      )}
                      {doc.isLocked === 1 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50">
                          <Lock className="h-2.5 w-2.5 mr-0.5" />
                          制限付き
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {doc.storeName && (
                        <button
                          className="text-primary hover:underline flex items-center gap-0.5"
                          onClick={() => navigate(`/cases/${doc.caseId}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {doc.storeName}
                        </button>
                      )}
                      {doc.requestNumber && <span>#{doc.requestNumber}</span>}
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString("ja-JP")}</span>
                      {doc.memo && <span className="truncate max-w-[200px]">📝 {doc.memo}</span>}
                    </div>
                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {tags.map((t, i) => (
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
                      onClick={() => toggleLockMutation.mutate({ id: doc.id, isLocked: doc.isLocked === 1 ? 0 : 1 })}
                      title={doc.isLocked === 1 ? "ロック解除" : "ロックする（アクセス制限）"}
                    >
                      {doc.isLocked === 1 ? <Lock className="h-3.5 w-3.5 text-amber-600" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
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
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            前へ
          </Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            次へ
          </Button>
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        cases={casesData ?? []}
        onUpload={(data) => uploadMutation.mutate(data)}
        isUploading={uploadMutation.isPending}
        defaultScope={scope}
      />
    </div>
  );
}

// ─── Upload Dialog Component ─────────────────────────────

function UploadDialog({
  open,
  onOpenChange,
  cases,
  onUpload,
  isUploading,
  defaultScope,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cases: Array<{ id: number; storeName: string; requestNumber: string }>;
  onUpload: (data: { caseId?: number | null; fileName: string; fileData: string; mimeType?: string; fileSize?: number; category: any; memo?: string; tags?: string }) => void;
  isUploading: boolean;
  defaultScope: "all" | "case" | "shared";
}) {
  const [uploadType, setUploadType] = useState<"case" | "shared">(defaultScope === "shared" ? "shared" : "case");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("その他");
  const [memo, setMemo] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      setFiles(Array.from(fileList));
      if (fileList.length > 0) {
        const f = fileList[0];
        setSelectedCategory(detectCategory(f.name, f.type));
      }
    }
  };

  const handleUpload = async () => {
    if (uploadType === "case" && !selectedCaseId) {
      toast.error("案件を選択してください");
      return;
    }
    if (files.length === 0) {
      toast.error("ファイルを選択してください");
      return;
    }
    // Parse tags
    const tags = tagsInput.trim()
      ? JSON.stringify(tagsInput.split(/[,、\s]+/).filter(Boolean))
      : undefined;

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      onUpload({
        caseId: uploadType === "shared" ? null : Number(selectedCaseId),
        fileName: file.name,
        fileData: base64,
        mimeType: file.type || undefined,
        fileSize: file.size,
        category: selectedCategory as any,
        memo: memo || undefined,
        tags,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            資料DB庫にアップロード
          </DialogTitle>
          <DialogDescription>
            案件に紐づく資料、または共通資料として登録できます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Upload type toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">種別</Label>
            <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="case">
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  案件紐づき
                </TabsTrigger>
                <TabsTrigger value="shared">
                  <Globe className="h-3.5 w-3.5 mr-1" />
                  共通資料
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Case selection (only for case-linked) */}
          {uploadType === "case" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">案件 *</Label>
              <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="案件を選択..." />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.storeName} ({c.requestNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Shared info */}
          {uploadType === "shared" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <Globe className="h-3.5 w-3.5 inline mr-1" />
              共通資料は全案件から参照可能です。担当者一覧・仕様書・施工対象店舗一覧などを登録してください。
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">カテゴリ</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">タグ（カンマ区切り）</Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="例: LED化, 厨房, 2026年度"
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">
              タグを付けると案件詳細から関連資料として自動表示されます
            </p>
          </div>

          {/* File input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">ファイル *</Label>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              {files.length > 0 ? (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <p key={i} className="text-sm font-medium">{f.name} ({formatFileSize(f.size)})</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">クリックしてファイルを選択</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv"
              onChange={handleFileChange}
            />
          </div>

          {/* Memo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">メモ（任意）</Label>
            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="補足情報があれば入力..."
              className="h-9"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={isUploading || (uploadType === "case" && !selectedCaseId) || files.length === 0}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            アップロード
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
