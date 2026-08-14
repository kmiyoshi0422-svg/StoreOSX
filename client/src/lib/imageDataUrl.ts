// 同一オリジンの /manus-storage 経由で画像をfetchし dataURL に変換する共通ヘルパ。
// html2canvas が外部画像で canvas を汚染（Tainted canvas）するのを防ぐために使用する。
//
// 重要: /manus-storage/* は 307 で S3（別オリジン）の署名URLへリダイレクトされる。
// このとき credentials:"include" を付けると、クロスオリジンへの credentials 付き
// リダイレクトがブラウザに拒否され "Failed to fetch" となり画像が取得できない。
// そのため credentials は付けない（同一オリジンのプロキシなので不要）。
// 念のため、直fetchが失敗した場合はサーバー側の base64 化APIにフォールバックする。

// ─── キャッシュ: 同一セッション中に同じ画像を何度もfetchしない ───
const dataUrlCache = new Map<string, string>();

/** 取得失敗画像用の軽量プレースホルダ（淡いグレー / No Image） */
export const PLACEHOLDER_DATA_URL =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="16" font-family="sans-serif">No Image</text></svg>',
  );

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** クライアントから直接 /manus-storage を fetch して dataURL 化（credentials なし） */
async function fetchDataUrlDirect(src: string): Promise<string> {
  const res = await fetch(src, { credentials: "omit", redirect: "follow" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  if (!blob.size) throw new Error("empty blob");
  return blobToDataUrl(blob);
}

/** サーバー経由で画像を base64 化して取得するフォールバック（tRPC media.toDataUrl） */
async function fetchDataUrlViaServer(src: string): Promise<string> {
  const { vanillaTrpc } = await import("./trpcVanilla");
  const json = await vanillaTrpc.media.toDataUrl.mutate({ src });
  if (!json?.dataUrl) throw new Error("server returned empty dataUrl");
  return json.dataUrl;
}

/** 画像URLをfetchしてPNG/JPEG等の dataURL に変換する（直fetch→サーバーの順で試行） */
export async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  // キャッシュヒット
  const cached = dataUrlCache.get(src);
  if (cached) return cached;
  try {
    const result = await fetchDataUrlDirect(src);
    dataUrlCache.set(src, result);
    return result;
  } catch {
    // 直fetchが失敗（CORS/リダイレクト等）した場合はサーバー側で取得する
    const result = await fetchDataUrlViaServer(src);
    dataUrlCache.set(src, result);
    return result;
  }
}

/**
 * 並列度を制限して複数の非同期タスクを実行するヘルパー
 */
async function parallelLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * 指定コンテナ内のすべての <img> を dataURL 化して差し替える。
 * 戻り値として「復元関数」を返す。
 * 取得失敗時はプレースホルダに差し替えて生成を継続する。
 * 並列度6で画像を取得し、高速化を実現。
 */
export async function inlineImages(container: HTMLElement): Promise<() => void> {
  const imgs = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
  const originalSrcs = imgs.map((img) => img.getAttribute("src") ?? "");

  // 並列度6で画像を取得（ブラウザの同一オリジン接続数上限を考慮）
  const tasks = imgs.map((img, idx) => async () => {
    const src = originalSrcs[idx];
    if (!src || src.startsWith("data:")) return;
    try {
      const dataUrl = await toDataUrl(src);
      img.src = dataUrl;
      img.removeAttribute("srcset");
    } catch {
      img.src = PLACEHOLDER_DATA_URL;
      img.removeAttribute("srcset");
    }
  });

  await parallelLimit(tasks, 6);

  // 全画像のdecodeを並列実行
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src || src.startsWith("data:")) return;
      if (typeof img.decode === "function") {
        await img.decode().catch(() => undefined);
      }
    }),
  );

  // 復元関数
  return () => {
    imgs.forEach((img, idx) => {
      if (originalSrcs[idx]) img.src = originalSrcs[idx];
    });
  };
}
