import { ReactNode } from "react";

/**
 * 統一ページヘッダー
 * - 上部にケブロンラベル（uppercase + 文字間隔）
 * - serif体の大型タイトル
 * - サブタイトル（desc）
 * - 右側にアクションボタン群（actions）
 *
 * 全主要ページで利用してデザイン言語を揃える。
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border/60 pb-5 md:pb-6 mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-2 font-medium">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif-jp text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2 leading-tight">
          {icon}
          <span className="truncate">{title}</span>
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 shrink-0 md:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
