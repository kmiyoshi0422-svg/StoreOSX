// 同一オリジンの /manus-storage 経由で画像をfetchし dataURL に変換する共通ヘルパ。
// html2canvas が外部画像で canvas を汚染（Tainted canvas）するのを防ぐために使用する。
//
// 重要: /manus-storage/* は 307 で S3（別オリジン）の署名URLへリダイレクトされる。
// このとき credentials:"include" を付けると、クロスオリジンへの credentials 付き
// リダイレクトがブラウザに拒否され "Failed to fetch" となり画像が取得できない。
// そのため credentials は付けない（同一オリジンのプロキシなので不要）。
// 念のため、直fetchが失敗した場合はサーバー側の base64 化APIにフォールバックする。

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
  try {
    return await fetchDataUrlDirect(src);
  } catch {
    // 直fetchが失敗（CORS/リダイレクト等）した場合はサーバー側で取得する
    return await fetchDataUrlViaServer(src);
  }
}

/**
 * 指定コンテナ内のすべての <img> を dataURL 化して差し替える。
 * 戻り値として「復元関数」を返す。
 * 取得失敗時はプレースホルダに差し替えて生成を継続する。
 */
export async function inlineImages(container: HTMLElement): Promise<() => void> {
  const imgs = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
  const originalSrcs = imgs.map((img) => img.getAttribute("src") ?? "");
  await Promise.all(
    imgs.map(async (img, idx) => {
      const src = originalSrcs[idx];
      if (!src || src.startsWith("data:")) return;
      try {
        const dataUrl = await toDataUrl(src);
        img.src = dataUrl;
        img.removeAttribute("srcset");
        if (typeof img.decode === "function") {
          await img.decode().catch(() => undefined);
        }
      } catch {
        img.src = PLACEHOLDER_DATA_URL;
        img.removeAttribute("srcset");
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
