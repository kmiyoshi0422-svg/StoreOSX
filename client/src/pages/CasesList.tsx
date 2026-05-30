import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import { Plus, Search, MapPin, Phone, Calendar, FileText, ChevronRight } from "lucide-react";

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

const URGENCY_LABEL: Record<string, string> = {
  S: "緊急",
  A: "高",
  B: "中",
  C: "低",
};

export default function CasesList() {
  const [, setLocation] = useLocation();
  const { data: cases = [], isLoading } = trpc.cases.list.useQuery();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [urgency, setUrgency] = useState("all");

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (urgency !== "all" && c.urgency !== urgency) return false;
      if (q) {
        const keyword = q.toLowerCase();
        return (
          c.storeName.toLowerCase().includes(keyword) ||
          c.requestNumber.toLowerCase().includes(keyword) ||
          (c.address ?? "").toLowerCase().includes(keyword) ||
          (c.categoryLarge ?? "").toLowerCase().includes(keyword) ||
          (c.categoryMedium ?? "").toLowerCase().includes(keyword)
        );
      }
      return true;
    });
  }, [cases, q, status, urgency]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-border/60 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Cases</p>
          <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">案件一覧</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {filtered.length} / {cases.length} 件
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/cases/import")}
          >
            CSVインポート
          </Button>
          <Button onClick={() => setLocation("/cases/new")} className="shadow-sm">
            <Plus className="h-4 w-4" />
            新規案件
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="店舗名・依頼番号・住所で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-40">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="受付">受付</SelectItem>
            <SelectItem value="現調中">現調中</SelectItem>
            <SelectItem value="見積中">見積中</SelectItem>
            <SelectItem value="施工待ち">施工待ち</SelectItem>
            <SelectItem value="施工中">施工中</SelectItem>
            <SelectItem value="完了">完了</SelectItem>
            <SelectItem value="クローズ">クローズ</SelectItem>
          </SelectContent>
        </Select>
        <Select value={urgency} onValueChange={setUrgency}>
          <SelectTrigger className="md:w-32">
            <SelectValue placeholder="緊急度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全緊急度</SelectItem>
            <SelectItem value="S">S 緊急</SelectItem>
            <SelectItem value="A">A 高</SelectItem>
            <SelectItem value="B">B 中</SelectItem>
            <SelectItem value="C">C 低</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">該当する案件がありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="hover:shadow-md hover:border-primary/40 transition-all duration-200"
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Left: Badges + Title */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setLocation(`/cases/${c.id}`)}
                  >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded text-[10px] font-bold ${URGENCY_COLORS[c.urgency]}`}
                        >
                          {URGENCY_LABEL[c.urgency]}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_COLORS[c.status]}`}
                        >
                          {c.status}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {c.brand}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {c.requestNumber}
                        </span>
                      </div>
                    <h3 className="font-semibold text-base mb-1.5 truncate">
                      {c.storeName}
                    </h3>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {c.address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          <span className="text-muted-foreground/60">工事:</span>{" "}
                          {c.categoryLarge || "—"} / {c.categoryMedium || "—"}
                        </span>
                        {c.requesterName && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.requesterName}
                          </span>
                        )}
                        {c.requestDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(c.requestDate).toLocaleDateString("ja-JP")}
                          </span>
                        )}
                        {c.estimatedCost != null && (
                          <span className="font-mono">
                            見積: ¥{c.estimatedCost.toLocaleString()}
                          </span>
                        )}
                        {c.actualCost != null && (
                          <span className="font-mono text-emerald-700">
                            実績: ¥{c.actualCost.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Right: Actions */}
                  <div className="flex md:flex-col gap-2 shrink-0 md:items-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/cases/${c.id}/ledger`);
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      写真台帳
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLocation(`/cases/${c.id}`)}
                    >
                      詳細
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
