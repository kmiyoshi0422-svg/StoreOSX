/**
 * 進捗ステージ（フォルダ分け用）とステータス（業務状態）の連動ロジック。
 *
 * 進捗ステージ: 未対応 → 現調済 → 見積提出済 → 承認済（営業/事務視点の大きな節目）
 * ステータス  : 受付 → 現調中 → 見積中 → 施工待ち → 施工中 → 完了 → クローズ（作業の細かい状態）
 *
 * 連動方針:
 * - ステージは「どこまで完了したか」、ステータスは「今どの作業中か」を表すため厳密な1:1ではない。
 * - そこで「ステージが進んだら、その節目に対応する最低限のステータスまで前進させる」
 *   「ステータスが進んだら、対応するステージまで前進させる」という前進専用（逆行しない）連動とする。
 * - 既に先に進んでいる側は巻き戻さない（手動で設定した先行状態を尊重）。
 */

export const PROGRESS_STAGES = ["未対応", "現調済", "見積提出済", "承認済"] as const;
export type ProgressStage = (typeof PROGRESS_STAGES)[number];

export const CASE_STATUSES = [
  "受付",
  "現調中",
  "見積中",
  "施工待ち",
  "施工中",
  "完了",
  "クローズ",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

const STAGE_ORDER: Record<ProgressStage, number> = {
  未対応: 0,
  現調済: 1,
  見積提出済: 2,
  承認済: 3,
};

const STATUS_ORDER: Record<CaseStatus, number> = {
  受付: 0,
  現調中: 1,
  見積中: 2,
  施工待ち: 3,
  施工中: 4,
  完了: 5,
  クローズ: 6,
};

/**
 * 進捗ステージから「対応する最低限のステータス」を求める。
 * - 未対応      → 受付（まだ動いていない）
 * - 現調済      → 見積中（現地調査が終わり見積作成フェーズ）
 * - 見積提出済  → 施工待ち（見積を出し承認・着工待ち）
 * - 承認済      → 施工待ち（承認されたが施工開始は別途ステータスで管理）
 */
export function stageToStatus(stage: ProgressStage): CaseStatus {
  switch (stage) {
    case "未対応":
      return "受付";
    case "現調済":
      return "見積中";
    case "見積提出済":
      return "施工待ち";
    case "承認済":
      return "施工待ち";
  }
}

/**
 * ステータスから「対応する進捗ステージ」を求める。
 * - 受付              → 未対応
 * - 現調中            → 未対応（現地調査に着手しただけでは「現調済」にしない）
 * - 見積中            → 現調済（見積フェーズ＝現調は完了している）
 * - 施工待ち/施工中    → 見積提出済（見積を出して着工段階）
 * - 完了/クローズ      → 承認済（最終的に承認・完了済み）
 */
export function statusToStage(status: CaseStatus): ProgressStage {
  switch (status) {
    case "受付":
    case "現調中":
      return "未対応";
    case "見積中":
      return "現調済";
    case "施工待ち":
    case "施工中":
      return "見積提出済";
    case "完了":
    case "クローズ":
      return "承認済";
  }
}

/**
 * ステージが変更された場合に、必要ならステータスを前進させた結果を返す。
 * 逆行はしない（現在のステータスが既に対応値より進んでいればそのまま）。
 */
export function syncStatusFromStage(
  stage: ProgressStage,
  currentStatus: CaseStatus,
): CaseStatus {
  const target = stageToStatus(stage);
  return STATUS_ORDER[target] > STATUS_ORDER[currentStatus] ? target : currentStatus;
}

/**
 * ステータスが変更された場合に、必要ならステージを前進させた結果を返す。
 * 逆行はしない。
 */
export function syncStageFromStatus(
  status: CaseStatus,
  currentStage: ProgressStage,
): ProgressStage {
  const target = statusToStage(status);
  return STAGE_ORDER[target] > STAGE_ORDER[currentStage] ? target : currentStage;
}

export interface StageStatusPair {
  progressStage: ProgressStage;
  status: CaseStatus;
}

/**
 * 案件更新時の連動解決。
 * - nextStage / nextStatus は今回ユーザーが明示的に指定した値（未指定は undefined）。
 * - current は更新前の値。
 * - 片方だけ変更された場合、もう片方を前進専用で追従させる。
 * - 両方明示指定された場合はユーザー入力をそのまま尊重（連動しない）。
 */
export function resolveStageStatus(args: {
  currentStage: ProgressStage;
  currentStatus: CaseStatus;
  nextStage?: ProgressStage;
  nextStatus?: CaseStatus;
}): StageStatusPair {
  const { currentStage, currentStatus, nextStage, nextStatus } = args;

  const stageChanged = nextStage != null && nextStage !== currentStage;
  const statusChanged = nextStatus != null && nextStatus !== currentStatus;

  // 両方指定されている場合はそのまま採用（明示優先）
  if (nextStage != null && nextStatus != null) {
    return { progressStage: nextStage, status: nextStatus };
  }

  // ステージのみ変更 → ステータスを追従
  if (stageChanged && nextStatus == null) {
    const stage = nextStage as ProgressStage;
    return { progressStage: stage, status: syncStatusFromStage(stage, currentStatus) };
  }

  // ステータスのみ変更 → ステージを追従
  if (statusChanged && nextStage == null) {
    const status = nextStatus as CaseStatus;
    return { progressStage: syncStageFromStatus(status, currentStage), status };
  }

  // 変更なし、あるいは指定された値が現状と同じ場合は現状維持（明示指定があればそれを採用）
  return {
    progressStage: nextStage ?? currentStage,
    status: nextStatus ?? currentStatus,
  };
}
