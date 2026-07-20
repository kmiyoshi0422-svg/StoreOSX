import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Search, Eye, Library, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

const CATEGORIES = ["図面", "仕様書", "見積書", "報告書", "写真", "その他"] as const;

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

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentLibrary() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [page, setPage] = useState(0);
  const limit = 30;

  const queryInput = useMemo(() => ({
    search: search || undefined,
    category: category === "all" ? undefined : category,
    limit,
    offset: page * limit,
  }), [search, category, page]);

  const { data, isLoading } = trpc.documents.listAll.useQuery(queryInput);
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Library className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">資料DB庫</h1>
        <span className="text-sm text-muted-foreground ml-2">{total}件</span>
      </div>

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
          <SelectTrigger className="w-[140px] h-9">
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
            <p className="text-xs mt-1">案件詳細の「図面・資料」タブからアップロードしてください</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((doc) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-shrink-0">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-medium truncate">{doc.fileName}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${getCategoryColor(doc.category)}`}>
                      {doc.category}
                    </Badge>
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
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            前へ
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            次へ
          </Button>
        </div>
      )}
    </div>
  );
}
