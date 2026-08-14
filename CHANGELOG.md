# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

---

## [1.13.0] - 2026-08-13

キャンペーンの達成状況を、購入者・団体・生徒それぞれに表示するようにした。これまで「ファンドレイジングの結果」がどこにも出ていなかった。

### Added
- **公開キャンペーンページに実際の達成率を表示**: 達成率バー・売上点数・支援者数・残り日数。従来はバーが `w-0` でハードコードされており、**すべてのキャンペーンが常に0%に見えていた**（購入者からは「誰も買っていない」と読める状態）
- **団体ダッシュボードに成果を表示**: 調達額（団体の取り分）・売上点数・支援者数・アクティブなキャンペーン数。「購入者の支払総額 $X のうち $Y が団体の取り分」という内訳も表示
- **キャンペーン一覧に個別の進捗を表示**: 下書きは「Not launched yet」と表示し、$0 と混同されないようにした
- **団体向けの注文履歴を追加** (`/dashboard/orgs/[orgId]/orders`): 何がいつ売れたか、各注文の団体取り分、ステータス。**返金済みの注文も表示**されるため、入金が減った理由が団体側から確認できる。購入者の住所は市・州のみ（配送は印刷業者が行うため、団体に番地は不要）
- **Student ロールの表示制御を実装**: 生徒には達成率・売上点数・支援者数・残り日数のみを表示し、金額・手数料・入金額は一切表示しない。注文履歴にもアクセスできない
- **キャンペーンごとの金額表示切替を有効化**: 「%のみ」と「金額も表示」を選択可能に（従来は `percent_only` にハードコードされていた）

### Fixed
- **団体ダッシュボードの「No campaigns yet.」がハードコードされていた問題を修正**: キャンペーン数に関係なく常に表示され、すぐ上の「アクティブなキャンペーン数」と矛盾していた

### Changed
- **達成率は「団体の手取り」を基準に計算**: 価格設定画面が既に「目標達成に必要な枚数＝目標÷利益」と表示しているため、目標は団体の受取額として設定されている。総売上を基準にすると、目標の2割しか受け取っていない団体に「200%達成」と表示されてしまう
- **注文の損益計算を `src/lib/order-economics.ts` に分離**: 純粋な計算が Stripe SDK に依存していたため、キャンペーン進捗の計算から利用できなかった

---

## [1.12.0] - 2026-08-13

返金機能を実装。あわせて、実際に返金を実行したことで見つかった2件の不具合を修正した。

### Added
- **管理画面から注文を返金できるように**（`platform_admin` 限定）: 注文詳細ページに「交換を手配する」「返金する」を追加。交換を先に提示し、それぞれの費用負担を明示する。返金画面では買い手への返金額・団体から回収する額・運営者が被る額を確定前に表示する。返金には理由の入力が必須で、実行者・日時・理由・Stripeの返金ID・転送取り消しIDが監査記録として残る
- **注文ステータスに `refunded` を追加**: 終端状態として扱い、売上・注文数の集計から除外される

### Fixed
- **管理画面の売上が過少計上されていた問題を修正**（返金機能とは無関係の既存不具合）: 集計条件が `status = "paid"` のみだったため、注文が履行されて `fulfilled` に進んだ時点で売上から消えていた。発送済みの注文がすべて計上されていなかったことになる。集計対象を `paid` / `fulfilled` / `shipped` / `delivered` の一覧として一元管理し、`refunded` を除外する形に変更
- **返金時の残高不足警告が常に誤検知していた問題を修正**: 団体の残高を請求総額と比較していたが、転送の取り消しと手数料の返還は同時に決済されるため、実際に動くのは団体の純利益分のみ。団体が純利益以上の残高を持つことはないため、すべての返金で警告が出ていた。実際に返金を実行して発覚

### Changed
- **ランディングページの調達額から返金済み注文を除外**: 返金した金額を「調達額」として掲示しないため

---

## [1.11.0] - 2026-08-13

購入者向けのFAQページ追加と、1回の注文金額に上限を導入。あわせて、未実装だった返金機能の仕様に含まれていた重大な誤りを Stripe テストモードでの実測により発見・修正した。

### Added
- **ヘルプページを追加** (`/help`): 購入者からよくある8つの質問（注文が届かない・不良品・サイズ違い・返品・誰から買ったのか・お金の行き先・住所変更・確認メール未着）。`/terms` `/privacy` と同じ `content/*.md` 方式なので、ライセンシーは GitHub 上で `content/help.md` を編集するだけで内容を差し替えられる。トップページ・法務ページ・注文確認ページ・購入者向けメールの全てからリンク
- **1回の注文金額に上限を導入**（既定 $500、`MAX_ORDER_TOTAL_CENTS` で変更可）: 従来は「1商品10点まで」の制限しかなく、商品の種類を増やせば素通りできた（実測で2商品×10点＝$560が通過）。製造費は Printful へ先払いで Stripe の入金は数日後になること、また不正カードによるチャージバック損失が運営者負担で商品も回収できないことから、1件あたりの被害額に天井を設けた。環境変数が不正な値の場合は上限が無効になるのではなく既定値に戻る

