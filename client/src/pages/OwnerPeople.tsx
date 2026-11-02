import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";
import { trpc } from "@/lib/trpc";
import { PREFECTURES, type Prefecture } from "@shared/prefecture";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Loader2,
  MapPinned,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type PersonRole = "owner" | "admin" | "executive" | "user" | "partner" | "customer";
type EditableRole = "user" | "admin" | "executive" | "partner";
type AccessMode = "all" | "selected";

type OwnerPerson = {
  id: number;
  name: string | null;
  nameOverride: string | null;
  email: string | null;
  role: PersonRole;
  areaAccessMode: AccessMode;
  allowedPrefectures: string | null;
  partnerLinks: Array<{ id: number; name: string }>;
  activeInternalCases: number;
  totalInternalCases: number;
  activePartnerCases: number;
  totalPartnerCases: number;
};

type PartnerMaster = {
  id: number;
  name: string;
  isActive: boolean;
  userId: number | null;
};

type OwnerPeopleResponse = {
  users: OwnerPerson[];
  partners: PartnerMaster[];
};

type ChangeCategoryInput = {
  userId: number;
  expectedRole: PersonRole;
  role: EditableRole;
  partnerId: number | null;
  expectedPartnerIds: number[];
  staffAreaAccessMode: AccessMode;
  staffAllowedPrefectures: Prefecture[];
  reason: string;
};

type EditorState = {
  user: OwnerPerson;
  nextRole: EditableRole;
  partnerId: number | null;
  accessMode: AccessMode;
  allowedPrefectures: Prefecture[];
  reason: string;
};

type RenameUserInput = {
  userId: number;
  expectedName: string | null;
  name: string;
  reason: string;
};

type RenameEditorState = {
  user: OwnerPerson;
  name: string;
  reason: string;
};

const ownerPeopleApi = trpc.ownerPeople;

const ROLE_LABELS: Record<PersonRole, string> = {
  owner: "最高管理者",
  admin: "管理者",
  executive: "役員",
  user: "社員",
  partner: "協力業者",
  customer: "顧客",
};

const ROLE_BADGE_CLASS: Record<PersonRole, string> = {
  owner: "border-amber-300 bg-amber-50 text-amber-900",
  admin: "border-violet-300 bg-violet-50 text-violet-900",
  executive: "border-blue-300 bg-blue-50 text-blue-900",
  user: "border-slate-300 bg-slate-50 text-slate-800",
  partner: "border-emerald-300 bg-emerald-50 text-emerald-900",
  customer: "border-stone-300 bg-stone-50 text-stone-800",
};

function parseAllowedPrefectures(value: string | null): Prefecture[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Prefecture =>
        typeof item === "string" && PREFECTURES.includes(item as Prefecture),
    );
  } catch {
    return [];
  }
}

function personName(user: OwnerPerson) {
  return user.nameOverride?.trim() || user.name?.trim() || "名称未設定";
}

function partnerLinkText(links: OwnerPerson["partnerLinks"]) {
  return links.length > 0 ? links.map((link) => link.name).join("、") : "未紐付け";
}

function areaSummary(accessMode: AccessMode, prefectures: Prefecture[]) {
  if (accessMode === "all") return "全エリア";
  return prefectures.length > 0 ? `${prefectures.join("、")}（${prefectures.length}県）` : "選択エリア未設定";
}

function roleAccessSummary(role: EditableRole) {
  if (role === "admin" || role === "executive") {
    return "金額を閲覧できます。利益は閲覧できません。";
  }
  return "金額は閲覧できません。";
}

