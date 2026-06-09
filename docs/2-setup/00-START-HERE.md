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
Phase 2: Deploy ボタンをクリック → 自分専用のアプリが作られる
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
無料枠（9GB）で小〜中規模の運用なら十分です。

**何を取得するか:** `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN`

**手順:**
1. [https://turso.tech](https://turso.tech) を開く
2. **「Get Started」** → GitHub または Google でサインアップ
3. ダッシュボードに移動したら **「Create Database」** をクリック
4. データベース名（例: `myapp-db`）を入力 → リージョンは `nrt`（東京）を選択 → **「Create」**
5. 作成したデータベースをクリック → **「Connect」** タブを開く
6. **「Create Token」** をクリック

取得できる値:
- `Database URL`: `libsql://your-db-name-username.turso.io` → これが `TURSO_DATABASE_URL`
- `Auth Token`: `eyJ...` で始まる長い文字列 → これが `TURSO_AUTH_TOKEN`

> ⚠️ Auth Token は一度しか表示されません。必ずコピーして保存してください。

---

### 1-4. Stripe（決済処理サービス）

**何をするサービス？**
クレジットカード決済を処理するサービスです。
購入者が商品を買うときの支払いを受け付け、組織の銀行口座に送金します。
取引ごとに手数料が発生しますが、月額料金はありません。

**何を取得するか:** `STRIPE_SECRET_KEY`、`STRIPE_PUBLISHABLE_KEY`、`STRIPE_WEBHOOK_SECRET`

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

今はメモに `STRIPE_WEBHOOK_SECRET = あとで設定` と書いておいてください。

---

### 1-5. Printful（印刷・発送サービス）

**何をするサービス？**
Tシャツなどのグッズを印刷して購入者の自宅に直接発送するサービスです。
注文が入ると自動的に Printful に転送され、印刷・梱包・発送まで行います。
月額料金なし（商品原価のみ）。

**何を取得するか:** `PRINTFUL_API_KEY`、`PRINTFUL_WEBHOOK_SECRET`

**手順（APIキーの取得）:**
1. [https://www.printful.com](https://www.printful.com) を開く → **「Get started for free」** で登録
2. ダッシュボードに移動したら右上のアカウントメニュー → **「Settings」**
3. **「API」** タブをクリック
4. **「Generate API Key」** をクリック → キーをコピー → `PRINTFUL_API_KEY`

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
| `TURSO_DATABASE_URL` | ☐ |
| `TURSO_AUTH_TOKEN` | ☐ |
| `BETTER_AUTH_SECRET` | ☐ |
| `GOOGLE_CLIENT_ID` | ☐ |
| `GOOGLE_CLIENT_SECRET` | ☐ |
| `RESEND_API_KEY` | ☐ |
| `EMAIL_FROM` | ☐ |
| `STRIPE_SECRET_KEY` | ☐ |
| `STRIPE_PUBLISHABLE_KEY` | ☐ |
| `STRIPE_WEBHOOK_SECRET` | ☐（あとで設定） |
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

### 2-1. Deploy ボタンをクリックする

1. プラットフォーム提供者から共有されたリポジトリページを開く
2. ページ上部の **「Deploy with Vercel」** ボタンをクリック

   > ボタンをクリックすると Vercel のページに移動します（ここから先は Vercel の画面です）

3. **Vercel のアカウントを作成またはログインする**
   - アカウントがない場合: **「Sign Up」** → メールアドレスで登録、または GitHub アカウントで登録
   - すでにある場合: **「Log In」**

4. **GitHub アカウントを Vercel に連携する**

   「Connect to Git provider」という画面が表示されます。

   - **「GitHub」** をクリック
   - GitHub のログイン画面が開く（GitHub アカウントでログイン）
   - **「Authorize Vercel」** をクリック

   > これは「Vercel があなたの GitHub にリポジトリを作成することを許可する」操作です。
   > 一度許可すれば次回からは不要です。

5. **自分の GitHub アカウントにリポジトリを作成する**

   「Create Git Repository」という画面が表示されます。

   - **「Select a GitHub Account」** で自分の GitHub アカウント名を選択
     （表示されない場合は **「Add GitHub Account」** をクリックして追加）
   - **「Repository Name」** にリポジトリ名を入力（例: `myapp`、`school-merch` など）
   - **「Create」** をクリック

   > ✅ あなた専用の GitHub リポジトリが作成されました
   > URL は `https://github.com/あなたのGitHubユーザー名/入力したリポジトリ名` になります
   > 他のライセンシーからは見えません

---

### 2-2. シークレット情報を入力する

Vercel の画面に環境変数の入力フォームが表示されます。
Phase 1 で集めた値を入力してください。

| 変数名 | 入力内容 |
|--------|---------|
| `TURSO_DATABASE_URL` | Turso の Database URL |
| `TURSO_AUTH_TOKEN` | Turso の Auth Token |
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

### 2-3. デプロイを実行する

1. 全項目入力後 → **「Deploy」** ボタンをクリック
2. 数分待つとデプロイが完了する（画面に紙吹雪 🎉 が出たら成功）
3. **2つの URL が発行される — 両方メモしておく**

   | URL | 場所 | 用途 |
   |-----|------|------|
   | Vercel アプリ URL | 例: `https://myapp.vercel.app` | あなたのサービスの URL |
   | GitHub リポジトリ URL | 例: `https://github.com/あなたのユーザー名/myapp` | コードの保管場所 |

   > GitHub リポジトリ URL は、Vercel の完了画面上部にある「Connected to GitHub」のリンクから確認できます

> ⚠️ デプロイ後すぐにアクセスすると「環境変数が未設定」のエラーが出る場合があります。
> Phase 3〜4 の設定を完了してから再アクセスしてください。

### 2-4. GitHub リポジトリ URL をプラットフォーム提供者に伝える

メモした **GitHub リポジトリ URL**（例: `https://github.com/あなたのユーザー名/myapp`）を
プラットフォーム提供者にメール等で共有してください。

> これは将来アップデートが届く際に必要になります。
> Vercel アプリ URL（`vercel.app` の URL）ではなく、GitHub の URL です。

---

## Phase 3: サービス名・カラーを設定する

デプロイで作成された「自分のリポジトリ」の `.env` ファイルを編集します。

### 3-1. 自分の GitHub リポジトリを開く

1. [https://github.com](https://github.com) にログイン
2. 左サイドバーの「Recent」または「Repositories」から、Phase 2 で作成したリポジトリをクリック

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

### 4-2. Stripe の Webhook を設定する

1. [https://dashboard.stripe.com](https://dashboard.stripe.com) を開く
2. 左メニュー **「Developers」** → **「Webhooks」** → **「Add endpoint」**
3. 以下を入力:
   - Endpoint URL: `https://（あなたのURL）.vercel.app/api/webhooks/stripe`
   - Events: **「Select events」** → `payment_intent.succeeded`、`checkout.session.completed` を選択
4. **「Add endpoint」** をクリック
5. 作成された Webhook の **「Signing secret」** → **「Reveal」** → コピー → `STRIPE_WEBHOOK_SECRET`

### 4-3. Printful の Webhook を設定する

1. [https://www.printful.com](https://www.printful.com) にログイン
2. **「Settings」** → **「API」** → **「Webhooks」** タブ
3. Webhook URL: `https://（あなたのURL）.vercel.app/api/webhooks/printful`
4. 設定を保存 → 表示されるシークレットをコピー → `PRINTFUL_WEBHOOK_SECRET`

### 4-4. Vercel に Webhook シークレットを登録する

1. [https://vercel.com](https://vercel.com) → 自分のプロジェクトをクリック
2. **「Settings」** → **「Environment Variables」**
3. 以下の2つを追加:
   - `STRIPE_WEBHOOK_SECRET` → 4-2 で取得した値
   - `PRINTFUL_WEBHOOK_SECRET` → 4-3 で取得した値
4. **「Save」** → プロジェクトを **「Redeploy」**（Deployments タブ → 最新の Deployment → 「...」→ 「Redeploy」）

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

管理画面（Admin Dashboard）に移動します。
これでサービスが開始されました 🎉

---

## よくある質問

**Q: デプロイ後に「Application error」が表示される場合は？**
A: 環境変数の入力ミスが原因であることが多いです。Vercel の Settings → Environment Variables で値を確認してください。特に `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` が正しいか確認します。

**Q: サービス名やカラーを後から変えたい場合は？**
A: Phase 3 の手順で `.env` を再編集して Commit すると、次のデプロイから反映されます。または管理画面の設定からも変更できます。

**Q: 独自ドメイン（例: myshop.com）を使いたい場合は？**
A: Vercel の「Domains」設定でカスタムドメインを追加できます。設定後は `.env` の `NEXT_PUBLIC_APP_URL` と `BETTER_AUTH_URL` も新しいドメインに更新してください。

**Q: うまくいかない場合は？**
A: プラットフォーム提供者までご連絡ください。
