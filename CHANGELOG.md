# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

---

## [1.20.1] - 2026-08-21

### Fixed

- **v1.20.0 の手順書に誤りがありました。訂正します — 「Sync fork でもプレビューが作られる」は誤りです**

  v1.20.0 で追加した「プレビュー環境を本番から切り離す」手順（1-3 / 4-5 / 4-6）に、**プレビューが作られる条件を誤って書いていました。**

  - **誤:** 「プレビューは Sync fork でアップデートを受け取ったときにも自動で作られます」
  - **正:** **プレビューが作られるのは `main` 以外のブランチに push したとき**、つまり**プルリクエストを作ったとき**だけです。**Sync fork では作られません**（更新されるのは `main` なので本番デプロイになります）。GitHub の画面でファイルを編集する場合も、既定の「Commit directly to the main branch」を選ぶ限り作られません

  **この訂正で、対応の緊急度が下がります。** **プルリクエストを一度も作らない運用なら、データベースが1つのままでも実際には何も起きません。** ただし**一度でも作れば起きる**ので、切り分けそのものは引き続き推奨します（特に本番運用を始める前）。

- **影響の重さの順序を実態に合わせました**

  v1.20.0 は「プレビュービルドが稼働中DBの構造を書き換える」ことを最も強く書いていましたが、**これは3つの中で最も軽い**ものでした。ライセンシーのブランチはコードを変えないため、構造は実際には変わらず、カタログの再登録が走るだけです。正しい順序は:

  1. 🔴 **プレビューでの購入が実カード課金・実発注になる** — データベースが共通だと、決済完了通知が本番URLに届いたとき**本番側がその注文を見つけて履行します**。印刷も請求も実際に発生します
  2. プレビュー画面から買い手の氏名・メールアドレス・配送先住所が読める
  3. プレビュービルドが稼働中DBにカタログ再登録を流す

- **4-5 と 4-6 は両方必要であることを明記**: データベースを分けずに Stripe / Printful だけ分けても、プレビューで作られた注文を本番側が拾って履行します

---

## [1.20.0] - 2026-08-21

> ⚠️ **既存インスタンスは手動対応が必要な項目があります。** 下の `Changed` を読んでください。
> ファイルの同期（Sync fork）では Turso と Vercel の設定は変わりません。

### Fixed
- **存在しないサイズを売っていた（本番で現に露出）**: サイズはカートに全商品共通でハードコードされ、**17商品中14商品**が実在しないサイズを出していた。特にキッズTシャツは `S/M/L/XL` の4サイズしか無いのに `XS` と `2XL` を出しており、**この商品はアクティブな3キャンペーン全てに載っていた**
  - Printful は (サイズ, 色) の**完全一致**でしか variant を引けず、発注は Stripe webhook から**決済成功後に**呼ばれる。買い手は課金され、Printful への発注が例外で落ち、**注文ページには「Order confirmed! 🎉」が出て、確認メールは一通も届かない**（送信処理が例外の後ろにある）
  - 失敗注文の再送でも直らない。存在しないサイズは何度投げても存在しない
- **色にも同じ穴が開いていた**: 既定色 `"White"` が全商品でハードコードされ、**17商品中7商品で誤りだった**
  - **2商品**（`bc-3413-triblend` / `econscious-ec8000-tote`）は Printful 側に White が無く、**決済後に発送不能**
  - **5商品**（`cc-1717-garment-dyed` / Yupoong 3種 / `atc-bg150-tote`）は正常に発送されるが、**団体が一度も選んでいない白い商品が届いていた。** 例外も警報も出ず、失敗注文一覧にも載らない。色が1つの商品はスウォッチすら出していなかったため**誰も気付けなかった**
  - Printful に存在しない3色（`bc-3501-ls` の Dark Grey、`atc-bg150-tote` の Natural / Navy）をカタログから削除した
- **カタログが許すだけでは足りない**: 検証は「Printful が作れるか」と「**その団体が売ると言ったか**」の2段にした。前者だけだと、黒しか売らない団体に `color:"Red"` を直接 POST して**赤いシャツが出荷できてしまう**
- **サイズと色は独立ではない**: `bc-3001-tee` は `XS` を持ち `Forest` も持つが `XS/Forest` は存在しない。**(サイズ, 色) の対**で検証する
- **数量が整数か確かめていなかった**: `quantity` の検証は比較だけで、`NaN` も `1.5` も `"abc"` も通っていた。通ると逆ざやガードも注文上限も同じく素通りし、`order_items` が確定してから Stripe が 500 を返す。**認証不要の POST 1回で、任意のキャンペーンを恒久的に編集不能にできた**
- **価格ステップを保存できない団体がいた**: `savePricingStep` は `campaign_products` を全行 DELETE してから再 INSERT していた。`order_items` から参照されている行があると外部キー制約で**保存が丸ごと失敗する**。実測で**アクティブな2キャンペーンが該当**していた
  - **売れている必要すら無い。** 注文が `pending`（未払い・カート離脱）でも `order_items` 行はできる。**買い手が Checkout を押して立ち去るだけで、その団体は値上げも商品の入れ替えも締切の変更もできなくなっていた**
  - 画面に出るのは原因を説明しない汎用のサーバーエラーだった
