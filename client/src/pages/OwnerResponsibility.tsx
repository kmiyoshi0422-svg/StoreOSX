import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

type RosterMember = {
  key: string;
  name: string;
  userId: number | null;
  userIds: number[];
  eligible: boolean;
};

type RosterCandidate = {
  id: number;
  name: string;
  email: string | null;
  role: string;
};

type RosterManagement = {
  version: number;
  current: RosterMember[];
  candidates: RosterCandidate[];
  archived: Array<{ key: string; name: string }>;
  history: Array<{
    id: number;
    beforeJson: string;
    afterJson: string;
    reason: string;
    changedByName: string;
    changedAt: Date;
  }>;
};

type Selection = { userId: number | null; name: string };

type ReplacementInput = {
  expectedVersion: number;
  members: number[];
  reason: string;
};

// Capture the payload AND its display labels once. Live query updates must not
// change the operation being confirmed. Only returning to the form discards it.
type Confirmation = Readonly<{
  input: Readonly<{
    expectedVersion: number;
    members: readonly number[];
    reason: string;
  }>;
  comparisons: readonly Readonly<{
    beforeName: string;
    afterName: string;
    afterEmail: string | null;
    changed: boolean;
  }>[];
}>;

const ROSTER_SIZE = 5;
const UNSELECTED = "unselected";
const ROLE_LABELS: Record<string, string> = {
  owner: "最高管理者",
  admin: "管理者",
  executive: "役員",
  user: "社員",
  partner: "協力業者",
  customer: "顧客",
};

function displayName(name: string) {
  return name.trim() || "名称未設定";
}