### Fixed
- **返金仕様の重大な誤りを修正**（未実装機能の仕様のため、本番影響はなし）: `add-order-refunds` の設計は Stripe への返金時に `reverse_transfer` のみを指定し `refund_application_fee` は指定しない、としていた。Stripe テストモードで実測したところ、この設定では**団体（PTA）の残高が −$21.61 になる**ことが判明。Stripe は決済額の全額を連結アカウントへ転送し手数料を別途徴収するため、`reverse_transfer` は総額 $28.69 を引き戻す一方、団体が実際に受け取っていたのは $7.08 だけだった。団体は Stripe ダッシュボードを持たないため、この差損に気付く手段もない。両フラグ指定が正しく（団体の残高がちょうど $0 に戻る）、仕様・設計・タスク・spec の全てを修正した
- **拒否されたチェックアウトが注文レコードを残す問題を修正**: `createPendingOrder` がバリデーションより前に実行されていたため、原価割れ等で拒否された場合に `pending` の注文が残っていた

### Changed
- **決済・履行の責任分担ドキュメントを実測値に更新**: Stripe の資金移動の仕組み（転送は総額・手数料は別途徴収）を実測に基づいて追記し、金額例を実測値に差し替え

---

## [1.10.0] - 2026-08-13

購入者が「困ったときに誰に連絡すればいいか」分からない状態と、運営者が「問い合わせが来ても注文を調べられない」状態を、両側から解消したリリース。

### Added
- **納品書に団体名とサポート連絡先を印字**: Printful は購入者の自宅へ直送するため、荷物が唯一の物理的接点。従来は納品書が Printful ストアの既定値のままで、団体名もプラットフォーム名も載っていなかった。団体名・キャンペーン名・サポート連絡先・「印刷工場に返送しないでください」を印字するよう変更（Printful が上書き可能と明記している `email` / `message` / `logo_url` の3フィールドのみ送信）
- **管理画面に注文照会を追加** (`/admin/orders`): 購入者が引用する注文番号・メールアドレス・氏名で検索。購入者に見えている注文番号は UUID ではなく先頭8文字の大文字16進なので、小文字プレフィックスとして照合する。詳細ページには購入者情報・配送先・商品明細・Printful注文（ダッシュボードへ直リンク）・追跡・Stripe決済（直リンク）・履行エラーと試行回数を表示。`platform_admin` と `platform_staff` の両方が閲覧可、書き込み操作なし
- **購入者向けの連絡先を追加**: 注文確認ページ・注文確認メール・**配送通知メール**の3箇所に、サポート連絡先と注文番号を入れた `mailto:` リンク、写真添付の案内、印刷工場への返送を避ける旨を追加（従来はいずれにも連絡先が無かった）
- **決済・履行の責任分担を設計文書化** (`docs/3-development/specs/2026-08-13-payment-responsibility-model-design.md`): KYC収集義務・決済名義・Stripe/Printful への支払い・返金とチャージバックの負担が、コードを追わないと分からない状態だったため明文化
- **OpenSpec に `platform-admin` capability を追加**: 二層ロールモデル（`user.platform_role` と `org_members.role`）、`/admin` のアクセス制御、初回管理者のブートストラップ、組織の suspend が唯一の削除手段であること等を、v1.9.1 時点の実装として仕様化
- **OpenSpec に `add-order-refunds` 提案を追加**（提案のみ、実装なし）: 利用規約が30日以内の交換・返金を約束している一方、返金処理がコード上に存在しない状態を解消するための提案

### Changed
- **利用規約の資金フローの記述を実装に合わせて修正**: Stripe の destination charge では売上が一度プラットフォーム運営者の残高を通過するため、「運営者は団体の資金を保持しない」は不正確だった。実際の流れ（運営者が製造・配送費と決済手数料を負担し、手数料を差し引いた残りを団体へ送金）に修正
- **利用規約の返金条項を明確化**: 交換を標準的な対応とし、返金額は実支払額を上限とすること、印刷工場に返送しないことを明記
- **ドキュメントの「Admin」の呼び分けを明確化**: README の役割一覧が無修飾の「Admin」だったため、プラットフォーム管理者と団体管理者が同一に読めた。「Organization Admin」に変更し、セットアップガイドの完了ステップも「プラットフォーム管理画面」と明示

---

## [1.9.1] - 2026-07-24

### Changed
- **トップページの実績統計に表示のしきい値を導入**: 「1 Campaigns launched」「5 Organizations」のような小さい数字は社会的証明として逆効果のため、一定数に達するまで非表示に変更（調達額 $1,000 以上・キャンペーン 10 件以上・団体 10 団体以上。全て未達の場合はセクションごと非表示 — 従来の「0 のときだけ隠す」から変更）

