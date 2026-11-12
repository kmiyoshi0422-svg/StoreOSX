import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, Smartphone, Unlink } from "lucide-react";
import { toast } from "sonner";

const PLATFORM_LABELS: Record<string, string> = {
  ios: "iPhone / iPad",
  android: "Android",
  web: "Web ブラウザ",
  other: "その他",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "最高管理者",
  admin: "管理者",
  executive: "役員",
  user: "社員",
  partner: "協力業者",
  customer: "顧客",
};

type DeviceRow = {
  id: number;
  userId: number;
  deviceName: string;
  platform: string;
  tokenPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  userName?: string;
  userRole?: string | null;
};

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "未使用";
  return new Date(value).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

function DeviceList({
  rows,
  loading,
  showOwner,
  onRevoke,
}: {
  rows: DeviceRow[] | undefined;
  loading: boolean;
  showOwner: boolean;
  onRevoke: (row: DeviceRow) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          連携している端末はありません。
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Smartphone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium break-all">{row.deviceName}</span>
                  <Badge variant="secondary">{PLATFORM_LABELS[row.platform] ?? row.platform}</Badge>
                  {showOwner && row.userName && (
                    <Badge variant="outline">
                      {row.userName}
                      {row.userRole ? `（${ROLE_LABELS[row.userRole] ?? row.userRole}）` : ""}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  連携 {formatDateTime(row.createdAt)} ／ 最終利用 {formatDateTime(row.lastUsedAt)} ／ 有効期限 {formatDateTime(row.expiresAt)}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">{row.tokenPrefix}…</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="self-start md:self-center" onClick={() => onRevoke(row)}>
              <Unlink className="h-4 w-4 mr-1" />
              連携を解除
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function MobileDevices() {
  const { user } = useAuth();
  const canSeeAll = user?.role === "owner" || user?.role === "admin";
  const utils = trpc.useUtils();
  const mine = trpc.mobileDevices.listMine.useQuery();
  const all = trpc.mobileDevices.listAll.useQuery(undefined, { enabled: canSeeAll });
  const [target, setTarget] = useState<DeviceRow | null>(null);
  const [code, setCode] = useState("");

  const revoke = trpc.mobileDevices.revoke.useMutation({
    onSuccess: async () => {
      toast.success("連携を解除しました。その端末からは再連携するまで利用できません");
      setTarget(null);
      await Promise.all([utils.mobileDevices.listMine.invalidate(), utils.mobileDevices.listAll.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Settings"
        title="モバイル連携端末"
        icon={<Smartphone className="h-6 w-6" />}
        description="Store-OSX モバイルアプリと連携している端末の一覧です。紛失・機種変更・退職時は、ここから連携を解除してください。"
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form
            className="flex flex-col md:flex-row md:items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim()) window.location.href = `/mobile-link?code=${encodeURIComponent(code.trim().toUpperCase())}`;
            }}
          >
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                確認コードで新しい端末を連携
              </p>
              <p className="text-xs text-muted-foreground">アプリの連携画面に表示された 8 文字のコードを入力します。</p>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="BCDF-GHJK"
                className="font-mono tracking-[0.2em] uppercase md:max-w-xs"
                maxLength={12}
              />
            </div>
            <Button type="submit" disabled={!code.trim()}>
              連携を確認
            </Button>
          </form>
        </CardContent>
      </Card>

      {canSeeAll ? (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">自分の端末</TabsTrigger>
            <TabsTrigger value="all">全利用者の端末</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="mt-4">
            <DeviceList rows={mine.data} loading={mine.isLoading} showOwner={false} onRevoke={setTarget} />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <DeviceList rows={all.data} loading={all.isLoading} showOwner onRevoke={setTarget} />
          </TabsContent>
        </Tabs>
      ) : (
        <DeviceList rows={mine.data} loading={mine.isLoading} showOwner={false} onRevoke={setTarget} />
      )}

      <AlertDialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{target?.deviceName}」の連携を解除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              解除すると、この端末のアプリは Store-OSX に接続できなくなります。端末に残っている未送信の写真は送信できなくなるため、必要なら先にアプリで送信を済ませてください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoke.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (target) revoke.mutate({ id: target.id });
              }}
            >
              {revoke.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "解除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
