import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { PREFECTURES, type Prefecture } from "@shared/prefecture";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  History,
  Loader2,
  MapPinned,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

type StaffRole = "owner" | "admin" | "user" | "executive";
type RegistrationRole = Exclude<StaffRole, "owner">;
type AreaAccessMode = "all" | "selected";
type StaffTab = "active" | "pending" | "inactive";

type HistoryTarget = {
  kind: "user_lifecycle" | "staff_registration";
  targetId: number;
  name: string;
};

type StaffUser = {
  id: number;
  name: string | null;
  email: string | null;
  role: StaffRole;
  disabledAt: Date | null;
  activeCases: number;
  totalCases: number;
};

type StaffRegistration = {
  id: number;
  name: string;
  email: string;
  role: RegistrationRole;
  areaAccessMode: AreaAccessMode;
  allowedPrefectures: string | null;
  state: "pending" | "active" | "canceled";
  version: number;
  userId: number | null;
  createdAt: Date;
};

type RegisterInput = {
  name: string;
  email: string;
  role: RegistrationRole;
  areaAccessMode: AreaAccessMode;
  allowedPrefectures: Prefecture[];
  reason: string;
};

type UserStateInput = {
  userId: number;
  expectedDisabledAt: string | null;
  expectedRole: StaffRole;
  disabled: boolean;
  reason: string;
};

type RegistrationStateInput = {
  registrationId: number;
  expectedVersion: number;
  active: boolean;
  reason: string;
};

type RegistrationForm = Omit<RegisterInput, "allowedPrefectures"> & {
  allowedPrefectures: Prefecture[];
};

type ChangeEditor =
  | { kind: "user"; target: StaffUser; disabled: boolean }
  | { kind: "registration"; target: StaffRegistration; active: boolean };

type ChangeDetails = {
  title: string;
  action: string;
  targetName: string;
  targetEmail: string | null;
  targetId: string;
  previousState: string;
  nextState: string;
  role: StaffRole;
  area: string | null;
  counts: { active: number; total: number } | null;
  countsNote: string;
  impact: string;
  destructive: boolean;
};

// Payload and display details are captured together, not rebuilt from a live query
// or editable form while the final confirmation is open.
type Confirmation =
  | { kind: "register"; input: RegisterInput; details: ChangeDetails }
  | { kind: "user"; input: UserStateInput; details: ChangeDetails }
  | {
      kind: "registration";
      input: RegistrationStateInput;
      details: ChangeDetails;
    };

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "最高管理者",
  admin: "管理者",
  user: "社員",
  executive: "役員",
};

const ROLE_CLASSES: Record<StaffRole, string> = {
  owner: "border-amber-300 bg-amber-50 text-amber-950",
  admin: "border-violet-200 bg-violet-50 text-violet-900",
  user: "border-slate-200 bg-slate-50 text-slate-800",
  executive: "border-blue-200 bg-blue-50 text-blue-900",
};

function emptyRegistrationForm(): RegistrationForm {
  return {
    name: "",
    email: "",
    role: "user",
    areaAccessMode: "selected",
    allowedPrefectures: [],
    reason: "",
  };
}

function staffName(person: { name: string | null }) {
  return person.name?.trim() || "名称未設定";
}

function reasonValid(reason: string) {
  const length = reason.trim().length;
  return length >= 3 && length <= 500;
}

function isRegistrationRole(value: string): value is RegistrationRole {
  return value === "user" || value === "admin" || value === "executive";
}

function isStaffUser(
  person: Omit<StaffUser, "role"> & { role: string }
): person is StaffUser {
  return person.role === "owner" || isRegistrationRole(person.role);
}

function isStaffTab(value: string): value is StaffTab {
  return value === "active" || value === "pending" || value === "inactive";
}

function parsePrefectures(value: string | null): Prefecture[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Prefecture =>
        typeof item === "string" &&
        PREFECTURES.some(prefecture => prefecture === item)
    );
  } catch {
    return [];
  }
}

function areaText(mode: AreaAccessMode, prefectures: readonly string[]) {
  if (mode === "all") return "全エリア";
  return prefectures.length ? prefectures.join("、") : "選択エリア未設定";
}

function registrationArea(registration: StaffRegistration) {
  return registration.role === "admin"
    ? "全エリア"
    : areaText(
        registration.areaAccessMode,
        parsePrefectures(registration.allowedPrefectures)
      );
}

function roleImpact(role: RegistrationRole) {
  return role === "user"
    ? "社員は金額・利益を閲覧できません。"
    : "管理者・役員は金額を閲覧できますが、利益は閲覧できません。";
}

