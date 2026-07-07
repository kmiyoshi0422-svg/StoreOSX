import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Sparkles, Users } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

type ToneSetting = "polite" | "standard" | "concise";
type LengthSetting = "short" | "standard" | "long";

interface ImpressionConfig {
  tone: ToneSetting;
  length: LengthSetting;
}

const TONE_LABELS: Record<ToneSetting, string> = {
  polite: "丁寧（です・ます調）",
  standard: "標準（実務的）",
  concise: "簡潔（要点のみ）",
};

const LENGTH_LABELS: Record<LengthSetting, string> = {
  short: "短め（2〜3文）",
  standard: "標準（3〜5文）",
  long: "長め（5〜8文）",
};

export default function ImpressionSettings() {
  const utils = trpc.useUtils();

  // AI生成設定
  const { data: toneData } = trpc.appSettings.get.useQuery({ key: "impression_config" });
  const [config, setConfig] = useState<ImpressionConfig>({ tone: "standard", length: "standard" });

  // 記入者プリセット
  const { data: authorsData } = trpc.appSettings.get.useQuery({ key: "impression_authors" });
  const [authors, setAuthors] = useState<string[]>([]);
  const [newAuthor, setNewAuthor] = useState("");

  const saveSetting = trpc.appSettings.set.useMutation({
    onSuccess: () => {
      utils.appSettings.get.invalidate();
      toast.success("設定を保存しました");
    },
  });

  // 初期値を設定
  useEffect(() => {
    if (toneData?.value) {
      const val = toneData.value as ImpressionConfig;
      setConfig({ tone: val.tone || "standard", length: val.length || "standard" });
    }
  }, [toneData]);

  useEffect(() => {
    if (authorsData?.value) {
      setAuthors(authorsData.value as string[]);
    }
  }, [authorsData]);

  const handleSaveConfig = () => {
    saveSetting.mutate({ key: "impression_config", value: config });
  };

  const handleAddAuthor = () => {
    const name = newAuthor.trim();
    if (!name) return;
    if (authors.includes(name)) {
      toast.error("既に登録されています");
      return;
    }
    const updated = [...authors, name];
    setAuthors(updated);
    setNewAuthor("");
    saveSetting.mutate({ key: "impression_authors", value: updated });
  };

  const handleRemoveAuthor = (name: string) => {
    const updated = authors.filter((a) => a !== name);
    setAuthors(updated);
    saveSetting.mutate({ key: "impression_authors", value: updated });
  };

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/exclusions">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">所感AI生成 設定</h1>
      </div>

      {/* AI生成トーン・文章量設定 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI文章生成の設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            現調報告書の所感をAIで生成する際のトーンと文章量を設定します。
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>トーン</Label>
              <Select
                value={config.tone}
                onValueChange={(v) => setConfig((prev) => ({ ...prev, tone: v as ToneSetting }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TONE_LABELS) as [ToneSetting, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>文章量</Label>
              <Select
                value={config.length}
                onValueChange={(v) => setConfig((prev) => ({ ...prev, length: v as LengthSetting }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(LENGTH_LABELS) as [LengthSetting, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleSaveConfig}
            disabled={saveSetting.isPending}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-2" />
            設定を保存
          </Button>
        </CardContent>
      </Card>

      {/* 記入者プリセット */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            記入者プリセット
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            よく使う記入者名を登録しておくと、所感入力時にドロップダウンから選択できます。
          </p>

          {/* 追加フォーム */}
          <div className="flex gap-2">
            <Input
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              placeholder="記入者名を入力"
              onKeyDown={(e) => { if (e.key === "Enter") handleAddAuthor(); }}
              className="flex-1"
            />
            <Button onClick={handleAddAuthor} disabled={!newAuthor.trim() || saveSetting.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>

          {/* 登録済みリスト */}
          {authors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {authors.map((name) => (
                <Badge key={name} variant="secondary" className="pl-3 pr-1 py-1.5 text-sm gap-1">
                  {name}
                  <button
                    onClick={() => handleRemoveAuthor(name)}
                    className="ml-1 hover:bg-destructive/20 rounded p-0.5 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              まだ記入者が登録されていません。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