- **無関係な編集で生成済みモックアップが消えていた**: 上記の再 INSERT はモックアップ列を含めていなかった。**価格を1円直しただけで生成済みモックアップが全て消えていた。** 生成自体は成功しているので警告も出ない。開発DBで `campaign_products` 10行すべての `mockup_url` が NULL だったのはこれが原因である
- **買い手の氏名が空文字で Printful に渡っていた**: `?? ""` と `?? "Customer"` を繋いでいたが `??` は nullish 専用で `""` は nullish ではない。Stripe が氏名を返さないと `name: ""` が渡り、確認メールも空文字に宛てて挨拶していた
- **終了したキャンペーンの色別モックアップが掃除されなかった**: 掃除の述語が `mockup_url` の非NULLだけを見ていた

### Added
- **色別モックアップ**: 団体が売る色ごとにモックアップを持つ（`campaign_products.mockup_urls`）
  - `create-task` の回数は商品あたり1回のまま（実測: 6色を1タスクで9.3秒）。ただし色の解決に `GET /products/{id}` が商品あたり1回**増える**
  - **返却順は要求順と一致しない**（実測で White が最後）。`variant_ids` で突き合わせる
  - モックアップが無い色でも、**少なくともその色のカタログ写真**を出す
  - **マグ・帽子・トートにはロゴ入りモックアップが乗らない。** プリント領域がアパレル前面の寸法で固定されているため。per-product placement は別件
  - 生成を試みた行に `mockup_attempted_at` を打ち、未生成の行を拾う cron 分岐を**週1回に収束する形で**追加した。打たないと、スキップされた1商品のせいで同じキャンペーンが毎日選ばれ、隣の商品の成功済みモックアップを毎日上書きする
- **単一選択肢を隠さず表示する**: `Size: 11 oz` / `Color: Black` のように**何が届くのかを必ず表示する**。従来は色が1つだと表示ごと消えており、買い手は色という概念に一度も触れないまま決済していた
- **カートに入れたことが分かるようにした**: 押下後およそ2秒ボタンが `Added ✓` に変わり、`aria-live` に追加内容が出る。見出しに点数を出す（`Your order (3 items)`）。**依存は追加していない**
- **売れない商品は `Currently unavailable` だけを出す**: 団体が選んだ色がカタログに1つも無い、あるいはサイズが空の商品は、旧来の固定サイズ一覧にも既定色文字列にもフォールバックせず購入不可として描画する。**そのカードにはサイズ・色・数量・購入ボタンのいずれも出さない。** 買えないカードで操作だけが反応する（押すとサイズが黒く点灯するのに、その先が無い）のは、本リリースが直しに来た「カートに入れても反応が無い」と同じ形になるため。**キャンペーン全体は止まらず、他の商品は通常どおり売れる**

### Changed

- **🔴 セットアップ手順を「データベース2つ（本番用・プレビュー用）」に変更。既存インスタンスは手動対応が必要です**

  従来の手順は Turso のデータベースを**1つ**作るよう案内しており、Vercel の環境変数もその1組を全環境に登録する形でした。この構成には、手順書が一度も警告していなかった2つの問題があります。

  - **プルリクエストを出したり Sync fork でアップデートを受け取ったりするたびに、稼働中のストアのデータベース構造が自動で書き換わる。** デプロイの buildCommand が `npm run db:init`（構造更新＋カタログ登録）を実行し、Vercel は**本番だけでなくプレビューでも同じビルドを走らせる**ため。人がレビューする前に本番へ適用される
  - **プレビュー環境から、買い手の氏名・メールアドレス・配送先住所が読める。** 本番と同じデータベースを見ているため

  **⚠️ Sync fork では設定は変わりません。** Turso でのデータベース作成も Vercel での環境設定も、それぞれのダッシュボードでの**手作業**です。**実運用されている場合は、次の作業をお願いします**（手順書 `docs/00-START-HERE.md` の 1-3 と 4-5 に詳細があります）:

  1. Turso で**空のプレビュー用データベースを1つ**作る（無料枠は100個まで。追加費用なし）
  2. Vercel の既存の `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` を **Production 専用**にする（**値は変更しない**）
  3. 同じ変数名で**プレビュー用の値**を `Preview` / `Development` に追加する

  **本番のデータは動かしません。**新しく作るのは空のプレビュー用データベースの方で、データ移行もダウンタイムもありません。作業後、プレビュー画面は空に見えますが**それが正常です**。

  手元でコードを動かす場合の `.env.local` も、**本番ではなくプレビュー用のデータベースを指してください**（`.env.local.sample` に注記を追加しました）。`npm run dev` と `npm run db:init` は、そこに書いたデータベースを直接書き換えます。

