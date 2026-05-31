# PDF案件インポート 抽出フィールド仕様

提供PDF「修理依頼システム」から抽出する項目（プレナス公式画面の項目に対応）

## 店舗情報
- 依頼番号 (例: 285236-1) → invoiceNumber
- 店舗名（漢字） (例: 小郡市役所前店) → storeName
- 店舗名（カナ） → storeNameKana
- ブランド名 (例: ほっともっと) → brandName
- 契約形態 (例: FC) → contractType
- 店舗タイプ (例: 19PH-00) → storeType
- 郵便番号 (例: 838-0141) → postalCode
- 住所 (例: 福岡県小郡市小郡333-1) → address
- 電話番号 (例: 0942-72-5874) → phone
- FAX番号 → fax
- 営業時間 (例: 10:00:00〜23:00:00) → businessHours
- OFC/MGR (例: 大原 俊一) → ofcMgr
- 開店日 (例: 1985/11/25) → openedAt
- 営業営業部 (例: HM福岡ﾌﾞﾛｯｸ) → branch
- 店舗コード (例: 2245) → storeCode
- SHOP-ID (例: 555) → shopId

## 依頼情報
- 依頼日時 (例: 2026/05/29 13:30) → requestDate
- 受付者 (例: 大原) → reception
- 依頼者 (例: 大原) → requester
- 依頼者連絡先 (例: 09065610359) → requesterContact
- 依頼内容 (フリーテキスト) → requestDetail
- 修理内容【大項目】(例: 内外装・サッシ・建具 関連) → categoryLarge
- 修理内容【中項目】(例: 建具関連) → categoryMid
- 修理内容【小項目】(例: 窓) → categorySmall

## 取引先情報
- 取引先選択 (例: コバヤシコウボウ ニシニホン) → partnerSelect
- 取引先名（漢字） (例: (株)小林工房) → partnerName
- 取引先名（カナ） → partnerNameKana
- 取引先責任者連絡先 (TEL: 093-383-7366) → partnerContact
- 取引先責任者名 (例: 下川 彩) → partnerManager

## 区分
- 依頼時作業区分: 入替/修理/納品/見積り/新規 → workType
- 依頼時負担区分: 店舗/営業部/その他 → costBearer
- 依頼時保険区分: 有り/無し/加害者 → insurance
- 依頼時店舗稼動可能区分: 運用無し/運用有り → storeOpen

## 写真・添付
- カメラ1〜10: 修理箇所写真 → photos[] (アップロード時に自動ラベル付け)
- 添付1〜4: 補足資料 → attachments[]

## マッピング先（既存schema）
cases テーブル既存カラム:
- title, storeName, address, phone, requesterName, categoryLarge, categoryMid, categorySmall, requestDetail, status, urgency, ...

新規追加検討:
- invoiceNumber (既存) ✓
- storeCode, shopId, brandName, contractType, businessHours, openedAt, ofcMgr, branch
- workType, costBearer, insurance, storeOpen

→ 既存スキーマで吸収できないものは extraInfo (text/JSON) カラムに保存して柔軟性確保
