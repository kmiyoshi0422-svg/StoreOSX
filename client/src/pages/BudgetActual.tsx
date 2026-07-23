import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { calcBudget, BUDGET_RATIO } from "@shared/budget";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
  Pencil,
  Save,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import type { InferSelectModel } from "drizzle-orm";
import { cases as casesTable } from "../../../drizzle/schema";
type BudgetCase = Pick<InferSelectModel<typeof casesTable>, "id" | "requestNumber" | "storeName" | "brand" | "status" | "progressStage" | "urgency" | "estimatedCost" | "plenusQuoteAmount" | "estimatedMaterialCost" | "estimatedLaborCost" | "actualCost" | "actualMaterialCost" | "actualLaborCost" | "managementFee" | "siteExpense" | "ownSurveyCost" | "partnerSurveyCost" | "transportCost" | "laborCost" | "is10mYen" | "categoryLarge" | "requestDate" | "constructionDate" | "completedAt" | "createdAt" | "invoiceNumber">;

function fmtYen(n: number | null | undefined): string {
  if (n == null) return "—";
  return `¥${n.toLocaleString()}`;
}

const STATUS_COLORS: Record<string, string> = {
  受付: "bg-slate-100 text-slate-700 border-slate-200",
  現調中: "bg-amber-50 text-amber-700 border-amber-200",
  見積中: "bg-blue-50 text-blue-700 border-blue-200",
  施工待ち: "bg-purple-50 text-purple-700 border-purple-200",
  施工中: "bg-orange-50 text-orange-700 border-orange-200",
  完了: "bg-emerald-50 text-emerald-700 border-emerald-200",
  クローズ: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export default function BudgetActual() {
  const [, setLocation] = useLocation();
  const { data: cases = [], isLoading } = trpc.cases.listForBudget.useQuery();
  const { data: summary } = trpc.cases.summary.useQuery();
  const utils = trpc.useUtils();
  const [editTarget, setEditTarget] = useState<BudgetCase | null>(null);

  const updateMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("予実を更新しました");
      utils.cases.listForBudget.invalidate();
      utils.cases.summary.invalidate();
      setEditTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const totalEst = summary?.totalEstimated ?? 0;
    const totalBudget = summary?.totalBudget ?? calcBudget(totalEst);
    const totalAct = summary?.totalActual ?? 0;
    const diff = totalAct - totalBudget;
    const rate = totalBudget > 0 ? (totalAct / totalBudget) * 100 : 0;
    return { totalEst, totalBudget, totalAct, diff, rate };
  }, [summary]);

  const completedCases = useMemo(
    () => cases.filter((c) => c.status === "完了" || c.actualCost != null),
    [cases]
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Budget & Actual
        </p>
        <div className="flex items-center gap-2">
          <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">予実管理</h1>
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">管理者限定</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          予算は見積金額×{Math.round(BUDGET_RATIO * 100)}%で自動計算されます。予算と実績の差分を案件ごとに管理します。
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <SummaryCard
          icon={<Wallet className="h-4 w-4" />}
          label="見積合計"
          value={fmtYen(totals.totalEst)}
          accent="navy"
        />
        <SummaryCard
          icon={<Wallet className="h-4 w-4" />}
          label={`予算 見積×${Math.round(BUDGET_RATIO * 100)}%`}
          value={fmtYen(totals.totalBudget)}
          accent="navy"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="実績合計"
          value={fmtYen(totals.totalAct)}
          accent="emerald"
        />
        <SummaryCard
          icon={
            totals.diff > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : totals.diff < 0 ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )
          }
          label="差分 実績 − 予算"
          value={`${totals.diff >= 0 ? "+" : ""}${fmtYen(totals.diff)}`}
          accent={totals.diff > 0 ? "red" : totals.diff < 0 ? "emerald" : "gray"}
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="予算消化率"
          value={`${totals.rate.toFixed(1)}%`}
          accent="gold"
        />
      </div>

      {/* 案件別予実テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif-jp text-lg">案件別 予実一覧</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              読み込み中...
            </div>
          ) : cases.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              案件がありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-y">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">依頼番号</th>
                    <th className="px-3 py-2.5 text-left font-medium">店舗</th>
                    <th className="px-3 py-2.5 text-left font-medium">状態</th>
                    <th className="px-3 py-2.5 text-right font-medium">見積</th>
                    <th className="px-3 py-2.5 text-right font-medium">予算<span className="text-[9px] block text-muted-foreground font-normal">見積×{Math.round(BUDGET_RATIO * 100)}%</span></th>
                    <th className="px-3 py-2.5 text-right font-medium">実績</th>
                    <th className="px-3 py-2.5 text-right font-medium">予算差</th>
                    <th className="px-3 py-2.5 text-right font-medium">消化率</th>
                    <th className="px-3 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => {
                    const budget = calcBudget(c.estimatedCost);
                    const diff =
                      c.actualCost != null && budget > 0
                        ? c.actualCost - budget
                        : null;
                    const rate =
                      c.actualCost != null && budget > 0
                        ? (c.actualCost / budget) * 100
                        : null;
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                      >
                        <td
                          className="px-3 py-2 font-mono text-[11px] cursor-pointer text-primary hover:underline"
                          onClick={() => setLocation(`/cases/${c.id}`)}
                        >
                          {c.requestNumber}
                        </td>
                        <td className="px-3 py-2">{c.storeName}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${STATUS_COLORS[c.status]}`}
                          >
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">{fmtYen(c.estimatedCost)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{budget > 0 ? fmtYen(budget) : "—"}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {fmtYen(c.actualCost)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right ${
                            diff == null
                              ? "text-muted-foreground"
                              : diff > 0
                                ? "text-red-600"
                                : diff < 0
                                  ? "text-emerald-600"
                                  : ""
                          }`}
                        >
                          {diff == null
                            ? "—"
                            : `${diff > 0 ? "+" : ""}${fmtYen(diff)}`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {rate == null ? "—" : `${rate.toFixed(1)}%`}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditTarget(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditDialog
        caseData={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={(data) => {
          if (!editTarget) return;
          updateMutation.mutate({ id: editTarget.id, data });
        }}
        saving={updateMutation.isPending}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "navy" | "emerald" | "red" | "gold" | "gray";
}) {
  const accents: Record<string, string> = {
    navy: "border-l-4 border-l-[#1a2238]",
    emerald: "border-l-4 border-l-emerald-600",
    red: "border-l-4 border-l-red-600",
    gold: "border-l-4 border-l-amber-500",
    gray: "border-l-4 border-l-slate-300",
  };
  return (
    <Card className={accents[accent]}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
          {icon}
          {label}
        </div>
        <p className="font-serif-jp text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function EditDialog({
  caseData,
  onClose,
  onSave,
  saving,
}: {
  caseData: BudgetCase | null;
  onClose: () => void;
  onSave: (data: {
    estimatedCost: number | null;
    estimatedMaterialCost: number | null;
    estimatedLaborCost: number | null;
    actualCost: number | null;
    actualMaterialCost: number | null;
    actualLaborCost: number | null;
    invoiceNumber: string | null;
  }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    estimatedCost: 0,
    estimatedMaterialCost: 0,
    estimatedLaborCost: 0,
    actualCost: 0,
    actualMaterialCost: 0,
    actualLaborCost: 0,
    invoiceNumber: "",
  });

  // caseDataが変わったら初期化（レンダー中setStateを避けるためuseEffectを使用）
  useEffect(() => {
    if (caseData) {
      setForm({
        estimatedCost: caseData.estimatedCost ?? 0,
        estimatedMaterialCost: caseData.estimatedMaterialCost ?? 0,
        estimatedLaborCost: caseData.estimatedLaborCost ?? 0,
        actualCost: caseData.actualCost ?? 0,
        actualMaterialCost: caseData.actualMaterialCost ?? 0,
        actualLaborCost: caseData.actualLaborCost ?? 0,
        invoiceNumber: caseData.invoiceNumber ?? "",
      });
    }
  }, [caseData?.id]);

  if (!caseData) return null;

  const estTotal = form.estimatedMaterialCost + form.estimatedLaborCost;
  const actTotal = form.actualMaterialCost + form.actualLaborCost;

  return (
    <Dialog open={!!caseData} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif-jp">予実編集</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {caseData.requestNumber} / {caseData.storeName}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-2">
          {/* 見積 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold border-l-2 border-l-[#1a2238] pl-2">
              見積・予算
            </p>
            <Field
              label="材料費"
              value={form.estimatedMaterialCost}
              onChange={(v) => setForm((p) => ({ ...p, estimatedMaterialCost: v }))}
            />
            <Field
              label="作業費"
              value={form.estimatedLaborCost}
              onChange={(v) => setForm((p) => ({ ...p, estimatedLaborCost: v }))}
            />
            <Field
              label="合計"
              value={form.estimatedCost || estTotal}
              onChange={(v) => setForm((p) => ({ ...p, estimatedCost: v }))}
              hint={estTotal > 0 ? `材料費+作業費: ¥${estTotal.toLocaleString()}` : undefined}
            />
          </div>

          {/* 実績 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold border-l-2 border-l-emerald-600 pl-2">
              実績
            </p>
            <Field
              label="材料費"
              value={form.actualMaterialCost}
              onChange={(v) => setForm((p) => ({ ...p, actualMaterialCost: v }))}
            />
            <Field
              label="作業費"
              value={form.actualLaborCost}
              onChange={(v) => setForm((p) => ({ ...p, actualLaborCost: v }))}
            />
            <Field
              label="合計"
              value={form.actualCost || actTotal}
              onChange={(v) => setForm((p) => ({ ...p, actualCost: v }))}
              hint={actTotal > 0 ? `材料費+作業費: ¥${actTotal.toLocaleString()}` : undefined}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">請求書番号</Label>
          <Input
            className="mt-1"
            value={form.invoiceNumber}
            onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={() =>
              onSave({
                estimatedCost: form.estimatedCost || estTotal || null,
                estimatedMaterialCost: form.estimatedMaterialCost || null,
                estimatedLaborCost: form.estimatedLaborCost || null,
                actualCost: form.actualCost || actTotal || null,
                actualMaterialCost: form.actualMaterialCost || null,
                actualLaborCost: form.actualLaborCost || null,
                invoiceNumber: form.invoiceNumber || null,
              })
            }
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        className="mt-1"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        placeholder="0"
      />
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