---

## [1.9.0] - 2026-07-24

### Changed
- **トップページの商品プレビューを実カタログ連動に変更**: 絵文字のダミーカード2枚（Tシャツのみ）を廃止し、実際のカタログから4商品（Tシャツ・フーディ・マグなど、カタログ全体から種類が散らばるように自動選出）を実商品画像・色・推奨価格つきで表示

---

## [1.8.1] - 2026-07-24

### Fixed
- **管理画面（/admin）に Sign out ボタンがなかった問題**: 管理ナビの右端（モバイルはメニュー内）にログアウトを追加。従来は団体ダッシュボードに移動しないとログアウトできなかった

---

## [1.8.0] - 2026-07-24

### Added
- **ランディングページ右上にログイン導線を追加**: 未ログインの訪問者には「Sign in」ボタン、ログイン済みユーザーには「Dashboard →」ボタンを表示。既存ユーザーがトップページから自分のダッシュボードに戻れなかったギャップを解消

---

## [1.7.0] - 2026-07-24

### Added
- **ランディングページに「What you'll need」セクションを追加**: 口座連携に必要なもの3点（EIN/SSN・銀行口座・約10分）をアイコン付きカードで表示し、スクロールで表示されると順番にアニメーション → 最後に「You're ready to {プラットフォーム名}!」のチェックバッジが出る。「キャンペーンは先に作れて、公開直前の口座連携でOK」の一文も明記（PTA など団体側の心理的ハードルを下げる施策。prefers-reduced-motion 対応済み）

---

## [1.6.1] - 2026-07-24

### Added
- **データライフサイクル管理の OpenSpec 提案**を作成（`openspec/changes/2026-07-24-add-data-lifecycle/`）: 注文ゼロの団体はオーナーが削除可・販売実績のある団体はアーカイブ（閉鎖）、注文の購入者個人情報（氏名・メール・住所・追跡情報）を保持期間（デフォルト24ヶ月）経過後に自動匿名化、団体向け画面での住所表示の最小化、プライバシーポリシーへの保持期間明記 — を将来実装としてスコープ化

### Fixed
- **団体ダッシュボードの「Manage payouts」ボタン（連携済み状態）が薄すぎて枠が見えない問題**: 白いカード上で枠線がほぼ見えなかったため、はっきり見えるグレーの枠線と薄い背景色に変更（実利用フィードバックに対応）

---

## [1.6.0] - 2026-07-23

### Added
- **セットアップウィザードで R2 公開 URL の設定ミスを検出**: `CLOUDFLARE_R2_PUBLIC_URL` に S3 API エンドポイント（`*.r2.cloudflarestorage.com`）が設定されている場合、Step 8 で赤色の警告と正しい値（Public Development URL `pub-*.r2.dev`）の取得手順を表示（実環境のセットアップで実際に発生した設定ミス）
- セットアップガイドに**テストモード動作確認チートシート**を追加: Stripe テスト用の magic value（生年月日・銀行口座・認証コード・テストカード）、州と ZIP が一致する住所の必要性、確認ポイント一覧
- セットアップガイドに **Vercel「Redeploy」の落とし穴**の注意書きを追加: Redeploy は古いコードスナップショットを再公開してしまうため、コード更新は Sync fork / コミットで行う旨を明記（FAQ にも追加）
- セットアップガイドに **Webhook URL はコピー＆ペースト必須**の注意書きを追加: タイプミス時は 404 が並ぶこと、修正後は「Resend」で再送できることを明記
- **フルフィルメント失敗注文のリカバリーフロー**の OpenSpec 提案を作成（`openspec/changes/2026-07-23-add-failed-order-recovery/`）: 管理画面での失敗注文の可視化・住所修正・再実行を将来実装としてスコープ化

### Changed
- **団体ダッシュボードの「Manage payouts」をボタン化**: 口座連携が未完了の場合は目立つプライマリボタン「Set up payouts →」、完了後はアウトラインの「Manage payouts」を表示（テキストリンクで見つけにくいという実利用フィードバックに対応）
- 要件定義書・システム設計書を実装に同期: Webhook イベントを `checkout.session.completed` に修正（2本のエンドポイント構成を明記）、配布フローを Fork + Import 方式に更新、ユニットエコノミクスを購入者送料負担モデル（$28 + $4.69 送料 → 手数料 $22.10 / 団体 $10.59）に更新

---

## [1.5.3] - 2026-07-23

### Fixed
- **Printful が注文を「Invalid External ID」で拒否する問題**: Printful の external_id は最大32文字だが、注文ID（UUID・36文字）をそのまま送っていた。ハイフンを除いた32文字へ可逆変換して送信し、発送通知 Webhook での逆引きも対応（実環境の E2E テストで発見）

---

## [1.5.2] - 2026-07-23

