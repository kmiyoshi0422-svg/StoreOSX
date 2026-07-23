import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  MapPin,
  Phone,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Download,
  FileImage,
  FileSpreadsheet,
  File,
} from "lucide-react";

const URGENCY_COLORS: Record<string, string> = {
  S: "bg-red-600 text-white",
  A: "bg-orange-500 text-white",
  B: "bg-yellow-500 text-white",
  C: "bg-emerald-500 text-white",
};
const URGENCY_LABEL: Record<string, string> = { S: "緊急", A: "高", B: "中", C: "低" };

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PartnerView({ token }: { token: string }) {
  const { data, isLoading, error } = trpc.partnerView.getByToken.useQuery({ token });
  const { data: documents, isLoading: docsLoading } = trpc.partnerView.getDocuments.useQuery({ token });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <Card className="max-w-md w-full border-amber-300">
          <CardContent className="py-12 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto" />
            <h1 className="text-lg font-semibold">このリンクは無効です</h1>
            <p className="text-sm text-muted-foreground">
              共有リンクが期限切れまたは取り消されている可能性があります。発行元にご確認ください。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-[#152841] text-white">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone-300 mb-2">
            Partner View · 協力業者向け
          </p>
          <h1 className="font-serif-jp text-2xl md:text-3xl font-semibold">
            修理依頼 共有ページ
          </h1>

        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        {/* Case Header */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded text-[10px] font-bold ${URGENCY_COLORS[data.urgency]}`}
              >
                {URGENCY_LABEL[data.urgency]}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {data.progressStage}
              </Badge>
              <span className="text-[11px] text-muted-foreground font-mono">
                依頼番号 {data.requestNumber}
              </span>
            </div>
            <h2 className="font-serif-jp text-xl font-semibold tracking-tight">
              {data.storeName}
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {data.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>{data.address}</span>
                </div>
              )}
              {data.storePhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{data.storePhone}</span>
                </div>
              )}
              {data.businessHours && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{data.businessHours}</span>
                </div>
              )}
            </div>
            {data.requestContent && (
              <div className="border-t border-border/60 pt-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  依頼内容
                </p>
                <p className="text-sm whitespace-pre-wrap">{data.requestContent}</p>
              </div>
            )}
            {(data.categoryLarge || data.categoryMedium || data.categorySmall) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {data.categoryLarge && (
                  <Badge variant="secondary">{data.categoryLarge}</Badge>
                )}
                {data.categoryMedium && (
                  <Badge variant="secondary">{data.categoryMedium}</Badge>
                )}
                {data.categorySmall && (
                  <Badge variant="secondary">{data.categorySmall}</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents Section */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-base">共有ドキュメント</h3>
            </div>

            {docsLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                読み込み中...
              </div>
            ) : !documents || documents.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                共有可能なドキュメントはありません
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex-shrink-0">
                      {getFileIcon(doc.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={doc.fileName}>
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        {doc.category && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {doc.category}
                          </Badge>
                        )}
                        {doc.fileSize && (
                          <span>{formatFileSize(doc.fileSize)}</span>
                        )}
                        {doc.createdAt && (
                          <span>{new Date(doc.createdAt).toLocaleDateString("ja-JP")}</span>
                        )}
                      </div>
                      {doc.memo && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">{doc.memo}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = doc.fileUrl;
                          link.download = doc.fileName;
                          link.target = "_blank";
                          link.click();
                        }}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        DL
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground py-4 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Store OSX · 協力業者ビュー
        </div>
      </main>
    </div>
  );
}
