import { useAuth } from "@/_core/hooks/useAuth";
import { canUseEstimateAssistant } from "../../../shared/estimateAssistant";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

/** この画面固有の例外。ほかの金額画面の権限を緩めない。 */
export default function EstimateStaffOnly({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!canUseEstimateAssistant(user?.role))
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h2 className="text-xl font-semibold">社員以上の権限が必要です</h2>
        <p className="text-sm text-muted-foreground">
          見積支援と標準施工単価は社内ユーザーのみ利用できます。
        </p>
        <Link href="/">
          <Button variant="outline">ダッシュボードへ戻る</Button>
        </Link>
      </div>
    );
  return <>{children}</>;
}