### Fixed
- **Printful のエラー内容が握りつぶされる問題**: Printful API のエラーはオブジェクト形式（`{reason, message}`）でも返るが、文字列前提の処理だったため「.includes is not a function」で自壊し、本当の失敗理由がログに出なかった。両形式に対応し、実際のエラーメッセージを記録するように修正
- **デザイン未アップロードのキャンペーンを公開できてしまう問題**: 公開後に購入されるとフルフィルメントが「manual fulfillment required」で止まり、購入者のお金を預かったまま発送できない状態になっていた。公開（Go Live）時にデザイン必須のチェックを追加し、未アップロード時はボタンを無効化 + デザイン画面への誘導リンクを表示（実環境の E2E テストで発見）

---

## [1.5.1] - 2026-07-23

### Fixed
- **決済後に Printful 注文と確認メールが処理されない問題**: Webhook が 200 を返した直後にサーバーレス関数が凍結され、投げっぱなしにしていたフルフィルメント処理（Printful 注文作成 → 注文確認メール送信）が実行されないことがあった。Next.js の `after()` に載せ替え、レスポンス返却後も処理の完走を保証するように修正（実環境の E2E テストで発見）

---

## [1.5.0] - 2026-07-23

### Changed
- **Printful 注文を自動確定に変更**: 従来は注文が Printful 上で「ドラフト」として止まり、運営者が1件ずつ手動で Confirm する必要があった（押し忘れ = 配送遅延）。デフォルトで自動確定し、そのまま印刷工程へ進むように変更。環境変数 `PRINTFUL_AUTO_CONFIRM=false` で従来のドラフト運用に戻せる
- セットアップガイドに **Printful の支払い方法登録が必須**である旨を追記（未登録だと注文確定が失敗するため）

### Added
- リリースごとの Git タグ運用を導入: `/release` スキルが開発リポジトリに `vX.Y.Z` タグを付与し、同期 workflow がリリースリポジトリにも同名タグを自動付与。過去分（v1.0.0〜v1.4.0）も遡及してタグ付け
- **GitHub Release の自動発行**: リリースごとに、CHANGELOG の該当バージョン部分をリリースノートとして公開リポジトリに Release を自動作成（`RELEASE_REPO_TOKEN` シークレット使用）。ライセンシーは公開リポジトリを Watch → Custom → Releases に設定するだけで新バージョン通知を受け取れる（ガイドに手順を追記）
- `CHANGELOG.md` をリリースリポジトリの同期対象に追加（ライセンシーが更新内容を確認できるように）

---

## [1.4.0] - 2026-07-23

### Added
- **Printful 価格の週次自動同期**: 毎週月曜に Printful API から各商品の現在価格を取得し、カタログの製造原価を自動更新する cron を追加（±25% を超える変動はスキップして警告・実行中のキャンペーンには影響なし）。価格改定への追従にリリースが不要に

### Changed
- seed はデプロイ時に既存商品の原価を上書きしないように変更（価格の管理権限を cron へ移譲。名称・画像等のメタデータは従来どおり更新）

---

## [1.3.1] - 2026-07-23

### Fixed
- セットアップウィザード Step 4 の必須環境変数に `STRIPE_CONNECT_WEBHOOK_SECRET` を追加（未設定のままウィザードを通過できてしまう漏れを修正）。ガイドの Phase 1 チェック表等にも追記

---

## [1.3.0] - 2026-07-23

### Added
- **編集可能なランディングページ**（#28）: セクション構成のトップページ（How it works / 実績統計 / 利用者の声 / FAQ / CTA）と、`/admin/landing` からの文言編集・セクションのピン留め・リセット機能

### Fixed
- **団体の口座連携が完了扱いにならない問題**: Stripe の Connected accounts イベント（`account.updated`）は別エンドポイント・別署名シークレットで届くが、Webhook 検証がシークレット1個にしか対応していなかった。任意の環境変数 `STRIPE_CONNECT_WEBHOOK_SECRET` を追加し、2段階で署名検証するように修正（未設定なら従来どおりの動作）
- セットアップガイド 4-2 を新しい Stripe 管理画面（Workbench）準拠に書き直し、「Webhook は2本必要」という手順を明記

### Changed
- 価格計算機の表記改善: 「Production + buffer」→「Production cost (+10% safety buffer)」、「Stripe fees」→「Payment processing」、「送料は購入者負担で利益に影響しない」旨の1行を追加
- `/admin` のヘッダーを濃色 + ADMIN バッジ付きに変更し、管理画面であることが一目でわかるように
- 小売価格の初期値を一律 $28.00 から「製造原価の2倍を次のドル整数に切り上げ」に変更（例: 原価 $9.40 → $19.00）。全商品で初期値のまま健全な利益が出るように

---

## [1.2.0] - 2026-07-22

