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

export default function ExpensesTab({ caseId }: { caseId: number }) {
  const utils = trpc.useUtils();
  const { data: expenses = [] } = trpc.expenses.listByCase.useQuery({ caseId });
  const { data: budgetStatus } = trpc.expenses.budgetStatus.useQuery({ caseId });
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const updateCaseMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      utils.expenses.budgetStatus.invalidate({ caseId });
      utils.cases.get.invalidate({ id: caseId });
      toast.success("予算を設定しました");
      setShowBudgetForm(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      utils.expenses.listByCase.invalidate({ caseId });
      utils.cases.get.invalidate({ id: caseId });
      toast.success("経費を削除しました");
    },
    onError: (e) => toast.error(e.message),
  });
  const addMutation = trpc.expenses.bulkSave.useMutation({
    onSuccess: () => {
      utils.expenses.listByCase.invalidate({ caseId });
      utils.cases.get.invalidate({ id: caseId });
      toast.success("原価を登録しました");
      setShowAddForm(false);
      setAddVendor(""); setAddAmount(""); setAddCategory("その他"); setAddDate(""); setAddNote("");
    },
    onError: (e) => toast.error(e.message),
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addVendor, setAddVendor] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addCategory, setAddCategory] = useState<string>("その他");
  const [addDate, setAddDate] = useState("");
  const [addNote, setAddNote] = useState("");
  const CATEGORIES = ["材料費", "外注費", "交通費", "消耗品", "車両費", "宿泊費", "接待交際費", "人件費", "現調費", "その他"];
  const handleAddExpense = () => {
    const amt = Number(addAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("金額を正しく入力してください"); return; }
    addMutation.mutate({
      items: [{
        caseId,
        vendorName: addVendor || null,
        amount: amt,
        expenseDate: addDate || null,
        category: addCategory as any,
        note: addNote || null,
      }],
    });
  };

  const yen = (n: number | null | undefined) =>
    n != null ? `¥${Math.round(n).toLocaleString()}` : "—";

  const total = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* 予算ステータス */}
      {budgetStatus && budgetStatus.budget !== null && (
        <div className={`rounded-lg border p-3 text-sm flex items-center justify-between ${budgetStatus.isOverBudget ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'border-green-300 bg-green-50 dark:bg-green-950/20'}`}>
          <div className="flex items-center gap-4">
            <span className="font-medium">予算: {yen(budgetStatus.budget)}</span>
            <span>実績: {yen(budgetStatus.totalExpense)}</span>
            <span className={budgetStatus.isOverBudget ? 'text-red-600 font-bold' : 'text-green-600'}>
              {budgetStatus.usagePercent}%消化
            </span>
          </div>
          <div className="flex items-center gap-2">
            {budgetStatus.isOverBudget && (
              <span className="text-red-600 font-bold text-xs">⚠️ 予算超過</span>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setBudgetInput(String(budgetStatus.budget ?? '')); setShowBudgetForm(true); }}>編集</Button>
          </div>
        </div>
      )}
      {/* 予算設定ボタン（未設定時） */}
      {budgetStatus && budgetStatus.budget === null && !showBudgetForm && (
        <Button variant="outline" size="sm" onClick={() => setShowBudgetForm(true)}>経費予算を設定</Button>
      )}
      {/* 予算設定フォーム */}
      {showBudgetForm && (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
          <span className="text-sm font-medium">予算上限:</span>
          <span className="text-sm">¥</span>
          <Input
            type="number"
            placeholder="例: 500000"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            className="w-40"
          />
          <Button size="sm" onClick={() => {
            const val = Number(budgetInput);
            if (!Number.isFinite(val) || val < 0) { toast.error("正しい金額を入力してください"); return; }
            updateCaseMutation.mutate({ id: caseId, data: { expenseBudget: val || null } });
          }} disabled={updateCaseMutation.isPending}>保存</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowBudgetForm(false)}>キャンセル</Button>
        </div>
      )}

      {/* 原価手入力フォーム */}
      {showAddForm && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">原価を手入力</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">支払先・業者名</Label>
                <Input placeholder="例: 自社、○○建設" value={addVendor} onChange={(e) => setAddVendor(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">金額（税込）</Label>
                <Input type="number" placeholder="例: 15000" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">区分</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">日付</Label>
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">摘要・メモ</Label>
              <Input placeholder="例: 現場調査交通費、パートナー現調費" value={addNote} onChange={(e) => setAddNote(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>キャンセル</Button>
              <Button size="sm" onClick={handleAddExpense} disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                登録
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">経費一覧</h3>
              <Badge variant="outline">{expenses.length}件</Badge>
            </div>
            <div className="flex items-center gap-3">
              {!showAddForm && (
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />原価入力
                </Button>
              )}
              <div className="text-sm">
                合計:{" "}
                <span className="font-semibold tabular-nums text-base">
                  {yen(total)}
                </span>
              </div>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-md flex flex-col items-center gap-3">
              <Receipt className="h-9 w-9 text-muted-foreground/70" />
              <p className="font-medium">この案件の経費はまだありません</p>
              <p className="text-sm text-muted-foreground max-w-md">
                <a href="/expenses/import" className="text-primary underline underline-offset-4">
                  経費取込ページ
                </a>
                から領収書・請求書をアップロードすると、依頼番号や店舗名から自動でこの案件に振り分けられます。
              </p>
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/60 text-foreground/80">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">日付</th>
                    <th className="text-left px-3 py-2 font-medium">業者</th>
                    <th className="text-left px-3 py-2 font-medium">区分</th>
                    <th className="text-right px-3 py-2 font-medium">金額・税込</th>
                    <th className="text-left px-3 py-2 font-medium">摘要</th>
                    <th className="text-left px-3 py-2 font-medium">入力者</th>
                    <th className="text-left px-3 py-2 font-medium">入力日時</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 tabular-nums">
                        {e.expenseDate
                          ? new Date(e.expenseDate as any).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{e.vendorName ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{e.category}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {yen(e.amount)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[260px]">
                        {e.note ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {(e as any).createdByName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {e.createdAt
                          ? new Date(e.createdAt as any).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("この経費を削除しますか？")) {
                              deleteMutation.mutate({ id: e.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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


// ─── Schedule Tab (工程管理ガントチャート) ─────────────────────────────────────
