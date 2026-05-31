import { describe, it, expect } from "vitest";

// クライアント側の haversine と同じ実装をサーバーテストで検証する
// （フロントの ScheduleBoard.tsx と同一ロジック）
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function computeRouteDistance(
  items: Array<{ caseId: number }>,
  caseLatLng: Map<number, { lat: number | null; lng: number | null }>,
): { km: number; missing: number; usable: number } {
  const pts: Array<{ lat: number; lng: number }> = [];
  let missing = 0;
  for (const it of items) {
    const c = caseLatLng.get(it.caseId);
    if (c?.lat != null && c?.lng != null) pts.push({ lat: c.lat, lng: c.lng });
    else missing++;
  }
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    km += haversineKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  }
  return { km, missing, usable: pts.length };
}

describe("v15: 距離再計算ロジック", () => {
  it("同一地点のみなら距離は 0", () => {
    const map = new Map([[1, { lat: 35.6812, lng: 139.7671 }]]);
    const r = computeRouteDistance([{ caseId: 1 }], map);
    expect(r.km).toBe(0);
    expect(r.usable).toBe(1);
  });

  it("東京駅 → 横浜駅の距離はおよそ 27〜30km の範囲", () => {
    const map = new Map([
      [1, { lat: 35.6812, lng: 139.7671 }],
      [2, { lat: 35.4657, lng: 139.622 }],
    ]);
    const r = computeRouteDistance([{ caseId: 1 }, { caseId: 2 }], map);
    expect(r.km).toBeGreaterThan(25);
    expect(r.km).toBeLessThan(32);
    expect(r.missing).toBe(0);
  });

  it("ジオコード未済の案件はmissingとしてカウントされ距離計算からは除外される", () => {
    const map = new Map<number, { lat: number | null; lng: number | null }>([
      [1, { lat: 35.6812, lng: 139.7671 }],
      [2, { lat: null, lng: null }],
      [3, { lat: 35.4657, lng: 139.622 }],
    ]);
    const r = computeRouteDistance(
      [{ caseId: 1 }, { caseId: 2 }, { caseId: 3 }],
      map,
    );
    expect(r.usable).toBe(2);
    expect(r.missing).toBe(1);
    expect(r.km).toBeGreaterThan(25);
  });

  it("順序を反転しても合計距離は同じ（巡回経路の対称性）", () => {
    const map = new Map([
      [1, { lat: 35.6812, lng: 139.7671 }],
      [2, { lat: 35.4657, lng: 139.622 }],
      [3, { lat: 35.4437, lng: 139.638 }],
    ]);
    const fwd = computeRouteDistance(
      [{ caseId: 1 }, { caseId: 2 }, { caseId: 3 }],
      map,
    );
    const rev = computeRouteDistance(
      [{ caseId: 3 }, { caseId: 2 }, { caseId: 1 }],
      map,
    );
    expect(Math.abs(fwd.km - rev.km)).toBeLessThan(0.001);
  });

  it("対象0件・1件は距離=0だが usableは正しくカウントされる", () => {
    const map = new Map([[1, { lat: 35, lng: 139 }]]);
    expect(computeRouteDistance([], map).km).toBe(0);
    expect(computeRouteDistance([{ caseId: 1 }], map).km).toBe(0);
    expect(computeRouteDistance([{ caseId: 1 }], map).usable).toBe(1);
  });
});