### Added
- **利用規約・プライバシーポリシー**: `/terms` と `/privacy` ページを新設（全ロール共通・全部入りの英語テンプレート）。本文は `content/terms.md` / `content/privacy.md` にあり、ライセンシーが GitHub 上で編集可能。サービス名・サポートメールはプラットフォーム設定から自動差し込み
- 同意導線: サインイン画面（continuing = 同意）、チェックアウトボタン下（購入 = 同意）、ランディングのフッターにリンクを設置
- **サインアップ前の事前体験**（#24）: 公開の `/start` プレビュービルダーと、サインアップ後にプレビュー内容をキャンペーンとして再現する `/onboarding` ガイド
- **団体レベルの入金設定**（#22）: Stripe Connect の口座連携をキャンペーンから分離し、団体設定（Settings → Payouts）に移動
- **プロフィール編集**（#19）: ユーザー表示名の変更と、管理者による団体名の変更

### Fixed
- ESLint エラー4件を解消（#20）
- **チェックアウトの手数料計算を修正（赤字バグ）**: application fee が商品代の9%のみで、ライセンシーが Printful に支払う POD 原価・送料を回収できていなかった（1注文ごとに確実に赤字になる状態）。手数料 = POD原価(+10%バッファ) + 送料 + 9% + Stripe手数料 に変更し、価格計算ツールの表示と実際の送金が一致するようにした
- 売価が原価割れしているキャンペーンでは、チェックアウト作成を 400 エラーで拒否（黙って赤字にしない）

### Added
- **購入者負担の送料**をチェックアウトに追加（Stripe の送料行・米国標準レート表ベース・注文単位で「1点目 + 追加点数」方式で算出）
- 送料レート表 `SHIPPING_RATES` と見積もり関数 `estimateShippingCents`（カタログ全17商品分・単体テスト付き）

### Changed
- Printful の配送方法を `PRINTFUL_FAST` から `STANDARD` に変更（コスト削減・速達が不要な商材のため）
- ライセンシーのデプロイ方式を「Vercel Deploy ボタン」から「**Fork → Vercel インポート**」に変更。Deploy ボタン方式はフォークではなく切り離されたコピーを作るため、ライセンシーがアップデート（Sync fork）を受け取れなかった
- `README.release.md`: Deploy ボタンをセットアップ手順への誘導ボタンに置き換え、Fork 必須の注意書きと3ステップ手順を追加
- `00-START-HERE.md` Phase 2 を Fork → インポート手順に全面書き換え。「アップデートの受け取り方」セクションと FAQ を追加
- 準備チェックリスト Section 4 のデプロイ手順も同様に更新
- 開発リポジトリ README の壊れた Deploy ボタン（private リポジトリを指すため常に失敗）を削除し、リリースリポジトリへの案内に変更

---

## [1.1.0] - 2026-07-13

### Added
- デプロイ時のデータベース自動初期化: Vercel の buildCommand で `db:init`（`drizzle-kit push` + カタログ seed）を実行。ライセンシーは Turso で空の DB を作るだけでよくなり、手動でのスキーマ適用・seed が不要に
- `npm run db:init` スクリプト（冪等 — 何度実行しても安全）
- セットアップドキュメント2件に「テーブルはデプロイ時に自動作成」の補足を追記

---

## [1.0.0] - 2026-06-09

### Added
- リリースインフラ: `CommunityMerch-PF-release` リポジトリへの自動同期 workflow
- リリースゲート: PreToolUse hook が `git push origin main` をブロックし、正式リリース手順を強制
- `/release` スキル: CHANGELOG 更新・バージョニング・release ブランチ push を一括実行
- ライセンシー向け `README.release.md`: 正しい Deploy ボタン URL（リリースリポジトリ指定）
- Deploy ボタンに全 22 環境変数の日本語ガイド（`envDescription` + `envLink`）
- `docs/00-START-HERE.md`: ライセンシー向けセルフオンボーディング完全ガイド（Phase 1〜5）
- `docs/licensee-preparation-checklist.md`: 事前準備チェックリスト
- リリースリポジトリへの同期ファイルを licensee 必須のみに絞り込み

---

## [Phase 1 完了] — 2026-06-01

### Milestone: MVP + 配布パッケージ完成

Plans 1–8 全て完了。ライセンシーへの配布・本番デプロイが可能な状態。

**実装済み機能:**
- 認証 (Better Auth, Google OAuth, magic link)
- 組織管理 (4ロール: Admin / Member / Student / Buyer)
- キャンペーン作成ウィザード + 公開ページ
- 価格計算ツール (Printful POD コスト + マージン計算)
- Stripe Connect 支払い + org 銀行口座連携
- Printful POD フルフィルメント自動化 + Resend メール
- Cloudflare R2 ファイルストレージ
- AI デザイン生成 (OpenAI gpt-image-1) + Printful Mockup
- 9ステップ Setup Wizard
- Platform Admin Panel (`/admin`) — 割引コード・Org管理・スタッフ管理
- README + Vercel Deploy ボタン

