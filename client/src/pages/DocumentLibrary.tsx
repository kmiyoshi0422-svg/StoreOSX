import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
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
import {
  Loader2, FileText, Search, Eye, Library, ExternalLink, Upload, Lock, Unlock,
  Plus, Tag, Globe, FolderOpen, History, X, ChevronDown, ChevronRight, Download,
  Cloud, CloudOff, RefreshCw, Settings2, CircleCheck, TriangleAlert,
} from "lucide-react";
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

type ViewMode = "documents" | "folders";

export default function DocumentLibrary() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [scope, setScope] = useState<"all" | "case" | "shared">("all");
  const [page, setPage] = useState(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("documents");
  const [selectedDocForHistory, setSelectedDocForHistory] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showZapierDialog, setShowZapierDialog] = useState(false);
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
  const { data: foldersData, isLoading: foldersLoading } = trpc.projectFolders.list.useQuery();
  const { data: zapierConfig } = trpc.documents.zapierConfig.useQuery();
  const { data: searchResults, isLoading: searchLoading } = trpc.documentSearch.search.useQuery(
    { query: searchQuery, scope: scope === "all" ? undefined : scope },
    { enabled: isSearching && searchQuery.length > 0 }
  );
  const utils = trpc.useUtils();
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: (result) => {
      utils.documents.listAll.invalidate();
      setShowUploadDialog(false);
      if (result.zapierSyncStatus === "sent") {
        toast.success("アップロードし、Zapierへクラウド保存を依頼しました");
      } else if (result.zapierSyncStatus === "skipped") {
        toast.warning("アップロード完了。Zapier設定後に再送してください");
      } else {
        toast.warning("アップロード完了。Zapier連携は再送できます");
      }
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

  const retryZapierMutation = trpc.documents.retryZapierSync.useMutation({
    onSuccess: (result) => {
      utils.documents.listAll.invalidate();
      if (result.status === "sent") toast.success("Zapierへ再送しました");
      else toast.error(result.error || "Zapierへの再送に失敗しました");
    },
    onError: (error) => toast.error(error.message || "Zapierへの再送に失敗しました"),
  });

  const handleSearchSubmit = () => {
    if (search.trim()) {
      setSearchQuery(search.trim());
      setIsSearching(true);
    }
  };

  const clearSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
  };

  const displayItems = isSearching ? (searchResults || []) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">資料DB庫</h1>
          <span className="text-sm text-muted-foreground ml-2">{isSearching ? `${displayItems.length}件` : `${total}件`}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowFolderDialog(true)}>
            <FolderOpen className="h-4 w-4 mr-1" />
            フォルダ管理
          </Button>
          {user && ["admin", "owner"].includes(user.role) && (
            <Button size="sm" variant="outline" onClick={() => setShowZapierDialog(true)}>
              <Settings2 className="h-4 w-4 mr-1" />
              Zapier設定
            </Button>
          )}
          <Button size="sm" onClick={() => setShowUploadDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            アップロード
          </Button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="documents">
            <FileText className="h-3.5 w-3.5 mr-1" />
            ドキュメント
          </TabsTrigger>
          <TabsTrigger value="folders">
            <FolderOpen className="h-3.5 w-3.5 mr-1" />
            プロジェクト
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${zapierConfig?.configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {zapierConfig?.configured ? <Cloud className="h-4 w-4 mt-0.5" /> : <CloudOff className="h-4 w-4 mt-0.5" />}
        <div>
          <p className="font-medium">{zapierConfig?.configured ? "Zapierクラウド連携は有効です" : "Zapierクラウド連携は未設定です"}</p>
          <p className="text-xs mt-0.5 opacity-80">
            StoreOSXのクラウドストレージと資料DBへの保存は常に行い、設定済みの場合はGoogle Drive保存とZapier Tables台帳記録も開始します。
          </p>
        </div>
      </div>

      {viewMode === "documents" ? (
        <>
          {/* Scope Tabs */}
          <Tabs value={scope} onValueChange={(v) => { setScope(v as any); setPage(0); clearSearch(); }}>
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
                placeholder="全文検索（ファイル名・メモ・タグ）..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); if (!e.target.value) clearSearch(); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearchSubmit(); }}
                className="pl-9 h-9 pr-20"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isSearching && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={clearSearch}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="secondary" className="h-6 px-2 text-xs" onClick={handleSearchSubmit}>
                  検索
                </Button>
              </div>
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

          {/* Search mode indicator */}
          {isSearching && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-sm text-amber-800 flex items-center justify-between">
              <span>
                <Search className="h-3.5 w-3.5 inline mr-1.5" />
                「<strong>{searchQuery}</strong>」の検索結果: {searchLoading ? "検索中..." : `${displayItems.length}件`}
              </span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearSearch}>
                クリア
              </Button>
            </div>
          )}

          {/* Info banner for shared scope */}
          {scope === "shared" && !isSearching && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <Globe className="h-4 w-4 inline mr-1.5" />
              <strong>共通資料</strong>は案件に紐づかず、全案件から参照できる資料です。担当者一覧、仕様書、施工対象店舗一覧などを登録できます。
            </div>
          )}

          {/* Results */}
          {(isLoading || searchLoading) ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Library className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>{isSearching ? "検索結果が見つかりません" : "ドキュメントが見つかりません"}</p>
                <p className="text-xs mt-1">上の「アップロード」ボタンから直接追加できます</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {displayItems.map((doc: any) => {
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
                          {doc.zapierSyncStatus === "completed" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-400 text-emerald-700 bg-emerald-50">
                              <CircleCheck className="h-2.5 w-2.5 mr-0.5" />
                              Drive保存済
                            </Badge>
                          )}
                          {doc.zapierSyncStatus === "sent" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700 bg-blue-50">
                              <Cloud className="h-2.5 w-2.5 mr-0.5" />
                              Zapier処理中
                            </Badge>
                          )}
                          {["failed", "skipped"].includes(doc.zapierSyncStatus) && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50" title={doc.zapierSyncError || undefined}>
                              <TriangleAlert className="h-2.5 w-2.5 mr-0.5" />
                              連携待ち
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
                        {doc.googleDriveUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => window.open(doc.googleDriveUrl, "_blank", "noopener,noreferrer")}
                            title="Google Driveで開く"
                          >
                            <Cloud className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        )}
                        {doc.zapierSyncStatus !== "completed" && zapierConfig?.configured && user?.role !== "partner" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            disabled={retryZapierMutation.isPending && retryZapierMutation.variables?.documentId === doc.id}
                            onClick={() => retryZapierMutation.mutate({ documentId: doc.id })}
                            title="Zapierへ再送"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${retryZapierMutation.isPending && retryZapierMutation.variables?.documentId === doc.id ? "animate-spin" : ""}`} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setSelectedDocForHistory(doc.id)}
                          title="バージョン履歴"
                        >
                          <History className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => toggleLockMutation.mutate({ id: doc.id, isLocked: doc.isLocked === 1 ? 0 : 1 })}
                          title={doc.isLocked === 1 ? "ロック解除" : "ロックする"}
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

          {/* Pagination (only in non-search mode) */}
          {!isSearching && totalPages > 1 && (
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
        </>
      ) : (
        /* Project Folders View */
        <ProjectFoldersView folders={foldersData || []} isLoading={foldersLoading} />
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

      {/* Folder Management Dialog */}
      <FolderManagementDialog
        open={showFolderDialog}
        onOpenChange={setShowFolderDialog}
      />

      <ZapierSettingsDialog
        open={showZapierDialog}
        onOpenChange={setShowZapierDialog}
        configured={Boolean(zapierConfig?.configured)}
        tableId={zapierConfig?.tableId || ""}
      />

      {/* Version History Dialog */}
      {selectedDocForHistory !== null && (
        <VersionHistoryDialog
          documentId={selectedDocForHistory}
          open={true}
          onOpenChange={(v) => { if (!v) setSelectedDocForHistory(null); }}
        />
      )}
    </div>
  );
}

// ─── Project Folders View ─────────────────────────────
function ProjectFoldersView({ folders, isLoading }: { folders: any[]; isLoading: boolean }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: folderDetail } = trpc.projectFolders.get.useQuery(
    { id: expandedId! },
    { enabled: expandedId !== null }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>プロジェクトフォルダがありません</p>
          <p className="text-xs mt-1">「フォルダ管理」から新しいフォルダを作成できます</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {folders.map((folder: any) => (
        <Card key={folder.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="p-0">
            <button
              className="w-full p-3 flex items-center gap-3 text-left"
              onClick={() => setExpandedId(expandedId === folder.id ? null : folder.id)}
            >
              {expandedId === folder.id ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <FolderOpen className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{folder.name}</p>
                {folder.description && (
                  <p className="text-xs text-muted-foreground truncate">{folder.description}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(folder.createdAt).toLocaleDateString("ja-JP")}
              </span>
            </button>

            {expandedId === folder.id && folderDetail && (
              <div className="border-t px-3 pb-3 pt-2 space-y-3">
                {/* Linked Cases */}
                {folderDetail.cases.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">紐づき案件 ({folderDetail.cases.length}件)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {folderDetail.cases.map((c: any) => (
                        <Badge key={c.id} variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                          {c.storeName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {/* Linked Documents */}
                {folderDetail.documents.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">共通資料 ({folderDetail.documents.length}件)</p>
                    <div className="space-y-1">
                      {folderDetail.documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 truncate">{doc.fileName}</span>
                          <Badge className={`text-[9px] px-1 py-0 ${getCategoryColor(doc.category)}`}>
                            {doc.category}
                          </Badge>
                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => window.open(doc.fileUrl, "_blank")}>
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {folderDetail.cases.length === 0 && folderDetail.documents.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    まだ案件や資料が紐づけられていません。「フォルダ管理」から追加できます。
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Version History Dialog ─────────────────────────────
function VersionHistoryDialog({ documentId, open, onOpenChange }: { documentId: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: versions, isLoading } = trpc.documentVersions.list.useQuery({ documentId }, { enabled: open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            バージョン履歴
          </DialogTitle>
          <DialogDescription>
            このドキュメントの過去のバージョンを確認・ダウンロードできます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !versions || versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>バージョン履歴はまだありません</p>
              <p className="text-xs mt-1">ファイルを更新すると旧版が自動保存されます</p>
            </div>
          ) : (
            versions.map((v: any) => (
              <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/30">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">v{v.version}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString("ja-JP")}
                  </p>
                  {v.fileSize && (
                    <p className="text-[10px] text-muted-foreground">{formatFileSize(v.fileSize)}</p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => window.open(v.fileUrl, "_blank")}>
                  <Download className="h-3 w-3 mr-1" />
                  DL
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Folder Management Dialog ─────────────────────────────
function FolderManagementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [addCaseId, setAddCaseId] = useState("");
  const [addDocId, setAddDocId] = useState("");

  const { data: folders } = trpc.projectFolders.list.useQuery(undefined, { enabled: open });
  const { data: casesData } = trpc.cases.listSummary.useQuery(undefined, { enabled: open });
  const { data: docsData } = trpc.documents.listAll.useQuery({ scope: "shared", limit: 100 }, { enabled: open });
  const utils = trpc.useUtils();

  const createMutation = trpc.projectFolders.create.useMutation({
    onSuccess: () => {
      utils.projectFolders.list.invalidate();
      setNewName("");
      setNewDesc("");
      toast.success("フォルダを作成しました");
    },
  });

  const deleteMutation = trpc.projectFolders.delete.useMutation({
    onSuccess: () => {
      utils.projectFolders.list.invalidate();
      setSelectedFolderId(null);
      toast.success("フォルダを削除しました");
    },
  });

  const addCaseMutation = trpc.projectFolders.addCase.useMutation({
    onSuccess: () => {
      utils.projectFolders.list.invalidate();
      utils.projectFolders.get.invalidate();
      setAddCaseId("");
      toast.success("案件を追加しました");
    },
  });

  const addDocMutation = trpc.projectFolders.addDocument.useMutation({
    onSuccess: () => {
      utils.projectFolders.list.invalidate();
      utils.projectFolders.get.invalidate();
      setAddDocId("");
      toast.success("資料を追加しました");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            プロジェクトフォルダ管理
          </DialogTitle>
          <DialogDescription>
            案件グループを作成し、共通資料を紐づけて管理します。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Create new folder */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium">新規フォルダ作成</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="フォルダ名（例: 厨房LED化）"
              className="h-8 text-sm"
            />
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="説明（任意）"
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              className="w-full"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newName.trim(), description: newDesc.trim() || null })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              作成
            </Button>
          </div>

          {/* Existing folders */}
          {folders && folders.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">既存フォルダ</p>
              {folders.map((f: any) => (
                <div key={f.id} className={`border rounded-lg p-3 space-y-2 ${selectedFolderId === f.id ? "border-primary" : ""}`}>
                  <div className="flex items-center justify-between">
                    <button className="flex items-center gap-2 text-left" onClick={() => setSelectedFolderId(selectedFolderId === f.id ? null : f.id)}>
                      <FolderOpen className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">{f.name}</span>
                    </button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteMutation.mutate({ id: f.id })}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {selectedFolderId === f.id && (
                    <div className="space-y-2 pt-2 border-t">
                      {/* Add case */}
                      <div className="flex items-center gap-2">
                        <Select value={addCaseId} onValueChange={setAddCaseId}>
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue placeholder="案件を追加..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[150px]">
                            {(casesData || []).map((c: any) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.storeName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-7 px-2 text-xs" disabled={!addCaseId} onClick={() => addCaseMutation.mutate({ folderId: f.id, caseId: Number(addCaseId) })}>
                          追加
                        </Button>
                      </div>
                      {/* Add document */}
                      <div className="flex items-center gap-2">
                        <Select value={addDocId} onValueChange={setAddDocId}>
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue placeholder="共通資料を追加..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[150px]">
                            {(docsData?.items || []).map((d: any) => (
                              <SelectItem key={d.id} value={String(d.id)}>{d.fileName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-7 px-2 text-xs" disabled={!addDocId} onClick={() => addDocMutation.mutate({ folderId: f.id, documentId: Number(addDocId) })}>
                          追加
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Zapier Settings Dialog ─────────────────────────────
function ZapierSettingsDialog({
  open,
  onOpenChange,
  configured,
  tableId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configured: boolean;
  tableId: string;
}) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const utils = trpc.useUtils();
  const saveMutation = trpc.documents.saveZapierConfig.useMutation({
    onSuccess: (result) => {
      utils.documents.zapierConfig.invalidate();
      setWebhookUrl("");
      onOpenChange(false);
      toast.success(result.configured ? "Zapier Catch Hookを保存しました" : "Zapier連携を解除しました");
    },
    onError: (error) => toast.error(error.message || "Zapier設定の保存に失敗しました"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Zapierクラウド連携
          </DialogTitle>
          <DialogDescription>
            Webhooks by Zapier の Catch Hook URLを保存すると、資料アップロード後にGoogle Drive保存とZapier Tables台帳記録を開始します。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className={`rounded-lg border p-3 text-sm ${configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            現在の状態: <strong>{configured ? "設定済み" : "未設定"}</strong>
          </div>
          <div className="space-y-1.5">
            <Label>Catch Hook URL</Label>
            <Input
              type="url"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
            />
            <p className="text-xs text-muted-foreground">URLは画面へ再表示しません。変更時は新しいURLを入力してください。</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Zapier Tables ID: <code className="font-mono">{tableId}</code>
          </div>
          <div className="flex justify-end gap-2">
            {configured && (
              <Button variant="outline" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ webhookUrl: "" })}>
                連携解除
              </Button>
            )}
            <Button disabled={!webhookUrl.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate({ webhookUrl: webhookUrl.trim() })}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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

          {uploadType === "shared" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <Globe className="h-3.5 w-3.5 inline mr-1" />
              共通資料は全案件から参照可能です。担当者一覧・仕様書・施工対象店舗一覧などを登録してください。
            </div>
          )}

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

          <div className="space-y-1.5">
            <Label htmlFor="document-upload-files" className="text-xs font-medium">ファイル *</Label>
            <label
              htmlFor="document-upload-files"
              className="block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
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
              <input
                id="document-upload-files"
                ref={fileInputRef}
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.gif,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv"
                onChange={handleFileChange}
              />
            </label>
          </div>

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
