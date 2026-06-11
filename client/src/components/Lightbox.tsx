import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export type LightboxItem = {
  url: string;
  title?: string;
  subtitle?: string;
  /** 時計回りの回転角度（0/90/180/270） */
  rotation?: number;
};

type LightboxProps = {
  items: LightboxItem[];
  /** 開いている写真のindex。nullなら閉じている */
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

/**
 * 写真の拡大プレビュー用ライトボックス。
 * - 背景クリック / 閉じるボタン / Escで閉じる
 * - 複数枚は ← → キー、左右ボタンで前後送り
 */
export function Lightbox({ items, index, onClose, onIndexChange }: LightboxProps) {
  const isOpen = index !== null && index >= 0 && index < items.length;

  const goPrev = useCallback(() => {
    if (index === null) return;
    onIndexChange((index - 1 + items.length) % items.length);
  }, [index, items.length, onIndexChange]);

  const goNext = useCallback(() => {
    if (index === null) return;
    onIndexChange((index + 1) % items.length);
  }, [index, items.length, onIndexChange]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    // 背景スクロールを抑制
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, goPrev, goNext]);

  if (!isOpen) return null;

  const current = items[index!];
  const hasMultiple = items.length > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm lightbox-fade"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* カウンタ */}
      {hasMultiple && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/80 text-sm tabular-nums">
          {index! + 1} / {items.length}
        </div>
      )}

      {/* 前へ */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="前の写真"
          className="absolute left-3 sm:left-5 h-11 w-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* 画像本体 */}
      <figure
        className="max-w-[92vw] max-h-[88vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={current.url}
          src={current.url}
          alt={current.title ?? ""}
          className="max-w-[92vw] max-h-[78vh] object-contain rounded shadow-2xl lightbox-zoom"
          style={{
            imageOrientation: "from-image",
            transform: current.rotation ? `rotate(${current.rotation}deg)` : undefined,
          }}
        />
        {(current.title || current.subtitle) && (
          <figcaption className="mt-3 text-center text-white/90 max-w-[92vw]">
            {current.title && <p className="text-sm font-medium">{current.title}</p>}
            {current.subtitle && (
              <p className="text-xs text-white/70 whitespace-pre-wrap">{current.subtitle}</p>
            )}
          </figcaption>
        )}
      </figure>

      {/* 次へ */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="次の写真"
          className="absolute right-3 sm:right-5 h-11 w-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <style>{`
        .lightbox-fade { animation: lightboxFade 160ms cubic-bezier(0.23, 1, 0.32, 1); }
        .lightbox-zoom { animation: lightboxZoom 180ms cubic-bezier(0.23, 1, 0.32, 1); }
        @keyframes lightboxFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lightboxZoom { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .lightbox-fade, .lightbox-zoom { animation: none; }
        }
      `}</style>
    </div>,
    document.body
  );
}

/**
 * ライトボックスの開閉状態を管理する簡易フック。
 */
export function useLightbox() {
  const [index, setIndex] = useState<number | null>(null);
  const open = useCallback((i: number) => setIndex(i), []);
  const close = useCallback(() => setIndex(null), []);
  return { index, setIndex, open, close };
}
