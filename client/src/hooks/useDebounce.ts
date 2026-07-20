import { useState, useEffect } from "react";

/**
 * 値のデバウンスを行うカスタムフック。
 * 入力値が変更されてから指定ミリ秒経過後に、デバウンスされた値を返す。
 * 検索入力やフィルタ変更時の不要な再計算・APIリクエストを抑制する。
 *
 * @param value - デバウンス対象の値
 * @param delay - デバウンス遅延時間（ミリ秒）。デフォルト300ms
 * @returns デバウンスされた値
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
