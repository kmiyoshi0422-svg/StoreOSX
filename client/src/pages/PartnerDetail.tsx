import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowLeft,
  Briefcase,
  Phone,
  Smartphone,
  Mail,
  MapPin,
  Wallet,
  TrendingUp,
  CheckCircle2,
  ListChecks,
  Loader2,
} from "lucide-react";

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
  S: "bg-red-50 text-red-700 border-red-200",
  A: "bg-orange-50 text-orange-700 border-orange-200",
  B: "bg-amber-50 text-amber-700 border-amber-200",
  C: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function fmtYen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.replace(/[^\d+]/g, "");
  return trimmed.length > 0 ? `tel:${trimmed}` : null;
}

export default function PartnerDetail({ id }: { id: number }) {
  const { data, isLoading } = trpc.partners.history.useQuery({ partnerId: id });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !data.partner) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        協力会社が見つかりませんでした。
        <div className="mt-4">
          <Link href="/partners">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              協力会社一覧に戻る
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { partner, cases, summary } = data;
  const variance = summary.totalActual - summary.totalEstimated;
  const repTel = telHref(partner.phone);
  const picTel = telHref(partner.picPhone);

  return (
    <div className="container py-6 space-y-6 max-w-6xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/partners">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            一覧へ戻る
          </Button>
        </Link>
      </div>

      {/* 業者基本情報 */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  <Briefcase className="h-3 w-3 mr-1" />
                  {partner.category}
                </Badge>
                {!partner.isActive && (
                  <Badge variant="outline" className="text-xs">休止</Badge>
                )}
                {partner.area && (
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    {partner.area}
                  </Badge>
                )}
              </div>
              <h1 className="font-serif-jp text-2xl font-semibold">{partner.name}</h1>
              {partner.pic && (
                <p className="text-sm text-muted-foreground mt-1">担当：{partner.pic}</p>
              )}
              {partner.address && (
                <p className="text-xs text-muted-foreground mt-1">{partner.address}</p>
              )}
              {partner.notes && (
                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap bg-muted/30 rounded p-2 border">
                  {partner.notes}
                </p>
              )}
            </div>
            <div className="grid gap-2 min-w-[200px]">
              {repTel ? (
                <a href={repTel}>
                  <Button variant="outline" size="sm" className="w-full justify-start bg-background">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="font-mono text-xs">{partner.phone}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">代表</span>
                  </Button>
                </a>
              ) : null}
              {picTel ? (
                <a href={picTel}>
                  <Button variant="outline" size="sm" className="w-full justify-start bg-background">
                    <Smartphone className="h-3.5 w-3.5" />
                    <span className="font-mono text-xs">{partner.picPhone}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">担当者</span>
                  </Button>
                </a>
              ) : null}
              {partner.email ? (
                <a href={`mailto:${partner.email}`}>
                  <Button variant="outline" size="sm" className="w-full justify-start bg-background">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="font-mono text-xs truncate">{partner.email}</span>
                  </Button>
                </a>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 累計サマリー */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ListChecks className="h-3.5 w-3.5" /> 発注案件数
            </div>
            <div className="font-serif-jp text-2xl font-semibold">{summary.totalCases}</div>
            <div className="text-xs text-muted-foreground mt-1">件</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 完了
            </div>
            <div className="font-serif-jp text-2xl font-semibold">{summary.completedCases}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.totalCases > 0
                ? `${Math.round((summary.completedCases / summary.totalCases) * 100)}%`
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3.5 w-3.5" /> 見積累計
            </div>
            <div className="font-serif-jp text-xl font-semibold">{fmtYen(summary.totalEstimated)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> 実績累計
            </div>
            <div className="font-serif-jp text-xl font-semibold">{fmtYen(summary.totalActual)}</div>
            <div
              className={`text-xs mt-1 ${
                variance > 0 ? "text-red-600" : variance < 0 ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              差分 {variance >= 0 ? "+" : ""}
              {fmtYen(variance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ステータス別集計 */}
      {summary.totalCases > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3">ステータス別</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.statusCounts).map(([status, count]) => (
                <Badge key={status} variant="outline" className={STATUS_COLORS[status] ?? ""}>
                  {status}：{count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 案件履歴 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-serif-jp text-lg font-semibold mb-4">発注履歴</h2>
          {cases.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              この協力会社に紐付く案件はまだありません。
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">依頼番号</th>
                    <th className="px-2 py-2 font-medium">店舗</th>
                    <th className="px-2 py-2 font-medium">大項目</th>
                    <th className="px-2 py-2 font-medium">緊急度</th>
                    <th className="px-2 py-2 font-medium">ステータス</th>
                    <th className="px-2 py-2 font-medium text-right">見積</th>
                    <th className="px-2 py-2 font-medium text-right">実績</th>
                    <th className="px-2 py-2 font-medium">作成</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-2 py-2">
                        <Link href={`/cases/${c.id}`}>
                          <span className="font-mono text-xs hover:underline cursor-pointer">
                            {c.requestNumber}
                          </span>
                        </Link>
                      </td>
                      <td className="px-2 py-2 truncate max-w-[180px]">{c.storeName}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {c.categoryLarge ?? "—"}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className={`text-[10px] ${URGENCY_COLORS[c.urgency] ?? ""}`}>
                          {c.urgency}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[c.status] ?? ""}`}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs">
                        {c.estimatedCost ? fmtYen(c.estimatedCost) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs">
                        {c.actualCost ? fmtYen(c.actualCost) : "—"}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
