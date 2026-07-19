import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Droplets, Save, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

type CheckItem = {
  id: number;
  inspectionId: number;
  section: "室内" | "天井裏" | "外部";
  orderNo: number;
  category: string;
  itemTitle: string;
  status: "未確認" | "有" | "無" | "不明";
  urgency: "none" | "urgent" | "caution" | "observe";
  memo: string | null;
  photoNo: string | null;
};

const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  none: { label: "-", color: "bg-muted text-muted-foreground" },
  urgent: { label: "🔴 緊急", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  caution: { label: "🟡 注意", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  observe: { label: "🟢 経過観察", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
};

const STATUS_LABELS: Record<string, string> = {
  "未確認": "未確認",
  "有": "有",
  "無": "無",
  "不明": "不明",
};

export default function RainLeakInspection() {
  const { user } = useAuth();
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // 案件一覧取得
  const { data: casesData } = trpc.cases.list.useQuery();
  const cases = casesData ?? [];

  // フィルタされた案件
  const filteredCases = useMemo(() => {
    if (!searchTerm) return cases.slice(0, 50);
    const term = searchTerm.toLowerCase();
    return cases.filter(
      (c: any) =>
        c.storeName?.toLowerCase().includes(term) ||
        c.requestNumber?.toLowerCase().includes(term) ||
        c.address?.toLowerCase().includes(term)
    ).slice(0, 50);
  }, [cases, searchTerm]);

  // 選択した案件の雨漏り調査データ
  const { data: inspectionData, refetch } = trpc.rainLeak.getByCaseId.useQuery(
    { caseId: selectedCaseId! },
    { enabled: !!selectedCaseId }
  );

  const createMutation = trpc.rainLeak.create.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("雨漏り調査チェックリストを作成しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateItemMutation = trpc.rainLeak.updateItem.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const updateInspectionMutation = trpc.rainLeak.updateInspection.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("保存しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const recalcMutation = trpc.rainLeak.recalcSummary.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success(`集計完了: 問題${data.totalIssueCount}件（緊急${data.urgentCount}/注意${data.cautionCount}/観察${data.observeCount}）`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreateInspection = () => {
    if (!selectedCaseId) return;
    createMutation.mutate({
      caseId: selectedCaseId,
      inspectionDate: new Date().toISOString().slice(0, 10),
      inspector: user?.name || "",
    });
  };

  const handleItemChange = (itemId: number, field: string, value: string) => {
    updateItemMutation.mutate({ id: itemId, [field]: value } as any);
  };

  const toggleCategory = (key: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 案件選択画面
  if (!selectedCaseId) {
    return (
      <div className="container py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Droplets className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">雨漏り調査チェックリスト</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>案件を選択してください</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="店舗名・依頼番号・住所で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredCases.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{c.storeName}</span>
                      <span className="text-sm text-muted-foreground ml-2">{c.requestNumber}</span>
                    </div>
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                  {c.address && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{c.address}</p>
                  )}
                </button>
              ))}
              {filteredCases.length === 0 && (
                <p className="text-center text-muted-foreground py-8">案件が見つかりません</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCase = cases.find((c: any) => c.id === selectedCaseId);

  // 調査が未作成の場合
  if (inspectionData === null) {
    return (
      <div className="container py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => setSelectedCaseId(null)}>← 戻る</Button>
          <Droplets className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl font-bold">雨漏り調査: {selectedCase?.storeName}</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">この案件にはまだ雨漏り調査チェックリストがありません</p>
            <Button onClick={handleCreateInspection} disabled={createMutation.isPending}>
              {createMutation.isPending ? "作成中..." : "チェックリストを作成"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ローディング中
  if (!inspectionData) {
    return (
      <div className="container py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => setSelectedCaseId(null)}>← 戻る</Button>
          <h1 className="text-xl font-bold">読み込み中...</h1>
        </div>
      </div>
    );
  }

  const { inspection, items } = inspectionData;

  // セクション別にグループ化
  const groupedItems = items.reduce((acc: Record<string, Record<string, CheckItem[]>>, item: CheckItem) => {
    if (!acc[item.section]) acc[item.section] = {};
    if (!acc[item.section][item.category]) acc[item.section][item.category] = [];
    acc[item.section][item.category].push(item);
    return acc;
  }, {} as Record<string, Record<string, CheckItem[]>>);

  const sections = ["室内", "天井裏", "外部"] as const;

  return (
    <div className="container py-6 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setSelectedCaseId(null)}>← 戻る</Button>
        <Droplets className="h-5 w-5 text-blue-500" />
        <h1 className="text-xl font-bold">{selectedCase?.storeName} - 雨漏り調査</h1>
        {inspection?.overallJudgment && (
          <Badge variant="outline" className="text-sm">{inspection.overallJudgment}</Badge>
        )}
      </div>

      {/* 集計バー */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          🔴 緊急: {inspection?.urgentCount ?? 0}
        </Badge>
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          🟡 注意: {inspection?.cautionCount ?? 0}
        </Badge>
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          🟢 観察: {inspection?.observeCount ?? 0}
        </Badge>
        <Badge variant="outline">
          問題合計: {inspection?.totalIssueCount ?? 0}件
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={() => recalcMutation.mutate({ caseId: selectedCaseId! })}
          disabled={recalcMutation.isPending}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          集計更新
        </Button>
      </div>

      <Tabs defaultValue="checklist">
        <TabsList className="mb-4">
          <TabsTrigger value="checklist">チェック項目</TabsTrigger>
          <TabsTrigger value="info">表紙情報</TabsTrigger>
          <TabsTrigger value="summary">総括所見</TabsTrigger>
        </TabsList>

        {/* チェック項目タブ */}
        <TabsContent value="checklist">
          <Tabs defaultValue="室内">
            <TabsList className="mb-4 overflow-x-auto">
              {sections.map((s) => (
                <TabsTrigger key={s} value={s}>{s}（{items.filter((i: CheckItem) => i.section === s).length}項目）</TabsTrigger>
              ))}
            </TabsList>
            {sections.map((section) => (
              <TabsContent key={section} value={section}>
                <div className="space-y-3">
                  {Object.entries(groupedItems[section] || {}).map(([category, catItems]) => {
                    const catKey = `${section}-${category}`;
                    const isCollapsed = collapsedCategories.has(catKey);
                    const issueCount = (catItems as CheckItem[]).filter((i) => i.status === "有").length;
                    return (
                      <Card key={catKey}>
                        <button
                          onClick={() => toggleCategory(catKey)}
                          className="w-full flex items-center justify-between p-3 hover:bg-accent/50 rounded-t-lg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="font-medium">{category}</span>
                            <Badge variant="outline" className="text-xs">{(catItems as CheckItem[]).length}項目</Badge>
                            {issueCount > 0 && (
                              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs">
                                問題{issueCount}件
                              </Badge>
                            )}
                          </div>
                        </button>
                        {!isCollapsed && (
                          <CardContent className="pt-0 px-3 pb-3">
                            <div className="space-y-2">
                              {(catItems as CheckItem[]).map((item) => (
                                <CheckItemRow
                                  key={item.id}
                                  item={item}
                                  onChange={handleItemChange}
                                />
                              ))}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* 表紙情報タブ */}
        <TabsContent value="info">
          <InspectionInfoForm
            inspection={inspection!}
            caseId={selectedCaseId!}
            onSave={(data) => updateInspectionMutation.mutate(data)}
            isSaving={updateInspectionMutation.isPending}
          />
        </TabsContent>

        {/* 総括所見タブ */}
        <TabsContent value="summary">
          <SummaryForm
            inspection={inspection!}
            caseId={selectedCaseId!}
            onSave={(data) => updateInspectionMutation.mutate(data)}
            isSaving={updateInspectionMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// チェック項目行コンポーネント
function CheckItemRow({ item, onChange }: { item: CheckItem; onChange: (id: number, field: string, value: string) => void }) {
  const [memo, setMemo] = useState(item.memo || "");
  const [photoNo, setPhotoNo] = useState(item.photoNo || "");

  return (
    <div className={`p-2 rounded border ${item.status === "有" ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20" : "border-border"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm flex-1 min-w-[120px]">{item.itemTitle}</span>
        <Select
          value={item.status}
          onValueChange={(v) => onChange(item.id, "status", v)}
        >
          <SelectTrigger className="w-[80px] h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {item.status === "有" && (
          <Select
            value={item.urgency}
            onValueChange={(v) => onChange(item.id, "urgency", v)}
          >
            <SelectTrigger className="w-[110px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(URGENCY_LABELS).map(([val, { label }]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          placeholder="写真No."
          value={photoNo}
          onChange={(e) => setPhotoNo(e.target.value)}
          onBlur={() => { if (photoNo !== (item.photoNo || "")) onChange(item.id, "photoNo", photoNo); }}
          className="w-[70px] h-7 text-xs"
        />
      </div>
      {item.status === "有" && (
        <div className="mt-2">
          <Input
            placeholder="メモ（状態の詳細）"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={() => { if (memo !== (item.memo || "")) onChange(item.id, "memo", memo); }}
            className="h-7 text-xs"
          />
        </div>
      )}
    </div>
  );
}

// 表紙情報フォーム
function InspectionInfoForm({ inspection, caseId, onSave, isSaving }: {
  inspection: any;
  caseId: number;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({
    inspectionDate: inspection?.inspectionDate || "",
    buildingStructure: inspection?.buildingStructure || "",
    buildingAge: inspection?.buildingAge || "",
    inspector: inspection?.inspector || "",
    weather: inspection?.weather || "",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>調査表紙情報</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>調査日</Label>
            <Input type="date" value={form.inspectionDate} onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })} />
          </div>
          <div>
            <Label>天候</Label>
            <Input value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} placeholder="晴れ / 曇り / 雨" />
          </div>
          <div>
            <Label>建物構造</Label>
            <Input value={form.buildingStructure} onChange={(e) => setForm({ ...form, buildingStructure: e.target.value })} placeholder="鉄骨造 / RC造 / 木造" />
          </div>
          <div>
            <Label>築年数</Label>
            <Input value={form.buildingAge} onChange={(e) => setForm({ ...form, buildingAge: e.target.value })} placeholder="例: 15年" />
          </div>
          <div>
            <Label>調査員</Label>
            <Input value={form.inspector} onChange={(e) => setForm({ ...form, inspector: e.target.value })} />
          </div>
        </div>
        <Button onClick={() => onSave({ caseId, ...form })} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "保存中..." : "保存"}
        </Button>
      </CardContent>
    </Card>
  );
}

// 総括所見フォーム
function SummaryForm({ inspection, caseId, onSave, isSaving }: {
  inspection: any;
  caseId: number;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const parsedSummary = (() => {
    try { return JSON.parse(inspection?.summary || "{}"); }
    catch { return {}; }
  })();

  const [form, setForm] = useState({
    overview: parsedSummary.overview || "",
    symptoms: parsedSummary.symptoms || "",
    cause: parsedSummary.cause || "",
    urgencyReason: parsedSummary.urgencyReason || "",
    plan: parsedSummary.plan || "",
    remarks: parsedSummary.remarks || "",
    nextInspection: parsedSummary.nextInspection || "",
  });

  const handleSave = () => {
    onSave({
      caseId,
      summary: JSON.stringify(form),
      overallJudgment: inspection?.overallJudgment,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>総括所見</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>概要</Label>
          <Textarea value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} placeholder="調査の概要を記入..." rows={3} />
        </div>
        <div>
          <Label>確認された症状</Label>
          <Textarea value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} placeholder="確認された雨漏りの症状..." rows={3} />
        </div>
        <div>
          <Label>推定原因</Label>
          <Textarea value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} placeholder="推定される浸入原因..." rows={3} />
        </div>
        <div>
          <Label>緊急度の理由</Label>
          <Textarea value={form.urgencyReason} onChange={(e) => setForm({ ...form, urgencyReason: e.target.value })} placeholder="緊急度判定の根拠..." rows={2} />
        </div>
        <div>
          <Label>修繕計画</Label>
          <Textarea value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} placeholder="推奨する修繕計画..." rows={3} />
        </div>
        <div>
          <Label>備考</Label>
          <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="その他特記事項..." rows={2} />
        </div>
        <div>
          <Label>次回点検予定</Label>
          <Input value={form.nextInspection} onChange={(e) => setForm({ ...form, nextInspection: e.target.value })} placeholder="例: 2025年3月" />
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "保存中..." : "保存"}
        </Button>
      </CardContent>
    </Card>
  );
}
