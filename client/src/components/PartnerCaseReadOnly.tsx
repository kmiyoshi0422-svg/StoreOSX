import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImageIcon, MapPin } from "lucide-react";
import type { Case, ChecklistItem, Photo } from "../../../drizzle/schema";
import { useLocation } from "wouter";

/** 担当外の協力業者には基本情報・現場写真のみ表示。更新画面へは遷移させない。 */
export function PartnerCaseReadOnly({ caseData, photos, checklist }: {
  caseData: Case;
  photos: Photo[];
  checklist: ChecklistItem[];
}) {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/cases")}> <ArrowLeft className="mr-2 h-4 w-4" />案件一覧へ</Button>
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">閲覧専用</Badge><span className="text-sm text-muted-foreground">{caseData.requestNumber}</span></div>
          <CardTitle>{caseData.storeName}</CardTitle>
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{caseData.prefecture ?? "都道府県未設定"} {caseData.address ?? ""}</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">{caseData.status}</Badge><Badge variant="outline">{caseData.urgency}</Badge><span>{caseData.categoryLarge ?? ""} / {caseData.categoryMedium ?? ""} / {caseData.categorySmall ?? ""}</span></div>
          <div><strong className="block mb-1">依頼内容</strong><p className="whitespace-pre-wrap break-words">{caseData.requestContent ?? "記載なし"}</p></div>
          <p className="text-xs text-muted-foreground">この案件は閲覧のみ可能です。担当・許可エリア外のため、写真・状況・報告書の変更はできません。金額や経費は表示されません。</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="h-4 w-4" />現場写真（{photos.length}枚）</CardTitle></CardHeader>
        <CardContent>
          {photos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{photos.map((photo) => <div key={photo.id} className="rounded-lg border p-2"><a href={photo.fileUrl ?? undefined} target="_blank" rel="noopener noreferrer" aria-label={`${photo.photoType}の写真を開く`}><img src={photo.fileUrl ?? undefined} alt={`${photo.photoType}の現場写真`} loading="lazy" className="aspect-square w-full rounded object-cover" /></a><p className="mt-1 text-xs">{photo.photoType}</p></div>)}</div> : <p className="text-sm text-muted-foreground">写真は未登録です。</p>}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">チェック状況</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{checklist.length ? checklist.map(item => <div key={item.id} className="flex gap-2 border-b pb-2"><span>{item.checked ? "✓" : "—"}</span><span>{item.title}</span></div>) : "チェック項目はありません。"}</CardContent></Card>
    </div>
  );
}