**次のアクション（優先順）:**
1. 本番デプロイ（Vercel Deploy ボタンで実施）
2. Student role 実装（要件書の差別化ポイント）
3. ユーザーフィードバック後に Phase 2 優先度を決定

---

## [1.1.0] — 2026-06-01

### Distribution

#### Added
- `vercel.json` with Vercel Deploy button support — all 20 env vars configured with descriptions and source URLs shown in Vercel's guided setup UI
- Platform README replacing the development template:
  - One-click Deploy to Vercel button
  - Licensee quickstart (4-step flow: prepare → deploy → configure → manage)
  - Required services table with free tier notes
  - Developer local setup guide (clone, install, env, push schema, dev)
  - Tech stack table
  - Directory structure
  - Documentation links
  - English primary, Japanese supplementary notes throughout
- `OPENAI_API_KEY` marked as optional in vercel.json (AI design feature runs without it)

---

## [1.0.0] — 2026-06-01

### Platform Admin Panel

#### Added
- `platform_admin` and `platform_staff` roles on the user table (via Better Auth `additionalFields`)
- `/admin` panel for business operators: dashboard, orgs, discount codes, staff
- Dashboard command center: stats (orgs, campaigns, orders, revenue), recent orgs with status badges, active discount codes with quick disable, quick action buttons
- Organizations: list all orgs, view detail, suspend/unsuspend, toggle isInternal flag, apply/remove discount code
- Discount codes: create (fee_percentage / fee_waiver), deactivate (with deactivatedAt audit), list with usage stats
- Staff management: assign/remove platform_admin or platform_staff role to existing users; errors surfaced via useActionState
- Fee calculation updated: checkout and publishCampaign now read org.isInternal and active discount code to compute correct platform fee rate
- Campaign platformFeeRate snapshot: fee rate locked at campaign creation — revoking a code does not affect existing campaigns
- fee_waiver campaignLimit enforcement: publishCampaign checks how many campaigns the org has already used the waiver on
- Org suspension enforcement: suspended orgs blocked from publishCampaign and checkout (checked before order creation); public page shows "Campaign Unavailable"
- Setup Wizard Step 9 now assigns platform_admin to the completing user and redirects to /admin/dashboard

#### Security
- All admin pages enforce platform_admin role check at the server component level (not just nav visibility)
- All server actions call requirePlatformAdmin() before mutating data
- discountType enum validated server-side in createCodeAction
- Suspension check in checkout moved before createPendingOrder to prevent orphaned orders

#### Architecture notes
- discountCodes.currentUses incremented with SQL-level `+1` (atomic, no read-then-write)
- Platform fee rate stored as basis points (900 = 9.00%) in campaigns.platformFeeRate
- No FK between organizations.discountCodeId and discountCodes (app-layer validation)
- platformRole: null on Better Auth user table means normal user (not platform staff)

---

## [0.9.2] — 2026-06-01

### Verified

- **Plan 6 end-to-end verified** — AI design generation (OpenAI gpt-image-1 → R2 upload), Printful T-shirt mockup generation, and public campaign page display all confirmed working with live credentials.
- **Plan 6 implementation checklist completed** — all 45 task steps marked complete in `docs/5-project-management/plans/2026-06-01-06-ai-design-mockup.md`

---

## [0.9.1] — 2026-06-01

### Infrastructure

- **Cloudflare R2 credentials fully configured** — Account ID, Access Key ID, Secret Access Key, Bucket Name all set in `.env.local`. AI-generated designs now upload directly to R2 (no local fallback needed in production). Printful mockup generation will work with publicly accessible R2 URLs.
- **R2 API token created**: `communitymerch-uploads-rw` — Object Read & Write, all buckets
- **Documentation updated**: system-design.md and licensee-preparation-checklist.md now include accurate step-by-step R2 token creation instructions (including the S3 Access Key ID vs Token value distinction)

---

## [0.9.0] — 2026-06-01

### Bug Fixes (Plan 6)

- **r2.ts**: Fixed lazy initialization to prevent Turbopack module-level env var errors
- **ai-design route**: Added local `public/uploads/` fallback when R2 not configured (dev mode)

---

## [0.8.0] — 2026-06-01

### Post-MVP: AI Design Generation + Printful Mockup

#### Added
- OpenAI gpt-image-1 integration — transparent PNG design generation from text prompts
- Copyright/IP filter: prompts referencing Disney, Marvel, NFL, Nike etc. are rejected with helpful error message
- Printful Mockup Generator API — design automatically applied to Bella+Canvas 3001 White M T-shirt
- `/api/ai-design` route: validated prompt → OpenAI generation → R2 upload → URL
- `/api/printful-mockup` route: design URL → Printful task → poll → mockup URL
- `designs.mockupUrl` column (Turso migration applied)
- Campaign design step: AI prompt section + "✨ Generate" button with side-by-side design/mockup preview
- Public campaign page: shows T-shirt mockup when available, falls back to raw design file

