// LLM応答テキストから JSON オブジェクトを堅牢に取り出すための純粋関数群。
// PDF抽出で LLM が Markdown コードフェンス（```json ... ```）や
// 前後の説明文を含めて返した場合でもパースできるようにする。

/**
 * LLM応答の content を文字列に正規化する。
 * 文字列ならそのまま、配列なら text 部分を連結する。
 */
export function contentToText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c) {
          const t = (c as { text?: unknown }).text;
          return typeof t === "string" ? t : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

/**
 * Markdownコードフェンスを取り除く。
 * 例: ```json\n{...}\n``` → {...}
 */
export function stripCodeFences(text: string): string {
  let t = text.trim();
  // 先頭の ```json / ```JSON / ``` を除去
  t = t.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "");
  // 末尾の ``` を除去
  t = t.replace(/\n?```\s*$/, "");
  return t.trim();
}

/**
 * テキストの中から最初の「バランスの取れた」JSONオブジェクト文字列を抽出する。
 * 文字列リテラル内の波括弧やエスケープを考慮する。
 * 見つからなければ null を返す。
 */
export function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * LLM応答テキストを段階的に解釈して JSON オブジェクトへパースする。
 * 1) そのまま JSON.parse
 * 2) コードフェンス除去後に JSON.parse
 * 3) 最初のバランスJSONオブジェクトを抽出して JSON.parse
 * いずれも失敗したら null を返す（呼び出し側でフォールバック）。
 */
export function parseLlmJson(rawText: string): Record<string, unknown> | null {
  const candidates: string[] = [];
  const trimmed = (rawText ?? "").trim();
  if (!trimmed) return null;

  candidates.push(trimmed);

  const noFence = stripCodeFences(trimmed);
  if (noFence && noFence !== trimmed) candidates.push(noFence);

  const balanced = extractFirstJsonObject(noFence || trimmed);
  if (balanced) candidates.push(balanced);

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // 次の候補へ
    }
  }
  return null;
}

/**
 * 金額文字列を整数（円）にパースする純粋関数。
 * - 全角数字（０-９）を半角に変換
 * - カンマ・円記号・「円」・空白・全角空白などの装飾を除去
 * - 小数点以下は切り捨て（円単位前提）
 * - 数字が1文字も無い／負値になる場合は null
 *
 * 例:
 *   parseAmount("¥1,200,000") -> 1200000
 *   parseAmount("１２３４") -> 1234
 *   parseAmount("350000円") -> 350000
 *   parseAmount("") -> null
 *   parseAmount(null) -> null
 */
export function parseAmount(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.floor(input);
  }
  if (typeof input !== "string") return null;

  // 全角数字 → 半角
  let s = input.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  // 全角ピリオド → 半角
  s = s.replace(/．/g, ".");
  // 数字・ピリコ・マイナス以外を除去（カンマ・円記号・「円」・空白等）
  s = s.replace(/[^0-9.\-]/g, "");

  if (s === "" || s === "-" || s === ".") return null;

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}
