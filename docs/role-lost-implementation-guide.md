# StoreOSX 権限管理・失注復活 実装確認ガイド

**作成者:** Manus AI  
**対象:** StoreOSX 本番環境  
**公開URL:** https://plenuscbk-l2kpa2gk.manus.space/

## 1. 確定した権限構成

三好慶さんの `k.miyoshi0422@gmail.com` を**最高管理者（owner）**、野口さんの `nogorow@gmail.com` を**管理者（admin）**へ設定しました。新藤さん、河野さん、藤原さんは**社員（user）**です。重複ログイン履歴がある野口・新藤アカウントも、同じ権限へ統一しています。

| 役割 | 案件閲覧 | 案件操作 | 売上・原価等 | 利益・粗利率 | 権限・エリア設定 |
|---|---|---:|---:|---:|---:|
| 最高管理者（三好） | 全エリア | 可 | 表示 | **表示** | 可 |
| 管理者（野口） | 全エリア | 可 | 表示 | **非表示** | 可 |
| 役員 | 許可エリア | 可 | 表示 | **非表示** | 不可 |
| 社員（新藤・河野・藤原） | 許可エリア | 可 | 非表示 | 非表示 | 不可 |
| 協力業者 | 指定エリア、未指定時は担当案件 | 不可 | **完全非表示** | 非表示 | 不可 |
| 顧客 | 許可エリア | 不可 | 完全非表示 | 非表示 | 不可 |

共通判定は `shared/accessPolicy.ts` に集約しています。社内金額は最高管理者・管理者・役員、利益は最高管理者だけ、案件操作は最高管理者・管理者・役員・社員へ許可します。[1]

```ts
export function canViewInternalFinancials(role: string) {
  return role === "owner" || role === "admin" || role === "executive";
}

export function canViewProfit(role: string) {
  return role === "owner";
}

export function canManageCases(role: string) {
  return role === "owner" || role === "admin" || role === "executive" || role === "user";
}
```

利益関連フィールドは、最高管理者以外のAPIレスポンスで `null` に置換します。画面で隠すだけではなく、通信レスポンスからも利益を除外する実装です。[1] [2]

```ts
if (["profit", "margin", "grossProfit", "grossMargin", "totalProfit", "profitMargin"].includes(key)) {
  result[key] = null;
}
```

## 2. 協力業者のエリア閲覧

管理画面の **「役割・閲覧エリア管理」** で協力業者を開き、「選択した都道府県のみ」を選んで都道府県を保存します。設定済みの場合は指定エリアの案件を返し、未設定の場合だけ従来どおり担当案件へ限定します。[2] [3]

```ts
const partnerUsesSelectedAreas =
  user.role === "partner" && user.areaAccessMode === "selected";
const areaVisible = user.role === "partner" && !partnerUsesSelectedAreas
  ? await filterCasesForPartner(rows, user.id)
  : filterCasesByArea(rows, user);
```

協力業者には、提出見積、売上、原価、管理費、現場経費、利益等を返しません。見積金額APIへの直接アクセスも `FORBIDDEN` で拒否します。[1] [2]

## 3. 失注登録の実装

失注理由は **高額なため／対応に不備／別業者手配／その他** の4区分です。「その他」では補足入力を必須にしています。失注前ステータスを `preLostStatus` に保存し、失注日時・実行者・理由・補足も保存します。[2]

```ts
await updateCase(input.caseId, {
  status: "失注",
  completedAt: lostAt,
  lostReason: input.reason,
  lostReasonDetail: input.reasonDetail?.trim() || null,
  lostAt,
  lostBy: ctx.user.id,
  preLostStatus: caseData.status,
});
```

失注は完了相当として通常の要対応一覧や工程提案から除外されます。担当業者がいる場合は、担当案件が失注した旨をアプリ内通知します。[2] [4]

## 4. 失注案件の復活実装

復活時は `preLostStatus` が「受付／現調中／見積中／施工待ち／施工中」のいずれかなら、その状態へ戻します。過去値が不正・欠落の場合は安全側で「受付」へ戻します。[2]

