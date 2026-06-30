/**
 * 報告書PDFの表記ルール用ヘルパー。
 * - 数字は全角に統一（章番号・ページ番号・手順番号・写真番号など）。
 * - 丸括弧（半角 ( ) と全角 （ ））は使わない。括弧内は中黒や読点に置き換える。
 */

// 半角数字 -> 全角数字
const HALF_TO_FULL_DIGIT: Record<string, string> = {
  "0": "０",
  "1": "１",
  "2": "２",
  "3": "３",
  "4": "４",
  "5": "５",
  "6": "６",
  "7": "７",
  "8": "８",
  "9": "９",
};

/** 文字列中の半角数字をすべて全角数字に変換する */
export function toFullWidthDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[0-9]/g, (d) => HALF_TO_FULL_DIGIT[d] ?? d);
}

/**
 * 丸括弧を使わない表記に変換する。
 * - 「本文（補足）」→「本文　補足」のように、括弧を全角スペースと中黒に置き換える。
 * - 文末/単独の括弧は読みやすさを保ちつつ除去する。
 */
export function removeParentheses(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  // 全角括弧・半角括弧の開きを「　」（全角スペース）に、閉じを空に
  // 例: 「状態（Before）」→「状態　Before」
  s = s.replace(/\s*[（(]\s*/g, "　").replace(/\s*[）)]\s*/g, "");
  // 連続する全角スペースを1つに、末尾の全角スペースを除去
  s = s.replace(/　{2,}/g, "　").replace(/　+$/g, "").trim();
  return s;
}

/** 数字を全角化し、かつ丸括弧を除去した表記にする（報告書PDF表示用） */
export function reportLabel(input: string | number | null | undefined): string {
  return removeParentheses(toFullWidthDigits(input));
}
