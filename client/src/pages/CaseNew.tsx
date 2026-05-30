import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  CATEGORY_LARGE_OPTIONS,
  CATEGORY_MEDIUM_OPTIONS,
} from "../../../shared/checklist-template";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

export default function CaseNew() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const createMutation = trpc.cases.create.useMutation({
    onSuccess: ({ id }) => {
      toast.success("案件を登録しました");
      utils.cases.list.invalidate();
      setLocation(`/cases/${id}`);
    },
    onError: (e) => {
      toast.error(e.message || "登録に失敗しました");
    },
  });

  const [form, setForm] = useState({
    requestNumber: "",
    brand: "ほっともっと" as "ほっともっと" | "やよい軒" | "その他",
    storeName: "",
    storeCode: "",
    shopId: "",
    address: "",
    storePhone: "",
    businessHours: "",
    requesterName: "",
    requesterPhone: "",
    requestContent: "",
    workType: "修理" as "入替" | "修理" | "納品" | "見積り" | "新規",
    costBearer: "店舗" as "店舗" | "営業部" | "その他",
    categoryLarge: "",
    categoryMedium: "",
    categorySmall: "",
    contractorName: "",
    contractorPic: "",
    contractorPhone: "",
    status: "受付" as "受付" | "現調中" | "見積中" | "施工待ち" | "施工中" | "完了" | "クローズ",
    urgency: "B" as "S" | "A" | "B" | "C",
    notes: "",
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = () => {
    if (!form.requestNumber.trim() || !form.storeName.trim()) {
      toast.error("依頼番号と店舗名は必須です");
      return;
    }
    createMutation.mutate({
      ...form,
      categoryLarge: form.categoryLarge || null,
      categoryMedium: form.categoryMedium || null,
      categorySmall: form.categorySmall || null,
      requestDate: new Date(),
    });
  };

  const mediumOptions =
    form.categoryLarge && CATEGORY_MEDIUM_OPTIONS[form.categoryLarge]
      ? CATEGORY_MEDIUM_OPTIONS[form.categoryLarge]
      : [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/cases")}
            className="-ml-2 mb-2 h-7 text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            案件一覧へ
          </Button>
          <h1 className="font-serif-jp text-3xl font-semibold tracking-tight">案件登録</h1>
          <p className="text-sm text-muted-foreground mt-1">
            プレナス修理依頼システムの情報を入力してください
          </p>
        </div>
      </div>

      {/* 店舗情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif-jp text-lg">店舗情報</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="依頼番号 *">
            <Input
              value={form.requestNumber}
              onChange={(e) => update("requestNumber", e.target.value)}
              placeholder="例: 284909-1"
            />
          </Field>
          <Field label="ブランド">
            <Select value={form.brand} onValueChange={(v) => update("brand", v as never)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ほっともっと">ほっともっと</SelectItem>
                <SelectItem value="やよい軒">やよい軒</SelectItem>
                <SelectItem value="その他">その他</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="店舗名 *">
            <Input
              value={form.storeName}
              onChange={(e) => update("storeName", e.target.value)}
              placeholder="例: ほっともっと八女井延店"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="店舗コード">
              <Input
                value={form.storeCode}
                onChange={(e) => update("storeCode", e.target.value)}
              />
            </Field>
            <Field label="SHOP-ID">
              <Input
                value={form.shopId}
                onChange={(e) => update("shopId", e.target.value)}
              />
            </Field>
          </div>
          <Field label="住所" className="md:col-span-2">
            <Input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="例: 山口県下関市古ヶ峠1-10"
            />
          </Field>
          <Field label="店舗電話">
            <Input
              value={form.storePhone}
              onChange={(e) => update("storePhone", e.target.value)}
            />
          </Field>
          <Field label="営業時間">
            <Input
              value={form.businessHours}
              onChange={(e) => update("businessHours", e.target.value)}
              placeholder="例: 09:00~23:00"
            />
          </Field>
        </CardContent>
      </Card>

      {/* 依頼内容 */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif-jp text-lg">依頼内容</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="依頼者">
            <Input
              value={form.requesterName}
              onChange={(e) => update("requesterName", e.target.value)}
            />
          </Field>
          <Field label="依頼者連絡先">
            <Input
              value={form.requesterPhone}
              onChange={(e) => update("requesterPhone", e.target.value)}
            />
          </Field>
          <Field label="依頼内容" className="md:col-span-2">
            <Textarea
              value={form.requestContent}
              onChange={(e) => update("requestContent", e.target.value)}
              rows={3}
              placeholder="依頼の詳細を記入"
            />
          </Field>
          <Field label="作業区分">
            <Select value={form.workType} onValueChange={(v) => update("workType", v as never)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="入替">入替</SelectItem>
                <SelectItem value="修理">修理</SelectItem>
                <SelectItem value="納品">納品</SelectItem>
                <SelectItem value="見積り">見積り</SelectItem>
                <SelectItem value="新規">新規</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="費用負担">
            <Select
              value={form.costBearer}
              onValueChange={(v) => update("costBearer", v as never)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="店舗">店舗</SelectItem>
                <SelectItem value="営業部">営業部</SelectItem>
                <SelectItem value="その他">その他</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* 修理内容 */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif-jp text-lg">修理内容</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="大項目">
            <Select
              value={form.categoryLarge || "__none__"}
              onValueChange={(v) => {
                update("categoryLarge", v === "__none__" ? "" : v);
                update("categoryMedium", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未選択</SelectItem>
                {CATEGORY_LARGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="中項目">
            <Select
              value={form.categoryMedium || "__none__"}
              onValueChange={(v) => update("categoryMedium", v === "__none__" ? "" : v)}
              disabled={!form.categoryLarge}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未選択</SelectItem>
                {mediumOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="小項目">
            <Input
              value={form.categorySmall}
              onChange={(e) => update("categorySmall", e.target.value)}
              placeholder="例: 修理交換"
            />
          </Field>
        </CardContent>
      </Card>

      {/* 進捗・取引先 */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif-jp text-lg">進捗・取引先</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="ステータス">
            <Select value={form.status} onValueChange={(v) => update("status", v as never)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="受付">受付</SelectItem>
                <SelectItem value="現調中">現調中</SelectItem>
                <SelectItem value="見積中">見積中</SelectItem>
                <SelectItem value="施工待ち">施工待ち</SelectItem>
                <SelectItem value="施工中">施工中</SelectItem>
                <SelectItem value="完了">完了</SelectItem>
                <SelectItem value="クローズ">クローズ</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="緊急度">
            <Select value={form.urgency} onValueChange={(v) => update("urgency", v as never)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S">S 緊急</SelectItem>
                <SelectItem value="A">A 高</SelectItem>
                <SelectItem value="B">B 中</SelectItem>
                <SelectItem value="C">C 低</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="協力会社名">
            <Input
              value={form.contractorName}
              onChange={(e) => update("contractorName", e.target.value)}
              placeholder="例: (株)小林工房"
            />
          </Field>
          <Field label="協力会社担当者">
            <Input
              value={form.contractorPic}
              onChange={(e) => update("contractorPic", e.target.value)}
            />
          </Field>
          <Field label="協力会社連絡先" className="md:col-span-2">
            <Input
              value={form.contractorPhone}
              onChange={(e) => update("contractorPhone", e.target.value)}
            />
          </Field>
          <Field label="備考" className="md:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => setLocation("/cases")}>
          キャンセル
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
          <Save className="h-4 w-4" />
          {createMutation.isPending ? "登録中..." : "登録"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