- **🔴 決済と印刷もプレビューから切り離す手順を追加。こちらも既存インスタンスは手動対応が必要です**

  データベースを分けても、**Stripe と Printful は本番のまま**です。本番運用を始めた後にこれを放置すると、**プレビュー環境で買い物をしたときに実際のカードへ課金され、Printful に本物の注文が入って印刷・発送・請求まで進みます。** プレビューはプルリクエストや Sync fork で自動的に作られるため、意図せず踏みます。

  手順書に **4-6「決済と印刷もプレビューから切り離す」** を新設しました。**実運用されている場合は次も設定してください**:

  | 変数 | Production | Preview / Development |
  |---|---|---|
  | `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | 本番キー（`sk_live_` / `pk_live_`） | **テストキー（`sk_test_` / `pk_test_`）** |
  | `PRINTFUL_AUTO_CONFIRM` | 設定しない | **`false`**（注文を下書きで止め、印刷・課金を発生させない） |

  `PRINTFUL_AUTO_CONFIRM` は既存の環境変数で、コード変更はありません。**Production 側に `false` を入れないでください** — 本番が下書きで止まると、買い手は代金を払ったのに商品が発送されません。

  なお `STRIPE_WEBHOOK_SECRET` のプレビュー用は用意できません（プレビューURLはデプロイごとに変わるため）。**プレビューでは決済完了後の処理が動かない**という前提でご確認ください。

- **手順書の Turso 無料枠の記載を修正**: 「9GB」は現行プランと異なります。**Free は 5GB・データベース100個まで**で、9GB は Developer（月 $4.99）です

---

## [1.19.0] - 2026-08-16

### Added
- **返金時に団体へ通知**: 返金が完了すると団体の管理者にメールが届く。従来、団体は募金総額が減ったことに自分で気付く必要があった
  - 内容はキャンペーン名・注文ID・**団体の取り分から戻る金額**・日時のみ
  - **返金理由は含めない。** 理由は PF運営者が監査用に書く自由記述で、表示先は管理画面のみ。団体向けの注文一覧も理由を出していないため、メールで送ると内部メモが裏口から漏れることになる
  - 宛先は**管理者のみ**（`member` / `student` は財務情報にアクセスできない設計に合わせる）
  - **通知の失敗は返金を失敗扱いにしない。** この時点で Stripe の返金は完了しており、失敗と表示すると二重返金を招く

### Fixed
- **Printful の Webhook 設定手順の重大な不足を修正**: 従来の手順は URL の登録しか案内しておらず、**イベント種別の指定が抜けていた**。さらにトークンのスコープについて「Webhook の管理は不要」と明記していたため、設定しようとしても `403 webhooks/read` で止まる状態だった
  - **実際に、開発環境・ライセンシー環境とも Webhook が一度も設定されていなかった。** つまり**購入者への発送通知メールと追跡番号の記録は一度も動いていなかった**（v1.18.0 の新機能以前の問題）
  - 手順書に3イベント（`package_shipped` / `order_refunded` / `package_returned`）の指定、必要なスコープ、API での設定手順、[シミュレーター](https://www.printful.com/api/webhook-simulator)での確認方法を追記
  - **「あなたのURL」がアプリのURLであり Vercel 管理画面のURLではない**ことを明記。取り違えると Printful は送信し続けるのにアプリには届かず、**エラーも出ない**

---

## [1.18.0] - 2026-08-16

買い手の個人情報を無期限に保持していた問題を解消し、Printful 側の処理結果を受け取れるようにした。

### Added
- **注文の個人情報を保持期間経過後に自動削除**: 氏名・メール・配送先住所・追跡番号を、注文の最終更新から **24ヶ月**（`ORDER_PII_RETENTION_MONTHS` で変更可）で NULL にする。**金額とキャンペーンは残す**ため、売上集計と Stripe の突き合わせには影響しない
  - **発送前の注文は、どれだけ古くても対象外**。住所を消すと商品が届かなくなるため
  - **返金済みも対象に含む**。終端状態で金銭も精算済みであり、除外すると「返金した注文だけ住所が永久に残る」ことになる
  - PF運営者は、買い手の依頼に応じて1件だけ先に削除できる。ただし最終更新から90日以内は係争期間として、チェックと注文IDの入力を必須とする（返金には買い手の身元が必要なため）
  - 既存の日次 cron に相乗り。**cron の枠は2のまま**
- **Printful 側の処理結果を受け取る**: `order_refunded`（Printful がこちらに製造費を返金）と `package_returned`（荷物の返送）を受信し、PF運営者にメールで通知する。従来は `package_shipped` しか見ておらず、**クレームが認められて返金されても、荷物が返送されても、Printful の管理画面を見に行くまで気付けなかった**
  - **注文の状態は変更しない。** `refunded` は「買い手が Stripe 経由で返金された」を意味し、Printful からの返金とは別の事象。混同すると団体がまだ受け取るべき売上が消える

### Changed
- **セットアップ手順に Printful の Webhook イベント指定を追加**: 従来は URL の登録しか書いておらず、イベントを選ばないと上記の通知が一切届かなかった。**既存のインスタンスは Printful 側で `Order refunded` と `Package returned` を手動で有効にする必要がある**
- **Printful の交換申請API化は実装対象から除外**: v1・v2 とも問題報告／クレーム／再印刷／返品／返金のエンドポイントが存在しないことを確認した。ダッシュボードでの人の判断を伴う機能であり、API 化されていない

### Fixed
- 引き継ぎ文書で「運営」の語がライセンシー（PF運営者）と団体管理者のどちらとも読めた点を統一。用語表を文書冒頭に追加

---

## [1.17.0] - 2026-08-16

R2 に溜まり続けていたデザイン画像を回収できるようにした。従来、削除されるのは団体を削除したときだけで、それ以外の孤児はどこからも回収されなかった。

### Fixed
- **デザインを差し替えても旧ファイルが残っていた問題を修正**: `saveDesignStep` は `designFileUrl` を上書きするだけで、前のアップロードをストレージに残していた。差し替えのたびに1つずつ孤児が増えていた
  - **新旧が異なるときだけ削除する**。デザインフォームは保存のたびに同じURLを再送信するため、無条件に削除すると**表示中のデザインを消す**
  - 削除はトランザクションのコミット後に行う。保存が失敗したのにファイルだけ消える状態を作らない

### Added
- **保存されなかったアップロードの回収**: `/api/upload` と `/api/ai-design` は DB に行ができる前に R2 へ書くため、ウィザードを途中でやめるとファイルだけが残る。**特に AI 生成は、複数試して1つ採用すれば残りが即座に孤児になる**（実測で2件存在した）
  - 削除するのは **3条件すべて**を満たすものだけ: 接頭辞が `uploads/` か `ai-designs/`、**7日以上前**、DB から参照されていない
  - **参照集合が空なら何もしない**。DB の読み取りが失敗したときに「空＝全部孤児」と解釈すると、バケットを丸ごと消すことになる
  - 1回あたり **200件の上限**。上限に達した場合はログに記録する（打ち切りを黙ると「全部処理済み」に見える）
  - 既存の日次 cron に相乗り。**cron の枠は2のまま**

### Changed
- **モックアップは掃除の対象ではない**ことを明確化した。`designs.mockupUrl` と `campaignProducts.mockupUrl` は Printful がホストするファイルを指しており、こちらのストレージには何も無い（v1.16.0 の設計文書に誤った記述があったため訂正済み）

---

## [1.16.0] - 2026-08-16

キャンペーンを終える手段を用意した。従来 `closed` に至る経路は**団体まるごとクローズしたときの巻き添えだけ**で、キャンペーン単体を止めることはできなかった。あわせて、期限切れ後も決済が通っていた穴を塞いだ。

### Added
- **キャンペーンの終了**: 団体管理者が公開ページ（Step 3）から実行。キャンペーン名の正確な入力による確認を必須とする。新規注文は止まるが、**支払い済みの注文はそのまま履行される**
- **キャンペーンの再開**: 団体が自分で実行できる。期限を未来に再設定するかクリアすることを必須とし、開いた直後にまた終了する状態を防ぐ。団体がクローズ・停止されている場合は再開できない
- **終了したキャンペーンの公開ページを残す**: 従来はクローズすると公開URLが404になり、告知・SNS・メールに貼られたリンクが一斉に切れていた。現在は「終了」の表示と成果（達成率・販売数）を出し、カートのみを隠す。金額の見せ方は既存の表示設定に従う
- `campaigns.closedAt` を追加

### Fixed
- **期限切れのキャンペーンで決済が成立していた問題を修正**: 公開ページは「Campaign ended」と表示してカートを隠していたが、`POST /api/checkout` は状態のみを検査し期限を見ていなかったため、**同じ商品を直接注文すると決済が通り、印刷・発送まで進んだ**。要件（`requirements.md:402`「orders auto-close at deadline」）はカウントダウン部分のみが実装されていた
  - 販売可否は保存された状態ではなく毎回**導出**する方式に変更した。cron の書き込みに依存しないため、cron が遅延・停止しても期限切れの決済は成立しない
  - 拒否は注文行の生成より前で行うため、拒否された注文が `pending` のまま残ることもなくなった
- **モックアップ掃除の起点を `closedAt` に変更**: 従来は `updatedAt` を見ていたため、終了後にキャンペーンを編集するたびに削除が先送りされていた

### Changed
- 期限到達によるキャンペーンの状態書き戻しを、既存の `mockup-cleanup` cron（日次）に統合した。**cron の枠は2のまま**

---

## [1.15.0] - 2026-08-14

団体が自分で組織を削除・クローズできるようにした。従来はプラットフォーム側の停止措置しか手段がなく、テスト用や放棄された団体が永久に残り、データ削除を希望する団体は運営者にSQLの直接実行を依頼するしかなかった。

### Added
- **組織の削除**（注文が1件も無い場合）: 団体管理者が組織設定の Danger Zone から実行。メンバー・招待・キャンペーン・商品・デザインを削除し、アップロード済みのデザインファイルもストレージから削除する。組織名の正確な入力による確認を必須とする
- **組織のクローズ**（注文がある場合）: 注文は財務記録のため削除せず保持する。全キャンペーンを終了し、公開ページは404、チェックアウトと公開処理は拒否される。プラットフォーム管理者が再オープンできる（団体は自分では再オープンできない）
- **削除条件の多重ガード**: 注文数だけでは以下の取り返しのつかない事態を防げないため、すべてを個別に検査して一覧表示する
  - **未完了の注文（pending）** — Stripe の決済セッションが開いたままの可能性があり、削除直後に支払いが成立すると、存在しないキャンペーンに対して課金だけが記録される
  - **公開中のキャンペーン** — 公開中は常に注文が入りうるため、「注文を確認してから削除する」処理の間に窓が空く。キャンペーンの終了を先に必須とすることで窓自体を無くした
  - **Stripe 連結アカウントの残高** — 団体は Stripe 管理画面を持たない設計のため、残高を残したまま削除すると**そのお金に二度と到達できなくなる**
  - **残高を確認できない場合** — 不明を「問題なし」として扱わず、削除を拒否する（Stripe がアカウントの不存在を返す場合のみ、失うものが無いため残高0として扱う）
- ブロッカーはサーバー側で判定し、ボタンを押す前に理由を表示する。`deleteOrgCascade` 内でも再検査する

### Changed
- **組織の停止（suspend）とクローズ（close）を別カラムに分離**: 同一項目で扱うと、団体がクローズと再オープンを行うことでプラットフォーム側の停止措置を解除できてしまうため

---

## [1.14.0] - 2026-08-14

**支払い済みなのに商品が発送されない注文**を検知・復旧できるようにした。従来この状態は誰にも通知されず、Vercel のログを読む以外に発見手段がなかった。

### Added
- **管理ダッシュボードに「Needs attention」を追加**: Printful への送信に失敗した支払い済み注文を、統計より**上**に表示する。エラー内容・試行回数・経過日数を一覧できる
- **履行失敗時にプラットフォーム管理者へメール通知**: 全 `platform_admin` 宛（未設定時はサポートアドレスにフォールバック）。デザインファイル欠落・住所不備・API エラーの**3経路すべて**で送信される（従来は catch のみならず、いずれも無音だった）
- **注文詳細から履行の再送が可能に**: Printful は `external_id` で重複排除するため、何度押しても二重印刷は発生しない
- **配送先住所の修正機能**: 州コードとZIPの検証付き。宛先の不備は最も多い修正可能な失敗原因だが、従来はデータベースを直接操作する以外に手段がなかった
- **Printful トークンの期限切れを個別に警告**: 全注文が一度に失敗する唯一の原因のため、ダッシュボードと復旧パネルの両方で他の失敗と区別して表示する

### Fixed
- **再送成功後も「要対応」に残り続ける問題を修正**: `markOrderFulfilled` が `fulfillmentError` を消去していなかったため、復旧した注文が永久に警告一覧へ残る状態だった

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
