export const ROOT_SEO = {
  title: "Store OSX｜店舗・案件・写真・報告書・工程・経費・協力会社を一元管理する現場施工・施設管理システム",
  description:
    "Store OSXは、店舗・案件・写真・報告書・工程・経費を一元管理し、現場調査から施工完了までの進捗共有、協力会社連携、業務効率化を支援する施設管理システムです。",
  keywords: ["店舗管理", "案件管理", "現場管理", "施工管理", "報告書管理", "施設管理"],
  h2: "店舗・案件・報告書・工程・経費を一元管理する現場管理ダッシュボード",
} as const;

function upsertMeta(name: "description" | "keywords", content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

export function applyRootSeoMetadata() {
  document.title = ROOT_SEO.title;
  upsertMeta("description", ROOT_SEO.description);
  upsertMeta("keywords", ROOT_SEO.keywords.join(","));
}
