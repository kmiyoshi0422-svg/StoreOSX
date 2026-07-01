import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import type { Partner } from "../../../drizzle/schema";
import {
  Briefcase,
  History,
  Loader2,
  Phone,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  Mail,
  MapPin,
} from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const CATEGORIES = [
  "電気",
  "給排水",
  "空調",
  "厨房設備",
  "排気・換気",
  "内装",
  "床",
  "看板",
  "外壁",
  "建具",
  "防水",
  "その他",
] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<Category, string> = {
  電気: "bg-amber-100 text-amber-900 border-amber-200",
  給排水: "bg-sky-100 text-sky-900 border-sky-200",
  空調: "bg-cyan-100 text-cyan-900 border-cyan-200",
  厨房設備: "bg-orange-100 text-orange-900 border-orange-200",
  "排気・換気": "bg-teal-100 text-teal-900 border-teal-200",
  内装: "bg-violet-100 text-violet-900 border-violet-200",
  床: "bg-stone-100 text-stone-900 border-stone-200",
  看板: "bg-rose-100 text-rose-900 border-rose-200",
  外壁: "bg-slate-100 text-slate-900 border-slate-200",
  建具: "bg-emerald-100 text-emerald-900 border-emerald-200",
  防水: "bg-blue-100 text-blue-900 border-blue-200",
  その他: "bg-zinc-100 text-zinc-900 border-zinc-200",
};

type FormData = {
  name: string;
  category: Category;
  phone: string;
  pic: string;
  picPhone: string;
  email: string;
  address: string;
  area: string;
  notes: string;
  isActive: boolean;
};

const emptyForm: FormData = {
  name: "",
  category: "その他",
  phone: "",
  pic: "",
  picPhone: "",
  email: "",
  address: "",
  area: "",
  notes: "",
  isActive: true,
};

// 電話番号を tel: リンク用に整形
function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.replace(/[^\d+]/g, "");
  return trimmed.length > 0 ? `tel:${trimmed}` : null;
}

export default function Partners() {
  const utils = trpc.useUtils();
  const { data: partners, isLoading } = trpc.partners.list.useQuery();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const createMut = trpc.partners.create.useMutation({
    onSuccess: () => {
      utils.partners.list.invalidate();
      toast.success("協力会社を登録しました");
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.partners.update.useMutation({
    onSuccess: () => {
      utils.partners.list.invalidate();
      toast.success("協力会社を更新しました");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.partners.delete.useMutation({
    onSuccess: () => {
      utils.partners.list.invalidate();
      toast.success("削除しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list: Partner[] = partners ?? [];
    return list.filter((p) => {
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.pic ?? "").toLowerCase().includes(q) ||
        (p.area ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q) ||
        (p.picPhone ?? "").includes(q)
      );
    });
  }, [partners, search, filterCategory]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: p.category as Category,
      phone: p.phone ?? "",
      pic: p.pic ?? "",
      picPhone: p.picPhone ?? "",
      email: p.email ?? "",
      address: p.address ?? "",
      area: p.area ?? "",
      notes: p.notes ?? "",
      isActive: p.isActive,
    });
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("会社名は必須です");
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category,
      phone: form.phone.trim() || null,
      pic: form.pic.trim() || null,
      picPhone: form.picPhone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      area: form.area.trim() || null,
      notes: form.notes.trim() || null,
      isActive: form.isActive,
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            協力会社マスタ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            業種別に協力会社を管理し、案件に紐付けてワンタップで電話発信できます
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />新規登録
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "協力会社を編集" : "協力会社を新規登録"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>会社名 <span className="text-destructive">*</span></Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例：◯◯電気工業株式会社"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>業種</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v as Category })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>対応エリア</Label>
                  <Input
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="例：福岡県全域"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>代表電話</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="例：092-000-0000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>メール</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="info@example.co.jp"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>担当者名</Label>
                  <Input
                    value={form.pic}
                    onChange={(e) => setForm({ ...form, pic: e.target.value })}
                    placeholder="例：山田太郎"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>担当者携帯</Label>
                  <Input
                    type="tel"
                    value={form.picPhone}
                    onChange={(e) => setForm({ ...form, picPhone: e.target.value })}
                    placeholder="例：090-0000-0000"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>住所</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="例：福岡県福岡市..."
                />
              </div>
              <div className="grid gap-2">
                <Label>備考</Label>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="得意分野・取引履歴など"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive" className="cursor-pointer">有効・現役の協力会社</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="bg-background" onClick={() => setDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingId ? "更新" : "登録"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* フィルター */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="会社名・担当者・エリア・電話番号で検索"
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全業種</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 一覧 */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center flex flex-col items-center gap-3">
            <Briefcase className="h-10 w-10 text-muted-foreground/70" />
            <p className="font-medium">
              {partners && partners.length > 0
                ? "条件に一致する協力会社がありません"
                : "協力会社が未登録です"}
            </p>
            {(!partners || partners.length === 0) && (
              <p className="text-sm text-muted-foreground max-w-sm">右上の「新規登録」ボタンから、または「CSV一括取込」ページから追加してください。</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const repTel = telHref(p.phone);
            const picTel = telHref(p.picPhone);
            return (
              <Card key={p.id} className={p.isActive ? "" : "opacity-60"}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-xs ${CATEGORY_COLORS[p.category as Category] ?? ""}`}
                        >
                          {p.category}
                        </Badge>
                        {!p.isActive && (
                          <Badge variant="outline" className="text-xs">休止</Badge>
                        )}
                      </div>
                      <Link href={`/partners/${p.id}`}>
                        <h3 className="font-serif text-lg mt-2 truncate hover:underline cursor-pointer">{p.name}</h3>
                      </Link>
                      {p.area && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{p.area}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Link href={`/partners/${p.id}`}>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="発注履歴">
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{p.name} を削除しますか？</AlertDialogTitle>
                            <AlertDialogDescription>
                              紐付いている案件があった場合、関連情報のみ残り、業者情報は外れます。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMut.mutate({ id: p.id })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {p.pic && (
                    <div className="mt-3 pt-3 border-t text-sm">
                      <span className="text-xs text-muted-foreground">担当：</span>
                      <span className="font-medium">{p.pic}</span>
                    </div>
                  )}

                  {/* ワンタップ電話発信 */}
                  <div className="mt-3 grid gap-2">
                    {repTel ? (
                      <a href={repTel} className="block">
                        <Button variant="outline" className="w-full justify-start bg-background" size="sm">
                          <Phone className="h-3.5 w-3.5" />
                          <span className="font-mono text-sm">{p.phone}</span>
                          <span className="ml-auto text-xs text-muted-foreground">代表</span>
                        </Button>
                      </a>
                    ) : null}
                    {picTel ? (
                      <a href={picTel} className="block">
                        <Button variant="outline" className="w-full justify-start bg-background" size="sm">
                          <Smartphone className="h-3.5 w-3.5" />
                          <span className="font-mono text-sm">{p.picPhone}</span>
                          <span className="ml-auto text-xs text-muted-foreground">担当者</span>
                        </Button>
                      </a>
                    ) : null}
                    {p.email && (
                      <a href={`mailto:${p.email}`} className="block">
                        <Button variant="outline" className="w-full justify-start bg-background" size="sm">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="text-sm truncate">{p.email}</span>
                        </Button>
                      </a>
                    )}
                  </div>

                  {p.notes && (
                    <p className="mt-3 pt-3 border-t text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                      {p.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
