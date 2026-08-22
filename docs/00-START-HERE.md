# スタートガイド — サービス開始までの全手順

**対象:** プラットフォームの利用許可を受けたライセンシー
**前提:** 技術的な知識は不要です。手順通りに進めれば完了できます。

**所要時間の目安:**

| フェーズ | 内容 | 目安 |
|---------|------|------|
| Phase 1 | 必要なアカウントを作成する | 60〜90分（初回のみ） |
| Phase 2 | Vercel にデプロイする | 20〜30分 |
| Phase 3 | サービス名・カラーを設定する | 10〜15分 |
| Phase 4 | Google の設定を追加する | 5分 |
| Phase 5 | セットアップウィザードを完了する | 5〜10分 |

---

## 全体の流れ

```
Phase 1: アカウント作成 → APIキーを手元に集める
Phase 2: リポジトリを Fork → Vercel にインポート → 自分専用のアプリが公開される
Phase 3: サービス名・カラーを設定する（自分のリポジトリで）
Phase 4: Google ログインの設定を追加する
Phase 5: セットアップウィザードで最終確認 → ローンチ
```

> ⚠️ Phase 2 でアプリを先に作ってから、Phase 3 で設定を行います。
> 「設定してからデプロイ」ではなく「デプロイしてから設定」の順番です。

---

## Phase 1: 必要なアカウントを作成する

以下のサービスのアカウントを作成し、APIキーを取得してください。
全て取得したら Phase 2 に進みます。

> 💡 各値はメモ帳などに記録しておくと便利です。

---

### 1-1. GitHub（コードを保管する場所）

**何をするサービス？**
アプリのソースコードを保管するサービスです。
ライセンシーはここからアプリをデプロイ・管理します。

**何を取得するか:** アカウントのみ（APIキー不要）

