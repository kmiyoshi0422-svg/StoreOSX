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
