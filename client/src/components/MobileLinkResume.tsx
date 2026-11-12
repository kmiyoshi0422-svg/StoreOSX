import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { takePendingMobileLinkCode } from "@/lib/mobileLinkPending";

/**
 * 端末連携の承認途中でログインした場合、ログイン後のトップ画面から承認画面へ戻す。
 * 画面には何も描画しない。
 */
export default function MobileLinkResume() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    if (window.location.pathname === "/mobile-link") return;
    const code = takePendingMobileLinkCode();
    if (code) window.location.replace(`/mobile-link?code=${encodeURIComponent(code)}`);
  }, [loading, user]);

  return null;
}
