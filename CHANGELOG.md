# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

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
