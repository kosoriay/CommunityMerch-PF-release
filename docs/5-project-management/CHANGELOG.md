# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

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
