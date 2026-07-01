/**
 * 報告書PDFの表記ルール用ヘルパー。
 * - 数字は全角に統一（章番号・ページ番号・手順番号・写真番号など）。
 * - 丸括弧（半角 ( ) と全角 （ ））は使わない。括弧内は中黒や読点に置き換える。
 *
 * ただし、型番・メールアドレス・URLなど、半角のまま残すべき文字列は
 * 「自動保護パターン」と「ユーザー登録の除外辞書」で保護する。
 * 保護対象の内部にある数字・記号は変換されない。
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

/**
 * 半角のまま保持したい文字列を自動検出する正規表現。
 * - メールアドレス
 * - URL（http/https、www.、スキームなしドメイン）
 * - 型番・品番風トークン（英字と数字・ハイフンが混在するもの。例: ABC-123X, RX-100, iPhone15Pro）
 * 順序が重要（長いパターンから先にマッチさせる）。
 */
const AUTO_PROTECT_PATTERNS: RegExp[] = [
  // メールアドレス
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  // URL（スキームあり）
  /https?:\/\/[^\s　）)」』】]+/,
  // URL（www. で始まる）
  /www\.[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/[^\s　）)」』】]*)?/,
  // 型番・品番風（英字と数字が混在し、英字を最低1つ含むトークン。ハイフン/ドット/アンダースコア/スラッシュを許容）
  /[A-Za-z][A-Za-z0-9]*(?:[-_./][A-Za-z0-9]+)*[0-9][A-Za-z0-9-_./]*|[0-9][A-Za-z0-9-_./]*[A-Za-z][A-Za-z0-9-_./]*/,
];

/** ユーザー登録の除外語を正規表現に変換（特殊文字をエスケープ） */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 入力文字列から「保護すべき区間」を抽出する。
 * @param input 対象文字列
 * @param exclusions ユーザー登録の除外語（完全一致で保護）
 * @returns 保護区間の配列 [{start, end}]（startで昇順、重複なし）
 */
function findProtectedRanges(
  input: string,
  exclusions: string[] = [],
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];

  // ユーザー除外語を優先的に保護（長い語から先に）
  const sortedExclusions = [...exclusions]
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
    .sort((a, b) => b.length - a.length);

  const patterns: RegExp[] = [
    ...sortedExclusions.map((e) => new RegExp(escapeRegExp(e), "g")),
    ...AUTO_PROTECT_PATTERNS.map((p) => new RegExp(p.source, "g")),
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(input)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  // 重なり・包含を統合
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/**
 * 保護区間を避けて変換関数を適用するヘルパー。
 * 保護区間内はそのまま、区間外だけに transform を適用する。
 */
function applyOutsideProtected(
  input: string,
  exclusions: string[],
  transform: (segment: string) => string,
): string {
  const ranges = findProtectedRanges(input, exclusions);
  if (ranges.length === 0) return transform(input);

  let result = "";
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) {
      result += transform(input.slice(cursor, r.start));
    }
    // 保護区間はそのまま
    result += input.slice(r.start, r.end);
    cursor = r.end;
  }
  if (cursor < input.length) {
    result += transform(input.slice(cursor));
  }
  return result;
}

/** 半角数字をすべて全角数字に変換する（内部用、保護なし） */
function convertDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => HALF_TO_FULL_DIGIT[d] ?? d);
}

/**
 * 文字列中の半角数字を全角数字に変換する。
 * exclusions に登録された語やメール・URL・型番風トークンは半角のまま保持する。
 */
export function toFullWidthDigits(
  input: string | number | null | undefined,
  exclusions: string[] = [],
): string {
  if (input === null || input === undefined) return "";
  return applyOutsideProtected(String(input), exclusions, convertDigits);
}

/** 丸括弧を除去する（内部用、保護なし） */
function stripParentheses(s: string): string {
  let out = s;
  // 全角括弧・半角括弧の開きを「　」（全角スペース）に、閉じを空に
  out = out.replace(/\s*[（(]\s*/g, "　").replace(/\s*[）)]\s*/g, "");
  // 連続する全角スペースを1つに、末尾の全角スペースを除去
  out = out.replace(/　{2,}/g, "　").replace(/　+$/g, "");
  return out;
}

/**
 * 丸括弧を使わない表記に変換する。
 * - 「本文（補足）」→「本文　補足」のように、括弧を全角スペースに置き換える。
 * - exclusions / メール / URL / 型番風トークン内の括弧は保護する。
 */
export function removeParentheses(
  input: string | null | undefined,
  exclusions: string[] = [],
): string {
  if (!input) return "";
  const converted = applyOutsideProtected(String(input), exclusions, stripParentheses);
  return converted.trim();
}

/**
 * 数字を全角化し、かつ丸括弧を除去した表記にする（報告書PDF表示用）。
 * @param input 対象文字列/数値
 * @param exclusions 全角化・括弧除去の対象外にする語（型番・固有名詞など）。省略可。
 */
export function reportLabel(
  input: string | number | null | undefined,
  exclusions: string[] = [],
): string {
  return removeParentheses(toFullWidthDigits(input, exclusions), exclusions);
}