**手順:**
1. [https://github.com](https://github.com) を開く
2. **「Sign up」** をクリック
3. メールアドレス・パスワード・ユーザー名を設定して登録
4. メール認証を完了する

---

### 1-2. Vercel（アプリをインターネットに公開する場所）

**何をするサービス？**
作ったアプリを世界中からアクセスできる状態にする（ホスティング）サービスです。
`https://あなたのアプリ名.vercel.app` というURLが発行されます。
無料枠で十分動作します。

**何を取得するか:** アカウントのみ（APIキー不要）

**手順:**
1. [https://vercel.com](https://vercel.com) を開く
2. **「Sign Up」** をクリック
3. **「Continue with GitHub」** を選択（GitHub アカウントで登録すると連携が楽）
4. 登録完了

---

### 1-3. Turso（データベース：データを保存する場所）

**何をするサービス？**
アプリのすべてのデータ（ユーザー情報・キャンペーン・注文など）を保存するデータベースサービスです。
無料枠（5GB・データベース100個まで）で小〜中規模の運用なら十分です。

**何を取得するか:** `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` を、**本番用とプレビュー用で2組**

> 🔴 **データベースは2つ作ってください。** 1つで動かすこともできますが、その場合
> **プルリクエストを出しただけで、稼働中のストアのデータベースが書き換わります。**
> 理由は下の「なぜ2つ必要なのか」に書きました。**無料枠は100個までなので、追加費用はかかりません。**

**手順:**

1. [https://turso.tech](https://turso.tech) を開く
2. **「Get Started」** → GitHub または Google でサインアップ
3. ダッシュボードに移動したら **「Create Database」** をクリック
4. **本番用**のデータベース名（例: `myapp-prod`）を入力 → リージョンは `nrt`（東京）を選択 → **「Create」**
5. 作成したデータベースをクリック → **「Connect」** タブを開く
6. **「Create Token」** をクリック
7. **もう一度「Create Database」をクリックし、プレビュー用（例: `myapp-preview`）を同じ手順で作る。**
   グループを選ぶ画面が出たら、**本番と同じグループ**を選んでください

取得できる値（**2組あります。取り違えないよう、どちらがどちらか必ずメモしてください**）:

| | 本番用（`myapp-prod`） | プレビュー用（`myapp-preview`） |
|---|---|---|
| `Database URL` | `libsql://myapp-prod-ユーザー名.turso.io` | `libsql://myapp-preview-ユーザー名.turso.io` |
| `Auth Token` | `eyJ...` | `eyJ...`（**別の値です**） |

> ⚠️ Auth Token は一度しか表示されません。必ずコピーして保存してください。

> 💡 **どちらのデータベースも空のままで大丈夫です。** テーブルの作成と商品カタログの登録は、
> Vercel でのデプロイ時に自動で行われます。**プレビュー用に本番のデータをコピーする必要はありません。**

#### なぜ2つ必要なのか

このアプリは、デプロイのたびに**データベースの構造更新と商品カタログの登録を自動で実行**します
（`vercel.json` の buildCommand が `npm run db:init` を呼ぶため）。これは本番では必要な仕組みです —
アップデートを受け取ったとき、新しい列がデータベースに自動で追加されます。

ところが Vercel は、**本番だけでなくプレビュー（試験公開）でも同じビルドを実行します。**
データベースが1つしかないと、プレビューが本番のデータを直接触ることになります。

**プレビューが作られるのはどういうときか。** `main` **以外**のブランチに push したとき、
つまり **プルリクエストを作ったとき**です。

- **Sync fork でアップデートを受け取っても、プレビューは作られません**（更新されるのは `main` なので、
  本番デプロイになります）
- GitHub の画面でファイルを編集するとき、**「Commit directly to the main branch」を選ぶ限り
  プレビューは作られません。**「Create a new branch and start a pull request」を選ぶと作られます

**したがって、プルリクエストを一度も作らないなら、以下は起きません。** ただし**一度でも作れば起きます**。
影響の重い順に:

1. 🔴 **プレビューで買い物を完了すると、実際のカードに課金され、Printful に本物の注文が入ります。**
   決済完了の通知（Webhook）は本番URLにしか届きませんが、**データベースが同じなので本番側がその注文を
   見つけて履行してしまいます。** 印刷も請求も実際に発生します
2. **プレビューの画面から、買い手の氏名・メールアドレス・配送先住所が読めます。** 本番と同じデータを
   見ているため
3. **プレビューのビルドが、稼働中のストアのデータベースに構造更新とカタログ再登録を流します。**
   あなたのブランチがコードを変えていなければ構造は変わらないので、実害は小さめです

データベースを2つに分ければ、1〜3 のどれも起きません。**本番は本番のデータだけを持ち、プレビューは
自分で作った空のデータから始まります。**

> 🔴 **これで分かれるのはデータベースだけです。決済（Stripe）と印刷（Printful）は別途 4-6 で切り離します。**
> データベースだけ分けて安心してしまうと、**プレビューでの購入が実際のカードに課金され、Printful に
> 本物の注文が入ります。** 本番運用を始める前に 4-6 まで必ず行ってください。

---

### 1-4. Stripe（決済処理サービス）

**何をするサービス？**
クレジットカード決済を処理するサービスです。
購入者が商品を買うときの支払いを受け付け、組織の銀行口座に送金します。
取引ごとに手数料が発生しますが、月額料金はありません。

**何を取得するか:** `STRIPE_SECRET_KEY`、`STRIPE_PUBLISHABLE_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_CONNECT_WEBHOOK_SECRET`

**手順（APIキーの取得）:**
1. [https://stripe.com](https://stripe.com) を開く → **「Start now」** で登録
2. ダッシュボードに移動したら左メニューの **「Developers」** → **「API keys」** をクリック
3. 以下の2つをコピーする:
   - **Publishable key**: `pk_test_...` → `STRIPE_PUBLISHABLE_KEY`
   - **Secret key**: **「Reveal live key」** をクリックして表示 → `STRIPE_SECRET_KEY`

> 💡 最初はテストモードのキー（`pk_test_`/`sk_test_`）で構いません。本番運用時に切り替えます。

**Webhook シークレットの取得（デプロイ後に設定）:**
Webhook は「Stripe からアプリへの通知」の設定です。
デプロイ後に URL が確定してから設定します → Phase 4 で案内します。

今はメモに `STRIPE_WEBHOOK_SECRET = あとで設定`、`STRIPE_CONNECT_WEBHOOK_SECRET = あとで設定` と書いておいてください（デプロイ後の Phase 4 で2本の Webhook を作って取得します）。

---

### 1-5. Printful（印刷・発送サービス）

**何をするサービス？**
Tシャツなどのグッズを印刷して購入者の自宅に直接発送するサービスです。
注文が入ると自動的に Printful に転送され、印刷・梱包・発送まで行います。
月額料金なし（商品原価のみ）。

**何を取得するか:** `PRINTFUL_API_KEY`、`PRINTFUL_WEBHOOK_SECRET`

**手順（APIトークンの取得）:**
1. [https://www.printful.com](https://www.printful.com) を開く → **「Get started for free」** で登録
2. [https://developers.printful.com](https://developers.printful.com) を開き、同じアカウントでログイン
3. **「Private tokens」**（Your tokens）を開く
   - Developer Portal には **Private tokens** と **Public apps** の2種類がありますが、
     必要なのは **Private token** です。
   - Private token = 「自分のストアに、自分のサーバーから接続する」用途。本プラットフォームはこれに該当します。
   - Public app = 「他の Printful 販売者に自分のアプリをインストールしてもらう」用途（OAuth）。今回は不要です。
4. **「Create new token」** をクリック
5. 以下を設定する:

   | 項目 | 設定内容 |
   |------|---------|
   | Token name | 用途が分かる名前（例: `SwagFund Production`） |
   | Contact email | 失効通知が届くアドレス（必ず受信できるもの） |
   | Expiration date | **2年後**（Printful の最大値。期限なしは選べません） |
   | Access level | **A single store** → 自分のストアを選択 |
   | BETA（新API）| **参加しない**（本アプリは v1 API を使用） |

6. **スコープ**は以下をチェックする:

   | スコープ | 用途 |
   |---------|------|
   | View and manage orders of the authorized store | 注文の送信・重複確認 |
   | View store products | サイズ・色から商品バリアントを解決、週次の価格同期 |
   | View and manage store files | モックアップ画像の生成 |
   | **View store webhooks** | **後述の Webhook 設定を確認するため** |
   | **View and manage store webhooks** | **後述の Webhook 設定を行うため** |

   商品の作成・変更は行わないため、そのスコープは不要です。

   > ⚠️ **webhook の2つを飛ばすと、あとで Webhook を設定しようとしたときに
   > `403 This endpoint requires any of the following scopes granted: webhooks/read!`
   > で止まります。** その場合はトークンを作り直すことになります（下の「既にトークンを
   > 発行済みの場合」を参照）。

7. 表示されたトークンをコピー → `PRINTFUL_API_KEY`

> ⚠️ **トークンは作成直後の一度しか表示されません。** 必ずコピーして保存してください。

> 🔴 **2年後に必ず失効します。期限切れになると注文が Printful に送信されなくなり、
> 購入者は代金を支払っているのに商品が発送されない状態になります。**
> トークン作成時に、カレンダーへ「Printful トークン更新」の予定を**期限の1ヶ月前**で
> 登録してください。更新は Developer Portal で新しいトークンを発行し、Vercel の環境変数
> `PRINTFUL_API_KEY` を差し替えるだけです。

> 💡 かつて Printful のダッシュボード（Settings → API）で発行できた「APIキー」は
> **2022年9月に発行が停止され、2023年3月に完全に失効しました。**
> 現在は上記の Developer Portal で発行する「トークン」を使います。
> なお、旧キーもトークンも文字列長は同じため、**見た目では区別できません。**
> 認証エラー（401）が出た場合、キーの種類ではなく**有効期限切れを最初に疑ってください。**

**⚠️ 支払い方法の登録（必須）:**

注文が入ると、印刷・発送費用は **あなたの Printful アカウントに登録されたカード**へ自動で請求されます（売上はそれより多く入金されるので損はしません）。**カードが未登録だと注文の確定が失敗し、商品が発送されません。**

1. Printful ダッシュボード → **Billing**（請求）→ **Payment methods**
2. クレジットカードを登録（ビジネス用カード推奨）

> 💡 注文は標準で「自動確定」され、そのまま印刷工程に進みます。立ち上げ期に1件ずつ手動で確認したい場合は、Vercel の環境変数に `PRINTFUL_AUTO_CONFIRM` = `false` を設定すると、注文が Printful 上で「ドラフト」として止まり、あなたが Printful 画面で Confirm を押すまで印刷・課金されません（押し忘れは配送遅延になるので、慣れたら自動確定に戻すことを推奨します）。

**Webhook シークレット（デプロイ後に設定）:**
こちらもデプロイ後に設定します → Phase 4 で案内します。
今はメモに `PRINTFUL_WEBHOOK_SECRET = あとで設定` と書いておいてください。

---

### 1-6. Resend（メール送信サービス）

**何をするサービス？**
注文確認メール・発送通知などのメールを自動で送るサービスです。
無料枠: 1日100通・月3,000通まで無料。

**何を取得するか:** `RESEND_API_KEY`、`EMAIL_FROM`（送信元メールアドレス）

**手順:**
1. [https://resend.com](https://resend.com) を開く → **「Sign Up」** で登録
2. ダッシュボードの **「API Keys」** → **「Create API Key」**
3. 名前を入力（例: `myapp`）→ **「Add」** → APIキーをコピー → `RESEND_API_KEY`
4. 左メニューの **「Domains」** → **「Add Domain」**
   - 自分のドメイン（例: `myapp.com`）を持っている場合 → 追加してDNS設定
   - ドメインがない場合 → `onboarding@resend.dev` が使えます（テスト用）

`EMAIL_FROM` に設定する値の例:
- ドメインあり: `noreply@myapp.com`
- ドメインなし（テスト用）: `onboarding@resend.dev`

---

### 1-7. Cloudflare R2（ファイル保存サービス）

**何をするサービス？**
ユーザーがアップロードするロゴ画像やデザインファイルを保存するサービスです。
無料枠: 10GB/月まで無料。

**何を取得するか:**
`CLOUDFLARE_R2_ACCOUNT_ID`、`CLOUDFLARE_R2_ACCESS_KEY_ID`、
`CLOUDFLARE_R2_SECRET_ACCESS_KEY`、`CLOUDFLARE_R2_BUCKET_NAME`、`CLOUDFLARE_R2_PUBLIC_URL`

**手順:**
1. [https://cloudflare.com](https://cloudflare.com) を開く → **「Sign Up」** で登録
2. ダッシュボード左メニューの **「R2」** をクリック
3. **「Create bucket」** → バケット名（例: `myapp-uploads`）を入力 → **「Create bucket」**
   - このバケット名が `CLOUDFLARE_R2_BUCKET_NAME`
4. バケットを開いて **「Settings」** タブ → **「Public access」** → **「Allow Access」** をクリック
   - 表示される URL（`https://pub-xxxx.r2.dev`）が `CLOUDFLARE_R2_PUBLIC_URL`
5. **アカウント ID の取得:**
   - ダッシュボード右サイドバーの **「Account ID」** をコピー → `CLOUDFLARE_R2_ACCOUNT_ID`
6. **APIキーの取得:**
   - ダッシュボード右上 → **「Manage account」** → **「API Tokens」**
   - **「Create Token」** → 「R2 Token」テンプレートを選択
   - **「Create Token」** → 表示される2つの値をコピー:
     - Access Key ID → `CLOUDFLARE_R2_ACCESS_KEY_ID`
     - Secret Access Key → `CLOUDFLARE_R2_SECRET_ACCESS_KEY`

> ⚠️ Secret Access Key は一度しか表示されません。必ずコピーして保存してください。

---

### 1-8. Google Cloud（Google アカウントでログインする機能）

**何をするサービス？**
ユーザーが「Google でサインイン」ボタンを使えるようにするための設定です。
Google のサーバーが本人確認を代行してくれます。無料。

**何を取得するか:** `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`

**手順:**
1. [https://console.cloud.google.com](https://console.cloud.google.com) を開く（Google アカウントでログイン）
2. 上部の **「プロジェクトを選択」** → **「新しいプロジェクト」**
   - プロジェクト名（例: `MyApp Auth`）を入力 → **「作成」**
3. 左メニュー → **「APIとサービス」** → **「OAuth 同意画面」**
   - ユーザーの種類: **「外部」** を選択 → **「作成」**
   - アプリ名・サポートメールを入力 → **「保存して次へ」**（残りはデフォルトで OK）
4. 左メニュー → **「認証情報」** → **「認証情報を作成」** → **「OAuth クライアント ID」**
   - アプリケーションの種類: **「ウェブ アプリケーション」**
   - 名前: 任意（例: `MyApp Web`）
   - **「承認済みのリダイレクト URI」** はこの時点では空のまま → **「作成」**
5. 表示される以下の値をコピー:
   - クライアント ID → `GOOGLE_CLIENT_ID`
   - クライアント シークレット → `GOOGLE_CLIENT_SECRET`

> ⚠️ 「承認済みのリダイレクト URI」はデプロイ後に追加します → Phase 4 で案内します。

---

### 1-9. OpenAI（AIデザイン生成 — 任意）

**何をするサービス？**
テキストから Tシャツのデザイン画像を自動生成する機能に使います。
この機能が不要な場合はスキップして構いません。

**何を取得するか:** `OPENAI_API_KEY`

**手順:**
1. [https://platform.openai.com](https://platform.openai.com) を開く → サインアップ
2. 右上メニュー → **「API keys」** → **「Create new secret key」**
3. 名前を入力 → **「Create secret key」** → コピー → `OPENAI_API_KEY`

> 💡 1画像の生成コストは約 $0.04（約6円）です。

---

### 1-10. ランダム文字列を2つ生成する

アプリのセキュリティに使うランダムな文字列を2つ生成します。

**何に使うか:**
- `BETTER_AUTH_SECRET`: ログイン情報の暗号化に使う（外部には公開しない）
- `CRON_SECRET`: 定期処理の保護に使う（外部には公開しない）

**生成方法（Mac のターミナルを使う場合）:**

1. `Cmd + Space` →「ターミナル」と入力 → Enter
2. 以下を2回実行し、それぞれの出力をコピーする:

```bash
openssl rand -base64 32
```

実行例:
```
X7kPqR2mNvLwHs4cBjYeAf9dZuMtGnVo1iCxKpEb6=
```

この文字列が `BETTER_AUTH_SECRET` と `CRON_SECRET` になります（それぞれ別の値を使ってください）。

> 💡 ターミナルが難しい場合は、[https://generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) にアクセスすると32文字のランダム文字列が生成されます。

---

### Phase 1 完了チェックリスト

以下の値が全て手元にあることを確認してから Phase 2 に進みます:

| 変数名 | 取得済み |
|--------|--------|
| `TURSO_DATABASE_URL`（**本番用**） | ☐ |
| `TURSO_AUTH_TOKEN`（**本番用**） | ☐ |
| `TURSO_DATABASE_URL`（**プレビュー用**） | ☐ ← 別のデータベースの値 |
| `TURSO_AUTH_TOKEN`（**プレビュー用**） | ☐ ← 別のデータベースの値 |
| `BETTER_AUTH_SECRET` | ☐ |
| `GOOGLE_CLIENT_ID` | ☐ |
| `GOOGLE_CLIENT_SECRET` | ☐ |
| `RESEND_API_KEY` | ☐ |
| `EMAIL_FROM` | ☐ |
| `STRIPE_SECRET_KEY` | ☐ |
| `STRIPE_PUBLISHABLE_KEY` | ☐ |
| `STRIPE_WEBHOOK_SECRET` | ☐（あとで設定） |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | ☐（あとで設定） |
| `PRINTFUL_API_KEY` | ☐ |
| `PRINTFUL_WEBHOOK_SECRET` | ☐（あとで設定） |
| `CLOUDFLARE_R2_ACCOUNT_ID` | ☐ |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | ☐ |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | ☐ |
| `CLOUDFLARE_R2_BUCKET_NAME` | ☐ |
| `CLOUDFLARE_R2_PUBLIC_URL` | ☐ |
| `OPENAI_API_KEY` | ☐（任意） |
| `CRON_SECRET` | ☐ |

---

## Phase 2: Vercel にデプロイする

### 2-1. リポジトリを Fork する

「Fork（フォーク）」とは、プラットフォームのコードの複製を、**元のリポジトリとつながった状態で**自分の GitHub アカウントに作ることです。つながっているおかげで、**将来のアップデート（機能追加・不具合修正）をボタン1つで受け取れます**。

> ⚠️ Fork せずにコードをコピーしてデプロイすると、アップデートを受け取る手段がなくなります。必ずこの手順どおり Fork してください。

1. プラットフォーム提供者から共有されたリポジトリページを開く（GitHub アカウントでログインしておく）
2. ページ右上の **「Fork」** ボタンをクリック
3. 「Create a new fork」画面はそのまま **「Create fork」** をクリック（設定の変更は不要）

   > ✅ 数秒で `https://github.com/あなたのGitHubユーザー名/CommunityMerch-PF-release` が作成され、そのページに移動します。これがあなた専用のリポジトリです。

---

### 2-2. Vercel にインポートする

1. ブラウザで **[vercel.com/new](https://vercel.com/new)** を開く
   - Vercel アカウントがない場合: **「Sign Up」** → **GitHub アカウントで登録**（連携が楽になるため GitHub での登録がおすすめ）
   - すでにある場合: **「Log In」**
2. 「Import Git Repository」の一覧に、先ほど Fork したリポジトリが表示されるので **「Import」** をクリック
   - 一覧に出ない場合: **「Install GitHub App」**（または「Adjust GitHub App Permissions」）をクリックし、自分のアカウントを選んで Vercel にリポジトリへのアクセスを許可してください
3. プロジェクト設定画面が開いたら、そのまま次の 2-3 に進みます（Framework などの設定は自動認識されるため変更不要）

---

### 2-3. シークレット情報を入力する

プロジェクト設定画面の **「Environment Variables」** セクションを開き、Phase 1 で集めた値を入力してください。

> 💡 **一括貼り付けが便利です。** メモ帳などで `変数名=値` の形式で全行そろえておき（[準備チェックリストのテンプレート](licensee-preparation-checklist.md) が使えます）、それを丸ごとコピーして Environment Variables の入力欄にペーストすると、**全変数が一度に登録されます**。1つずつ入力する必要はありません。

> 🔴 **ここでは Turso は「本番用」の値だけを入れてください。プレビュー用はまだ入れません。**
> この画面で登録した変数は、**本番・プレビュー・開発のすべての環境に同じ値が入ります**。環境ごとに
> 分ける操作はこの画面ではできず、デプロイ後の Settings 画面で行います。**手順 4-5 で必ず設定します。**

| 変数名 | 入力内容 |
|--------|---------|
| `TURSO_DATABASE_URL` | Turso の Database URL — **本番用**（`myapp-prod` の方） |
| `TURSO_AUTH_TOKEN` | Turso の Auth Token — **本番用**（`myapp-prod` の方） |
| `BETTER_AUTH_SECRET` | 生成したランダム文字列（1つ目） |
| `BETTER_AUTH_URL` | まだ不明 → 空欄のまま（後で設定） |
| `NEXT_PUBLIC_APP_URL` | まだ不明 → 空欄のまま（後で設定） |
| `GOOGLE_CLIENT_ID` | Google の クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Google の クライアント シークレット |
| `RESEND_API_KEY` | Resend の API キー |
| `EMAIL_FROM` | 送信元メールアドレス |
| `STRIPE_SECRET_KEY` | Stripe のシークレットキー |
| `STRIPE_PUBLISHABLE_KEY` | Stripe の公開キー |
| `STRIPE_WEBHOOK_SECRET` | まだ不明 → 空欄のまま |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | まだ不明 → 空欄のまま |
| `PRINTFUL_API_KEY` | Printful の API キー |
| `PRINTFUL_WEBHOOK_SECRET` | まだ不明 → 空欄のまま |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare のアカウント ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 のアクセスキー ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 のシークレットアクセスキー |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 のバケット名 |
| `CLOUDFLARE_R2_PUBLIC_URL` | R2 の公開 URL |
| `OPENAI_API_KEY` | OpenAI の API キー（任意・なければ空欄） |
| `CRON_SECRET` | 生成したランダム文字列（2つ目） |
| `PLATFORM_ADMIN_EMAIL` | あなた自身のメールアドレス |

---

### 2-4. デプロイを実行する

1. 全項目入力後 → **「Deploy」** ボタンをクリック
2. 数分待つとデプロイが完了する（画面に紙吹雪 🎉 が出たら成功）
3. **2つの URL をメモしておく**

   | URL | 場所 | 用途 |
   |-----|------|------|
   | Vercel アプリ URL | 例: `https://myapp.vercel.app` | あなたのサービスの URL |
   | GitHub リポジトリ URL | 例: `https://github.com/あなたのユーザー名/CommunityMerch-PF-release` | 2-1 で Fork したリポジトリ |

> ⚠️ デプロイ後すぐにアクセスすると「環境変数が未設定」のエラーが出る場合があります。
> Phase 3〜4 の設定を完了してから再アクセスしてください。

### 2-5. GitHub リポジトリ URL をプラットフォーム提供者に伝える

メモした **GitHub リポジトリ URL**（2-1 で Fork したリポジトリの URL）を
プラットフォーム提供者にメール等で共有してください。

> Vercel アプリ URL（`vercel.app` の URL）ではなく、GitHub の URL です。

---

### 📬 アップデートの受け取り方（Fork したあなたへ）

プラットフォームに機能追加や不具合修正があると、プラットフォーム提供者から連絡が届きます。反映はボタン2クリックです:

1. 自分の GitHub リポジトリ（2-1 で Fork したもの）のページを開く
2. ファイル一覧の上に表示される **「Sync fork」** → **「Update branch」** をクリック
3. あとは待つだけ — Vercel が自動で新しいバージョンをデプロイします（数分）

> 「This branch is up to date」と表示されている場合は、すでに最新です。

> 💡 **新バージョンの通知を自動で受け取るには**: プラットフォーム提供者の公開リポジトリ（Fork 元）のページで **「Watch」→「Custom」→「Releases」にチェック → Apply** としておくと、新しいバージョンが公開されるたびに GitHub からメール通知が届きます。届いたら上の「Sync fork」をすれば最新化できます。

---

## Phase 3: サービス名・カラーを設定する

Phase 2 で Fork した「自分のリポジトリ」の `.env` ファイルを編集します。

### 3-1. 自分の GitHub リポジトリを開く

1. [https://github.com](https://github.com) にログイン
2. 左サイドバーの「Recent」または「Repositories」から、Phase 2 で Fork したリポジトリをクリック

### 3-2. `.env` ファイルを編集する

1. リポジトリのファイル一覧から **`.env`** をクリック
2. 右上の **鉛筆アイコン（Edit this file）** をクリック
3. 以下の項目を自分の情報に書き換える:

```
PLATFORM_NAME=あなたのサービス名（例: SchoolMerch）
PLATFORM_TAGLINE=キャッチコピー（例: Fundraise for your school）
PLATFORM_PRIMARY_COLOR=#2E4057    ← メインカラー（16進数カラーコード）
PLATFORM_ACCENT_COLOR=#378ADD    ← アクセントカラー
PLATFORM_ADMIN_EMAIL=あなたのメールアドレス

NEXT_PUBLIC_APP_URL=https://（Phase 2 で発行されたURL）
BETTER_AUTH_URL=https://（Phase 2 で発行されたURL）

EMAIL_FROM=noreply@あなたのドメイン.com
CLOUDFLARE_R2_BUCKET_NAME=（Phase 1 で設定したバケット名）
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev
STRIPE_PUBLISHABLE_KEY=pk_test_...
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

> 💡 カラーコードは [https://colorpicker.me](https://colorpicker.me) などで好みの色を選んでコピーできます。

4. 画面下の **「Commit changes」** をクリック
5. **「Commit directly to the main branch」** を選択 → **「Commit changes」** をクリック

→ Vercel が自動的に再デプロイを開始します（約 1〜2 分）

---

## Phase 4: 残りのサービス設定を追加する

デプロイ後に URL が確定したので、残りの設定を行います。

### 4-1. Google の「承認済みリダイレクト URI」を追加する

1. [https://console.cloud.google.com](https://console.cloud.google.com) を開く
2. 左メニュー → **「APIとサービス」** → **「認証情報」**
3. Phase 1 で作成した OAuth クライアント ID をクリック
4. **「承認済みのリダイレクト URI」** に以下を追加:
   ```
   https://（あなたのURL）.vercel.app/api/auth/callback/google
   ```
5. **「保存」** をクリック

---

### 4-2. Stripe の Webhook を設定する（2本必要です）

Stripe の仕様で、「注文の通知」と「団体の口座連携完了の通知」は**別々の Webhook** として登録する必要があります。同じ手順を2回繰り返します。

1. [https://dashboard.stripe.com](https://dashboard.stripe.com) を開く
2. 画面**左下**の **「Developers」**（`</>` アイコン）をクリック → 「Workbench」パネルが開く
   （見つからない場合は上部の検索バーに「webhooks」と入力）
3. **「Webhooks」タブ** → **「+ Create an event destination」** をクリック

**1本目 — 注文の通知用:**

4. **Events from**: 「**Your account**」を選択
5. イベント検索欄に `checkout.session.completed` と入力してチェック → Continue
6. Destination type: 「**Webhook endpoint**」→ Continue
7. Endpoint URL: `https://（あなたのURL）.vercel.app/api/webhooks/stripe` → **Create**
8. 作成された destination の **「Signing secret」** → 「Reveal」→ コピー → `STRIPE_WEBHOOK_SECRET`

**2本目 — 口座連携完了の通知用:**

9. もう一度 **「+ Create an event destination」**
10. **Events from**: 「**Connected accounts**」を選択（ここが1本目との違い）
11. イベント検索欄で `account.updated` にチェック → Continue
12. Destination type: 「**Webhook endpoint**」→ URL は1本目と**同じ** `https://（あなたのURL）.vercel.app/api/webhooks/stripe` → **Create**
13. こちらの **「Signing secret」** をコピー → `STRIPE_CONNECT_WEBHOOK_SECRET`（1本目とは別の値になります）

> ⚠️ 2本目を忘れると、団体が銀行口座を連携しても「連携完了」と認識されず、キャンペーンの公開・購入ができません。

> ⚠️ **Endpoint URL は必ずコピー＆ペーストで入力してください（手打ち禁止）。**
> 1文字でも違うと Webhook は届かず、Stripe 側のイベント履歴に **404** エラーが並びます。
> 404 が出ている場合は URL のタイプミスです — destination の設定で URL を修正し、
> 失敗したイベントを開いて **「Resend」** を押すと再送されます（**200 OK** になれば成功）。

### 4-3. Printful の Webhook を設定する

1. [https://www.printful.com](https://www.printful.com) にログイン
2. **「Settings」** → **「API」** → **「Webhooks」** タブ
3. Webhook URL: `https://（あなたのURL）.vercel.app/api/webhooks/printful?secret=（好きなランダム文字列）`
4. **イベントを3つ有効にする** — ここを飛ばすと、対応する機能が動きません:

   | イベント | 有効にしないと起きること |
   |---|---|
   | **Package shipped** | 買い手に発送通知メールが届かず、追跡番号も記録されない |
   | **Order refunded** | Printful が再印刷クレームを認めて**製造費を返金しても、気付けない** |
   | **Package returned** | 住所不備などで**商品が返送されても、気付けない**。買い手は支払い済みで手元に何も無い |

5. 設定を保存 → URL に入れたランダム文字列を `PRINTFUL_WEBHOOK_SECRET` に登録

> **Order refunded は「買い手への返金」ではありません。** Printful がこちらに製造費を返すイベントです。買い手への返金は別途 Stripe 側で行う必要があり、通知メールにもその旨が書かれています。

> 🔴 **「あなたのURL」= アプリのURLです。Vercel の管理画面のURLではありません。**
>
> | URL | 何か | 使う？ |
> |---|---|---|
> | `vercel.com/（チーム名）/（プロジェクト名）` | **Vercel の管理画面。** 環境変数やデプロイを設定する、あなただけが見る画面 | ❌ |
> | `（プロジェクト名）.vercel.app` のような形 | **アプリ本体。** 購入者がアクセスする実際のサイト | ✅ |
>
> **調べ方:** Vercel のプロジェクト画面の右上 **「Visit」ボタン**の飛び先。または **Settings → Domains**。
>
> **確かめ方:** そのURLに `/api/webhooks/printful` を付けて叩き、**401 が返れば正解**です
> （認証情報を付けていないので 401 が正しい応答）。404 や HTML が返るならURLが違います。
>
> ```bash
> curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://（アプリURL）/api/webhooks/printful"
> ```
>
> 管理画面のURLを登録すると、**Printful は送信し続けるのにアプリには何も届かず、エラーも出ません。**

#### 画面が見つからない場合（および、既に運用中の場合）

Printful の管理画面はレイアウトが変わることがあります。**確実なのは API で設定する方法**です。ターミナルで次を実行してください（`PRINTFUL_API_KEY` は発行済みのトークン）。

**手順1 — いまの設定を確認する（読むだけ・安全）**

```bash
curl -s -H "Authorization: Bearer あなたのPRINTFUL_API_KEY" \
  https://api.printful.com/webhooks
```

`url` と `types` が返ります。**`types` に `order_refunded` と `package_returned` が無ければ、手順2が必要です。**

**手順2 — 3つまとめて設定する**

```bash
curl -s -X POST https://api.printful.com/webhooks \
  -H "Authorization: Bearer あなたのPRINTFUL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://（あなたのURL）.vercel.app/api/webhooks/printful?secret=（PRINTFUL_WEBHOOK_SECRETと同じ値）",
    "types": ["package_shipped", "order_refunded", "package_returned"]
  }'
```

> ⚠️ **必ず3つ同時に指定してください。** この設定が既存の指定を置き換えるのか追記するのかは公式ドキュメントに明記がありません。3つまとめて送れば、どちらの挙動でも正しい結果になります。1つずつ追加すると、置き換え動作だった場合に `package_shipped` を失い、**発送通知が止まります。**

**手順3 — Printful のシミュレーターで実際に送ってみる**

[https://www.printful.com/api/webhook-simulator](https://www.printful.com/api/webhook-simulator)

- **URL**: 手順2の `"url"` に入れた文字列を**そのままコピー**（`?secret=...` まで含めて）
- **イベント**: `package_shipped`

送信して **200** が返れば、**Printful からアプリまで本当に届いている**ことの証明です。自分で `curl` する確認より強い証拠になります（Printful 自身が送るため）。

> **200 が返っても、通知メールまでは確かめられません。** シミュレーターが送るのは架空の注文IDなので、アプリは「該当注文なし」で終了し、それでも 200 を返します。確認できるのは**到達と認証**までです。実際のメール送信は本物の注文を待つ必要があります。

**手順4 — 登録内容を確認する**

手順1をもう一度実行し、`types` に3つ揃っていること、`secret=` の値が Vercel の環境変数と一致していることを確認してください。

> ⚠️ **secret を後から変更した場合は、手順2をやり直してください。** 環境変数だけ変えて登録を更新しないと、Printful は古い値で送信し、アプリは 401 で弾きます。**この失敗はどこにもエラーが出ません。**

#### 既にトークンを発行済みで、webhook スコープが無い場合

手順1が次のエラーで止まります。

```
403 This endpoint requires any of the following scopes granted: webhooks/read!
```

**本番で使っているトークンは絶対に削除・失効させないでください。** 消すと全注文の履行が止まります。代わりに、この設定作業専用のトークンをもう1本作ります。

1. [developers.printful.com](https://developers.printful.com) → 左メニュー **Tokens** → **Add new token**
   （`printful.com` のダッシュボードとは**別サイト**です。ダッシュボード側に API の画面はありません）
2. Access level は **A single store** → 対象ストアを選択
3. スコープは **下2つだけ**にチェックする。他は全部外したままにする:
   - **View store webhooks**
   - **View and manage store webhooks**
4. そのトークンで上の手順1〜4を実行する
5. **このトークンは削除せず残しておく。** **Vercel の `PRINTFUL_API_KEY` は変更しないこと**

こうすれば、本番のトークンに一切触れずに Webhook を設定できます。本番トークンへの
webhook スコープの取り込みは、**2年ごとのトークン更新のタイミングで行えば十分です**
（更新時は Vercel の差し替えが手順に含まれるため、そこで一緒にやるのが安全）。

> **なぜ残すのか:** webhook スコープだけのトークンは注文にも商品にも触れないため、
> 残しておく危険がありません。逆に削除すると、次に登録内容を確認したくなったときに
> 作り直しになります。**また、削除が webhook 登録そのものを消すかどうかは未確認です。**

### 4-4. Vercel に Webhook シークレットを登録する

1. [https://vercel.com](https://vercel.com) → 自分のプロジェクトをクリック
2. **「Settings」** → **「Environment Variables」**
3. 以下の3つを追加:
   - `STRIPE_WEBHOOK_SECRET` → 4-2 の1本目で取得した値
   - `STRIPE_CONNECT_WEBHOOK_SECRET` → 4-2 の2本目で取得した値
   - `PRINTFUL_WEBHOOK_SECRET` → 4-3 で取得した値
4. **「Save」** → プロジェクトを **「Redeploy」**（Deployments タブ → 最新の Deployment → 「...」→ 「Redeploy」）

> ⚠️ **「Redeploy」の落とし穴**: Redeploy は「その行のデプロイと同じコード」をビルドし直す機能です。
> 説明欄が「Redeploy of ...」となっている行を Redeploy すると、**古いコードが再公開されてしまいます**。
>
> - **コードを最新にしたい** → Redeploy ではなく、「Sync fork」または GitHub でのコミット（コミットすると自動でデプロイされます）
> - **環境変数の変更を反映したい** → 説明欄が**コミット名になっている一番新しい行**を Redeploy する。
>   確実なのは GitHub で `.env` 等に空行を1行足して Commit し、新しいデプロイを走らせる方法です

---

### 4-5. プレビュー環境を本番から切り離す（🔴 実運用するなら必須）

**この手順を飛ばすと、プルリクエストを出しただけで稼働中のストアのデータベースが書き換わります。**
理由は 1-3 の「なぜ2つ必要なのか」に書きました。ここでその設定を行います。

作業は3つです。**順番どおりに行ってください。**

**① 既存の Turso 変数を「Production 専用」にする**

1. [https://vercel.com](https://vercel.com) → 自分のプロジェクト → **「Settings」** → **「Environment Variables」**
2. `TURSO_DATABASE_URL` の行の **「…」** → **「Edit」**
3. **環境のチェックボックスで `Production` だけを残し、`Preview` と `Development` のチェックを外す**
4. **「Save」**
5. `TURSO_AUTH_TOKEN` にも同じことをする

> ⚠️ **値は変更しません。** ここで触るのは「どの環境で使うか」だけです。
> **値を書き換えると稼働中のストアが別のデータベースを見にいきます。**

**② プレビュー用の Turso 変数を追加する**

1. 同じ画面で **「Add Another」**（または「Add New」）をクリック
2. 以下を**2回**登録する:

   | Key | Value | 環境（チェックを入れる先） |
   |-----|-------|--------------------------|
   | `TURSO_DATABASE_URL` | **プレビュー用**の Database URL（`myapp-preview` の方） | `Preview` と `Development` のみ |
   | `TURSO_AUTH_TOKEN` | **プレビュー用**の Auth Token | `Preview` と `Development` のみ |

> 🔴 **入れる値を取り違えないこと。** ここに本番用の値を入れると、分けた意味がまったく無くなります。
> **`myapp-prod` と `myapp-preview` のどちらの URL か、貼り付ける前に目で確認してください。**

**③ 設定できたことを確認する**

1. 同じ画面の一覧を上から見て、`TURSO_DATABASE_URL` が **2行**あることを確認する
2. 片方の環境欄が **`Production`** だけ、もう片方が **`Preview, Development`** になっていること
3. `TURSO_AUTH_TOKEN` も同様に2行あること

**確認できたら完了です。** プレビュー用データベースの中身は空のままで構いません。
次にプレビューが作られたとき、そこにテーブルと商品カタログが自動で作られます。

> 💡 **本番の見え方は何も変わりません。** ①で値を変えていないため、本番は同じデータベースを
> 見続けます。再デプロイも不要です（次のデプロイから自動で反映されます）。

> 💡 **プレビューを開くとデータが空に見えます。それが正常です。** プレビューは本番とは別の
> データベースを見ているので、本番のキャンペーンや注文は表示されません。プレビューで動作を
> 試したい場合は、プレビュー環境の中で新しく団体とキャンペーンを作ってください。

---

### 4-6. 決済と印刷もプレビューから切り離す（🔴 本番運用を始める前に必ず）

**4-5 で分けたのはデータベースだけです。決済（Stripe）と印刷（Printful）はまだ本番のままです。**

本番運用を始めた後、この作業をしていないと、**プレビュー環境で買い物をしたときに実際のカードへ課金され、Printful に本物の注文が入って印刷・発送・請求まで進みます。**

プレビューが作られるのは **`main` 以外のブランチに push したとき**、つまりプルリクエストを作ったときです（Sync fork では作られません — 1-3 参照）。**プルリクエストを一度も作らないなら起きませんが、一度でも作れば起きます。**

作業は 4-5 と同じ要領です（Settings → Environment Variables）。

**① Stripe — プレビューはテストキーにする**

| 変数 | Production | Preview / Development |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | **`sk_test_...`** |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | **`pk_test_...`** |

テストキーは Stripe ダッシュボードの右上でテストモードに切り替えると取得できます。これでプレビューでの購入は[テストカード](https://docs.stripe.com/testing)でしか通らなくなり、**実際のお金は動きません。**

> 💡 `STRIPE_WEBHOOK_SECRET` はプレビュー用を用意できません。Webhook はURLを1つ登録する仕組みですが、プレビューのURLはデプロイごとに変わるためです。**4-5 でデータベースを分けてあれば**、プレビューの決済完了通知は本番URLに届いても本番側に該当する注文が無いため、**注文確定・メール送信・Printful への発注はどれも動きません。** 画面の動作確認には支障ありません。
>
> 🔴 **逆に言うと、4-5 をやらずに 4-6 だけやっても不十分です。** データベースが共通のままだと、
> プレビューで作られた注文を**本番側が見つけて履行してしまいます。** 4-5 と 4-6 は両方必要です。

**② Printful — プレビューでは注文を下書きで止める**

Printful にはテストモードがありません。代わりに、**プレビューだけ自動確定を切ります。**

| 変数 | Production | Preview / Development |
|---|---|---|
| `PRINTFUL_AUTO_CONFIRM` | 設定しない（＝自動確定） | **`false`** |

`false` にすると注文は Printful 上で「ドラフト」として止まり、**印刷も課金も発生しません**（あなたが Printful の画面で Confirm を押さない限り）。

> 🔴 **Production 側にうっかり `false` を入れないこと。** 本番が下書きで止まると、買い手は代金を
> 払ったのに商品が発送されません。**`false` を入れるのは Preview と Development だけです。**

---

## Phase 5: セットアップウィザードを完了する

### 5-1. アプリにアクセスする

1. ブラウザで `https://（あなたのURL）.vercel.app` を開く
2. セットアップウィザードに**自動的に移動します**

---

### 5-2. Step 1: ライセンス同意

1. ライセンス条項を読む
2. 「I have read and agree to the license terms」にチェック
3. **「Get Started →」** をクリック

---

### 5-3. Step 2: ブランド設定

`.env` に記入した内容が自動で入力されています。

1. 内容を確認する（サービス名・キャッチコピー・カラー）
2. 必要があれば修正する
3. **「Save & Continue →」** をクリック

> 💡 値が「Community Merch Platform」のままの場合は Phase 3 の `.env` 編集が反映されていません。このフォームで直接入力して進むこともできます。

---

### 5-4. Steps 3〜8: サービス接続の確認

各ステップで、設定した環境変数が正しく読み込まれているか確認します。

- ✅ **緑** → 正しく設定されています
- ⚠️ **黄** → 未設定または設定に問題があります

⚠️ が表示されている場合は Vercel の環境変数設定を確認してください。
全て ✅ でなくても **「Continue →」** で進めます（後から設定可能です）。

---

### 5-5. Step 9: ローンチ

1. 設定内容のサマリーを確認する
2. `PLATFORM_ADMIN_EMAIL` に設定したメールアドレスでサインインしていることを確認
   - まだサインインしていない場合: **「サインイン」** リンクをクリックしてサインイン後に戻る
3. **「🚀 Launch Platform」** をクリック

---

### 5-6. 完了！

プラットフォーム管理画面（Platform Admin Dashboard / `/admin`）に移動します。
これはライセンシー（プラットフォーム運営者）専用の管理画面です。各団体の管理者が使う団体ダッシュボード（`/dashboard`）とは別物です。
これでサービスが開始されました 🎉

---

## テストモード動作確認チートシート

本番公開の前に、Stripe **テストモード**（`sk_test_` / `pk_test_` キー）で購入までの流れを一度通すことを推奨します。テストモードでは実際のお金は動きません。以下は Stripe が用意しているテスト専用の magic value です。

### 団体の口座連携（Stripe オンボーディング）

| 入力項目 | テスト用の値 |
|---------|------------|
| 生年月日 | `1901-01-01`（January 1, 1901） |
| SMS 認証コード | `000000` |
| 銀行選択 | **「Test (non-OAuth)」** という名前のテスト銀行を選ぶ |
| Routing number | `110000000` |
| Account number | `000123456789` |
| 本人確認書類 | アップロード画面で「Skip」またはテスト書類ボタンが表示されます |

> 💡 連携完了後、ダッシュボードの Payouts が「Ready to accept funds」になれば成功です。
> 反映されない場合は 4-2 の**2本目の Webhook**（Connected accounts / `account.updated`）を確認してください。

### テスト購入（チェックアウト）

| 入力項目 | テスト用の値 |
|---------|------------|
| カード番号 | `4242 4242 4242 4242` |
| 有効期限 | `12/30`（未来の日付なら何でも可） |
| CVC | `123` |
| 郵便番号・住所 | **州と ZIP が一致する実在の組み合わせ**にすること（例: `100 Broad St, Columbus, OH 43215`） |

> ⚠️ 住所の州と ZIP が一致していないと、決済は通っても Printful への発注が
> 「Shipping address state and ZIP don't match」で失敗します。適当な住所は使わないでください。

### 確認ポイント

1. 購入後に「Order confirmed!」が表示される
2. 注文ステータスが `paid` → `completed` に変わる（Vercel の Logs に `[fulfillment]` が出ます）
3. 確認メールが届く（Resend の Logs にも記録されます）
4. Printful のダッシュボードに注文が作成されている（テスト時は `PRINTFUL_AUTO_CONFIRM=false` を設定しておくと Draft で止まり、課金されません。**確認後は Draft を削除**してください）

---

## よくある質問

**Q: デプロイ後に「Application error」が表示される場合は？**
A: 環境変数の入力ミスが原因であることが多いです。Vercel の Settings → Environment Variables で値を確認してください。特に `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` が正しいか確認します。

**Q: サービス名やカラーを後から変えたい場合は？**
A: Phase 3 の手順で `.env` を再編集して Commit すると、次のデプロイから反映されます。または管理画面の設定からも変更できます。

**Q: 独自ドメイン（例: myshop.com）を使いたい場合は？**
A: Vercel の「Domains」設定でカスタムドメインを追加できます。設定後は `.env` の `NEXT_PUBLIC_APP_URL` と `BETTER_AUTH_URL` も新しいドメインに更新してください。

**Q: 利用規約・プライバシーポリシーを自分の内容にしたい**
A: `/terms` と `/privacy` に英語のテンプレートが最初から表示されます（サービス名とサポートメールは自動で埋まります）。内容を変えるには、GitHub で自分のリポジトリの `content/terms.md` と `content/privacy.md` を開き、鉛筆アイコンで編集して Commit してください（`.env` の編集と同じ手順）。**公開前に、テンプレートの内容で問題ないか弁護士等の専門家への確認を推奨します。**

**Q: プラットフォームのアップデート（機能追加・修正）はどうやって反映する？**
A: 自分の GitHub リポジトリのページで「Sync fork」→「Update branch」をクリックするだけです（Phase 2 の「アップデートの受け取り方」参照）。Vercel が自動で再デプロイします。「Sync fork」ボタンが見当たらない場合、リポジトリが Fork ではなくコピーとして作られている可能性があります — プラットフォーム提供者にご相談ください。

**Q: アップデートしたはずなのに、不具合が直っていない**
A: 「Redeploy」で古いコードを再公開してしまっている可能性があります。Vercel の Deployments タブで最新（一番上）の行の説明欄を確認してください。「Redeploy of ...」となっていたら古いスナップショットです。「Sync fork」または GitHub でのコミットで新しいデプロイを作り直してください（4-4 の「Redeploy の落とし穴」参照）。

**Q: プレビューを開いたらキャンペーンも注文も何も表示されない**
A: **それが正常です。** 手順 4-5 でプレビューを本番から切り離すと、プレビューは本番とは別の空のデータベースを見ます。本番のデータは無事です（本番URLで確認できます）。プレビューで動作を試したい場合は、プレビューの中で新しく団体とキャンペーンを作ってください。

**Q: データベースは1つでも動く？ 2つ作るのは面倒なのだけれど**
A: 動きます。**プルリクエストを一度も作らないなら、実際のところ何も起きません**（プレビューは `main` 以外のブランチに push したときだけ作られ、Sync fork では作られません）。

ただし**一度でもプルリクエストを作れば**、そのプレビューで買い物を完了したときに**実際のカードへ課金され、Printful に本物の注文が入ります**（データベースが同じなので、本番側がその注文を見つけて履行します）。プレビュー画面から買い手の氏名・メールアドレス・配送先住所も読めます。

Turso の無料枠は**データベース100個まで**なので、2つ目を作っても費用は増えません。**実運用するなら分けてください。**

**Q: すでに1つのデータベースで運用を始めてしまった。どうすればいい？**
A: **本番のデータは動かしません。**新しく作るのは**空のプレビュー用データベースの方**です。1-3 の手順7でプレビュー用を1つ作り、4-5 の①②を行ってください。データの移行もダウンタイムもありません。

**Q: うまくいかない場合は？**
A: プラットフォーム提供者までご連絡ください。
