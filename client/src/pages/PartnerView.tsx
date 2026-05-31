import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  MapPin,
  Phone,
  Clock,
  FileText,
  Receipt,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const URGENCY_COLORS: Record<string, string> = {
  S: "bg-red-600 text-white",
  A: "bg-orange-500 text-white",
  B: "bg-yellow-500 text-white",
  C: "bg-emerald-500 text-white",
};
const URGENCY_LABEL: Record<string, string> = { S: "緊急", A: "高", B: "中", C: "低" };

export default function PartnerView({ token }: { token: string }) {
  const { data, isLoading, error } = trpc.partnerView.getByToken.useQuery({ token });

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
          <p className="text-xs text-stone-300 mt-2">
            このページにはプレナス向け原価は表示されません。表示金額は 75% 価格です。
          </p>
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

        {/* Partner Amount */}
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-4 w-4 text-emerald-700" />
              <p className="text-[10px] uppercase tracking-wider text-emerald-800 font-medium">
                協力業者向け金額（プレナス見積の 75%）
              </p>
            </div>
            {data.totalPartnerAmount != null ? (
              <p className="font-serif-jp text-4xl md:text-5xl font-semibold text-emerald-900 tracking-tight">
                ¥{data.totalPartnerAmount.toLocaleString()}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                見積金額が確定次第こちらに表示されます。
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              ※ 表示金額は確定金額ではありません。最終金額は別途ご連絡いたします。
            </p>
          </CardContent>
        </Card>

        {/* Estimates List (per-file) */}
        {data.estimates.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">見積書ごとの金額（75%）</h3>
              </div>
              <div className="divide-y divide-border/60">
                {data.estimates.map((e) => (
                  <div key={e.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {e.fileName ?? "見積書"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.vendorName ? `${e.vendorName} · ` : ""}
                        {e.estimateDate
                          ? new Date(e.estimateDate).toLocaleDateString("ja-JP")
                          : new Date(e.createdAt).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <span className="font-serif-jp text-lg font-semibold">
                      ¥{e.partnerAmount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground py-4 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Store OSX · 協力業者ビュー
        </div>
      </main>
    </div>
  );
}
