// 同一オリジンの /manus-storage 経由で画像をfetchし dataURL に変換する共通ヘルパ。
// html2canvas が外部画像で canvas を汚染（Tainted canvas）するのを防ぐために使用する。
//
// 重要: /manus-storage/* は 307 で S3（別オリジン）の署名URLへリダイレクトされる。
// このとき credentials:"include" を付けると、クロスオリジンへの credentials 付き
// リダイレクトがブラウザに拒否され "Failed to fetch" となり画像が取得できない。
// そのため credentials は付けない（同一オリジンのプロキシなので不要）。
// 念のため、直fetchが失敗した場合はサーバー側の base64 化APIにフォールバックする。

// ─── キャッシュ: 同一PDF生成中に同じ画像を何度もfetchしない ───
const dataUrlCache = new Map<string, string>();
const inFlightCache = new Map<string, Promise<string>>();
const MAX_CACHE_ENTRIES = 24;

export type InlineImageOptions = {
  maxEdge?: number;
  quality?: number;
  concurrency?: number;
};

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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  const res = await fetch(src, {
    credentials: "omit",
    redirect: "follow",
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));
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

function loadDataImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

/** PDF用途に長辺を制限し、巨大なスマホ写真をメモリへ原寸展開し続けない。 */
async function optimizeDataUrl(dataUrl: string, maxEdge: number, quality: number): Promise<string> {
  const img = await loadDataImage(dataUrl);
  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  if (!sourceWidth || !sourceHeight) return dataUrl;

  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  // 署名PNGなどの透明部分が黒くならないよう白背景でJPEG化する。
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const optimized = canvas.toDataURL("image/jpeg", quality);
  canvas.width = 0;
  canvas.height = 0;
  return optimized;
}

function remember(cacheKey: string, value: string) {
  dataUrlCache.set(cacheKey, value);
  while (dataUrlCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = dataUrlCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    dataUrlCache.delete(oldestKey);
  }
}

/** 画像URLをfetchし、PDF用に縮小したdataURLへ変換する。 */
export async function toDataUrl(
  src: string,
  options: Pick<InlineImageOptions, "maxEdge" | "quality"> = {},
): Promise<string> {
  const maxEdge = options.maxEdge ?? 1600;
  const quality = options.quality ?? 0.84;
  const cacheKey = `${src}|${maxEdge}|${quality}`;
  const cached = dataUrlCache.get(cacheKey);
  if (cached) return cached;
  const inFlight = inFlightCache.get(cacheKey);
  if (inFlight) return inFlight;

  const task = (async () => {
    const raw = src.startsWith("data:")
      ? src
      : await fetchDataUrlDirect(src).catch(() => fetchDataUrlViaServer(src));
    const result = await optimizeDataUrl(raw, maxEdge, quality).catch(() => raw);
    remember(cacheKey, result);
    return result;
  })();
  inFlightCache.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightCache.delete(cacheKey);
  }
}

/** PDF保存完了後にbase64画像を解放し、次回生成時のメモリ不足を防ぐ。 */
export function clearDataUrlCache() {
  dataUrlCache.clear();
  inFlightCache.clear();
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
export async function inlineImages(
  container: HTMLElement,
  options: InlineImageOptions = {},
): Promise<() => void> {
  const imgs = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
  const originalSrcs = imgs.map((img) => img.getAttribute("src") ?? "");
  const maxEdge = options.maxEdge ?? 1600;
  const quality = options.quality ?? 0.84;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 6));

  // 並列度6で画像を取得（ブラウザの同一オリジン接続数上限を考慮）
  const tasks = imgs.map((img, idx) => async () => {
    const src = originalSrcs[idx];
    if (!src) return;
    try {
      const dataUrl = await toDataUrl(src, { maxEdge, quality });
      img.src = dataUrl;
      img.removeAttribute("srcset");
    } catch {
      img.src = PLACEHOLDER_DATA_URL;
      img.removeAttribute("srcset");
    }
  });

  await parallelLimit(tasks, concurrency);

  // 全画像のdecodeを並列実行
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src) return;
      if (typeof img.decode === "function") {
        await img.decode().catch(() => undefined);
      } else if (!img.complete) {
        await new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
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
