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

export default function ProfitTab({ caseData, onUpdated, isPartner = false }: { caseData: Case; onUpdated: () => void; isPartner?: boolean }) {
  const { data: estimates = [] } = trpc.estimates.listByCase.useQuery({ caseId: caseData.id });
  const { data: expenses = [] } = trpc.expenses.listByCase.useQuery({ caseId: caseData.id });

  const yen = (n: number | null | undefined) =>
    n != null ? `¥${Math.round(n).toLocaleString()}` : "—";

  // 入力フォーム state（プレナス提出見積額＝売上／協力業者見積額＝原価）
  const [plenusInput, setPlenusInput] = useState<string>(
    caseData.plenusQuoteAmount != null ? String(caseData.plenusQuoteAmount) : ""
  );
  const [vendorInput, setVendorInput] = useState<string>(
    caseData.estimatedCost != null ? String(caseData.estimatedCost) : ""
  );
  // 管理費・現場経費入力
  const [mgmtFee, setMgmtFee] = useState<string>(caseData.managementFee != null ? String(caseData.managementFee) : "");
  const [siteExp, setSiteExp] = useState<string>(caseData.siteExpense != null ? String(caseData.siteExpense) : "");
  const [ownSurvey, setOwnSurvey] = useState<string>(caseData.ownSurveyCost != null ? String(caseData.ownSurveyCost) : "");
  const [partnerSurvey, setPartnerSurvey] = useState<string>(caseData.partnerSurveyCost != null ? String(caseData.partnerSurveyCost) : "");
  const [transport, setTransport] = useState<string>(caseData.transportCost != null ? String(caseData.transportCost) : "");
  const [labor, setLabor] = useState<string>(caseData.laborCost != null ? String(caseData.laborCost) : "");

  const saveMutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("金額を保存しました");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const plenus = plenusInput.trim() === "" ? null : Number(plenusInput);
    const vendor = vendorInput.trim() === "" ? null : Number(vendorInput);
    if (plenus != null && (!Number.isFinite(plenus) || plenus < 0)) {
      toast.error("プレナス提出額が不正です");
      return;
    }
    if (vendor != null && (!Number.isFinite(vendor) || vendor < 0)) {
      toast.error("協力業者額が不正です");
      return;
    }
    const toNum = (s: string) => s.trim() === "" ? null : Number(s);
    saveMutation.mutate({
      id: caseData.id,
      data: {
        plenusQuoteAmount: plenus,
        estimatedCost: vendor,
        is10mYen: (plenus ?? 0) >= 100000,
        managementFee: toNum(mgmtFee),
        siteExpense: toNum(siteExp),
        ownSurveyCost: toNum(ownSurvey),
        partnerSurveyCost: toNum(partnerSurvey),
        transportCost: toNum(transport),
        laborCost: toNum(labor),
      },
    });
  };

  // 見積一覧合計（協力業者見積の参考値）
  const estimatesTotal = estimates.reduce((s, e) => s + (e.totalAmount ?? 0), 0);
  // 経費合計（領収書取込分）
  const expensesTotal = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  // 売上 = プレナス提出見積額。未入力なら協力業者見積額からの想定（÷0.75）でフォールバック表示
  const vendorAmount = caseData.estimatedCost ?? null;
  const plenusAmount = caseData.plenusQuoteAmount ?? null;
  const sales =
    plenusAmount != null
      ? plenusAmount
      : vendorAmount != null && vendorAmount > 0
        ? Math.round(vendorAmount / 0.75)
        : 0;
  const salesIsEstimated = plenusAmount == null && sales > 0;

  // 管理費・現場経費の合計
  const overheadTotal = [mgmtFee, siteExp, ownSurvey, partnerSurvey, transport, labor]
    .reduce((sum, v) => sum + (v.trim() === "" ? 0 : Number(v) || 0), 0);

  // 原価 = 協力業者見積額 + 経費合計 + 管理費・現場経費
  const cost = (vendorAmount ?? 0) + expensesTotal + overheadTotal;
  const grossProfit = sales - cost;
  const grossMargin = sales > 0 ? grossProfit / sales : 0;

  const dirty =
    plenusInput !== (caseData.plenusQuoteAmount != null ? String(caseData.plenusQuoteAmount) : "") ||
    vendorInput !== (caseData.estimatedCost != null ? String(caseData.estimatedCost) : "") ||
    mgmtFee !== (caseData.managementFee != null ? String(caseData.managementFee) : "") ||
    siteExp !== (caseData.siteExpense != null ? String(caseData.siteExpense) : "") ||
    ownSurvey !== (caseData.ownSurveyCost != null ? String(caseData.ownSurveyCost) : "") ||
    partnerSurvey !== (caseData.partnerSurveyCost != null ? String(caseData.partnerSurveyCost) : "") ||
    transport !== (caseData.transportCost != null ? String(caseData.transportCost) : "") ||
    labor !== (caseData.laborCost != null ? String(caseData.laborCost) : "");

  return (
    <div className="space-y-4">
      {/* 金額入力カード */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">金額入力</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              依頼番号: {caseData.requestNumber}
            </span>
          </div>

          <div className={`grid ${isPartner ? 'grid-cols-1' : 'sm:grid-cols-2'} gap-4`}>
            {!isPartner && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">プレナスへ提出した見積金額・売上</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="pl-7 tabular-nums"
                  placeholder="例: 320000"
                  value={plenusInput}
                  onChange={(e) => setPlenusInput(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">プレナスへ請求・提出した金額。これが売上になります。</p>
            </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{isPartner ? '見積金額' : '協力業者の見積金額・原価'}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="pl-7 tabular-nums"
                  placeholder="例: 240000"
                  value={vendorInput}
                  onChange={(e) => setVendorInput(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                協力業者へ支払う金額。領収書取込分の経費と合わせて原価になります。
                {estimatesTotal > 0 && (
                  <>
                    {" "}見積書合計: <span className="font-medium">{yen(estimatesTotal)}</span>
                    {estimatesTotal !== (caseData.estimatedCost ?? estimatesTotal) && (
                      <button
                        type="button"
                        className="ml-1 text-primary underline"
                        onClick={() => setVendorInput(String(estimatesTotal))}
                      >
                        反映
                      </button>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* 管理費・現場経費入力 */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              管理費・現場経費
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">自社管理費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={mgmtFee} onChange={(e) => setMgmtFee(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">現場経費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={siteExp} onChange={(e) => setSiteExp(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">自社現調費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={ownSurvey} onChange={(e) => setOwnSurvey(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">パートナー現調費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={partnerSurvey} onChange={(e) => setPartnerSurvey(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">交通費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={transport} onChange={(e) => setTransport(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">人件費</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">¥</span>
                  <Input type="number" inputMode="numeric" className="pl-5 h-8 text-sm tabular-nums" placeholder="0" value={labor} onChange={(e) => setLabor(e.target.value)} />
                </div>
              </div>
            </div>
            {overheadTotal > 0 && (
              <div className="text-xs text-muted-foreground mt-2 text-right">
                管理費・現場経費 小計: <span className="font-medium text-foreground">{yen(overheadTotal)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending} className="active:scale-[0.97] transition-transform">
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              金額を保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 収支サマリーカード */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">個別案件 収支</h3>
          </div>

          <div className={`grid ${isPartner ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'} gap-3`}>
            {!isPartner && (
            <div className="rounded-md border p-3 bg-blue-50 border-blue-200">
              <div className="text-xs text-blue-700 mb-1">売上・プレナス提出額</div>
              <div className="text-xl font-semibold tracking-tight">{yen(sales)}</div>
              {salesIsEstimated && (
                <div className="text-[11px] text-blue-700/80 mt-1">未入力のため協力業者額から想定 ÷0.75</div>
              )}
            </div>
            )}
            <div className="rounded-md border p-3 bg-emerald-50 border-emerald-200">
              <div className="text-xs text-emerald-700 mb-1">{isPartner ? '見積額' : '協力業者見積額'}</div>
              <div className="text-xl font-semibold tracking-tight">{yen(vendorAmount)}</div>
            </div>
            <div className="rounded-md border p-3 bg-amber-50 border-amber-200">
              <div className="text-xs text-amber-700 mb-1">経費・領収書</div>
              <div className="text-xl font-semibold tracking-tight">{yen(expensesTotal)}</div>
              {!isPartner && <div className="text-[11px] text-amber-700/80 mt-1">原価計: {yen(cost)}</div>}
            </div>
            {overheadTotal > 0 && (
              <div className="rounded-md border p-3 bg-orange-50 border-orange-200">
                <div className="text-xs text-orange-700 mb-1">管理費・現場経費</div>
                <div className="text-xl font-semibold tracking-tight">{yen(overheadTotal)}</div>
              </div>
            )}
            {!isPartner && (
            <div className={`rounded-md border p-3 ${grossProfit >= 0 ? "bg-violet-50 border-violet-200" : "bg-red-50 border-red-200"}`}>
              <div className="text-xs mb-1 text-muted-foreground">粗利・売上−原価</div>
              <div className={`text-xl font-semibold tracking-tight ${grossProfit >= 0 ? "text-violet-700" : "text-red-700"}`}>
                {yen(grossProfit)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                粗利率 {(grossMargin * 100).toFixed(1)}%
              </div>
            </div>
            )}
          </div>

          {!isPartner && (
          <div className="text-xs text-muted-foreground space-y-1 leading-relaxed pt-2 border-t">
            <div>・売上：プレナスへ提出した見積金額。未入力時は協力業者額から想定表示</div>
            <div>・原価：協力業者見積額 ＋ 領収書経費 ＋ 管理費・現場経費</div>
            <div>・粗利・粗利率は金額を保存すると即時に反映されます</div>
          </div>
          )}
        </CardContent>
      </Card>

      {estimates.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2">見積書内訳・{estimates.length}件</div>
            <div className="text-xs text-muted-foreground mb-3">合計: {yen(estimatesTotal)}</div>
            <div className="space-y-1">
              {estimates.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                  <div className="truncate">
                    <span className="text-muted-foreground mr-2">{e.vendorName || "—"}</span>
                    <span>{e.fileName ?? "見積書"}</span>
                  </div>
                  <div className="font-medium tabular-nums">{yen(e.totalAmount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
