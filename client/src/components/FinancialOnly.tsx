import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { Link } from "wouter";

export default function FinancialOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || !["owner", "admin", "executive"].includes(user.role)) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">金額閲覧権限が必要です</h2>
        <p className="text-sm text-muted-foreground">この画面は管理者・役員だけが閲覧できます。</p>
        <Link href="/"><Button variant="outline">ダッシュボードへ戻る</Button></Link>
      </div>
    );
  }
  return <>{children}</>;
}