export default function OwnerPeople() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmedPayload, setConfirmedPayload] = useState<ChangeCategoryInput | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [renameEditor, setRenameEditor] = useState<RenameEditorState | null>(null);
  const [renameConfirmOpen, setRenameConfirmOpen] = useState(false);
  const [confirmedRenamePayload, setConfirmedRenamePayload] = useState<RenameUserInput | null>(null);
  const [renameSubmitError, setRenameSubmitError] = useState<string | null>(null);

  const peopleQuery = ownerPeopleApi.list.useQuery(undefined, {
    enabled: user?.role === "owner",
  });

  const invalidatePeopleCaches = async () => {
    await Promise.all([
      utils.users.accessList.invalidate(),
      utils.users.list.invalidate(),
      utils.users.assignable.invalidate(),
      utils.internalStaff.summary.invalidate(),
      utils.internalStaff.assignments.invalidate(),
      utils.responsibility.personal.invalidate(),
      utils.ownerPeople.list.invalidate(),
      utils.partners.list.invalidate(),
      utils.auth.me.invalidate(),
    ]);
  };

  const changeCategory = ownerPeopleApi.changeCategory.useMutation({
    onSuccess: async () => {
      toast.success("利用者区分を更新しました。既存案件の自動移管は行っていません。");
      setConfirmOpen(false);
      setEditor(null);
      setSubmitError(null);
      await invalidatePeopleCaches();
    },
    onError: (error) => {
      setSubmitError(error.message);
      toast.error(`更新できませんでした: ${error.message}`);
    },
  });

  const renameUser = ownerPeopleApi.renameUser.useMutation({
    onSuccess: async (result) => {
      toast.success(result.changed ? "登録名を更新しました。" : "登録名はすでに反映されています。");
      setRenameConfirmOpen(false);
      setRenameEditor(null);
      setRenameSubmitError(null);
      await invalidatePeopleCaches();
    },
    onError: (error) => {
      setRenameSubmitError(error.message);
      toast.error(`登録名を更新できませんでした: ${error.message}`);
    },
  });

  const people = peopleQuery.data?.users ?? [];
  const partners = peopleQuery.data?.partners ?? [];

  const filteredPeople = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ja-JP");
    if (!keyword) return people;

    return people.filter((person) => {
      const searchable = [person.nameOverride ?? "", person.name ?? "", person.email ?? "", String(person.id)]
        .join(" ")
        .toLocaleLowerCase("ja-JP");
      return searchable.includes(keyword);
    });
  }, [people, search]);

  const selectablePartners = useMemo(() => {
    if (!editor) return [];
    return partners.filter(
      (partner) => partner.isActive && (partner.userId === null || partner.userId === editor.user.id),
    );
  }, [editor, partners]);

  const selectedPartner = selectablePartners.find((partner) => partner.id === editor?.partnerId) ?? null;
  const editorAreas = editor?.allowedPrefectures ?? [];
  const isToPartner = editor?.nextRole === "partner";
  const isInternalRole = Boolean(editor && editor.nextRole !== "partner");
  const reasonLength = editor?.reason.trim().length ?? 0;
  const editorValid = Boolean(
    editor &&
      reasonLength >= 3 &&
      reasonLength <= 500 &&
      (editor.nextRole !== "partner" || editor.partnerId !== null) &&
      (editor.nextRole === "partner" || editor.accessMode !== "selected" || editorAreas.length > 0),
  );
  const renameNameLength = renameEditor?.name.trim().length ?? 0;
  const renameReasonLength = renameEditor?.reason.trim().length ?? 0;
  const renameValid = Boolean(
    renameEditor &&
      renameNameLength >= 1 &&
      renameNameLength <= 128 &&
      renameReasonLength >= 3 &&
      renameReasonLength <= 500,
  );

  const openEditor = (target: OwnerPerson) => {
    if (target.role === "owner" || target.role === "customer" || target.id === user?.id) return;

    const targetRole: EditableRole = target.role;
    const currentAreas = parseAllowedPrefectures(target.allowedPrefectures);
    const existingAvailableLink = partners.find(
      (partner) =>
        partner.isActive &&
        partner.userId === target.id &&
        target.partnerLinks.some((link) => link.id === partner.id),
    );

    // この時点の query 値をそのままスナップショットにして、確認時の expected 値に使用する。
    setEditor({
      user: target,
      nextRole: targetRole,
      partnerId: existingAvailableLink?.id ?? null,
      accessMode: target.areaAccessMode === "selected" ? "selected" : "all",
      allowedPrefectures: currentAreas,
      reason: "",
    });
    setSubmitError(null);
  };

  const openRenameEditor = (target: OwnerPerson) => {
    setRenameEditor({
      user: target,
      name: personName(target) === "名称未設定" ? "" : personName(target),
      reason: "",
    });
    setRenameSubmitError(null);
  };

  const togglePrefecture = (prefecture: Prefecture, checked: boolean) => {
    setEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        allowedPrefectures: checked
          ? Array.from(new Set([...current.allowedPrefectures, prefecture]))
          : current.allowedPrefectures.filter((item) => item !== prefecture),
      };
    });
  };

  const requestConfirmation = () => {
    if (!editor) return;

    if (reasonLength < 3 || reasonLength > 500) {
      toast.error("変更理由は3〜500文字で入力してください。");
      return;
    }
    if (editor.nextRole === "partner" && !editor.partnerId) {
      toast.error("担当会社のマスタを選択してください。");
      return;
    }
    if (editor.nextRole !== "partner" && editor.accessMode === "selected" && editor.allowedPrefectures.length === 0) {
      toast.error("選択エリアの場合は、都道府県を1件以上選択してください。");
      return;
    }

    setSubmitError(null);
    setConfirmedPayload({
      userId: editor.user.id,
      expectedRole: editor.user.role,
      role: editor.nextRole,
      partnerId: editor.nextRole === "partner" ? editor.partnerId : null,
      expectedPartnerIds: editor.user.partnerLinks.map((link) => link.id),
      staffAreaAccessMode: editor.nextRole === "partner" ? "all" : editor.accessMode,
      staffAllowedPrefectures: editor.nextRole === "partner" ? [] : [...editor.allowedPrefectures],
      reason: editor.reason.trim(),
    });
    setConfirmOpen(true);
  };

  const executeChange = () => {
    if (!confirmedPayload || changeCategory.isPending) return;
    changeCategory.mutate(confirmedPayload);
  };

  const requestRenameConfirmation = () => {
    if (!renameEditor) return;

    if (renameNameLength < 1 || renameNameLength > 128) {
      toast.error("登録名は1〜128文字で入力してください。");
      return;
    }
    if (renameReasonLength < 3 || renameReasonLength > 500) {
      toast.error("変更理由は3〜500文字で入力してください。");
      return;
    }

    setRenameSubmitError(null);
    setConfirmedRenamePayload({
      userId: renameEditor.user.id,
      expectedName: renameEditor.user.name,
      name: renameEditor.name.trim(),
      reason: renameEditor.reason.trim(),
    });
    setRenameConfirmOpen(true);
  };

  const executeRename = () => {
    if (!confirmedRenamePayload || renameUser.isPending) return;
    renameUser.mutate(confirmedRenamePayload);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> 権限を確認しています…
      </div>
    );
  }

  if (user?.role !== "owner") {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-destructive" /> 最高管理者専用
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>利用者を社内担当者と協力業者の間で変更できるのは最高管理者だけです。</p>
            <p>役割・金額の表示範囲・担当会社の紐付けに影響するため、この画面は表示できません。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-label="利用者区分変更">
      <PageHeader
        eyebrow="OWNER CONTROL"
        title="利用者管理"
        icon={<Users className="h-6 w-6 text-primary" />}
        description="登録名と利用者区分を管理します。既存案件の担当・業者情報は自動移管しません。金額の表示範囲が変わるため、必ず確認画面で内容を確認してください。"
        actions={
          <Button
            variant="outline"
            onClick={() => void peopleQuery.refetch()}
            disabled={peopleQuery.isFetching}
            className="bg-background"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${peopleQuery.isFetching ? "animate-spin" : ""}`} />
            {peopleQuery.isFetching ? "更新中…" : "一覧を更新"}
          </Button>
        }
      />

      <Card className="border-amber-300/70 bg-amber-50/50">
        <CardContent className="flex gap-3 p-4 text-sm leading-relaxed text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold">変更前に確認してください</p>
            <p className="mt-1 text-amber-900/90">
              協力業者は引き続き全案件の概要を閲覧できますが、編集は担当会社の案件だけとなり、金額・社内情報は非公開になります。社員・協力業者は金額を閲覧できません。管理者・役員は金額を閲覧できますが、利益は閲覧できません。管理者は全エリア、社員・役員は閲覧エリアを指定できます。
            </p>
            <a href="/owner-partners" className="mt-2 inline-flex font-medium text-amber-950 underline underline-offset-4">
              協力会社の登録名やログイン担当の入替
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="名前・メールアドレス・ユーザーIDで検索"
              aria-label="名前・メールアドレス・ユーザーIDで検索"
              className="pl-9"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {peopleQuery.isLoading ? "利用者を読み込み中…" : `${filteredPeople.length} / ${people.length} 名を表示`}
          </p>
        </CardContent>
      </Card>

      {peopleQuery.isError && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span role="alert">利用者一覧を取得できませんでした。{peopleQuery.error?.message}</span>
            <Button variant="outline" size="sm" onClick={() => void peopleQuery.refetch()}>
              再試行
            </Button>
          </CardContent>
        </Card>
      )}

      {peopleQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="利用者を読み込み中">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="space-y-4 p-5">
                <div className="h-5 w-2/3 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="grid grid-cols-2 gap-3"><div className="h-20 rounded bg-muted" /><div className="h-20 rounded bg-muted" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !peopleQuery.isError && filteredPeople.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {people.length === 0 ? "変更対象の利用者がいません。" : "検索条件に一致する利用者がいません。"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPeople.map((person) => {
            const isLocked = person.role === "owner" || person.role === "customer";
            const isSelf = person.id === user?.id;
            const isPartner = person.role === "partner";
            const areas = parseAllowedPrefectures(person.allowedPrefectures);
            return (
              <Card key={person.id} className="flex min-w-0 flex-col">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{personName(person)}</h2>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{person.email ?? "メールアドレス未設定"}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">ID: {person.id}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 ${ROLE_BADGE_CLASS[person.role]}`}>
                      {ROLE_LABELS[person.role]}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-primary/5 p-3">
                      <p className="text-[11px] text-muted-foreground">社内担当</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">対応中 {person.activeInternalCases}件</p>
                      <p className="text-xs text-muted-foreground">全 {person.totalInternalCases}件</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/5 p-3">
                      <p className="text-[11px] text-muted-foreground">業者担当</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">対応中 {person.activePartnerCases}件</p>
                      <p className="text-xs text-muted-foreground">全 {person.totalPartnerCases}件</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t pt-3 text-xs">
                    <div className="flex gap-2">
                      <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 break-words"><span className="text-muted-foreground">マスタ紐付け: </span>{partnerLinkText(person.partnerLinks)}</span>
                    </div>
                    <div className="flex gap-2">
                      <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 break-words"><span className="text-muted-foreground">{isPartner ? "編集範囲" : "閲覧エリア"}: </span>{isPartner && person.areaAccessMode === "all" ? "担当会社の案件のみ（概要閲覧は全案件）" : areaSummary(person.areaAccessMode, areas)}</span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      {isSelf
                        ? "自分自身の役割は変更できません"
                        : isLocked
                          ? person.role === "owner" ? "最高管理者の役割は変更できません" : "顧客の役割は変更できません"
                          : isPartner ? "協力業者・社員・管理者・役員から選択できます" : "社員・管理者・役員・協力業者から選択できます"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-background"
                        onClick={() => openRenameEditor(person)}
                      >
                        登録名を変更
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-background"
                        disabled={isLocked || isSelf}
                        onClick={() => openEditor(person)}
                      >
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                        役割を変更
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !changeCategory.isPending) {
            setConfirmOpen(false);
            setEditor(null);
            setSubmitError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" showCloseButton={!changeCategory.isPending}>
          <DialogHeader>
            <DialogTitle>利用者区分を変更</DialogTitle>
            <DialogDescription>保存はまだ行いません。社員・管理者・役員・協力業者から選択後、確認画面で確定します。</DialogDescription>
          </DialogHeader>

          {editor && (
            <fieldset className="space-y-5" disabled={confirmOpen || changeCategory.isPending}>
              <div className="rounded-lg border bg-muted/35 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong>{personName(editor.user)}</strong>
                  <span className="font-mono text-xs text-muted-foreground">対象ID: {editor.user.id}</span>
                  <span className="text-xs text-muted-foreground">{editor.user.email ?? "メールアドレス未設定"}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={ROLE_BADGE_CLASS[editor.user.role]}>{ROLE_LABELS[editor.user.role]}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className={ROLE_BADGE_CLASS[editor.nextRole]}>{ROLE_LABELS[editor.nextRole]}</Badge>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="next-role">変更後の利用者区分 <span className="text-destructive">*</span></Label>
                <Select
                  value={editor.nextRole}
                  onValueChange={(value) => setEditor((current) => current ? {
                    ...current,
                    nextRole: value as EditableRole,
                    partnerId: value === "partner" ? current.partnerId : null,
                    accessMode: value === "admin" ? "all" : current.accessMode,
                  } : current)}
                >
                  <SelectTrigger id="next-role" className="w-full bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">社員</SelectItem>
                    <SelectItem value="admin">管理者</SelectItem>
                    <SelectItem value="executive">役員</SelectItem>
                    <SelectItem value="partner">協力業者</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{roleAccessSummary(editor.nextRole)}</p>
              </div>

              {isToPartner && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                  <div>
                    <Label htmlFor="partner-master">担当会社のマスタ <span className="text-destructive">*</span></Label>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">他の利用者に紐付いている協力会社は選択できません。変更後はこの担当会社の案件だけが編集対象となり、金額は非公開です。</p>
                  </div>
                  <Select
                    value={editor.partnerId ? String(editor.partnerId) : undefined}
                    onValueChange={(value) => setEditor((current) => current ? { ...current, partnerId: Number(value) } : current)}
                  >
                    <SelectTrigger id="partner-master" className="w-full bg-background"><SelectValue placeholder="担当会社を選択" /></SelectTrigger>
                    <SelectContent>
                      {selectablePartners.map((partner) => <SelectItem key={partner.id} value={String(partner.id)}>{partner.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectablePartners.length === 0 && <p className="text-sm text-destructive">選択可能な有効協力会社がありません。協力会社マスタの紐付けを確認してください。</p>}
                  {editor.user.role === "admin" || editor.user.role === "executive" ? (
                    <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                      <strong>役割の変更:</strong> {ROLE_LABELS[editor.user.role]}から協力業者になるため、現在の{ROLE_LABELS[editor.user.role]}権限も失われます。
                    </p>
                  ) : null}
                </div>
              )}

              {isInternalRole && (
                <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                  <div>
                    <Label>{ROLE_LABELS[editor.nextRole]}としての閲覧エリア <span className="text-destructive">*</span></Label>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{roleAccessSummary(editor.nextRole)} 閲覧対象を明示してください。旧業者案件は社内案件へ移しません。</p>
                  </div>
                  <Select
                    value={editor.accessMode}
                    disabled={editor.nextRole === "admin"}
                    onValueChange={(value) => setEditor((current) => current ? { ...current, accessMode: value as AccessMode } : current)}
                  >
                    <SelectTrigger className="w-full bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全エリアを閲覧</SelectItem>
                      <SelectItem value="selected">選択した都道府県だけを閲覧</SelectItem>
                    </SelectContent>
                  </Select>

                  {editor.accessMode === "selected" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">{editor.allowedPrefectures.length}県を選択中（1県以上必須）</p>
                        <div className="flex gap-1">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditor((current) => current ? { ...current, allowedPrefectures: [...PREFECTURES] } : current)}>すべて選択</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditor((current) => current ? { ...current, allowedPrefectures: [] } : current)}>解除</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
                        {PREFECTURES.map((prefecture) => (
                          <label key={prefecture} className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                              checked={editor.allowedPrefectures.includes(prefecture)}
                              onCheckedChange={(checked) => togglePrefecture(prefecture, checked === true)}
                            />
                            {prefecture}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="change-reason">変更理由 <span className="text-destructive">*</span></Label>
                <Textarea
                  id="change-reason"
                  value={editor.reason}
                  onChange={(event) => setEditor((current) => current ? { ...current, reason: event.target.value } : current)}
                  maxLength={500}
                  rows={3}
                  placeholder="例：協力会社への所属変更に伴い、案件閲覧範囲を見直すため"
                />
                <p className={`text-xs ${reasonLength > 0 && (reasonLength < 3 || reasonLength > 500) ? "text-destructive" : "text-muted-foreground"}`}>3〜500文字（現在 {reasonLength}文字）</p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm leading-relaxed text-amber-950">
                <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />案件の自動移管はありません</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
                  <li>旧社内担当の案件割当は引継ぎ保持し、変更・解除しません。</li>
                  <li>社員に変更しても、旧業者案件を社員案件として移しません。</li>
                  <li>変更後の新規閲覧・編集範囲だけに権限が反映されます。</li>
                </ul>
              </div>
            </fieldset>
          )}

          <DialogFooter>
            <Button variant="outline" className="bg-background" disabled={changeCategory.isPending} onClick={() => setEditor(null)}>キャンセル</Button>
            <Button disabled={!editorValid || changeCategory.isPending} onClick={requestConfirmation}>
              内容を確認
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!changeCategory.isPending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>この内容で利用者区分を変更しますか？</AlertDialogTitle>
            <AlertDialogDescription>権限と金額の表示範囲が変更されます。送信後も既存案件の自動移管は行われません。</AlertDialogDescription>
          </AlertDialogHeader>

          {editor && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">対象</span>
                <strong>{personName(editor.user)}</strong>
                <span className="font-mono text-xs">対象ID: {editor.user.id}</span>
                <span className="text-xs">{editor.user.email ?? "メールアドレス未設定"}</span>
              </div>
              <div className="grid gap-1 border-t pt-3">
                <span className="text-xs text-muted-foreground">役割</span>
                <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={ROLE_BADGE_CLASS[editor.user.role]}>{ROLE_LABELS[editor.user.role]}</Badge><ArrowRight className="h-4 w-4" /><Badge variant="outline" className={ROLE_BADGE_CLASS[editor.nextRole]}>{ROLE_LABELS[editor.nextRole]}</Badge></div>
              </div>
              <div className="grid gap-1 border-t pt-3">
                <span className="text-xs text-muted-foreground">マスタ紐付け</span>
                <span>{partnerLinkText(editor.user.partnerLinks)} <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> {editor.nextRole === "partner" ? (selectedPartner?.name ?? "未選択") : `解除（${ROLE_LABELS[editor.nextRole]}へ変更）`}</span>
              </div>
              {editor.nextRole !== "partner" && (
                <div className="grid gap-1 border-t pt-3">
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[editor.nextRole]}の閲覧エリア</span>
                  <span>{areaSummary(editor.accessMode, editor.allowedPrefectures)}</span>
                </div>
              )}
              <div className="grid gap-1 border-t pt-3">
                <span className="text-xs text-muted-foreground">金額・利益の表示</span>
                <span>{roleAccessSummary(editor.nextRole)}</span>
              </div>
              <div className="grid gap-1 border-t pt-3">
                <span className="text-xs text-muted-foreground">変更理由</span>
                <span className="whitespace-pre-wrap break-words">{editor.reason.trim()}</span>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
            <p><strong>旧社内担当は引継ぎ保持</strong>し、既存案件の担当を変更しません。</p>
            <p className="mt-1"><strong>社員に旧業者案件を移さない</strong>ため、担当会社案件が社員案件に変わることはありません。</p>
          </div>

          {submitError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{submitError}</p>}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={changeCategory.isPending}>キャンセル</AlertDialogCancel>
            <Button onClick={executeChange} disabled={!editorValid || changeCategory.isPending}>
              {changeCategory.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />更新中…</> : "変更を確定する"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={renameEditor !== null}
        onOpenChange={(open) => {
          if (!open && !renameUser.isPending) {
            setRenameConfirmOpen(false);
            setRenameEditor(null);
            setRenameSubmitError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" showCloseButton={!renameUser.isPending}>
          <DialogHeader>
            <DialogTitle>登録名を変更</DialogTitle>
            <DialogDescription>保存はまだ行いません。対象者と旧名・新名を確認してから確定します。</DialogDescription>
          </DialogHeader>

          {renameEditor && (
            <fieldset className="space-y-5" disabled={renameConfirmOpen || renameUser.isPending}>
              <div className="rounded-lg border bg-muted/35 p-4 text-sm">
                <div className="grid gap-1">
                  <strong>{personName(renameEditor.user)}</strong>
                  <span className="font-mono text-xs text-muted-foreground">対象ID: {renameEditor.user.id}</span>
                  <span className="text-xs text-muted-foreground">{renameEditor.user.email ?? "メールアドレス未設定"}</span>
                </div>
                <div className="mt-3 grid gap-1 border-t pt-3">
                  <span className="text-xs text-muted-foreground">旧名</span>
                  <span className="break-words">{personName(renameEditor.user)}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="rename-name">新しい登録名 <span className="text-destructive">*</span></Label>
                <Input
                  id="rename-name"
                  value={renameEditor.name}
                  onChange={(event) => setRenameEditor((current) => current ? { ...current, name: event.target.value } : current)}
                  maxLength={128}
                  placeholder="登録名を入力"
                />
                <p className={`text-xs ${renameNameLength > 0 && (renameNameLength < 1 || renameNameLength > 128) ? "text-destructive" : "text-muted-foreground"}`}>1〜128文字（現在 {renameNameLength}文字）</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="rename-reason">変更理由 <span className="text-destructive">*</span></Label>
                <Textarea
                  id="rename-reason"
                  value={renameEditor.reason}
                  onChange={(event) => setRenameEditor((current) => current ? { ...current, reason: event.target.value } : current)}
                  maxLength={500}
                  rows={3}
                  placeholder="例：登録情報を最新の氏名・会社名に更新するため"
                />
                <p className={`text-xs ${renameReasonLength > 0 && (renameReasonLength < 3 || renameReasonLength > 500) ? "text-destructive" : "text-muted-foreground"}`}>3〜500文字（現在 {renameReasonLength}文字）</p>
              </div>
            </fieldset>
          )}

          <DialogFooter>
            <Button variant="outline" className="bg-background" disabled={renameUser.isPending} onClick={() => setRenameEditor(null)}>キャンセル</Button>
            <Button disabled={!renameValid || renameUser.isPending} onClick={requestRenameConfirmation}>
              内容を確認
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={renameConfirmOpen}
        onOpenChange={(open) => {
          if (!renameUser.isPending) setRenameConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>この内容で登録名を変更しますか？</AlertDialogTitle>
            <AlertDialogDescription>ユーザーID、メールアドレス、旧名と新名を確認してから確定してください。</AlertDialogDescription>
          </AlertDialogHeader>

          {renameEditor && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">対象</span>
                <span className="font-mono text-xs">対象ID: {renameEditor.user.id}</span>
                <span className="text-xs">{renameEditor.user.email ?? "メールアドレス未設定"}</span>
              </div>
              <div className="grid gap-1 border-t pt-3">
                <span className="text-xs text-muted-foreground">登録名</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words">{personName(renameEditor.user)}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <strong className="break-words">{renameEditor.name.trim()}</strong>
                </div>
              </div>
              <div className="grid gap-1 border-t pt-3">
                <span className="text-xs text-muted-foreground">変更理由</span>
                <span className="whitespace-pre-wrap break-words">{renameEditor.reason.trim()}</span>
              </div>
            </div>
          )}

          {renameSubmitError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{renameSubmitError}</p>}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={renameUser.isPending}>キャンセル</AlertDialogCancel>
            <Button onClick={executeRename} disabled={!renameValid || renameUser.isPending}>
              {renameUser.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />更新中…</> : "登録名の変更を確定する"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
