import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { clearPendingMobileLinkCode, savePendingMobileLinkCode } from "@/lib/mobileLinkPending";

const PLATFORM_LABELS: Record<string, string> = {
  ios: "iPhone / iPad",
  android: "Android",
  web: "Web ブラウザ",
  other: "その他の端末",
};

const LOOKUP_MESSAGES: Record<string, string> = {
  invalid_code: "確認コードの形式が正しくありません。アプリに表示された 8 文字（例: BCDF-GHJK）を入力してください。",
  not_found: "この確認コードの連携申請は見つかりません。アプリで連携をやり直してください。",
  expired: "確認コードの有効期限（10分）が切れています。アプリで「連携をやり直す」を押してください。",
  decided: "この連携申請はすでに処理済みです。",
};

function readCodeFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("code")?.trim() ?? "";
}

function replaceCodeInUrl(code: string) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("code", code);
  else url.searchParams.delete("code");
  window.history.replaceState(null, "", url.toString());
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-start md:items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Smartphone className="h-4 w-4" />
          <span className="text-[11px] uppercase tracking-[0.22em] font-medium">Store-OSX モバイル連携</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function CodeEntry({ initial, onSubmit }: { initial?: string; onSubmit: (code: string) => void }) {
  const [value, setValue] = useState(initial ?? "");
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h1 className="font-serif-jp text-xl font-semibold">確認コードを入力</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          スマートフォンの Store-OSX アプリに表示されている 8 文字の確認コードを入力してください。
        </p>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) onSubmit(value.trim().toUpperCase());
          }}
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="BCDF-GHJK"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            className="font-mono tracking-[0.2em] text-lg uppercase"
            maxLength={12}
          />
          <Button type="submit" disabled={!value.trim()}>
            確認
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function MobileLink() {
  const { user, loading } = useAuth();
  const [code, setCode] = useState(readCodeFromUrl);
  const [result, setResult] = useState<{ kind: "approved" | "denied"; deviceName: string } | null>(null);

  // 未ログインのまま開かれた場合は、ログイン後に戻れるよう確認コードを保存する。
  useEffect(() => {
    if (loading) return;
    if (!user && code) savePendingMobileLinkCode(code);
    if (user) clearPendingMobileLinkCode();
  }, [loading, user, code]);

  const lookup = trpc.mobileDevices.lookup.useQuery(
    { userCode: code },
    { enabled: Boolean(user && code && !result), retry: false, refetchOnWindowFocus: false },
  );
  const approve = trpc.mobileDevices.approve.useMutation({
    onSuccess: (data) => setResult({ kind: "approved", deviceName: data.deviceName }),
  });
  const deny = trpc.mobileDevices.deny.useMutation({
    onSuccess: (data) => setResult({ kind: "denied", deviceName: data.deviceName }),
  });

  const changeCode = (next: string) => {
    setCode(next);
    setResult(null);
    approve.reset();
    deny.reset();
    replaceCodeInUrl(next);
  };

  const errorMessage = useMemo(() => {
    const error = approve.error ?? deny.error ?? lookup.error;
    return error?.message ?? null;
  }, [approve.error, deny.error, lookup.error]);

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Card>
          <CardContent className="pt-6 space-y-5">
            <h1 className="font-serif-jp text-xl font-semibold leading-snug">
              Store-OSX にログインして、
              <br />
              この端末を連携します
            </h1>
            {code && (
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">確認コード</p>
                <p className="font-mono text-2xl tracking-[0.25em] font-semibold">{code.toUpperCase()}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              普段お使いのアカウントでログインしてください。ログイン後、この画面に戻って連携を承認できます。
            </p>
            <Button className="w-full" size="lg" onClick={() => (window.location.href = getLoginUrl())}>
              ログインして続ける
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (result) {
    const approved = result.kind === "approved";
    return (
      <Shell>
        <Card>
          <CardContent className="pt-6 space-y-4 text-center">
            {approved ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            ) : (
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            )}
            <h1 className="font-serif-jp text-xl font-semibold">
              {approved ? "連携を承認しました" : "連携を拒否しました"}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {approved
                ? `「${result.deviceName}」を ${user.name ?? "あなた"} さんのアカウントで連携しました。アプリに戻ると自動で使えるようになります。`
                : `「${result.deviceName}」からの連携申請を拒否しました。心当たりがない場合は管理者へ連絡してください。`}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" onClick={() => (window.location.href = "/settings/mobile-devices")}>
                連携端末の一覧を見る
              </Button>
              <Button variant="ghost" onClick={() => (window.location.href = "/")}>
                Store-OSX のトップへ
              </Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!code) {
    return (
      <Shell>
        <CodeEntry onSubmit={changeCode} />
      </Shell>
    );
  }

  if (lookup.isLoading) {
    return (
      <Shell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Shell>
    );
  }

  const data = lookup.data;
  if (!data || data.state !== "pending") {
    const message = data ? LOOKUP_MESSAGES[data.state] : errorMessage ?? "連携申請を確認できませんでした。";
    return (
      <Shell>
        <Card className="border-destructive/40">
          <CardContent className="pt-6 space-y-2">
            <p className="text-sm font-medium text-destructive">{message}</p>
          </CardContent>
        </Card>
        <CodeEntry onSubmit={changeCode} />
      </Shell>
    );
  }

  const busy = approve.isPending || deny.isPending;
  return (
    <Shell>
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-serif-jp text-xl font-semibold">この端末を連携しますか？</h1>
          </div>
          <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">確認コード</p>
            <p className="font-mono text-3xl tracking-[0.25em] font-semibold">{data.userCode}</p>
            <p className="text-xs text-muted-foreground mt-2">
              アプリに表示されているコードと同じか確かめてください。違う場合は「拒否する」を押してください。
            </p>
          </div>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">端末名</dt>
            <dd className="font-medium break-all">{data.deviceName}</dd>
            <dt className="text-muted-foreground">種類</dt>
            <dd>{PLATFORM_LABELS[data.platform] ?? data.platform}</dd>
            <dt className="text-muted-foreground">申請日時</dt>
            <dd>{formatDateTime(data.createdAt)}</dd>
            <dt className="text-muted-foreground">連携先</dt>
            <dd className="font-medium">{user.name ?? user.email ?? "あなたのアカウント"}</dd>
          </dl>
          <p className="text-xs text-muted-foreground leading-relaxed">
            連携すると、この端末からあなたの権限で案件の閲覧・更新・写真の送信ができます。連携は「モバイル連携端末」画面からいつでも解除できます。
          </p>
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <div className="flex flex-col gap-2">
            <Button size="lg" disabled={busy} onClick={() => approve.mutate({ userCode: code })}>
              {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "この端末を連携する"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => deny.mutate({ userCode: code })}>
              拒否する
            </Button>
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
}