function selectionsFromCurrent(current: RosterMember[]): Selection[] {
  return Array.from({ length: ROSTER_SIZE }, (_, index) => ({
    userId: current[index]?.userId ?? null,
    name: current[index]?.name ?? "未設定",
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// History is a config object { version, current, archived }, not a members array.
// Read only current names; never expose the raw JSON or internal member keys.
function historyNames(json: string): string[] | null {
  try {
    const config: unknown = JSON.parse(json);
    if (!isRecord(config) || !Array.isArray(config.current)) return null;
    const members: unknown[] = config.current;
    const names: string[] = [];
    for (const member of members) {
      if (!isRecord(member) || typeof member.name !== "string") return null;
      names.push(displayName(member.name));
    }
    return names;
  } catch {
    return null;
  }
}

function formatDate(value: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistoryNames({ label, json }: { label: string; json: string }) {
  const names = historyNames(json);
  return (
    <div className="min-w-0 space-y-2 rounded-lg bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {names === null ? (
        <p className="text-xs text-muted-foreground">
          履歴の名前を読み取れませんでした。
        </p>
      ) : names.length === 0 ? (
        <p className="text-xs text-muted-foreground">責任者の記録なし</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {names.map((name, index) => (
            <li key={index} className="break-words [overflow-wrap:anywhere]">
              <span className="mr-2 text-xs tabular-nums text-muted-foreground">
                {index + 1}.
              </span>
              {name}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** App.tsx supplies DashboardLayout; do not mount another layout here. */
export default function OwnerResponsibility() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" /> 権限を確認しています…
      </div>
    );
  }

  if (user?.role !== "owner") {
    return (
      <Card className="mx-auto max-w-2xl border-destructive/30">
        <CardContent className="space-y-3 p-6">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 shrink-0 text-destructive" />{" "}
            アクセスできません
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            案件責任者5名を入れ替えられるのは最高管理者（オーナー）だけです。この画面を表示する権限がありません。
          </p>
          <Button asChild variant="outline">
            <Link href="/">ダッシュボードへ戻る</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Do not mount management queries or mutations for a non-owner.
  return <OwnerResponsibilityContent />;
}

function OwnerResponsibilityContent() {
  const utils = trpc.useUtils();
  const rosterQuery = trpc.responsibility.rosterManagement.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const replaceMutation = trpc.responsibility.replaceRoster.useMutation({
    retry: false,
  });
  const roster: RosterManagement | undefined = rosterQuery.data;

  const [selections, setSelections] = useState<Selection[] | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const inFlightRef = useRef(false);
  const confirmationRef = useRef<Confirmation | null>(null);

  const busy = submitting || replaceMutation.isPending;
  const locked =
    busy ||
    confirmation !== null ||
    rosterQuery.isFetching ||
    savedVersion !== null;
  const candidates = roster?.candidates ?? [];
  const selectedIds = (selections ?? []).map(selection => selection.userId);
  const memberIds = selectedIds.filter((id): id is number => id !== null);
  const reasonLength = reason.trim().length;
  const allSelected = memberIds.length === ROSTER_SIZE;
  const distinct = new Set(memberIds).size === memberIds.length;
  const eligible =
    allSelected &&
    memberIds.every(id => candidates.some(candidate => candidate.id === id));
  const rosterValid = roster?.current.length === ROSTER_SIZE;
  const formValid =
    rosterValid &&
    allSelected &&
    distinct &&
    eligible &&
    reasonLength > 0 &&
    reasonLength <= 500;
  const canConfirm =
    formValid &&
    !locked &&
    !rosterQuery.isError &&
    !refreshError &&
    Boolean(roster);

  useEffect(() => {
    if (!roster) return;
    // Initialize exactly once. Refetches (especially after errors/conflicts) must
    // keep the user's selections and reason. Only a verified successful save resets.
    if (
      selections === null ||
      (savedVersion !== null &&
        roster.version >= savedVersion &&
        !busy &&
        !confirmation)
    ) {
      setSelections(selectionsFromCurrent(roster.current));
      if (savedVersion !== null) {
        setReason("");
        setSavedVersion(null);
      }
    }
  }, [roster, selections, savedVersion, busy, confirmation]);

  async function refreshRoster() {
    if (
      busy ||
      inFlightRef.current ||
      confirmationRef.current ||
      rosterQuery.isFetching
    )
      return;
    setRefreshError(null);
    try {
      await rosterQuery.refetch({ throwOnError: true });
    } catch {
      setRefreshError(
        "最新の責任者一覧を取得できませんでした。入力は保持しています。一覧を更新してから再確認してください。"
      );
    }
  }

  function changeSelection(index: number, value: string) {
    if (locked || inFlightRef.current || confirmationRef.current) return;
    if (value === UNSELECTED) {
      setSelections(
        current =>
          current?.map((selection, position) =>
            position === index ? { userId: null, name: "未選択" } : selection
          ) ?? null
      );
      return;
    }
    const candidate = candidates.find(person => String(person.id) === value);
    if (
      !candidate ||
      selectedIds.some(
        (id, position) => position !== index && id === candidate.id
      )
    )
      return;
    setSelections(
      current =>
        current?.map((selection, position) =>
          position === index
            ? { userId: candidate.id, name: candidate.name }
            : selection
        ) ?? null
    );
  }

  function requestConfirmation() {
    if (
      !canConfirm ||
      !roster ||
      !selections ||
      inFlightRef.current ||
      confirmationRef.current
    )
      return;
    const chosen = selections.map(selection =>
      candidates.find(candidate => candidate.id === selection.userId)
    );
    if (chosen.some(candidate => !candidate)) return;
    const snapshot: Confirmation = Object.freeze({
      input: Object.freeze({
        expectedVersion: roster.version,
        members: Object.freeze([...memberIds]),
        reason: reason.trim(),
      }),
      comparisons: Object.freeze(
        selections.map((selection, index) => {
          const candidate = chosen[index];
          return Object.freeze({
            beforeName: displayName(roster.current[index]?.name ?? "未設定"),
            afterName: displayName(candidate?.name ?? selection.name),
            afterEmail: candidate?.email ?? null,
            changed: roster.current[index]?.userId !== selection.userId,
          });
        })
      ),
    });
    confirmationRef.current = snapshot;
    setConfirmation(snapshot);
    setAttempted(false);
    setSubmitError(null);
  }

  function returnToForm() {
    if (busy || inFlightRef.current) return;
    confirmationRef.current = null;
    setConfirmation(null);
    // Preserve all input and any error, and require a new confirmation for retry.
  }

  async function executeConfirmed() {
    const snapshot = confirmationRef.current;
    if (!snapshot || busy || inFlightRef.current || attempted) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setAttempted(true);
    setSubmitError(null);
    setRefreshError(null);
    let succeeded = false;

    try {
      // Copy only the frozen snapshot into the mutable API input type. Never
      // rebuild this payload from the current form or a refreshed query.
      const input: ReplacementInput = {
        expectedVersion: snapshot.input.expectedVersion,
        members: [...snapshot.input.members],
        reason: snapshot.input.reason,
      };
      const result = await replaceMutation.mutateAsync(input);
      succeeded = true;
      setSavedVersion(result.version);
      confirmationRef.current = null;
      setConfirmation(null);
      toast.success(
        "案件責任者5名を更新しました。既存案件・ログイン・金額権限は変更していません。"
      );
    } catch (error: unknown) {
      const conflict =
        isRecord(error) &&
        isRecord(error.data) &&
        error.data.code === "CONFLICT";
      const detail =
        error instanceof Error ? error.message : "処理を完了できませんでした。";
      setSubmitError(
        conflict
          ? `他の操作と競合しました。${detail} 入力は保持しています。最新一覧を確認し、入力に戻ってもう一度確認してください。`
          : `保存できませんでした。${detail} 入力は保持しています。通信エラーの場合は保存済みの可能性もあるため、最新一覧・履歴を確認してから再操作してください。`
      );
      toast.error(
        conflict
          ? "変更が競合しました。最新の一覧を確認してください。"
          : "保存結果を確認できませんでした。入力は保持しています。"
      );
    } finally {
      // Refresh on BOTH success and failure: an ambiguous response may hide a
      // completed operation. Wait for refresh before allowing another attempt.
      const invalidations = await Promise.allSettled([
        utils.responsibility.invalidate(),
        utils.cases.invalidate(),
      ]);
      let refreshFailed = invalidations.some(
        result => result.status === "rejected"
      );
      try {
        await rosterQuery.refetch({ throwOnError: true });
      } catch {
        refreshFailed = true;
      }
      if (refreshFailed) {
        setRefreshError(
          succeeded
            ? "保存は完了しましたが、最新データの再取得に失敗しました。一覧を更新してください。"
            : "最新データの再取得に失敗しました。入力は保持しています。一覧を更新してから再確認してください。"
        );
        toast.warning(
          "最新データを取得できませんでした。一覧を更新してください。"
        );
      }
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div
      className="mx-auto min-w-0 max-w-6xl space-y-5"
      aria-label="案件責任者5名の入替管理"
    >
      <PageHeader
        eyebrow="OWNER CONTROL"
        title="案件責任者の入替"
        icon={<Users className="h-6 w-6 shrink-0 text-primary" />}
        description="案件責任者の構成を、在籍中の候補から5名選んで更新します。現在の5名全員を変更できます。"
        actions={
          <Button
            type="button"
            variant="outline"
            className="bg-background"
            onClick={() => void refreshRoster()}
            disabled={busy || confirmation !== null || rosterQuery.isFetching}
          >
            <RefreshCw
              className={`mr-1.5 h-4 w-4 ${rosterQuery.isFetching ? "animate-spin" : ""}`}
            />
            {rosterQuery.isFetching ? "更新中…" : "一覧を更新"}
          </Button>
        }
      />

      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="flex items-start gap-3 p-4 text-sm leading-relaxed text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0 space-y-2">
            <p className="font-semibold">
              責任者一覧の変更と、案件の引継ぎは別の操作です
            </p>
            <p>
              現在の5名は全員、別の在籍候補に変更できます。既存の責任者案件や過去の担当履歴は自動で付け替え・解除・削除しません。必要な案件の引継ぎは別途行ってください。
            </p>
            <p>
              責任者を入れ替えても、ログイン可否や利用者区分、金額・利益の閲覧権限は自動変更しません。
            </p>
          </div>
        </CardContent>
      </Card>

      {rosterQuery.isError && (
        <Card className="border-destructive/40">
          <CardContent className="space-y-2 p-4 text-sm" role="alert">
            <p className="font-semibold text-destructive">
              責任者一覧を取得できませんでした。
            </p>
            <p className="break-words">{rosterQuery.error?.message}</p>
            <p className="text-muted-foreground">
              入力済みの内容は保持しています。「一覧を更新」で再取得してください。
            </p>
          </CardContent>
        </Card>
      )}
      {refreshError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {refreshError}
        </p>
      )}
      {submitError && (
        <p
          role="alert"
          className="break-words rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {submitError}
        </p>
      )}
      {savedVersion !== null && (
        <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
          保存は完了しています。最新の構成を確認するまで再保存できません。
        </p>
      )}

      {rosterQuery.isLoading || !selections ? (
        !rosterQuery.isError && (
          <Card>
            <CardContent
              className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin" />{" "}
              責任者と在籍候補を読み込んでいます…
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">新しい責任者5名を選択</CardTitle>
              <Badge variant="outline">{memberIds.length} / 5名 選択中</Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              他の欄で選択中の候補は選べません。現在の5名同士を入れ替える場合は、一度「未選択」に戻してから選択してください。
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {!rosterValid && (
              <p role="alert" className="text-sm text-destructive">
                現在の構成が5名ではないため保存できません。最高管理者向けの設定を確認してください。
              </p>
            )}
            {candidates.length < ROSTER_SIZE && (
              <p role="alert" className="text-sm text-destructive">
                在籍候補が5名未満のため保存できません。社員の在籍状態を確認してください。
              </p>
            )}
            <fieldset disabled={locked} className="min-w-0 space-y-5">
              <legend className="sr-only">変更後の案件責任者と変更理由</legend>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {selections.map((selection, index) => {
                  const current = roster?.current[index];
                  const candidate = candidates.find(
                    person => person.id === selection.userId
                  );
                  const invalidCandidate =
                    selection.userId !== null && !candidate;
                  const duplicate =
                    selection.userId !== null &&
                    selectedIds.some(
                      (id, position) =>
                        position !== index && id === selection.userId
                    );
                  const label = `responsibility-member-${index}`;
                  return (
                    <div
                      key={index}
                      className="min-w-0 space-y-3 rounded-xl border bg-muted/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            現在の責任者 {index + 1}
                          </p>
                          <p className="mt-1 break-words font-semibold [overflow-wrap:anywhere]">
                            {displayName(current?.name ?? "未設定")}
                          </p>
                        </div>
                        {current && !current.eligible && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px]"
                          >
                            要入替
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2 border-t pt-3">
                        <Label htmlFor={label}>
                          新しい責任者 {index + 1}{" "}
                          <span className="text-destructive">（必須）</span>
                        </Label>
                        <Select
                          value={
                            selection.userId === null
                              ? UNSELECTED
                              : String(selection.userId)
                          }
                          disabled={locked}
                          onValueChange={value => changeSelection(index, value)}
                        >
                          <SelectTrigger
                            id={label}
                            className="h-11 w-full min-w-0 bg-background"
                            aria-invalid={invalidCandidate || duplicate}
                            aria-describedby={`${label}-hint`}
                          >
                            <SelectValue placeholder="在籍候補を選択" />
                          </SelectTrigger>
                          <SelectContent className="max-w-[calc(100vw-2rem)]">
                            <SelectItem value={UNSELECTED}>
                              未選択（選択を解除）
                            </SelectItem>
                            {invalidCandidate && (
                              <SelectItem
                                value={String(selection.userId)}
                                disabled
                              >
                                {displayName(selection.name)}（在籍候補外）
                              </SelectItem>
                            )}
                            {candidates.map(person => (
                              <SelectItem
                                key={person.id}
                                value={String(person.id)}
                                disabled={selectedIds.some(
                                  (id, position) =>
                                    position !== index && id === person.id
                                )}
                                textValue={`${displayName(person.name)} ${person.email ?? ""}`}
                              >
                                <span className="min-w-0 break-words whitespace-normal">
                                  {displayName(person.name)}
                                  {person.email ? `（${person.email}）` : ""}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p
                          id={`${label}-hint`}
                          className={`break-words text-xs leading-relaxed ${invalidCandidate || duplicate ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {duplicate
                            ? "別の欄と重複しています。異なる5名を選択してください。"
                            : invalidCandidate
                              ? "この方は現在の在籍候補に含まれません。別の候補を選択してください。"
                              : candidate
                                ? `${ROLE_LABELS[candidate.role] ?? "利用者"} ／ ${candidate.email || "メールアドレス未設定"}`
                                : "在籍中の候補から選んでください。"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsibility-reason">
                  変更理由 <span className="text-destructive">（必須）</span>
                </Label>
                <Textarea
                  id="responsibility-reason"
                  value={reason}
                  disabled={locked}
                  onChange={event => {
                    if (
                      !locked &&
                      !inFlightRef.current &&
                      !confirmationRef.current
                    )
                      setReason(event.target.value);
                  }}
                  rows={3}
                  maxLength={500}
                  required
                  placeholder="例：人事異動に伴い、新規案件の責任者体制を見直すため"
                  aria-describedby="responsibility-reason-hint"
                />
                <p
                  id="responsibility-reason-hint"
                  className="text-xs text-muted-foreground"
                >
                  前後の空白を除いた理由が必須です。500文字以内（現在{" "}
                  {reasonLength}文字）
                </p>
              </div>
            </fieldset>
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-muted-foreground">
                在籍候補から異なる5名を選び、理由を入力すると確認に進めます。確認だけでは保存されません。
              </p>
              <Button
                type="button"
                className="h-11 w-full shrink-0 sm:w-auto"
                onClick={requestConfirmation}
                disabled={!canConfirm}
              >
                内容を確認 <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {roster && roster.archived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">過去の責任者</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              過去の責任者の記録は保持されています。既存案件の担当を新しい責任者へ自動で移すことはありません。
            </p>
            <div className="flex flex-wrap gap-2">
              {roster.archived.map((member, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="max-w-full break-words whitespace-normal"
                >
                  {displayName(member.name)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {roster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-muted-foreground" /> 入替履歴
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roster.history.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">
                責任者の入替履歴はまだありません。
              </p>
            ) : (
              <div className="space-y-4">
                {roster.history.map(entry => (
                  <article
                    key={entry.id}
                    className="min-w-0 space-y-3 rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <time>{formatDate(entry.changedAt)}</time>
                      <span className="break-words">
                        変更者：{displayName(entry.changedByName)}
                      </span>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <HistoryNames
                        label="変更前の責任者"
                        json={entry.beforeJson}
                      />
                      <HistoryNames
                        label="変更後の責任者"
                        json={entry.afterJson}
                      />
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-xs text-muted-foreground">変更理由</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                        {entry.reason}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={confirmation !== null}
        onOpenChange={open => {
          if (!open) returnToForm();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"
          showCloseButton={false}
          onEscapeKeyDown={event => {
            if (busy || inFlightRef.current) event.preventDefault();
          }}
          onInteractOutside={event => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>この5名で案件責任者を更新しますか？</DialogTitle>
            <DialogDescription>
              現在と新しい責任者の名前を確認してください。確認開始時の内容を固定しています。修正する場合は「入力に戻る」を選んでください。
            </DialogDescription>
          </DialogHeader>
          {confirmation && (
            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                {confirmation.comparisons.map((comparison, index) => (
                  <div key={index} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>責任者 {index + 1}</span>
                      <Badge
                        variant={comparison.changed ? "outline" : "secondary"}
                      >
                        {comparison.changed ? "変更" : "継続"}
                      </Badge>
                    </div>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="mb-1 text-xs text-muted-foreground">
                          現在
                        </p>
                        <p className="break-words [overflow-wrap:anywhere]">
                          {comparison.beforeName}
                        </p>
                      </div>
                      <ArrowRight
                        className="mt-5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="mb-1 text-xs text-muted-foreground">
                          新しい責任者
                        </p>
                        <p className="break-words font-semibold [overflow-wrap:anywhere]">
                          {comparison.afterName}
                        </p>
                        {comparison.afterEmail && (
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {comparison.afterEmail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">変更理由</p>
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {confirmation.input.reason}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                既存の責任者案件・担当履歴は保持し、担当を自動で付け替えません。ログイン可否・利用者区分・金額権限も自動変更しません。
              </div>
              {submitError && (
                <p
                  role="alert"
                  className="break-words rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {submitError}
                </p>
              )}
              {refreshError && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {refreshError}
                </p>
              )}
              {attempted && !busy && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  この確認内容は再送信できません。「入力に戻る」から、最新一覧を確認して再度確認してください。
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-background"
              disabled={busy}
              onClick={returnToForm}
            >
              入力に戻る
            </Button>
            <Button
              type="button"
              className="h-11"
              disabled={!confirmation || busy || attempted}
              onClick={() => void executeConfirmed()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{" "}
                  保存・再取得中…
                </>
              ) : (
                "5名の入替を確定する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
