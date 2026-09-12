/**
 * 推進ロジック（v12）
 *
 * 案件を「次にやるべき訪問」に変換し、優先度（緊急度→進捗→滞留→近接）で並べ
 * 2チームに均等配分し、同日近接案件を1ツアーにまとめる。
 */

export type UrgencyLevel = "S" | "A" | "B" | "C";
export type ProgressStage = "未対応" | "現調済" | "見積提出済" | "承認済";
export type CaseStatus =
  | "受付"
  | "現調中"
  | "見積中"
  | "施工待ち"
  | "施工中"
  | "完了"
  | "クローズ"
  | "失注";
export type TaskType = "survey" | "construction";
export type Team = "A" | "B";

export interface PlannerCase {
  id: number;
  requestNumber: string;
  storeName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  urgency: UrgencyLevel;
  progressStage: ProgressStage;
  status: CaseStatus;
  requestDate: Date | null;
  surveyDate: Date | null;
  constructionDate: Date | null;
}

export interface PlannerTask {
  caseId: number;
  requestNumber: string;
  storeName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  taskType: TaskType;
  urgency: UrgencyLevel;
  progressStage: ProgressStage;
  staleDays: number; // 滞留日数（依頼日 or 最終更新からの経過）
  priorityScore: number; // 数値が大きいほど優先
  reason: string; // 「次のアクション」の説明
}

const URGENCY_WEIGHT: Record<UrgencyLevel, number> = {
  S: 1000,
  A: 500,
  B: 100,
  C: 10,
};

const STAGE_WEIGHT: Record<ProgressStage, number> = {
  未対応: 80, // 早く現調を入れたい
  承認済: 70, // 工事を入れる必要がある
  現調済: 50, // 見積提出を促す
  見積提出済: 5, // 通常は訪問不要
};

/**
 * 案件 → 次にやるべきタスクへ変換
 * 戻り値が null の場合は「現在訪問の必要なし」（見積提出済の承認待ちなど）
 */
export function deriveNextTask(c: PlannerCase, today: Date): PlannerTask | null {
  if (c.status === "完了" || c.status === "クローズ" || c.status === "失注") return null;

  let taskType: TaskType;
  let reason: string;
  switch (c.progressStage) {
    case "未対応":
      taskType = "survey";
      reason = "現調未実施 → 現場調査を実施";
      break;
    case "現調済":
      // 現調は終わっているが見積未提出。状況により再訪が必要なケースのみタスク化
      taskType = "survey";
      reason = "現調済 → 必要なら再訪して見積へ";
      break;
    case "見積提出済":
      // 承認待ち。基本訪問不要なので除外
      return null;
    case "承認済":
      taskType = "construction";
      reason = "承認済 → 工事を実施";
      break;
    default:
      return null;
  }

  // 滞留日数：基準日（依頼日 > 現調日 > 施工日）からの経過日数
  const baseDate =
    c.progressStage === "承認済"
      ? c.surveyDate ?? c.requestDate
      : c.requestDate;
  const staleDays = baseDate
    ? Math.max(0, Math.floor((+today - +new Date(baseDate)) / (24 * 60 * 60 * 1000)))
    : 0;

  // スコア = 緊急度 + ステージ重み + 滞留ボーナス（上限60、1日=2pt）
  const staleBonus = Math.min(60, staleDays * 2);
  const priorityScore =
    URGENCY_WEIGHT[c.urgency] + STAGE_WEIGHT[c.progressStage] + staleBonus;

  return {
    caseId: c.id,
    requestNumber: c.requestNumber,
    storeName: c.storeName,
    address: c.address,
    latitude: c.latitude,
    longitude: c.longitude,
    taskType,
    urgency: c.urgency,
    progressStage: c.progressStage,
    staleDays,
    priorityScore,
    reason,
  };
}

/**
 * 推進タスクを2チームへ均等配分
 *
 * 配分ルール:
 *  1) 高優先（緊急S/A）から交互に配る（A→B→A→B...）
 *  2) その他案件も交互
 *  3) 各チーム内で重心点（平均緯度経度）を計算し、同日近接ツアーを構成
 */
export function distributeToTeams(tasks: PlannerTask[]): {
  teamA: PlannerTask[];
  teamB: PlannerTask[];
} {
  const sorted = tasks.slice().sort((a, b) => b.priorityScore - a.priorityScore);
  const teamA: PlannerTask[] = [];
  const teamB: PlannerTask[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i % 2 === 0) teamA.push(sorted[i]);
    else teamB.push(sorted[i]);
  }
  return { teamA, teamB };
}

/**
 * Haversine距離（km）
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 最近傍法（nearest neighbor）で訪問順を最適化
 * 起点は配列の先頭タスク（優先度最大）
 */
export function nearestNeighborOrder(tasks: PlannerTask[]): PlannerTask[] {
  if (tasks.length <= 1) return tasks.slice();

  const withCoords = tasks.filter((t) => t.latitude != null && t.longitude != null);
  const withoutCoords = tasks.filter((t) => t.latitude == null || t.longitude == null);

  if (withCoords.length === 0) return tasks.slice();

  const ordered: PlannerTask[] = [withCoords[0]];
  const remaining = withCoords.slice(1);
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(
        { lat: last.latitude!, lng: last.longitude! },
        { lat: remaining[i].latitude!, lng: remaining[i].longitude! }
      );
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    ordered.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }
  // 緯度経度なしは末尾に追加
  return ordered.concat(withoutCoords);
}

/**
 * 1日あたりの訪問数上限
 */
export const MAX_VISITS_PER_DAY = 4;

/**
 * 日付スケジューリング: チームのタスク列を翌営業日から1日 MAX_VISITS_PER_DAY 件ずつ詰める
 *
 * 緊急S/A は最も近い日に集中させ、Bは2日目以降、Cは余裕枠に配置
 */
export interface ScheduledTask extends PlannerTask {
  team: Team;
  scheduledDate: string; // YYYY-MM-DD
  sequence: number; // その日その担当の訪問順 0-based
}

export function fmtYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nextWeekday(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  // 土日を回避
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function scheduleTeam(
  team: Team,
  tasks: PlannerTask[],
  startDate: Date
): ScheduledTask[] {
  // 訪問順最適化（近接）
  const ordered = nearestNeighborOrder(tasks);
  const result: ScheduledTask[] = [];
  let cursor = new Date(startDate);
  // 開始日が土日なら次営業日へ
  if (cursor.getDay() === 0 || cursor.getDay() === 6) cursor = nextWeekday(cursor);

  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i];
    const dayIdx = Math.floor(i / MAX_VISITS_PER_DAY);
    const seq = i % MAX_VISITS_PER_DAY;
    let d = new Date(startDate);
    if (d.getDay() === 0 || d.getDay() === 6) d = nextWeekday(d);
    for (let j = 0; j < dayIdx; j++) d = nextWeekday(d);
    result.push({
      ...t,
      team,
      scheduledDate: fmtYmd(d),
      sequence: seq,
    });
  }
  return result;
}

/**
 * 全体プランを生成
 */
export function buildSchedule(
  cases_: PlannerCase[],
  today: Date
): { teamA: ScheduledTask[]; teamB: ScheduledTask[] } {
  const tasks = cases_
    .map((c) => deriveNextTask(c, today))
    .filter((t): t is PlannerTask => t !== null);

  const { teamA, teamB } = distributeToTeams(tasks);
  // 開始日 = 翌営業日
  const startDate = nextWeekday(today);
  return {
    teamA: scheduleTeam("A", teamA, startDate),
    teamB: scheduleTeam("B", teamB, startDate),
  };
}