#### Architecture notes
- No remove.bg dependency — gpt-image-1 supports transparent PNG natively (`background: "transparent"`)
- Mockup generation is non-fatal: if Printful mockup fails, the design is still saved without mockup
- Printful Mockup variant: Bella+Canvas 3001 White M (variant_id 4012, verified from API)

#### Infrastructure
- Branch: `feat/phase-6-ai-design-mockup`
- Plan: `docs/5-project-management/plans/2026-06-01-06-ai-design-mockup.md`

---

## [0.7.0] — 2026-06-01

### Bug Fix

- **platform-config**: Fixed UNIQUE constraint error on first visit caused by layout + page concurrently calling `getOrCreateConfig()`. Fixed with `onConflictDoNothing()`.

---

## [0.6.0] — 2026-06-01

### Phase 5: Setup Wizard

#### Added
- platform_config schema (singleton row: platformName, tagline, colors, domain, email, licenseAgreed, currentStep, setupComplete)
- Platform config library: getOrCreateConfig (upsert singleton), updateConfig, advanceStep, markSetupComplete, isEnvConfigured
- /setup wizard: 9-step route at /setup/step/[step] with step indicator progress bar
- Setup layout: auto-redirects to / if setupComplete=true; handles first-run creation
- Setup redirect page: routes to /setup/step/{currentStep} for resumption
- Step server actions: saveStep1, saveStep2, advanceServiceStep, launchPlatformAction
- Step 1: License agreement (checkbox required)
- Step 2: Brand identity (name, tagline, primary/accent colors, domain, support email)
- Steps 3–8: Env var checklist (Turso/Stripe/Printful/Resend/OpenAI(opt)/R2) with ✓/⚠ per variable
- Step 9: Review summary + 🚀 Launch Platform → setupComplete=true → /dashboard
- Dashboard layout: setup guard redirects to /setup when not complete
- 27 unit tests passing

#### Architecture notes
- Wizard stores only brand config in DB; API keys remain as env vars (Vercel-managed)
- No live connection tests (simplified MVP); service steps check env vars only
- Single dynamic route /setup/step/[step] handles all 9 steps

