/** 名簿・確認済み本人設定は、監査付き専用管理以外から変更／公開しない。 */
export function isProtectedAppSetting(key: string): boolean {
  return key.normalize('NFKD').replace(new RegExp('\\p{M}', 'gu'), '').replace(/[\u200b-\u200d\ufeff]/g, '').trim().toLowerCase().startsWith('responsibility.');
}
