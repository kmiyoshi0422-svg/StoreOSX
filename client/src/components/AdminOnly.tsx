import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

/**
 * 管理者ロールのユーザーのみが見られる領域をラップするガード
 * - ログイン中で role==='admin' または role==='owner' → children を表示
 * - それ以外 → アクセス拒否メッセージ
 */
export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !["owner", "admin"].includes(user.role)) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-serif tracking-tight">管理者専用ページ</h2>
        <p className="text-sm text-muted-foreground">
          このページは管理者のみが閲覧できます。<br />
          権限が必要な場合は管理者にお問い合わせください。
        </p>
        <Link href="/">
          <Button variant="outline" className="bg-background">ダッシュボードへ戻る</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
