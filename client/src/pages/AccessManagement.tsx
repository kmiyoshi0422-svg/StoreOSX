import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PREFECTURES, REGIONS, regionOfPrefecture } from "@shared/prefecture";
import { Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Role = "user" | "executive" | "admin" | "owner" | "partner" | "customer";
type AccessMode = "all" | "selected";
type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: Role;
  areaAccessMode: AccessMode;
  allowedPrefectures: string | null;
};

const ROLE_LABELS: Record<Role, string> = {
  owner: "オーナー",
  admin: "管理者",
  executive: "役員",
  user: "社員",
  partner: "協力業者",
  customer: "顧客",
};

function parseAreas(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default function AccessManagement() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.accessList.useQuery();
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [role, setRole] = useState<Role>("user");
  const [mode, setMode] = useState<AccessMode>("all");
  const [areas, setAreas] = useState<string[]>([]);

  const update = trpc.users.updateAccess.useMutation({
    onSuccess: async () => {
      toast.success("役割・閲覧エリアを更新しました");
      setEditing(null);
      await utils.users.accessList.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const grouped = useMemo(() => REGIONS.map((region) => ({
    region,
    prefectures: PREFECTURES.filter((prefecture) => regionOfPrefecture(prefecture) === region),
  })), []);

  const openEditor = (user: UserRow) => {
    setEditing(user);
    setRole(user.role);
    setMode(user.areaAccessMode ?? "all");
    setAreas(parseAreas(user.allowedPrefectures));
  };

  const toggleArea = (prefecture: string, checked: boolean) => {
    setAreas((current) => checked
      ? Array.from(new Set([...current, prefecture]))
      : current.filter((item) => item !== prefecture));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">役割・閲覧エリア管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">役割ごとの金額権限と、案件を閲覧できる都道府県を管理します。</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5" /> 権限の線引き</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <div><strong>管理者</strong><p className="text-muted-foreground">全情報・全エリア・権限設定</p></div>
          <div><strong>役員</strong><p className="text-muted-foreground">金額を含む情報。設定したエリアのみ</p></div>
          <div><strong>社員</strong><p className="text-muted-foreground">社内金額を除く情報。設定したエリアのみ</p></div>
          <div><strong>協力業者</strong><p className="text-muted-foreground">担当案件と本人入力経費のみ</p></div>
          <div><strong>顧客</strong><p className="text-muted-foreground">設定エリアの案件。金額は非表示</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>ユーザー</TableHead><TableHead>役割</TableHead><TableHead>閲覧エリア</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((raw) => {
                const user = raw as UserRow;
                const selected = parseAreas(user.allowedPrefectures);
                const isAll = ["owner", "admin"].includes(user.role) || user.areaAccessMode !== "selected";
                return (
                  <TableRow key={user.id}>
                    <TableCell><div className="font-medium">{user.name || "名称未設定"}</div><div className="text-xs text-muted-foreground">{user.email || `ID: ${user.id}`}</div></TableCell>
                    <TableCell><Badge variant="outline">{ROLE_LABELS[user.role]}</Badge></TableCell>
                    <TableCell className="max-w-md text-sm">{isAll ? "全エリア" : selected.length ? selected.join("、") : "閲覧可能エリアなし"}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" disabled={user.role === "owner"} onClick={() => openEditor(user)}><Settings2 className="mr-1 h-4 w-4" />設定</Button></TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && users.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">ユーザーがありません</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.name || "ユーザー"}の権限設定</DialogTitle><DialogDescription>管理者は常に全エリアです。その他の役割は全エリアまたは選択エリアに制限できます。</DialogDescription></DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-2"><Label>役割</Label><Select value={role} onValueChange={(value) => { const next = value as Role; setRole(next); if (["owner", "admin"].includes(next)) setMode("all"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["admin", "executive", "user", "partner", "customer"] as Role[]).map((item) => <SelectItem key={item} value={item}>{ROLE_LABELS[item]}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>案件の閲覧範囲</Label><Select value={mode} disabled={["owner", "admin"].includes(role)} onValueChange={(value) => setMode(value as AccessMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全エリア</SelectItem><SelectItem value="selected">選択した都道府県のみ</SelectItem></SelectContent></Select></div>
            {mode === "selected" && (
              <div className="space-y-4">
                <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setAreas([...PREFECTURES])}>すべて選択</Button><Button type="button" size="sm" variant="ghost" onClick={() => setAreas([])}>すべて解除</Button></div>
                <div className="grid gap-4 md:grid-cols-2">
                  {grouped.map(({ region, prefectures }) => <div key={region} className="space-y-2"><div className="font-medium">{region}</div><div className="grid grid-cols-2 gap-2">{prefectures.map((prefecture) => <label key={prefecture} className="flex items-center gap-2 text-sm"><Checkbox checked={areas.includes(prefecture)} onCheckedChange={(checked) => toggleArea(prefecture, checked === true)} />{prefecture}</label>)}</div></div>)}
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>キャンセル</Button><Button disabled={update.isPending || (mode === "selected" && areas.length === 0)} onClick={() => editing && update.mutate({ id: editing.id, role, areaAccessMode: mode, allowedPrefectures: areas as any })}>{update.isPending ? "保存中..." : "保存"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
