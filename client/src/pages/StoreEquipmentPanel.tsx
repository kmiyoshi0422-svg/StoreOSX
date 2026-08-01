/**
 * 店舗設備台帳パネル
 * - グリーストラップ（品番・蓋サイズ）
 * - フード排気量
 * - 天井内温度・湿度
 * - 厨房内温度・湿度
 * - 雨漏り歴
 * - 漏電歴
 * - 分電盤写真
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Droplets,
  Wind,
  Thermometer,
  CloudRain,
  Zap,
  Camera,
  Loader2,
} from "lucide-react";

// ============================================================
// メインパネル
// ============================================================
export function StoreEquipmentPanel({ storeId }: { storeId: number }) {
  const [activeTab, setActiveTab] = useState("greaseTrap");

  return (
    <div className="space-y-4">
      <h3 className="font-serif-jp font-semibold text-lg">設備台帳</h3>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="greaseTrap" className="text-xs px-3 py-1.5">
            <Droplets className="h-3.5 w-3.5 mr-1" />
            グリーストラップ
          </TabsTrigger>
          <TabsTrigger value="exhaustHood" className="text-xs px-3 py-1.5">
            <Wind className="h-3.5 w-3.5 mr-1" />
            フード排気
          </TabsTrigger>
          <TabsTrigger value="environment" className="text-xs px-3 py-1.5">
            <Thermometer className="h-3.5 w-3.5 mr-1" />
            温湿度
          </TabsTrigger>
          <TabsTrigger value="leakHistory" className="text-xs px-3 py-1.5">
            <CloudRain className="h-3.5 w-3.5 mr-1" />
            雨漏り・漏電
          </TabsTrigger>
          <TabsTrigger value="distributionBoard" className="text-xs px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 mr-1" />
            分電盤
          </TabsTrigger>
        </TabsList>

        <TabsContent value="greaseTrap">
          <GreaseTrapSection storeId={storeId} />
        </TabsContent>
        <TabsContent value="exhaustHood">
          <ExhaustHoodSection storeId={storeId} />
        </TabsContent>
        <TabsContent value="environment">
          <EnvironmentSection storeId={storeId} />
        </TabsContent>
        <TabsContent value="leakHistory">
          <LeakHistorySection storeId={storeId} />
        </TabsContent>
        <TabsContent value="distributionBoard">
          <DistributionBoardSection storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// グリーストラップ
// ============================================================
function GreaseTrapSection({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.storeEquipment.greaseTraps.list.useQuery({ storeId });
  const createMut = trpc.storeEquipment.greaseTraps.create.useMutation({
    onSuccess: () => { toast.success("グリーストラップを登録しました"); utils.storeEquipment.greaseTraps.list.invalidate({ storeId }); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.storeEquipment.greaseTraps.delete.useMutation({
    onSuccess: () => { toast.success("削除しました"); utils.storeEquipment.greaseTraps.list.invalidate({ storeId }); },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ location: "", modelNumber: "", lidSize: "", lidMaterial: "", capacity: "", memo: "" });

  const handleCreate = () => {
    createMut.mutate({ storeId, ...form });
  };

  if (isLoading) return <LoadingCard />;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <Droplets className="h-4 w-4" />
            グリーストラップ
            <Badge variant="secondary" className="text-[10px]">{items.length}台</Badge>
          </h4>
          <Button size="sm" variant="outline" onClick={() => { setForm({ location: "", modelNumber: "", lidSize: "", lidMaterial: "", capacity: "", memo: "" }); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />追加
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">登録なし</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.location && <Badge variant="outline" className="text-[10px]">{item.location}</Badge>}
                    <span className="text-sm font-medium">{item.modelNumber || "品番未登録"}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm("削除しますか？")) deleteMut.mutate({ id: item.id }); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div><span className="text-muted-foreground">蓋サイズ:</span> {item.lidSize || "—"}</div>
                  <div><span className="text-muted-foreground">蓋材質:</span> {item.lidMaterial || "—"}</div>
                  <div><span className="text-muted-foreground">容量:</span> {item.capacity || "—"}</div>
                </div>
                {item.memo && <p className="text-xs text-muted-foreground">{item.memo}</p>}
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>グリーストラップ登録</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">設置場所</Label><Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="厨房内、外部等" /></div>
                <div><Label className="text-xs">品番</Label><Input value={form.modelNumber} onChange={(e) => setForm(p => ({ ...p, modelNumber: e.target.value }))} placeholder="GT-500F等" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">蓋の大きさ</Label><Input value={form.lidSize} onChange={(e) => setForm(p => ({ ...p, lidSize: e.target.value }))} placeholder="600x600mm" /></div>
                <div><Label className="text-xs">蓋の材質</Label><Input value={form.lidMaterial} onChange={(e) => setForm(p => ({ ...p, lidMaterial: e.target.value }))} placeholder="FRP、鉄等" /></div>
              </div>
              <div><Label className="text-xs">容量</Label><Input value={form.capacity} onChange={(e) => setForm(p => ({ ...p, capacity: e.target.value }))} placeholder="100L等" /></div>
              <div><Label className="text-xs">メモ</Label><Textarea value={form.memo} onChange={(e) => setForm(p => ({ ...p, memo: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}登録
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// フード排気
// ============================================================
function ExhaustHoodSection({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.storeEquipment.exhaustHoods.list.useQuery({ storeId });
  const createMut = trpc.storeEquipment.exhaustHoods.create.useMutation({
    onSuccess: () => { toast.success("フード排気情報を登録しました"); utils.storeEquipment.exhaustHoods.list.invalidate({ storeId }); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.storeEquipment.exhaustHoods.delete.useMutation({
    onSuccess: () => { toast.success("削除しました"); utils.storeEquipment.exhaustHoods.list.invalidate({ storeId }); },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ location: "", hoodType: "", exhaustVolume: "", motorModel: "", filterSize: "", memo: "" });

  const handleCreate = () => {
    createMut.mutate({ storeId, ...form });
  };

  if (isLoading) return <LoadingCard />;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <Wind className="h-4 w-4" />
            フード排気
            <Badge variant="secondary" className="text-[10px]">{items.length}台</Badge>
          </h4>
          <Button size="sm" variant="outline" onClick={() => { setForm({ location: "", hoodType: "", exhaustVolume: "", motorModel: "", filterSize: "", memo: "" }); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />追加
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">登録なし</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.location && <Badge variant="outline" className="text-[10px]">{item.location}</Badge>}
                    <span className="text-sm font-medium">{item.hoodType || "種類未登録"}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm("削除しますか？")) deleteMut.mutate({ id: item.id }); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">排気量:</span> <strong>{item.exhaustVolume || "—"}</strong></div>
                  <div><span className="text-muted-foreground">モーター:</span> {item.motorModel || "—"}</div>
                  <div><span className="text-muted-foreground">フィルター:</span> {item.filterSize || "—"}</div>
                </div>
                {item.memo && <p className="text-xs text-muted-foreground">{item.memo}</p>}
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>フード排気情報登録</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">設置場所</Label><Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="厨房フード1等" /></div>
                <div><Label className="text-xs">フード種類</Label><Input value={form.hoodType} onChange={(e) => setForm(p => ({ ...p, hoodType: e.target.value }))} placeholder="箱型、山型等" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">排気量</Label><Input value={form.exhaustVolume} onChange={(e) => setForm(p => ({ ...p, exhaustVolume: e.target.value }))} placeholder="2000m³/h" /></div>
                <div><Label className="text-xs">モーター品番</Label><Input value={form.motorModel} onChange={(e) => setForm(p => ({ ...p, motorModel: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">フィルターサイズ</Label><Input value={form.filterSize} onChange={(e) => setForm(p => ({ ...p, filterSize: e.target.value }))} placeholder="500x350mm" /></div>
              <div><Label className="text-xs">メモ</Label><Textarea value={form.memo} onChange={(e) => setForm(p => ({ ...p, memo: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}登録
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 温湿度記録
// ============================================================
function EnvironmentSection({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const { data: ceilingLogs = [] } = trpc.storeEquipment.environmentLogs.list.useQuery({ storeId, area: "天井内" });
  const { data: kitchenLogs = [] } = trpc.storeEquipment.environmentLogs.list.useQuery({ storeId, area: "厨房内" });
  const createMut = trpc.storeEquipment.environmentLogs.create.useMutation({
    onSuccess: () => {
      toast.success("温湿度を記録しました");
      utils.storeEquipment.environmentLogs.list.invalidate({ storeId });
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.storeEquipment.environmentLogs.delete.useMutation({
    onSuccess: () => { utils.storeEquipment.environmentLogs.list.invalidate({ storeId }); },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ measurementArea: "天井内" as "天井内" | "厨房内", temperature: "", humidity: "", measuredBy: "", memo: "" });

  const handleCreate = () => {
    createMut.mutate({
      storeId,
      measurementArea: form.measurementArea,
      temperature: form.temperature || null,
      humidity: form.humidity || null,
      measuredAt: new Date().toISOString(),
      measuredBy: form.measuredBy || null,
      memo: form.memo || null,
    });
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <Thermometer className="h-4 w-4" />
            温湿度記録
          </h4>
          <Button size="sm" variant="outline" onClick={() => { setForm({ measurementArea: "天井内", temperature: "", humidity: "", measuredBy: "", memo: "" }); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />記録追加
          </Button>
        </div>

        {/* 天井内 */}
        <div>
          <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] bg-blue-50">天井内</Badge>
            <span className="text-xs text-muted-foreground">{ceilingLogs.length}件</span>
          </h5>
          {ceilingLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground ml-2">記録なし</p>
          ) : (
            <div className="space-y-1">
              {ceilingLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono">{log.temperature ? `${log.temperature}℃` : "—"}</span>
                    <span className="font-mono">{log.humidity ? `${log.humidity}%` : "—"}</span>
                    <span className="text-muted-foreground">{log.measuredBy || ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleDateString("ja-JP")}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteMut.mutate({ id: log.id })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 厨房内 */}
        <div>
          <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] bg-orange-50">厨房内</Badge>
            <span className="text-xs text-muted-foreground">{kitchenLogs.length}件</span>
          </h5>
          {kitchenLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground ml-2">記録なし</p>
          ) : (
            <div className="space-y-1">
              {kitchenLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono">{log.temperature ? `${log.temperature}℃` : "—"}</span>
                    <span className="font-mono">{log.humidity ? `${log.humidity}%` : "—"}</span>
                    <span className="text-muted-foreground">{log.measuredBy || ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleDateString("ja-JP")}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteMut.mutate({ id: log.id })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>温湿度記録</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">計測エリア</Label>
                <Select value={form.measurementArea} onValueChange={(v) => setForm(p => ({ ...p, measurementArea: v as "天井内" | "厨房内" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="天井内">天井内</SelectItem>
                    <SelectItem value="厨房内">厨房内</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">温度（℃）</Label><Input type="number" step="0.1" value={form.temperature} onChange={(e) => setForm(p => ({ ...p, temperature: e.target.value }))} placeholder="28.5" /></div>
                <div><Label className="text-xs">湿度（%）</Label><Input type="number" step="0.1" value={form.humidity} onChange={(e) => setForm(p => ({ ...p, humidity: e.target.value }))} placeholder="65.0" /></div>
              </div>
              <div><Label className="text-xs">計測者</Label><Input value={form.measuredBy} onChange={(e) => setForm(p => ({ ...p, measuredBy: e.target.value }))} /></div>
              <div><Label className="text-xs">メモ</Label><Textarea value={form.memo} onChange={(e) => setForm(p => ({ ...p, memo: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}記録
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 雨漏り・漏電歴
// ============================================================
function LeakHistorySection({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const { data: rainLeaks = [] } = trpc.storeEquipment.leakHistory.list.useQuery({ storeId, leakType: "雨漏り" });
  const { data: electricLeaks = [] } = trpc.storeEquipment.leakHistory.list.useQuery({ storeId, leakType: "漏電" });
  const createMut = trpc.storeEquipment.leakHistory.create.useMutation({
    onSuccess: () => { toast.success("履歴を登録しました"); utils.storeEquipment.leakHistory.list.invalidate({ storeId }); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.storeEquipment.leakHistory.delete.useMutation({
    onSuccess: () => { utils.storeEquipment.leakHistory.list.invalidate({ storeId }); },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    leakType: "雨漏り" as "雨漏り" | "漏電",
    occurredAt: "",
    location: "",
    severity: "中程度" as "軽微" | "中程度" | "重大",
    cause: "",
    repairContent: "",
    repairDate: "",
    memo: "",
  });

  const handleCreate = () => {
    createMut.mutate({
      storeId,
      leakType: form.leakType,
      occurredAt: form.occurredAt || null,
      location: form.location || null,
      severity: form.severity,
      cause: form.cause || null,
      repairContent: form.repairContent || null,
      repairDate: form.repairDate || null,
      memo: form.memo || null,
    });
  };

  const SEVERITY_COLOR: Record<string, string> = {
    "軽微": "bg-green-100 text-green-800",
    "中程度": "bg-yellow-100 text-yellow-800",
    "重大": "bg-red-100 text-red-800",
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <CloudRain className="h-4 w-4" />
            雨漏り・漏電歴
          </h4>
          <Button size="sm" variant="outline" onClick={() => { setForm({ leakType: "雨漏り", occurredAt: "", location: "", severity: "中程度", cause: "", repairContent: "", repairDate: "", memo: "" }); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />追加
          </Button>
        </div>

        {/* 雨漏り */}
        <div>
          <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
            <CloudRain className="h-3.5 w-3.5 text-blue-600" />
            雨漏り
            <Badge variant="secondary" className="text-[10px]">{rainLeaks.length}件</Badge>
          </h5>
          {rainLeaks.length === 0 ? (
            <p className="text-xs text-muted-foreground ml-2">記録なし</p>
          ) : (
            <div className="space-y-2">
              {rainLeaks.map((item) => (
                <LeakCard key={item.id} item={item} onDelete={() => deleteMut.mutate({ id: item.id })} severityColor={SEVERITY_COLOR} />
              ))}
            </div>
          )}
        </div>

        {/* 漏電 */}
        <div>
          <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-amber-600" />
            漏電
            <Badge variant="secondary" className="text-[10px]">{electricLeaks.length}件</Badge>
          </h5>
          {electricLeaks.length === 0 ? (
            <p className="text-xs text-muted-foreground ml-2">記録なし</p>
          ) : (
            <div className="space-y-2">
              {electricLeaks.map((item) => (
                <LeakCard key={item.id} item={item} onDelete={() => deleteMut.mutate({ id: item.id })} severityColor={SEVERITY_COLOR} />
              ))}
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>雨漏り・漏電歴 登録</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">種別</Label>
                  <Select value={form.leakType} onValueChange={(v) => setForm(p => ({ ...p, leakType: v as "雨漏り" | "漏電" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="雨漏り">雨漏り</SelectItem>
                      <SelectItem value="漏電">漏電</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">重大度</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm(p => ({ ...p, severity: v as "軽微" | "中程度" | "重大" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="軽微">軽微</SelectItem>
                      <SelectItem value="中程度">中程度</SelectItem>
                      <SelectItem value="重大">重大</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">発生日</Label><Input type="date" value={form.occurredAt} onChange={(e) => setForm(p => ({ ...p, occurredAt: e.target.value }))} /></div>
                <div><Label className="text-xs">発生箇所</Label><Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="天井、壁面等" /></div>
              </div>
              <div><Label className="text-xs">原因</Label><Input value={form.cause} onChange={(e) => setForm(p => ({ ...p, cause: e.target.value }))} /></div>
              <div><Label className="text-xs">修理内容</Label><Textarea value={form.repairContent} onChange={(e) => setForm(p => ({ ...p, repairContent: e.target.value }))} rows={2} /></div>
              <div><Label className="text-xs">修理日</Label><Input type="date" value={form.repairDate} onChange={(e) => setForm(p => ({ ...p, repairDate: e.target.value }))} /></div>
              <div><Label className="text-xs">メモ</Label><Textarea value={form.memo} onChange={(e) => setForm(p => ({ ...p, memo: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}登録
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function LeakCard({ item, onDelete, severityColor }: { item: any; onDelete: () => void; severityColor: Record<string, string> }) {
  return (
    <div className="border rounded-lg p-3 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {item.severity && <Badge className={`text-[10px] ${severityColor[item.severity] ?? ""}`}>{item.severity}</Badge>}
          {item.location && <span className="text-xs">{item.location}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{item.occurredAt ? new Date(item.occurredAt).toLocaleDateString("ja-JP") : "日付不明"}</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {item.cause && <p className="text-xs"><span className="text-muted-foreground">原因:</span> {item.cause}</p>}
      {item.repairContent && <p className="text-xs"><span className="text-muted-foreground">修理:</span> {item.repairContent}</p>}
      {item.memo && <p className="text-xs text-muted-foreground">{item.memo}</p>}
    </div>
  );
}

// ============================================================
// 分電盤写真
// ============================================================
function DistributionBoardSection({ storeId }: { storeId: number }) {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.storeEquipment.distributionBoards.list.useQuery({ storeId });
  const createMut = trpc.storeEquipment.distributionBoards.create.useMutation({
    onSuccess: () => { toast.success("分電盤情報を登録しました"); utils.storeEquipment.distributionBoards.list.invalidate({ storeId }); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.storeEquipment.distributionBoards.delete.useMutation({
    onSuccess: () => { toast.success("削除しました"); utils.storeEquipment.distributionBoards.list.invalidate({ storeId }); },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ boardName: "", location: "", capacity: "", circuitCount: "", memo: "", photoFileKey: "" });
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/storage/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.fileKey) {
        setForm(p => ({ ...p, photoFileKey: data.fileKey }));
        toast.success("写真をアップロードしました");
      }
    } catch (err) {
      toast.error("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = () => {
    if (!form.photoFileKey) {
      toast.error("分電盤写真をアップロードしてください");
      return;
    }
    createMut.mutate({
      storeId,
      boardName: form.boardName || null,
      location: form.location || null,
      capacity: form.capacity || null,
      circuitCount: form.circuitCount ? parseInt(form.circuitCount) : null,
      photoFileKey: form.photoFileKey,
      memo: form.memo || null,
      photographedAt: new Date().toISOString(),
    });
  };

  if (isLoading) return <LoadingCard />;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4" />
            分電盤写真
            <Badge variant="secondary" className="text-[10px]">{items.length}台</Badge>
          </h4>
          <Button size="sm" variant="outline" onClick={() => { setForm({ boardName: "", location: "", capacity: "", circuitCount: "", memo: "", photoFileKey: "" }); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />追加
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">登録なし</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg overflow-hidden">
                <div className="aspect-[4/3] bg-muted relative">
                  <img
                    src={`/api/storage/${item.photoFileKey}`}
                    alt={item.boardName || "分電盤"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{item.boardName || "分電盤"}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => { if (confirm("削除しますか？")) deleteMut.mutate({ id: item.id }); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    {item.location && <p>場所: {item.location}</p>}
                    {item.capacity && <p>容量: {item.capacity}</p>}
                    {item.circuitCount && <p>回路数: {item.circuitCount}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>分電盤写真登録</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">分電盤写真（必須）</Label>
                <div className="mt-1">
                  {form.photoFileKey ? (
                    <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden border">
                      <img src={`/api/storage/${form.photoFileKey}`} alt="分電盤" className="w-full h-full object-cover" />
                      <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-6 text-[10px]" onClick={() => setForm(p => ({ ...p, photoFileKey: "" }))}>
                        削除
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                      {uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">クリックして写真を選択</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">分電盤名称</Label><Input value={form.boardName} onChange={(e) => setForm(p => ({ ...p, boardName: e.target.value }))} placeholder="主幹、厨房系統等" /></div>
                <div><Label className="text-xs">設置場所</Label><Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="バックヤード等" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">容量</Label><Input value={form.capacity} onChange={(e) => setForm(p => ({ ...p, capacity: e.target.value }))} placeholder="60A" /></div>
                <div><Label className="text-xs">回路数</Label><Input type="number" value={form.circuitCount} onChange={(e) => setForm(p => ({ ...p, circuitCount: e.target.value }))} placeholder="20" /></div>
              </div>
              <div><Label className="text-xs">メモ</Label><Textarea value={form.memo} onChange={(e) => setForm(p => ({ ...p, memo: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleCreate} disabled={!form.photoFileKey || createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}登録
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 共通コンポーネント
// ============================================================
function LoadingCard() {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