```ts
const restorableStatuses = ["受付", "現調中", "見積中", "施工待ち", "施工中"] as const;
const previousStatus = restorableStatuses.includes(caseData.preLostStatus as typeof restorableStatuses[number])
  ? caseData.preLostStatus as typeof restorableStatuses[number]
  : "受付";

await updateCase(input.caseId, {
  status: previousStatus,
  completedAt: null,
  lostReason: null,
  lostReasonDetail: null,
  lostAt: null,
  lostBy: null,
  preLostStatus: null,
});
```

復活後はダッシュボード、案件一覧、横断工程表を再取得します。失注タブの **「復活する」** から即時復元できます。[3]

## 5. 画面動作の確認手順

### 最高管理者（三好）

1. `k.miyoshi0422@gmail.com` でログインします。
2. 「役割・閲覧エリア管理」で三好が「最高管理者」、野口が「管理者」であることを確認します。
3. 「実績レポート」で売上・原価・粗利・粗利率が表示されることを確認します。
4. 案件詳細の「収支」で粗利カードが表示されることを確認します。

### 管理者（野口）

1. `nogorow@gmail.com` でログインします。
2. 案件一覧、案件登録、ユーザー権限、エリア設定が利用できることを確認します。
3. 「実績レポート」で売上・原価は表示され、粗利KPI・粗利推移・粗利列が表示されないことを確認します。
4. 案件詳細の「収支」で売上・原価は表示され、粗利カードが表示されないことを確認します。

### 役員と社員の切替テスト

1. 最高管理者または管理者で「役割・閲覧エリア管理」を開きます。
2. テスト対象ユーザーを一時的に「役員」へ変更し、対象都道府県を選択します。
3. 対象ユーザーで再ログインし、指定エリアの案件、売上・原価は見えるが利益は見えないことを確認します。
4. 同じユーザーを「社員」へ戻して再ログインし、案件操作はできるが売上・原価・利益が見えないことを確認します。
5. テスト後は必ず本来の役割へ戻します。

### 協力業者

1. 管理側で対象業者を「協力業者」に設定し、「選択した都道府県のみ」でテスト対象県を選びます。
2. 協力業者でログインし、選択県以外の案件が表示されないことを確認します。
3. 提出見積、売上、原価、利益、見積金額APIが利用できないことを確認します。

### 失注・復活

1. 管理者または社員で、ダッシュボードの要対応案件から **「失注」** を選びます。
2. 4区分から理由を選び、必要に応じて補足を入力して確定します。
3. 案件が失注タブへ移動し、通常の要対応件数から除外されることを確認します。
4. 失注タブで **「復活する」** を押し、失注前ステータスへ戻ることを確認します。

## 6. 検証結果

自動テストは **35ファイル・368テスト**が成功し、TypeScript型チェックと本番ビルドも成功しました。実DBスモークでは、最高管理者の利益が数値、管理者の利益が `null`、協力業者の指定県外案件が0件、社内金額漏えいが0件、見積API拒否を確認しています。[5] [6]

## References

[1]: https://github.com/kmiyoshi0422-svg/StoreOSX/blob/main/shared/accessPolicy.ts "共通アクセスポリシー"
[2]: https://github.com/kmiyoshi0422-svg/StoreOSX/blob/main/server/routers.ts "tRPCルーターと権限制御・失注復活API"
[3]: https://github.com/kmiyoshi0422-svg/StoreOSX/blob/main/client/src/pages/Home.tsx "ダッシュボード失注・復活UI"
[4]: https://github.com/kmiyoshi0422-svg/StoreOSX/blob/main/shared/dashboard.ts "ダッシュボード集計"
[5]: https://github.com/kmiyoshi0422-svg/StoreOSX/blob/main/server/permissionMatrix.contract.test.ts "権限マトリクス契約テスト"
[6]: https://github.com/kmiyoshi0422-svg/StoreOSX/blob/main/server/dashboardScheduling.test.ts "失注・復活・施工割当テスト"