#### Infrastructure
- Branch: `feat/phase-5-setup-wizard`
- PR: [#6 — feat: Phase 5 — Setup wizard](https://github.com/madbarbarian/CommunityMerch-Fundraising-Platform/pull/6)
- Plan: `docs/5-project-management/plans/2026-06-01-05-setup-wizard.md`

---

## [0.5.0] — 2026-06-01

### Phase 4b: Printful Fulfillment + Resend Emails

#### Added
- orders schema: fulfillmentAttempts, fulfillmentError, trackingNumber, carrier, trackingUrl columns
- Printful product IDs verified from API and hardcoded in catalog (bc-3001-tee=71, bc-3001y-tee=307, bc-3501-ls=356, gildan-18500-hoodie=146, atc-bg150-tote=641)
- Printful API provider (src/lib/providers/printful.ts): idempotent order submission via external_id, variant lookup by size+color
- Email helpers (src/lib/email.ts): sendOrderConfirmationEmail + sendShippingNotificationEmail via Resend
- Orders library: markOrderFulfilled, markOrderShipped, markFulfillmentFailed
- Fixed getOrder: added missing design relation (critical bug — would have blocked all fulfillments)
- Fulfillment orchestrator (src/lib/fulfillment.ts): design-file guard, Printful variant resolution, order submission, confirmation email; errors recorded in DB without propagating to Stripe webhook
- Stripe webhook updated: fulfillment triggered fire-and-forget after markOrderPaid
- Printful webhook (/api/webhooks/printful): shared-secret ?secret= auth, idempotent package_shipped → markOrderShipped + shipping email
- PRINTFUL_WEBHOOK_SECRET added to env sample
- 26 unit tests passing

#### Architecture notes
- Printful external_id = orderId ensures no duplicate POD orders on Stripe webhook retries
- No design file → fulfillment blocked, error recorded, manual intervention flagged
- Printful webhook authenticated via ?secret= URL param (Printful doesn't sign webhooks with HMAC)

#### Infrastructure
- Branch: `feat/phase-4b-fulfillment`
- PR: [#5 — feat: Phase 4b — Printful fulfillment + Resend emails](https://github.com/madbarbarian/CommunityMerch-Fundraising-Platform/pull/5)
- Plan: `docs/5-project-management/plans/2026-06-01-04b-fulfillment.md`

---

## [0.4.0] — 2026-06-01

### Phase 4a: Stripe + R2 + Orders + Cart

#### Added
- orders/order_items schema with indexes (campaign_id, stripe_checkout_session_id)
- Cloudflare R2 file storage — /api/upload switched from public/uploads/ to R2 (production-ready)
- Stripe provider singleton (`src/lib/providers/stripe.ts`) — destination charges, 9% platform fee
- R2 provider (`src/lib/providers/r2.ts`) — S3-compatible upload with startup guards
- Orders library (createPendingOrder, getOrder, markOrderPaid)
- Campaign page: client-side cart UI (size selector XS–2XL, quantity 1–10, cart summary)
- Stripe Connect wizard step (Step 3 of 4) — org admin connects bank account before publishing
- Wizard updated: Design(1) → Pricing(2) → Connect Bank(3) → Publish(4)
- Checkout API (/api/checkout) — validates cart, creates pending order, creates Stripe Checkout Session
- Stripe webhook (/api/webhooks/stripe) — checkout.session.completed → order marked paid; account.updated → org marked connected
- Order confirmation page at /orders/[orderId] (public, no auth, shows buyer/shipping/status)
- test/results/ directory for verification screenshots (no longer scatter in project root)
- 25 unit tests passing

#### Infrastructure
- Branch: `feat/phase-4a-payments` (merged)
- PR: [#4 — feat: Phase 4a — Stripe + R2 + orders + cart](https://github.com/madbarbarian/CommunityMerch-Fundraising-Platform/pull/4)
- Plan: `docs/5-project-management/plans/2026-06-01-04a-payments.md`

---

## [0.3.0] — 2026-06-01

### Phase 3: Campaign Creation

#### Added
- Campaign schema: campaigns, campaign_products, designs tables with indexes and named constraints
- Middleware switched to protect-only model (only /dashboard requires auth; public /<slug> works)
- Printful product catalog constants (5 variants, 4 preset packs) + calculateMargin + itemsNeededForGoal
- Campaign CRUD library (createCampaign, getCampaignBySlug, savePricingStep, publishCampaign, etc.)
- Format helpers (formatCents, formatDate, daysUntil)
- File upload API (/api/upload → public/uploads/ in dev)
- Campaign wizard: Design (logo upload) → Pricing (margin calculator) → Publish (Go Live)
- Public campaign page at /<slug> (SSR, no auth, read-only)
- Dashboard campaigns list (Active/Draft/Closed)
- 25 unit tests passing

#### Infrastructure
- Branch: `feat/phase-3-campaign` (merged)
- PR: [#3 — feat: Phase 3 — Campaign creation + public page](https://github.com/madbarbarian/CommunityMerch-Fundraising-Platform/pull/3)
- Plan: `docs/5-project-management/plans/2026-05-31-03-campaign.md`

---

## [0.2.0] — 2026-05-31

### Phase 2: Organization Management

#### Added
- `invitations` table (token-based, 7-day expiry, cascade on org/user delete)
- `requireOrgAccess()` middleware + `hasRole()` rank-based role hierarchy (admin > member > student > buyer)
- Org CRUD library: `createOrg` (slug collision-safe, transactional), `getOrgsForUser`, `getOrg`, `getOrgMembers`
- Drizzle ORM relations for orgMembers, organizations, user, invitations
- Dashboard org list with OrgCard component (role badge, slug display)
- Create Organization page (Server Action + useActionState)
- Org layout with breadcrumb nav, role-gated Members tab
- Org overview page (member count stat, role stat)
- Members management: list, invite by email, promote/demote, remove
- Invitation library: token generation (64-char hex), Resend email / console fallback
- Invitation accept flow `/invite/[token]`: invalid/expired/used states, sign-in prompt for unauthenticated users
- `.gitignore` fix: un-ignore `[token]` dynamic routes (was swallowed by `*token*` rule)
- 17 unit tests passing (middleware path, hasRole, generateSlug)

#### Infrastructure
- Branch: `feat/phase-2-organization`
- PR: [#2 — feat: Phase 2 — Organization management](https://github.com/madbarbarian/CommunityMerch-Fundraising-Platform/pull/2)
- Plan: `docs/5-project-management/plans/2026-05-30-02-organization.md`

---

## [0.1.0] — 2026-05-30

### Phase 1: Foundation

Initial foundation implementation. Running Next.js app with authentication and database.

#### Added
- Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui component library
- Turso DB (communitymerch-dev) + Drizzle ORM with 6 tables:
  - Auth tables: `user`, `session`, `account`, `verification`
  - App tables: `organizations`, `org_members`
- Better Auth with Google OAuth and magic link (Resend) providers
- Route protection middleware with session cookie check
- Sign-in page (Google button + email magic link form)
- Authenticated dashboard shell (server-side session check, sign-out)
- Landing page with "Get Started" CTA
- Vitest unit tests (7 passing) for middleware path logic
- Environment variable template (`.env.local.sample`)

#### Infrastructure
- Branch: `feat/phase-1-foundation`
- PR: [#1 — feat: Phase 1 Foundation](https://github.com/madbarbarian/CommunityMerch-Fundraising-Platform/pull/1)
- Plan: `docs/5-project-management/plans/2026-05-30-01-foundation.md`

---

*Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)*
