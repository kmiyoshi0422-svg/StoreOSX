import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { buildTelHref, buildMapDirectionsHref } from "@shared/map-actions";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MapPin,
  MapPinned,
  Loader2,
  RefreshCw,
  Search,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

/* ============================================================
   設定：緊急度・進捗の配色（CasesList と統一）
   ============================================================ */
const URGENCY_LABEL: Record<string, string> = {
  S: "緊急",
  A: "高",
  B: "中",
  C: "低",
};
// ピンの塗り色（緊急度ベース）
const URGENCY_PIN: Record<string, string> = {
  S: "#dc2626", // red-600
  A: "#f97316", // orange-500
  B: "#eab308", // yellow-500
  C: "#10b981", // emerald-500
};
const URGENCY_BADGE: Record<string, string> = {
  S: "bg-red-600 text-white",
  A: "bg-orange-500 text-white",
  B: "bg-yellow-500 text-white",
  C: "bg-emerald-500 text-white",
};
const STAGE_BADGE: Record<string, string> = {
  未対応: "bg-slate-100 text-slate-700 border-slate-200",
  現調済: "bg-amber-50 text-amber-700 border-amber-200",
  見積提出済: "bg-blue-50 text-blue-700 border-blue-200",
  承認済: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// 日本の中心あたり（初期表示）
const JAPAN_CENTER = { lat: 36.2048, lng: 138.2529 };

type CaseRow = {
  id: number;
  requestNumber: string;
  storeName: string;
  brand: string;
  address: string | null;
  storePhone: string | null;
  latitude: string | null;
  longitude: string | null;
  urgency: string;
  progressStage: string;
  status: string;
};

type Located = CaseRow & { lat: number; lng: number };

/* ピンのSVG（雫型＋中央ドット）
   AdvancedMarkerElement は content 要素の「下端中央」を座標にアンカーするため、
   ここでは translate などの自前オフセットを一切付けず、雫の先端が要素の
   下端中央に一致するSVG（viewBox 高さ=要素高さ）だけを返す。
   これにより、どのズームレベルでもピン先端が正確に座標へ吸着しズレない。 */
function createPinElement(color: string, emphasized: boolean) {
  const scale = emphasized ? 1.25 : 1;
  const w = 28 * scale;
  const h = 38 * scale;
  const wrap = document.createElement("div");
  // display:block + line-height:0 で余白を消し、SVG下端=要素下端を厳密に一致させる
  wrap.style.lineHeight = "0";
  wrap.style.filter = "drop-shadow(0 2px 3px rgba(0,0,0,.35))";
  wrap.innerHTML = `
    <svg width="${w}" height="${h}" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg" style="display:block;">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 24 14 24s14-14.5 14-24C28 6.27 21.73 0 14 0z"
        fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>`;
  return wrap;
}

export default function CasesMap() {
  const [, setLocation] = useLocation();
  const { data: cases = [], isLoading } = trpc.cases.list.useQuery();
  const utils = trpc.useUtils();

  const geocodeMutation = trpc.routes.geocodeMissing.useMutation({
    onSuccess: (res) => {
      toast.success(
        `位置情報を ${res.updated} 件取得しました（対象 ${res.total} 件）`
      );
      utils.cases.list.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "位置情報の取得に失敗しました"),
  });

  const [q, setQ] = useState("");
  const [urgency, setUrgency] = useState("all");
  const [stage, setStage] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // マップ・マーカー参照
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.marker.AdvancedMarkerElement>>(
    new Map()
  );
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // フィルタ適用後の案件
  const filtered = useMemo<CaseRow[]>(() => {
    const kw = q.trim().toLowerCase();
    return (cases as CaseRow[]).filter((c) => {
      if (urgency !== "all" && c.urgency !== urgency) return false;
      if (stage !== "all" && c.progressStage !== stage) return false;
      if (kw) {
        const hay = `${c.storeName} ${c.requestNumber} ${c.address ?? ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [cases, q, urgency, stage]);

  // 位置あり / なし
  const located = useMemo<Located[]>(
    () =>
      filtered
        .filter((c) => c.latitude && c.longitude)
        .map((c) => ({
          ...c,
          lat: Number(c.latitude),
          lng: Number(c.longitude),
        }))
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng)),
    [filtered]
  );
  const unlocated = useMemo(
    () => filtered.filter((c) => !c.latitude || !c.longitude),
    [filtered]
  );

  // 全体のうちジオコード未取得（住所あり）の件数
  const missingCount = useMemo(
    () =>
      (cases as CaseRow[]).filter(
        (c) => c.address && (!c.latitude || !c.longitude)
      ).length,
    [cases]
  );

  // マーカー再描画
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google) return;
    const map = mapRef.current;
    const g = window.google;

    // 既存マーカーをクリア
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current.clear();

    if (!infoRef.current) {
      infoRef.current = new g.maps.InfoWindow();
    }

    const bounds = new g.maps.LatLngBounds();

    located.forEach((c) => {
      const color = URGENCY_PIN[c.urgency] ?? "#64748b";
      const emphasized = c.id === selectedId;
      const content = createPinElement(color, emphasized);

      const marker = new g.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: c.lat, lng: c.lng },
        title: `${c.storeName}（${c.requestNumber}）`,
        content,
        zIndex: emphasized ? 999 : undefined,
      });

      marker.addListener("click", () => {
        setSelectedId(c.id);
        openInfo(c);
      });

      markersRef.current.set(c.id, marker);
      bounds.extend({ lat: c.lat, lng: c.lng });
    });

    // 初回・フィルタ変更時は全ピンが収まるようにフィット
    if (located.length > 0 && selectedId === null) {
      if (located.length === 1) {
        map.setCenter({ lat: located[0].lat, lng: located[0].lng });
        map.setZoom(15);
      } else {
        map.fitBounds(bounds, 80);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located, mapReady, selectedId]);

  function openInfo(c: Located) {
    if (!infoRef.current || !mapRef.current) return;
    const marker = markersRef.current.get(c.id);
    if (!marker) return;

    // InfoWindow は HTML文字列だと React の onClick が効かないため、
    // DOM要素を組み立ててボタンに直接リスナーを付ける。
    const root = document.createElement("div");
    root.style.fontFamily = "system-ui";
    root.style.minWidth = "210px";
    root.style.maxWidth = "270px";
    root.innerHTML = `
      <div style="font-weight:600; font-size:14px; margin-bottom:2px;">${escapeHtml(
        c.storeName
      )}</div>
      <div style="color:#64748b; font-size:12px; margin-bottom:6px;">${escapeHtml(
        c.requestNumber
      )} ・ ${escapeHtml(c.brand)}</div>
      <div style="font-size:12px; color:#334155; margin-bottom:8px;">${escapeHtml(
        c.address ?? ""
      )}</div>
      <div style="display:flex; gap:6px; font-size:11px; margin-bottom:10px;">
        <span style="background:${URGENCY_PIN[c.urgency] ?? "#64748b"};color:#fff;padding:1px 6px;border-radius:4px;">緊急度 ${
          c.urgency
        }</span>
        <span style="background:#f1f5f9;color:#334155;padding:1px 6px;border-radius:4px;">${escapeHtml(
          c.progressStage
        )}</span>
      </div>`;

    // 現場向けクイックアクション行（電話 / 地図アプリで開く）
    const phone = (c.storePhone ?? "").trim();
    const actionRow = document.createElement("div");
    actionRow.style.cssText =
      "display:flex; gap:6px; margin-bottom:8px;";

    // 電話する（有効な番号がある時のみ）
    const telHref = buildTelHref(phone);
    if (telHref) {
      const telLink = document.createElement("a");
      telLink.href = telHref;
      telLink.textContent = "電話する";
      telLink.style.cssText =
        "flex:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;" +
        "background:#059669;color:#fff;text-decoration:none;border-radius:6px;padding:7px 8px;" +
        "font-size:12px;font-weight:600;cursor:pointer;";
      telLink.addEventListener(
        "mouseenter",
        () => (telLink.style.background = "#047857")
      );
      telLink.addEventListener(
        "mouseleave",
        () => (telLink.style.background = "#059669")
      );
      actionRow.appendChild(telLink);
    }

    // 地図アプリで開く（経路案内）。住所優先、無ければ座標。
    const mapLink = document.createElement("a");
    mapLink.href = buildMapDirectionsHref({
      address: c.address,
      lat: c.lat,
      lng: c.lng,
    });
    mapLink.target = "_blank";
    mapLink.rel = "noopener noreferrer";
    mapLink.textContent = "地図アプリで開く";
    mapLink.style.cssText =
      "flex:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;" +
      "background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;padding:7px 8px;" +
      "font-size:12px;font-weight:600;cursor:pointer;";
    mapLink.addEventListener(
      "mouseenter",
      () => (mapLink.style.background = "#1d4ed8")
    );
    mapLink.addEventListener(
      "mouseleave",
      () => (mapLink.style.background = "#2563eb")
    );
    actionRow.appendChild(mapLink);
    root.appendChild(actionRow);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "案件詳細を編集 →";
    btn.style.cssText =
      "width:100%;display:inline-flex;align-items:center;justify-content:center;gap:4px;" +
      "background:#1e293b;color:#fff;border:none;border-radius:6px;padding:7px 10px;" +
      "font-size:12px;font-weight:600;cursor:pointer;";
    btn.addEventListener("mouseenter", () => (btn.style.background = "#0f172a"));
    btn.addEventListener("mouseleave", () => (btn.style.background = "#1e293b"));
    btn.addEventListener("click", () => {
      setLocation(`/cases/${c.id}`);
    });
    root.appendChild(btn);

    infoRef.current.setContent(root);
    infoRef.current.open({ map: mapRef.current, anchor: marker });
  }

  // サイドリストから選択 → 地図をセンタリング＋InfoWindow
  function focusCase(c: CaseRow) {
    setSelectedId(c.id);
    if (!c.latitude || !c.longitude) {
      toast.info("この案件はまだ位置情報がありません。先に位置情報を取得してください。");
      return;
    }
    const lat = Number(c.latitude);
    const lng = Number(c.longitude);
    if (mapRef.current && Number.isFinite(lat) && Number.isFinite(lng)) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(16);
      openInfo({ ...c, lat, lng });
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="MAP VIEW"
        title="案件マップ"
        icon={<MapPinned className="h-6 w-6 text-primary" />}
        description="登録済み案件の住所を地図上にピン表示します。緊急度で色分けし、左の一覧から選ぶと地図が連動します。"
        actions={
          <Button
            onClick={() => geocodeMutation.mutate()}
            disabled={geocodeMutation.isPending}
            variant={missingCount > 0 ? "default" : "outline"}
            className={missingCount === 0 ? "bg-background" : ""}
          >
            {geocodeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            位置情報を取得
            {missingCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px]">
                {missingCount}
              </span>
            )}
          </Button>
        }
      />

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">緊急度の凡例:</span>
        {(["S", "A", "B", "C"] as const).map((u) => (
          <span key={u} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full border border-white shadow"
              style={{ background: URGENCY_PIN[u] }}
            />
            {u}（{URGENCY_LABEL[u]}）
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* 左：フィルタ＋一覧 */}
        <div className="space-y-3 order-2 lg:order-1">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="店舗名・依頼番号・住所で検索"
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
                  <SelectValue placeholder="緊急度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">緊急度: 全て</SelectItem>
                  <SelectItem value="S">S 緊急</SelectItem>
                  <SelectItem value="A">A 高</SelectItem>
                  <SelectItem value="B">B 中</SelectItem>
                  <SelectItem value="C">C 低</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue placeholder="進捗" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">進捗: 全て</SelectItem>
                  <SelectItem value="未対応">未対応</SelectItem>
                  <SelectItem value="現調済">現調済</SelectItem>
                  <SelectItem value="見積提出済">見積提出済</SelectItem>
                  <SelectItem value="承認済">承認済</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center justify-between px-0.5">
            <span>
              地図表示 <span className="font-semibold text-foreground">{located.length}</span> 件
            </span>
            {unlocated.length > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                位置未取得 {unlocated.length} 件
              </span>
            )}
          </div>

          <div className="border rounded-lg divide-y max-h-[560px] overflow-y-auto bg-card">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                読み込み中...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <MapPin className="h-8 w-8 mx-auto text-muted-foreground/70 mb-2" />
                <p className="text-sm font-medium text-foreground">
                  該当する案件がありません
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  検索条件を変えてお試しください。
                </p>
              </div>
            ) : (
              filtered.map((c) => {
                const hasLoc = !!(c.latitude && c.longitude);
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => focusCase(c)}
                    className={`w-full text-left px-3 py-2.5 transition-colors flex items-start gap-2.5 ${
                      active ? "bg-primary/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <span
                      className="mt-0.5 inline-flex h-6 min-w-6 px-1 items-center justify-center rounded text-[11px] font-bold shrink-0"
                      style={{
                        background: URGENCY_PIN[c.urgency] ?? "#64748b",
                        color: "#fff",
                      }}
                    >
                      {c.urgency}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">
                          {c.storeName}
                        </span>
                        {!hasLoc && (
                          <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                        )}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {c.requestNumber} ・ {c.address || "住所未登録"}
                      </span>
                      <span className="mt-1 inline-flex">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            STAGE_BADGE[c.progressStage] ?? ""
                          }`}
                        >
                          {c.progressStage}
                        </Badge>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 右：地図 */}
        <div className="order-1 lg:order-2 space-y-3">
          <div className="rounded-lg overflow-hidden border">
            <MapView
              initialCenter={JAPAN_CENTER}
              initialZoom={5}
              className="h-[480px] lg:h-[620px]"
              onMapReady={(map) => {
                mapRef.current = map;
                setMapReady(true);
              }}
            />
          </div>

          {selectedId !== null && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/cases/${selectedId}`)}
                className="bg-background"
              >
                選択中の案件を開く
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
