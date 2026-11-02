# StoreOSX 重大依存脆弱性の修正（2026-11-03）

現行lockfileを対象とするレジストリ監査で重大7件を再現し、公式修正版への更新と不要になった旧テスト依存の除去により、修正後の監査では重大0件となった。警告のdismiss、監査除外、脆弱性の無視設定は行っていない。

## 更新した依存

DOMPurifyはjsPDFとStreamdown／Mermaidの両経路を3.4.17へ揃えた。添付shadow root内のテンプレート式に関するGHSA-cg2g-xh64-v4q7を対象とする。アプリがその攻撃条件を満たすと断定したわけではなく、依存自体を修正済みにした。[1]

AWS S3 SDKのXMLビルダー経由のfast-xml-parserは5.2.5から5.11.2へ更新した。DOCTYPEエンティティ名の正規表現による組込みエンティティ置換の回避問題GHSA-m7jm-9gc2-mpf2を解消する。同一メジャー内で更新しており、SDK自体を無関係な最新メジャーへ変更していない。[2]

Express経由のproxy-addrは2.0.7から2.0.8へ更新した。IPv4マップIPv6の短いプレフィックスによる信頼済みプロキシ判定の問題GHSA-jqcg-44mw-7w3hを解消する。認証や既存プロキシ設定を緩めていない。[3]

Tailwindビルドツール経由のtarは7.5.1から7.5.22へ更新した。無制限の展開処理によるDoSのGHSA-23hp-3jrh-7fpwを対象とする。アプリへ危険なアーカイブを投入する試験は行っていない。[4]

Vitestは2.1.9から4.1.10へ更新した。Vitest UIのGHSA-5xrq-8626-4rwpを解消し、4系で廃止されたTinypoolの依存経路ごと削除した。これによりTinypoolのGHSA-5gmw-xhrv-c9v3とGHSA-85c8-ppgw-ccprも除去した。非互換なTinypoolの強制差替はしていない。Node 22と既存Vite 7を継続利用する。[5] [6] [7] [8]

## 再発防止と監査範囲

既存pnpm 10.4.1と新しい設定読込環境の双方に対応するため、package.jsonとpnpm-workspace.yamlで同じ修正版の解決設定を保持した。既存のWouterパッチを維持する。lockfile上に旧Vitest／Tinypoolが残っていないこと、プロキシ判定、XMLエンティティ処理と設定整合を回帰テストへ追加した。

`pnpm audit:critical`で再監査できる。重大警告があれば終了コード1、監査不能なら2となる。その他の重大度も件数を表示し、criticalが0であっても安全性全体の保証にはしない。

変更前のローカル監査は重大7・高65・中98・低21、更新後は重大0・高51・中68・低8。GitHubの再集計でも重大0を確認し、残存は127件（高50・中69・低8）となった。集計元・時点が異なるため、その他の区分件数を同一視しない。GitHub Dependabot詳細APIはHTTP 403で利用できなかったため、個別警告IDごとの閉鎖状態は取得していない。mainへの反映と公開配信の確認結果は後述する。

## 手入力案件登録の追加申告

依存更新後の開発実画面で、最高管理者（PC）と社員（390pxスマホ）それぞれから手入力の合成案件を登録できた。API 200・詳細への遷移・保存済み案件を確認し、各合成案件は関連データごと削除した。実案件の代行登録はしていない。今回申告された失敗の原因は未特定で、実際のエラー文／画面と依頼番号・店舗名を確認待ち。登録APIの障害が解決済みと断定しない。

## References

[1]: https://github.com/advisories/GHSA-cg2g-xh64-v4q7 "DOMPurify shadow root template expression advisory"
[2]: https://github.com/advisories/GHSA-m7jm-9gc2-mpf2 "fast-xml-parser entity encoding bypass advisory"
[3]: https://github.com/advisories/GHSA-jqcg-44mw-7w3h "proxy-addr trust subnet advisory"
[4]: https://github.com/advisories/GHSA-23hp-3jrh-7fpw "node-tar unlimited decompression advisory"
[5]: https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp "Vitest UI advisory"
[6]: https://github.com/tinylibs/tinypool/security/advisories/GHSA-5gmw-xhrv-c9v3 "Tinypool worker options advisory"
[7]: https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr "Tinypool run options advisory"
[8]: https://v4.vitest.dev/guide/migration#pool-rework "Vitest 4 migration pool rework"

## 検証結果

既存全72テストファイル・643テストがVitest 4.1.10で成功し、追加の依存セキュリティ回帰4テストも成功した。TypeScriptと本番ビルドは成功。既知の500kBチャンクサイズ・JSXプラグインのVite peer警告はあるが、今回の重大脆弱性警告とは別である。凍結lockfileによる再インストールと監査コマンドも成功した。

390pxスマホ画面で現調報告書3ページと完了報告書5ページをA4 PDFとして保存し、写真・プレビュー・ダウンロードボタンと画面エラー0を確認した。検証ではPDF履歴アップロードのみをモックし、実案件へ検証履歴を残していない。手入力登録は実際のAPIとDBを利用し、合成案件2件だけを保存して削除した。

作業前後の比較で実案件678件全列と協力会社49件全列が一致し、既存44ユーザーの名前・役割・エリア・会社リンクも不変だった。画面検証に伴う最高管理者と社員のログイン関連時刻だけが更新された。全テストと清掃後のテスト案件・テスト協力会社の追加残存はない。DBスキーマ変更はない。

## 公開・同期の確認

検証済みチェックポイントdf4035b3を既存StoreOSXリポジトリのmainへ同期し、既存公開ドメインへ再公開した。デプロイ成功通知と、公開HTMLのエントリー切替を確認した。エントリーindex-DkHDBnsu.js、案件登録CaseNew-D06-uPtm.js、案件詳細CaseDetail-DALE-Rhy.js、現調CaseReport-Dxf_A0Za.js、完了CompletionReport-Bp0O4egK.js、プレビューPdfPreviewModal-DldMRgce.js、PDFライブラリvendor-pdf-qUOlKPGf.jsの7ファイルがすべてHTTP200・JavaScript形式・ローカル最終ビルドとSHA256一致で配信されていた。公開後の本人ログインによる実操作は未検証で、認証済み開発画面で検証した。

GitHubへの初回push応答は旧集計172件（critical7等）だったが、公開確認記録68f942c0をmainへ同期した際の再集計は127件（high50・moderate69・low8、critical0）となり、GitHub側でも重大警告がなくなったことを確認できた。個別APIは403のため警告IDごとの詳細状態は未取得。高51・中68・低8のローカル監査残存、および高50・中69・低8のGitHub集計残存は、今回の重大7件以外の課題として残る。
