import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/SignaturePad";
import { PenLine, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type SignatureValue = {
  fileUrl: string;
  signerName: string | null;
  signedAt: Date;
} | null | undefined;

type Props = {
  title: string;
  description: string;
  badgeLabel: string;
  signature: SignatureValue;
  signerName: string;
  onSignerNameChange: (value: string) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  saving: boolean;
  deleting: boolean;
  requireName?: boolean;
  onSave: (dataUrl: string) => void;
  onDelete: () => void;
};

export function ReportSignatureEditor({
  title,
  description,
  badgeLabel,
  signature,
  signerName,
  onSignerNameChange,
  editing,
  onEditingChange,
  saving,
  deleting,
  requireName = false,
  onSave,
  onDelete,
}: Props) {
  const hasSignature = Boolean(signature);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" data-signature-editor={badgeLabel}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{title}</h4>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Badge variant={hasSignature ? "default" : "secondary"}>{hasSignature ? "署名済み" : badgeLabel}</Badge>
      </div>

      {hasSignature && !editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-lg border border-border bg-white p-2">
              <img src={signature!.fileUrl} alt={`${title}の保存済みサイン`} className="h-20 object-contain" />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>署名者：<span className="font-medium text-foreground">{signature!.signerName || "未入力"}</span></p>
              <p>サイン日時：{new Date(signature!.signedAt).toLocaleString("ja-JP")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="bg-background" onClick={() => onEditingChange(true)}>
              <RotateCcw className="mr-1 h-4 w-4" />サインし直す
            </Button>
            <Button type="button" variant="outline" size="sm" className="bg-background text-destructive" onClick={onDelete} disabled={deleting}>
              <Trash2 className="mr-1 h-4 w-4" />削除
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid max-w-xs gap-1.5">
            <Label className="text-xs">署名者名{requireName ? "（必須）" : "（任意）"}</Label>
            <Input
              value={signerName}
              onChange={(event) => onSignerNameChange(event.target.value)}
              placeholder={requireName ? "例）株式会社〇〇　山田 太郎" : "例）プレナス 山田"}
              className="h-9"
            />
          </div>
          <SignaturePad
            saving={saving}
            onConfirm={(dataUrl) => {
              if (requireName && !signerName.trim()) {
                toast.error("署名者名を入力してください");
                return;
              }
              onSave(dataUrl);
            }}
          />
          {hasSignature && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onEditingChange(false)}>キャンセル</Button>
          )}
        </div>
      )}
    </section>
  );
}