function formatDate(value: Date) {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReasonField({
  id,
  value,
  onChange,
  registration = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  registration?: boolean;
}) {
  const length = value.trim().length;
  const invalid = length > 0 && !reasonValid(value);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {registration ? "登録理由" : "変更理由"}{" "}
        <span className="text-destructive">（必須）</span>
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={3}
        required
        minLength={3}
        maxLength={500}
        aria-describedby={`${id}-hint`}
        aria-invalid={invalid}
        placeholder={
          registration
            ? "例：新入社員の受入れに伴う事前登録のため"
            : "例：退職に伴いログインを停止し、担当案件を引継ぎするため"
        }
        className="resize-y"
      />
      <p
        id={`${id}-hint`}
        className={`text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}
      >
        前後の空白を除いて3〜500文字（現在 {length}文字）
      </p>
    </div>
  );
}

function CaseCounts({ active, total }: { active: number; total: number }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg bg-primary/5 p-3">
        <p className="text-xs text-muted-foreground">対応中の担当案件</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">
          {active}
          <span className="ml-1 text-xs font-normal">件</span>
        </p>
      </div>
      <div className="rounded-lg bg-muted/70 p-3">
        <p className="text-xs text-muted-foreground">全担当案件（過去含む）</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">
          {total}
          <span className="ml-1 text-xs font-normal">件</span>
        </p>
      </div>
    </div>
  );
}

/** App.tsx already supplies DashboardLayout; do not nest a second sidebar here. */
export default function OwnerStaff() {
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
            社員の登録・退職・復帰を操作できるのは最高管理者（オーナー）だけです。この画面を表示する権限がありません。
          </p>
          <Button asChild variant="outline">
            <Link href="/">ダッシュボードへ戻る</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Owner-only hooks are mounted only after the authorization check.
  return <OwnerStaffContent currentUserId={user.id} />;
}

function OwnerStaffContent({ currentUserId }: { currentUserId: number }) {
  const utils = trpc.useUtils();
  const staffQuery = trpc.staffAdministration.list.useQuery(undefined, {
    retry: false,
  });
  const registerMutation = trpc.staffAdministration.register.useMutation({
    retry: false,
  });
  const userStateMutation = trpc.staffAdministration.setUserState.useMutation({
    retry: false,
  });
  const registrationStateMutation =
    trpc.staffAdministration.setRegistrationState.useMutation({ retry: false });

  const [tab, setTab] = useState<StaffTab>("active");
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registrationForm, setRegistrationForm] = useState<RegistrationForm>(
    emptyRegistrationForm
  );
  const [changeEditor, setChangeEditor] = useState<ChangeEditor | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const busy =
    submitting ||
    registerMutation.isPending ||
    userStateMutation.isPending ||
    registrationStateMutation.isPending;
  const users: StaffUser[] = (staffQuery.data?.users ?? []).filter(isStaffUser);
  const registrations: StaffRegistration[] =
    staffQuery.data?.registrations ?? [];

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ja-JP");
    const matches = (person: { name: string | null; email: string | null }) =>
      !keyword ||
      [person.name ?? "", person.email ?? ""]
        .join(" ")
        .toLocaleLowerCase("ja-JP")
        .includes(keyword);
    const allUsers: StaffUser[] = (staffQuery.data?.users ?? []).filter(
      isStaffUser
    );
    const allRegistrations: StaffRegistration[] =
      staffQuery.data?.registrations ?? [];
    return {
      active: allUsers.filter(
        person => person.disabledAt === null && matches(person)
      ),
      retired: allUsers.filter(
        person => person.disabledAt !== null && matches(person)
      ),
      pending: allRegistrations.filter(
        person => person.state === "pending" && matches(person)
      ),
      canceled: allRegistrations.filter(
        person => person.state === "canceled" && matches(person)
      ),
    };
  }, [staffQuery.data, search]);

  const totals = {
    active: users.filter(person => person.disabledAt === null).length,
    pending: registrations.filter(person => person.state === "pending").length,
    inactive:
      users.filter(person => person.disabledAt !== null).length +
      registrations.filter(person => person.state === "canceled").length,
  };
  const visibleCount =
    tab === "active"
      ? filtered.active.length
      : tab === "pending"
        ? filtered.pending.length
        : filtered.retired.length + filtered.canceled.length;
  const normalizedEmail = registrationForm.email.trim().toLowerCase();
  const existingUser = users.find(
    person => person.email?.trim().toLowerCase() === normalizedEmail
  );
  const existingRegistration = registrations.find(
    person => person.email.trim().toLowerCase() === normalizedEmail
  );
  const emailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) &&
    normalizedEmail.length <= 320;
  const formValid =
    registrationForm.name.trim().length >= 1 &&
    registrationForm.name.trim().length <= 128 &&
    emailValid &&
    !existingUser &&
    !existingRegistration &&
    reasonValid(registrationForm.reason) &&
    (registrationForm.role === "admin" ||
      registrationForm.areaAccessMode === "all" ||
      registrationForm.allowedPrefectures.length > 0);

  function openRegistration() {
    if (busy || inFlightRef.current) return;
    setRegistrationForm(emptyRegistrationForm());
    setSubmitError(null);
    setChangeEditor(null);
    setRegisterOpen(true);
  }

  function openUserChange(target: StaffUser) {
    if (
      busy ||
      inFlightRef.current ||
      target.role === "owner" ||
      target.id === currentUserId
    )
      return;
    setChangeEditor({
      kind: "user",
      target: { ...target },
      disabled: target.disabledAt === null,
    });
    setChangeReason("");
    setSubmitError(null);
  }

  function openRegistrationChange(target: StaffRegistration) {
    if (busy || inFlightRef.current || target.state === "active") return;
    setChangeEditor({
      kind: "registration",
      target: { ...target },
      active: target.state === "canceled",
    });
    setChangeReason("");
    setSubmitError(null);
  }

  function showConfirmation(snapshot: Confirmation) {
    if (busy || inFlightRef.current || confirmation) return;
    setSubmitError(null);
    setAttempted(false);
    setConfirmation(snapshot);
  }

  function confirmRegistration() {
    if (!formValid) return;
    const input: RegisterInput = {
      name: registrationForm.name.trim(),
      email: normalizedEmail,
      role: registrationForm.role,
      areaAccessMode:
        registrationForm.role === "admin"
          ? "all"
          : registrationForm.areaAccessMode,
      allowedPrefectures:
        registrationForm.role === "admin" ||
        registrationForm.areaAccessMode === "all"
          ? []
          : [...registrationForm.allowedPrefectures],
      reason: registrationForm.reason.trim(),
    };
    showConfirmation({
      kind: "register",
      input,
      details: {
        title: "この内容で社員を事前登録しますか？",
        action: "事前登録を確定する",
        targetName: input.name,
        targetEmail: input.email,
        targetId: "新規事前登録（ユーザーIDは初回ログイン後に確定）",
        previousState: "未登録",
        nextState: "初回ログイン待ち",
        role: input.role,
        area: areaText(input.areaAccessMode, input.allowedPrefectures),
        counts: { active: 0, total: 0 },
        countsNote:
          "新規の事前登録です。旧名で残る過去担当の有無は、引継ぎ一覧で別途確認してください。",
        impact: `登録したメールアドレスで本人が初回OAuthログインした時点で、${ROLE_LABELS[input.role]}の権限と指定の閲覧エリアを付与します。メール等の通知は送信しません。${roleImpact(input.role)} 案件の自動割当・自動移管はしません。`,
        destructive: false,
      },
    });
  }

  function confirmStateChange() {
    if (!changeEditor || !reasonValid(changeReason)) return;
    const reason = changeReason.trim();
    if (changeEditor.kind === "user") {
      const { target, disabled } = changeEditor;
      if (target.role === "owner" || target.id === currentUserId) return;
      showConfirmation({
        kind: "user",
        input: {
          userId: target.id,
          expectedDisabledAt:
            target.disabledAt === null ? null : target.disabledAt.toISOString(),
          expectedRole: target.role,
          disabled,
          reason,
        },
        details: {
          title: disabled
            ? "この社員を削除（退職）しますか？"
            : "この社員を復帰させますか？",
          action: disabled ? "削除（退職）を確定する" : "復帰を確定する",
          targetName: staffName(target),
          targetEmail: target.email,
          targetId: `ユーザーID: ${target.id}`,
          previousState: disabled
            ? "在籍・ログイン可能"
            : "退職・ログイン停止中",
          nextState: disabled ? "退職・ログイン停止" : "在籍・ログイン再開",
          role: target.role,
          area: null,
          counts: { active: target.activeCases, total: target.totalCases },
          countsNote:
            "確認画面を開いた時点の担当件数です。担当・案件履歴は削除しません。",
          impact: disabled
            ? "履歴保全型の削除です。本人のログインを停止し、新規担当の割当候補から外します。既存案件は消さず、過去担当は社内担当者一覧の引継ぎ欄に残します。対応中案件も自動で解除・移管しないため、必要な引継ぎを別途行ってください。共有済みのカレンダー購読URL等は個別失効しないため、別途共有の見直しが必要です。"
            : "本人のログインを再開し、現在の利用者区分・閲覧エリアで利用可能にします。担当履歴はそのまま保持します。案件の担当を自動で付け替えたり、新たに割り当てたりはしません。",
          destructive: disabled,
        },
      });
      return;
    }

    const { target, active } = changeEditor;
    const linkedUser =
      target.userId === null
        ? undefined
        : users.find(person => person.id === target.userId);
    showConfirmation({
      kind: "registration",
      input: {
        registrationId: target.id,
        expectedVersion: target.version,
        active,
        reason,
      },
      details: {
        title: active
          ? "この事前登録を再開しますか？"
          : "この事前登録を取り消しますか？",
        action: active ? "事前登録を再開する" : "事前登録を取り消す",
        targetName: staffName(target),
        targetEmail: target.email,
        targetId: `事前登録ID: ${target.id} ／ 確認時バージョン: ${target.version}`,
        previousState: active ? "事前登録取消済み" : "初回ログイン待ち",
        nextState: active ? "初回ログイン待ち" : "事前登録取消",
        role: target.role,
        area: registrationArea(target),
        counts: linkedUser
          ? { active: linkedUser.activeCases, total: linkedUser.totalCases }
          : null,
        countsNote: linkedUser
          ? "紐付いたアカウントの担当件数です。案件と過去担当の履歴はそのまま保持します。"
          : "未ログインの事前登録のため、アカウントの担当件数は未集計です。旧名で残る担当は引継ぎ一覧で確認してください。",
        impact: active
          ? "事前登録を初回ログイン待ちに戻します。本人が登録メールアドレスで初回OAuthログインした時点で、登録済みの区分・閲覧エリアの権限を付与します。通知は送信せず、案件の自動割当・自動移管もしません。"
          : "この事前登録による初回ログイン時の権限付与を取り消します。登録履歴・既存案件・過去担当は削除しません。既存アカウントの退職処理とは別の操作です。通知は送信しません。",
        destructive: !active,
      },
    });
  }

  async function executeConfirmed() {
    // The ref closes the same-tick double-click gap before React disables buttons.
    // A failed/ambiguous attempt cannot be resubmitted without a new confirmation.
    if (!confirmation || busy || inFlightRef.current || attempted) return;
    const snapshot = confirmation;
    if (!reasonValid(snapshot.input.reason)) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setAttempted(true);
    setSubmitError(null);
    let succeeded = false;

    try {
      if (snapshot.kind === "register") {
        await registerMutation.mutateAsync(snapshot.input);
      } else if (snapshot.kind === "user") {
        await userStateMutation.mutateAsync(snapshot.input);
      } else {
        await registrationStateMutation.mutateAsync(snapshot.input);
      }
      succeeded = true;
      setConfirmation(null);
      setRegisterOpen(false);
      setChangeEditor(null);
      setChangeReason("");
      setRegistrationForm(emptyRegistrationForm());
      toast.success(
        `${snapshot.details.targetName}：${snapshot.details.nextState}に更新しました。`
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "処理に失敗しました。最新の状態を確認してください。";
      setSubmitError(message);
      toast.error(
        "処理を完了できませんでした。エラーと最新の状態を確認してください。"
      );
    } finally {
      try {
        // Covers staffAdministration.list, ownerPeople.list, users.assignable,
        // internalStaff.summary and auth.me without assuming optional API branches.
        // Also refresh after errors: a lost response may hide a completed operation.
        await utils.invalidate();
      } catch {
        toast.warning(
          succeeded
            ? "変更は保存されましたが、一覧を再取得できませんでした。一覧を更新してください。"
            : "最新の状態を再取得できませんでした。一覧を更新してから再操作してください。"
        );
      }
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  function renderUserCard(person: StaffUser) {
    const retired = person.disabledAt !== null;
    const protectedUser =
      person.role === "owner" || person.id === currentUserId;
    return (
      <Card key={`user-${person.id}`} className="min-w-0">
        <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words font-semibold [overflow-wrap:anywhere]">
                {staffName(person)}
              </h3>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {person.email || "メールアドレス未設定"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                ユーザーID: {person.id}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 ${ROLE_CLASSES[person.role]}`}
            >
              {ROLE_LABELS[person.role]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant={retired ? "secondary" : "outline"}
              className={
                retired
                  ? ""
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }
            >
              {retired ? "退職・ログイン停止" : "在籍"}
            </Badge>
            {person.id === currentUserId && (
              <span className="text-muted-foreground">自分のアカウント</span>
            )}
          </div>
          <CaseCounts active={person.activeCases} total={person.totalCases} />
          {person.disabledAt && (
            <p className="text-xs text-muted-foreground">
              退職処理日時：{formatDate(person.disabledAt)}
            </p>
          )}
          {retired && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              案件・過去担当は削除せず、引継ぎ欄に保持しています。
            </p>
          )}
          <div className="mt-auto space-y-3 border-t pt-3">
            {protectedUser ? (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {person.id === currentUserId
                  ? "自分自身のログインは停止できません。"
                  : "最高管理者のログインは停止できません。"}
              </p>
            ) : (
              <Button
                type="button"
                size="sm"
                variant={retired ? "outline" : "destructive"}
                disabled={busy || staffQuery.isError}
                onClick={() => openUserChange(person)}
                className="w-full sm:w-auto"
                aria-label={`${staffName(person)}を${retired ? "復帰" : "削除（退職）"}`}
              >
                {retired ? (
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                ) : (
                  <Trash2 className="mr-1.5 h-4 w-4" />
                )}
                {retired ? "復帰" : "削除（退職）"}
              </Button>
            )}
            <Link
              href="/settings/people"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4"
            >
              <Settings2 className="h-3.5 w-3.5" /> 登録名・利用者区分を変更
            </Link>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={busy}
                onClick={() =>
                  setHistoryTarget({
                    kind: "user_lifecycle",
                    targetId: person.id,
                    name: staffName(person),
                  })
                }
              >
                <History className="mr-1.5 h-3.5 w-3.5" />
                退職・復帰履歴
              </Button>
              {registrations
                .filter(registration => registration.userId === person.id)
                .map(registration => (
                  <Button
                    key={registration.id}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    disabled={busy}
                    onClick={() =>
                      setHistoryTarget({
                        kind: "staff_registration",
                        targetId: registration.id,
                        name: staffName(person),
                      })
                    }
                  >
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    事前登録履歴
                  </Button>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderRegistrationCard(person: StaffRegistration) {
    const canceled = person.state === "canceled";
    return (
      <Card key={`registration-${person.id}`} className="min-w-0">
        <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words font-semibold [overflow-wrap:anywhere]">
                {staffName(person)}
              </h3>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {person.email}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                事前登録ID: {person.id}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 ${ROLE_CLASSES[person.role]}`}
            >
              {ROLE_LABELS[person.role]}
            </Badge>
          </div>
          <div>
            <Badge
              variant="outline"
              className={
                canceled
                  ? "bg-muted text-muted-foreground"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }
            >
              {canceled ? "事前登録取消" : "初回ログイン待ち"}
            </Badge>
          </div>
          <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
            <p className="flex items-start gap-2">
              <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words">
                閲覧エリア：{registrationArea(person)}
              </span>
            </p>
            <p>登録日時：{formatDate(person.createdAt)}</p>
            <p className="text-muted-foreground">
              {canceled
                ? "この事前登録による権限付与は停止しています。履歴は保持します。"
                : "本人の初回OAuthログイン時に権限を付与します。通知は送信していません。"}
            </p>
          </div>
          <div className="mt-auto border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={
                canceled
                  ? "w-full sm:w-auto"
                  : "w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
              }
              disabled={busy || staffQuery.isError}
              onClick={() => openRegistrationChange(person)}
              aria-label={`${staffName(person)}の事前登録を${canceled ? "再開" : "取消"}`}
            >
              {canceled ? (
                <RotateCcw className="mr-1.5 h-4 w-4" />
              ) : (
                <XCircle className="mr-1.5 h-4 w-4" />
              )}
              {canceled ? "事前登録を再開" : "事前登録を取消"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2 h-8 px-2 text-xs"
              disabled={busy}
              onClick={() =>
                setHistoryTarget({
                  kind: "staff_registration",
                  targetId: person.id,
                  name: staffName(person),
                })
              }
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              変更履歴
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const editorTitle =
    changeEditor?.kind === "user"
      ? changeEditor.disabled
        ? "削除（退職）の理由"
        : "復帰の理由"
      : changeEditor?.active
        ? "事前登録を再開"
        : "事前登録を取消";

  return (
    <div
      className="mx-auto min-w-0 max-w-7xl space-y-5"
      aria-label="社員の登録・退職管理"
    >
      <PageHeader
        eyebrow="OWNER CONTROL"
        title="社員の登録・退職管理"
        icon={<Users className="h-6 w-6 shrink-0 text-primary" />}
        description="社内メンバーの事前登録、ログイン停止・復帰を管理します。削除しても案件・担当履歴は保持されます。"
        actions={
          <>
            <Button
              variant="outline"
              disabled={busy || staffQuery.isFetching}
              onClick={() => void staffQuery.refetch()}
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${staffQuery.isFetching ? "animate-spin" : ""}`}
              />
              {staffQuery.isFetching ? "更新中…" : "一覧を更新"}
            </Button>
            <Button
              onClick={openRegistration}
              disabled={busy || staffQuery.isLoading || staffQuery.isError}
            >
              <UserPlus className="mr-1.5 h-4 w-4" /> 社員を事前登録
            </Button>
          </>
        }
      />

      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="flex items-start gap-3 p-4 text-sm leading-relaxed text-amber-950">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0 space-y-2">
            <p className="font-semibold">「削除」は、履歴を残す退職処理です</p>
            <p>
              ログインを停止し、新規割当の候補から外します。案件は消さず、過去担当は引継ぎ欄に残します。既存案件の担当は自動解除・自動移管しません。
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium">
              <Link
                href="/internal-staff"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                <Briefcase className="h-3.5 w-3.5" />
                担当案件・引継ぎを確認
              </Link>
              <Link
                href="/settings/people"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                <Settings2 className="h-3.5 w-3.5" />
                登録名・利用者区分管理
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={tab}
        onValueChange={value => {
          if (isStaffTab(value)) setTab(value);
        }}
        className="min-w-0 gap-4"
      >
        <div className="space-y-4 rounded-xl border bg-card p-3 text-card-foreground sm:p-4">
          <TabsList
            className="grid h-auto w-full grid-cols-3 gap-1 p-1"
            aria-label="社員・事前登録の状態"
          >
            <TabsTrigger
              value="active"
              className="min-w-0 flex-col gap-1 whitespace-normal px-1 py-2 text-xs sm:flex-row sm:gap-2 sm:text-sm"
            >
              在籍{" "}
              <span className="rounded bg-background/70 px-1.5 text-xs tabular-nums">
                {totals.active}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="min-w-0 flex-col gap-1 whitespace-normal px-1 py-2 text-xs sm:flex-row sm:gap-2 sm:text-sm"
            >
              初回ログイン待ち{" "}
              <span className="rounded bg-background/70 px-1.5 text-xs tabular-nums">
                {totals.pending}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="inactive"
              className="min-w-0 flex-col gap-1 whitespace-normal px-1 py-2 text-xs sm:flex-row sm:gap-2 sm:text-sm"
            >
              退職／取消{" "}
              <span className="rounded bg-background/70 px-1.5 text-xs tabular-nums">
                {totals.inactive}
              </span>
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="名前・メールアドレスで検索"
                aria-label="名前・メールアドレスで検索"
                className="pl-9"
                type="search"
              />
            </div>
            <p
              className="shrink-0 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {staffQuery.isLoading
                ? "一覧を読み込み中…"
                : `${visibleCount} / ${totals[tab]} 名を表示`}
            </p>
          </div>
        </div>

        {staffQuery.isError && (
          <div
            role="alert"
            className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
          >
            <p className="break-words text-destructive">
              一覧を取得できませんでした。{staffQuery.error.message}
            </p>
            <p className="text-xs text-muted-foreground">
              最新の状態を確認するまで変更操作はできません。
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || staffQuery.isFetching}
              onClick={() => void staffQuery.refetch()}
            >
              再試行
            </Button>
          </div>
        )}

        {staffQuery.isLoading ? (
          <div
            role="status"
            className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            社員・事前登録を読み込んでいます…
          </div>
        ) : (
          <>
            <TabsContent value="active" className="space-y-4">
              <h2 className="sr-only">在籍中の社員</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.active.map(renderUserCard)}
              </div>
            </TabsContent>
            <TabsContent value="pending" className="space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                メールアドレスで事前登録した、初回ログイン前のメンバーです。本人が同じメールアドレスでOAuthログインすると、在籍一覧へ移ります。招待メール等の通知は送信しません。
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.pending.map(renderRegistrationCard)}
              </div>
            </TabsContent>
            <TabsContent value="inactive" className="space-y-5">
              {filtered.retired.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">
                    退職・ログイン停止{" "}
                    <span className="ml-1 text-muted-foreground">
                      {filtered.retired.length}名
                    </span>
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.retired.map(renderUserCard)}
                  </div>
                </section>
              )}
              {filtered.canceled.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">
                    事前登録の取消{" "}
                    <span className="ml-1 text-muted-foreground">
                      {filtered.canceled.length}名
                    </span>
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.canceled.map(renderRegistrationCard)}
                  </div>
                </section>
              )}
            </TabsContent>
            {!staffQuery.isError && visibleCount === 0 && (
              <Card className="border-dashed">
                <CardContent className="space-y-3 py-12 text-center">
                  <Users className="mx-auto h-7 w-7 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">
                    {search.trim()
                      ? "検索条件に一致するメンバーはいません。"
                      : tab === "pending"
                        ? "初回ログイン待ちの事前登録はありません。"
                        : tab === "inactive"
                          ? "退職者・取り消した事前登録はありません。"
                          : "在籍中のメンバーはいません。"}
                  </p>
                  {search.trim() && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSearch("")}
                    >
                      検索を解除
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>

      <Dialog
        open={registerOpen}
        onOpenChange={open => {
          if (!busy && !inFlightRef.current && !confirmation)
            setRegisterOpen(open);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"
          showCloseButton={!busy && !confirmation}
        >
          <DialogHeader>
            <DialogTitle>社員をメールアドレスで事前登録</DialogTitle>
            <DialogDescription>
              OAuthでまだログインしていない方を登録します。本人の初回ログイン時に権限を付与します。通知は送信しません。
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              confirmRegistration();
            }}
            className="space-y-5"
          >
            <fieldset
              disabled={busy || confirmation !== null}
              className="min-w-0 space-y-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="staff-registration-name">
                    登録名 <span className="text-destructive">（必須）</span>
                  </Label>
                  <Input
                    id="staff-registration-name"
                    value={registrationForm.name}
                    onChange={event =>
                      setRegistrationForm(current => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    maxLength={128}
                    required
                    placeholder="例：山田 太郎"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-registration-email">
                    本人のメールアドレス{" "}
                    <span className="text-destructive">（必須）</span>
                  </Label>
                  <Input
                    id="staff-registration-email"
                    type="email"
                    value={registrationForm.email}
                    onChange={event =>
                      setRegistrationForm(current => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    maxLength={320}
                    required
                    placeholder="name@example.com"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-describedby="staff-registration-email-hint"
                    aria-invalid={
                      Boolean(existingUser) ||
                      Boolean(existingRegistration) ||
                      (normalizedEmail.length > 0 && !emailValid)
                    }
                  />
                  <p
                    id="staff-registration-email-hint"
                    className={`text-xs leading-relaxed ${existingUser || existingRegistration ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {existingUser
                      ? `このメールは「${staffName(existingUser)}」の既存アカウントに登録済みです。区分は利用者区分管理で変更し、退職済みの場合は在籍管理から復帰してください。`
                      : existingRegistration
                        ? existingRegistration.state === "canceled"
                          ? "このメールは取消済みの事前登録に使用されています。「退職／取消」一覧の「事前登録を再開」を使ってください。"
                          : "このメールはすでに登録済みです。初回ログイン待ち・在籍一覧で確認してください。"
                        : "本人がOAuthログイン時に利用するメールアドレスと一致させてください。"}
                  </p>
                  {existingRegistration?.state === "canceled" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRegisterOpen(false);
                        setTab("inactive");
                        setSearch(existingRegistration.email);
                      }}
                    >
                      取消済みの事前登録を表示
                    </Button>
                  )}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
                すでにログイン済みのアカウントは、この画面から重複登録できません。
                <Link
                  href="/settings/people"
                  className="ml-1 font-medium text-primary underline underline-offset-4"
                >
                  利用者区分管理で登録名・役割を変更
                </Link>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-registration-role">
                  利用者区分 <span className="text-destructive">（必須）</span>
                </Label>
                <Select
                  value={registrationForm.role}
                  disabled={busy || confirmation !== null}
                  onValueChange={value => {
                    if (!isRegistrationRole(value)) return;
                    setRegistrationForm(current => ({
                      ...current,
                      role: value,
                      areaAccessMode:
                        value === "admin" ? "all" : current.areaAccessMode,
                    }));
                  }}
                >
                  <SelectTrigger
                    id="staff-registration-role"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">社員</SelectItem>
                    <SelectItem value="admin">管理者</SelectItem>
                    <SelectItem value="executive">役員</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {roleImpact(registrationForm.role)}
                </p>
              </div>
              <div className="space-y-3 rounded-xl border bg-muted/25 p-3 sm:p-4">
                <Label htmlFor="staff-registration-area">
                  閲覧エリア <span className="text-destructive">（必須）</span>
                </Label>
                <Select
                  value={
                    registrationForm.role === "admin"
                      ? "all"
                      : registrationForm.areaAccessMode
                  }
                  disabled={
                    registrationForm.role === "admin" ||
                    busy ||
                    confirmation !== null
                  }
                  onValueChange={value => {
                    if (value === "all" || value === "selected")
                      setRegistrationForm(current => ({
                        ...current,
                        areaAccessMode: value,
                      }));
                  }}
                >
                  <SelectTrigger
                    id="staff-registration-area"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全エリア</SelectItem>
                    <SelectItem value="selected">
                      選択した都道府県のみ
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {registrationForm.role === "admin"
                    ? "管理者は全エリア固定です。"
                    : "社員・役員は全エリア、または都道府県を指定できます。"}
                </p>
                {registrationForm.role !== "admin" &&
                  registrationForm.areaAccessMode === "selected" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p
                          className={`text-xs ${registrationForm.allowedPrefectures.length ? "text-muted-foreground" : "text-destructive"}`}
                        >
                          {registrationForm.allowedPrefectures.length}
                          都道府県を選択（1件以上必須）
                        </p>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setRegistrationForm(current => ({
                                ...current,
                                allowedPrefectures: [...PREFECTURES],
                              }))
                            }
                          >
                            すべて選択
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setRegistrationForm(current => ({
                                ...current,
                                allowedPrefectures: [],
                              }))
                            }
                          >
                            解除
                          </Button>
                        </div>
                      </div>
                      <div
                        className="grid grid-cols-2 gap-1 sm:grid-cols-3"
                        role="group"
                        aria-label="閲覧可能な都道府県"
                      >
                        {PREFECTURES.map(prefecture => (
                          <label
                            key={prefecture}
                            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-1.5 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              disabled={busy || confirmation !== null}
                              checked={registrationForm.allowedPrefectures.includes(
                                prefecture
                              )}
                              onCheckedChange={checked =>
                                setRegistrationForm(current => ({
                                  ...current,
                                  allowedPrefectures:
                                    checked === true
                                      ? Array.from(
                                          new Set([
                                            ...current.allowedPrefectures,
                                            prefecture,
                                          ])
                                        )
                                      : current.allowedPrefectures.filter(
                                          item => item !== prefecture
                                        ),
                                }))
                              }
                            />
                            {prefecture}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
              <ReasonField
                id="staff-registration-reason"
                value={registrationForm.reason}
                onChange={reason =>
                  setRegistrationForm(current => ({ ...current, reason }))
                }
                registration
              />
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy || confirmation !== null}
                onClick={() => setRegisterOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={
                  !formValid ||
                  busy ||
                  confirmation !== null ||
                  staffQuery.isError
                }
              >
                登録内容を確認
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={changeEditor !== null}
        onOpenChange={open => {
          if (!open && !busy && !inFlightRef.current && !confirmation)
            setChangeEditor(null);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto p-4 sm:max-w-xl sm:p-6"
          showCloseButton={!busy && !confirmation}
        >
          <DialogHeader>
            <DialogTitle>{editorTitle}</DialogTitle>
            <DialogDescription>
              この時点では変更しません。理由を入力し、対象・新旧の状態・影響を次の確認画面で確認してください。
            </DialogDescription>
          </DialogHeader>
          {changeEditor && (
            <form
              className="space-y-5"
              onSubmit={event => {
                event.preventDefault();
                confirmStateChange();
              }}
            >
              <fieldset
                disabled={busy || confirmation !== null}
                className="min-w-0 space-y-4"
              >
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="break-words font-semibold [overflow-wrap:anywhere]">
                    {staffName(changeEditor.target)}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">
                    {changeEditor.target.email || "メールアドレス未設定"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {changeEditor.kind === "user" ? "ユーザーID" : "事前登録ID"}
                    : {changeEditor.target.id} ／{" "}
                    {ROLE_LABELS[changeEditor.target.role]}
                  </p>
                </div>
                {changeEditor.kind === "user" && (
                  <CaseCounts
                    active={changeEditor.target.activeCases}
                    total={changeEditor.target.totalCases}
                  />
                )}
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-950">
                  {changeEditor.kind === "user"
                    ? changeEditor.disabled
                      ? "ログインを停止します。案件と過去担当は削除せず、引継ぎ欄に残します。対応中案件も自動移管しません。"
                      : "ログインを再開します。現在の利用者区分と閲覧エリアを引き継ぎ、担当履歴は保持します。"
                    : changeEditor.active
                      ? "初回ログイン待ちに戻します。初回本人ログインで登録済みの権限を付与します。通知は送信しません。"
                      : "この事前登録による権限付与を取り消します。登録履歴・既存案件・過去担当は削除しません。"}
                </div>
                <ReasonField
                  id="staff-state-reason"
                  value={changeReason}
                  onChange={setChangeReason}
                />
              </fieldset>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || confirmation !== null}
                  onClick={() => setChangeEditor(null)}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !reasonValid(changeReason) ||
                    busy ||
                    confirmation !== null ||
                    staffQuery.isError
                  }
                >
                  変更内容を確認
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmation !== null}
        onOpenChange={open => {
          if (!open && !busy && !inFlightRef.current) {
            setConfirmation(null);
            setSubmitError(null);
          }
        }}
      >
        <AlertDialogContent
          className="max-h-[90dvh] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"
          aria-busy={busy}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.details.title || "変更内容の確認"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              以下は確認画面を開いた時点で固定した送信内容です。対象と変更理由を確認して確定してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation && (
            <>
              <dl className="divide-y rounded-lg border bg-muted/20 px-3 text-sm sm:px-4">
                <div className="space-y-1 py-3">
                  <dt className="text-xs text-muted-foreground">対象</dt>
                  <dd className="break-words font-semibold [overflow-wrap:anywhere]">
                    {confirmation.details.targetName}
                  </dd>
                  <dd className="break-all text-xs">
                    {confirmation.details.targetEmail || "メールアドレス未設定"}
                  </dd>
                  <dd className="break-words text-xs text-muted-foreground">
                    {confirmation.details.targetId}
                  </dd>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3">
                  <div className="min-w-0 space-y-1">
                    <dt className="text-xs text-muted-foreground">変更前</dt>
                    <dd className="break-words font-medium">
                      {confirmation.details.previousState}
                    </dd>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-1">
                    <dt className="text-xs text-muted-foreground">変更後</dt>
                    <dd className="break-words font-semibold">
                      {confirmation.details.nextState}
                    </dd>
                  </div>
                </div>
                <div className="space-y-1 py-3">
                  <dt className="text-xs text-muted-foreground">
                    利用者区分
                    {confirmation.kind === "register"
                      ? "（初回ログイン時に付与）"
                      : "（変更なし）"}
                  </dt>
                  <dd>{ROLE_LABELS[confirmation.details.role]}</dd>
                </div>
                <div className="space-y-1 py-3">
                  <dt className="text-xs text-muted-foreground">閲覧エリア</dt>
                  <dd className="break-words">
                    {confirmation.details.area ||
                      "現在の設定を保持（この操作では変更しません）"}
                  </dd>
                </div>
                <div className="space-y-2 py-3">
                  <dt className="text-xs text-muted-foreground">担当件数</dt>
                  <dd>
                    {confirmation.details.counts ? (
                      <span className="font-medium tabular-nums">
                        対応中 {confirmation.details.counts.active}件 ／ 全担当{" "}
                        {confirmation.details.counts.total}件
                      </span>
                    ) : (
                      <span>対応中・全担当：未集計（初回ログイン前）</span>
                    )}
                  </dd>
                  <dd className="text-xs leading-relaxed text-muted-foreground">
                    {confirmation.details.countsNote}
                  </dd>
                </div>
                <div className="space-y-1 py-3">
                  <dt className="text-xs text-muted-foreground">
                    {confirmation.kind === "register" ? "登録理由" : "変更理由"}
                  </dt>
                  <dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {confirmation.input.reason}
                  </dd>
                </div>
              </dl>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm leading-relaxed text-amber-950">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">この操作の影響</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    {confirmation.details.impact}
                  </p>
                </div>
              </div>
              {confirmation.kind === "register" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  同じメールアドレスのアカウントがすでに存在する場合は登録できません。
                  <Link
                    href="/settings/people"
                    className="ml-1 text-primary underline underline-offset-4"
                  >
                    利用者区分管理で確認・変更
                  </Link>
                </p>
              ) : (
                <Link
                  href="/internal-staff"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  担当案件と引継ぎ欄を確認
                </Link>
              )}
              {submitError && (
                <div
                  role="alert"
                  className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
                >
                  <p className="break-words text-destructive [overflow-wrap:anywhere]">
                    {submitError}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    同じ内容は再送しません。処理結果が不明な場合や他の管理者が変更した場合は、入力へ戻り、ダイアログを閉じて一覧を更新してください。最新の対象を開き直してから再確認してください。
                  </p>
                  {confirmation.kind === "register" && (
                    <Link
                      href="/settings/people"
                      className="inline-block text-xs font-medium text-primary underline underline-offset-4"
                    >
                      既存アカウントの登録名・利用者区分を変更
                    </Link>
                  )}
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>
                  {attempted ? "入力へ戻る" : "戻って修正"}
                </AlertDialogCancel>
                <Button
                  type="button"
                  variant={
                    confirmation.details.destructive ? "destructive" : "default"
                  }
                  disabled={
                    busy ||
                    attempted ||
                    Boolean(submitError) ||
                    staffQuery.isError
                  }
                  onClick={() => void executeConfirmed()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      処理中…
                    </>
                  ) : attempted ? (
                    "再確認が必要です"
                  ) : (
                    confirmation.details.action
                  )}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
      {historyTarget && (
        <StaffHistoryDialog
          target={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}

const AUDIT_LABELS: Record<string, string> = {
  role: "利用者区分",
  disabledAt: "ログイン停止日時",
  state: "登録状態",
  version: "バージョン",
  name: "登録名",
  email: "メールアドレス",
  areaAccessMode: "閲覧エリア",
  allowedPrefectures: "許可都道府県",
  createdBy: "登録者ID",
  userId: "本人ユーザーID",
};

function auditValue(key: string, value: unknown): string {
  if (value === null)
    return key === "disabledAt" ? "停止なし（ログイン有効）" : "未設定";
  if (typeof value === "string") {
    if (key === "role" && (value === "owner" || isRegistrationRole(value)))
      return ROLE_LABELS[value];
    if (key === "state")
      return (
        (
          {
            pending: "初回ログイン待ち",
            active: "本人ログイン済み",
            canceled: "事前登録取消",
          } as Record<string, string>
        )[value] ?? value
      );
    if (key === "areaAccessMode")
      return value === "all"
        ? "全エリア"
        : value === "selected"
          ? "選択都道府県のみ"
          : value;
    if (key === "allowedPrefectures")
      return parsePrefectures(value).join("、") || "指定なし";
    if (key === "disabledAt" && !Number.isNaN(Date.parse(value)))
      return formatDate(new Date(value));
    return value;
  }
  if (Array.isArray(value))
    return (
      value
        .map(item => (typeof item === "string" ? item : JSON.stringify(item)))
        .join("、") || "指定なし"
    );
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function AuditSnapshot({ value }: { value: string }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return (
      <p className="break-words text-xs [overflow-wrap:anywhere]">{value}</p>
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return <p className="text-xs">記録なし</p>;
  const entries = Object.entries(parsed);
  if (!entries.length)
    return (
      <p className="text-xs text-muted-foreground">未登録・変更前の記録なし</p>
    );
  return (
    <dl className="space-y-2 text-xs">
      {entries.map(([key, item]) => (
        <div key={key}>
          <dt className="text-muted-foreground">{AUDIT_LABELS[key] || key}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {auditValue(key, item)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StaffHistoryDialog({
  target,
  onClose,
}: {
  target: HistoryTarget;
  onClose: () => void;
}) {
  const history = trpc.staffAdministration.history.useQuery(
    { kind: target.kind, targetId: target.targetId },
    { retry: false }
  );
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
        <DialogHeader>
          <DialogTitle>変更履歴</DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            {target.name} ／{" "}
            {target.kind === "user_lifecycle" ? "退職・復帰" : "事前登録"}（ID:{" "}
            {target.targetId}
            ）。新しい順に最大50件の履歴を表示します。閲覧のみで変更は行いません。
          </DialogDescription>
        </DialogHeader>
        {history.isLoading ? (
          <p
            role="status"
            className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            履歴を読み込んでいます…
          </p>
        ) : history.isError ? (
          <div
            role="alert"
            className="space-y-3 rounded-lg bg-destructive/5 p-3 text-sm"
          >
            <p className="break-words text-destructive">
              履歴を取得できませんでした。{history.error.message}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={history.isFetching}
              onClick={() => void history.refetch()}
            >
              再試行
            </Button>
          </div>
        ) : history.data?.length ? (
          <div className="space-y-4">
            {history.data.map(entry => (
              <article
                key={entry.id}
                className="space-y-3 rounded-xl border p-3 sm:p-4"
              >
                <header className="flex flex-wrap items-start justify-between gap-2 text-xs">
                  <p className="font-medium">{formatDate(entry.changedAt)}</p>
                  <p className="break-words text-muted-foreground [overflow-wrap:anywhere]">
                    操作した人：{entry.changedByName}
                  </p>
                </header>
                <div className="grid gap-3 sm:grid-cols-2">
                  <section className="space-y-2 rounded-lg bg-muted/50 p-3">
                    <h3 className="text-xs font-semibold">変更前</h3>
                    <AuditSnapshot value={entry.beforeJson} />
                  </section>
                  <section className="space-y-2 rounded-lg bg-primary/5 p-3">
                    <h3 className="text-xs font-semibold">変更後</h3>
                    <AuditSnapshot value={entry.afterJson} />
                  </section>
                </div>
                <div className="border-t pt-3 text-xs">
                  <p className="text-muted-foreground">変更理由</p>
                  <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere]">
                    {entry.reason}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            この対象の変更履歴はまだありません。
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
