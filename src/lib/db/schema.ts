import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"

// ── Better Auth tables (required) ─────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  platformRole: text("platform_role", { enum: ["platform_admin", "platform_staff"] }),
})

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})

// ── Discount codes ─────────────────────────────────────────────────────────

export const discountCodes = sqliteTable("discount_codes", {
  id:            text("id").primaryKey(),
  code:          text("code").notNull().unique(),
  discountType:  text("discount_type", { enum: ["fee_percentage", "fee_waiver"] }).notNull(),
  discountValue: integer("discount_value").notNull(),
  // fee_percentage: 1–100 (e.g. 20 = 20% off the 9% fee → 7.2%)
  // fee_waiver:     always 100; campaignLimit controls how many campaigns are covered
  campaignLimit: integer("campaign_limit"),
  maxUses:       integer("max_uses"),
  currentUses:   integer("current_uses").notNull().default(0),
  expiresAt:     integer("expires_at", { mode: "timestamp" }),
  isActive:      integer("is_active", { mode: "boolean" }).notNull().default(true),
  deactivatedAt: integer("deactivated_at", { mode: "timestamp" }),
  createdBy:     text("created_by"),
  createdAt:     integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt:     integer("updated_at", { mode: "timestamp" }).notNull(),
}, (t) => [
  index("discount_codes_created_by_idx").on(t.createdBy),
])

// ── App tables ─────────────────────────────────────────────────────────────

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  stripeAccountId: text("stripe_account_id"),
  stripeOnboardingComplete: integer("stripe_onboarding_complete", { mode: "boolean" }).default(false),
  isInternal: integer("is_internal", { mode: "boolean" }).default(false),
  discountCodeId: text("discount_code_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  suspendedAt: integer("suspended_at", { mode: "timestamp" }),
}, (t) => [
  index("orgs_discount_code_id_idx").on(t.discountCodeId),
])

export const orgMembers = sqliteTable("org_members", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "member", "student", "buyer"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (t) => [uniqueIndex("org_members_org_user_unique").on(t.orgId, t.userId)])

export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role", { enum: ["admin", "member", "student", "buyer"] }).notNull().default("member"),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by").notNull().references(() => user.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

// ── Campaign tables ────────────────────────────────────────────────────────

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  status: text("status", { enum: ["draft", "active", "closed"] }).notNull().default("draft"),
  goalAmount: integer("goal_amount"),
  deadline: integer("deadline", { mode: "timestamp" }),
  amountDisplayMode: text("amount_display_mode", {
    enum: ["percent_only", "show_amount"],
  }).notNull().default("percent_only"),
  platformFeeRate:       integer("platform_fee_rate").notNull().default(900),
  appliedDiscountCodeId: text("applied_discount_code_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (t) => [
  uniqueIndex("campaigns_slug_unique").on(t.slug),
  index("campaigns_org_id_idx").on(t.orgId),
])

export const campaignProducts = sqliteTable("campaign_products", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  printfulVariantId: text("printful_variant_id").notNull(),
  retailPrice: integer("retail_price").notNull(),
  podCost: integer("pod_cost").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  availableColors: text("available_colors").notNull().default('["White"]'),
  mockupUrl: text("mockup_url"),
  mockupGeneratedAt: integer("mockup_generated_at", { mode: "timestamp" }),
}, (t) => [
  index("campaign_products_campaign_id_idx").on(t.campaignId),
])

export const designs = sqliteTable("designs", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  designFileUrl: text("design_file_url"),
  mockupUrl: text("mockup_url"),
  aiGenerated: integer("ai_generated", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (t) => [
  uniqueIndex("designs_campaign_id_unique").on(t.campaignId),
])

// ── Order tables ───────────────────────────────────────────────────────────

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  userId: text("user_id").references(() => user.id),
  buyerEmail: text("buyer_email"),
  buyerName: text("buyer_name"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  printfulOrderId: text("printful_order_id"),
  status: text("status", {
    enum: ["pending", "paid", "fulfilled", "shipped", "delivered"],
  }).notNull().default("pending"),
  shippingAddressJson: text("shipping_address_json"),
  totalAmountCents: integer("total_amount_cents").notNull(),
  fulfillmentAttempts: integer("fulfillment_attempts").notNull().default(0),
  fulfillmentError: text("fulfillment_error"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  trackingUrl: text("tracking_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (t) => [
  index("orders_campaign_id_idx").on(t.campaignId),
  index("orders_stripe_session_idx").on(t.stripeCheckoutSessionId),
])

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  campaignProductId: text("campaign_product_id").notNull().references(() => campaignProducts.id),
  size: text("size").notNull(),
  color: text("color").notNull().default("White"),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
})

// ── Drizzle relations ──────────────────────────────────────────────────────

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(organizations, { fields: [orgMembers.orgId], references: [organizations.id] }),
  user: one(user, { fields: [orgMembers.userId], references: [user.id] }),
}))

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  campaigns: many(campaigns),
}))

export const userRelations = relations(user, ({ many }) => ({
  memberships: many(orgMembers),
}))

export const discountCodesRelations = relations(discountCodes, ({ one }) => ({
  creator: one(user, { fields: [discountCodes.createdBy], references: [user.id] }),
}))

export const invitationsRelations = relations(invitations, ({ one }) => ({
  org: one(organizations, { fields: [invitations.orgId], references: [organizations.id] }),
  inviter: one(user, { fields: [invitations.invitedBy], references: [user.id] }),
}))

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  org: one(organizations, { fields: [campaigns.orgId], references: [organizations.id] }),
  products: many(campaignProducts),
  design: one(designs, { fields: [campaigns.id], references: [designs.campaignId] }),
  orders: many(orders),
}))

export const campaignProductsRelations = relations(campaignProducts, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignProducts.campaignId], references: [campaigns.id] }),
}))

export const designsRelations = relations(designs, ({ one }) => ({
  campaign: one(campaigns, { fields: [designs.campaignId], references: [campaigns.id] }),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [orders.campaignId], references: [campaigns.id] }),
  user: one(user, { fields: [orders.userId], references: [user.id] }),
  items: many(orderItems),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(campaignProducts, { fields: [orderItems.campaignProductId], references: [campaignProducts.id] }),
}))

// ── Platform configuration (setup wizard) ─────────────────────────────────

export const platformConfig = sqliteTable("platform_config", {
  id: text("id").primaryKey().default("singleton"),
  platformName: text("platform_name").notNull().default("Community Merch Platform"),
  platformTagline: text("platform_tagline").notNull().default("Fundraise with custom merch"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#2E4057"),
  accentColor: text("accent_color").notNull().default("#378ADD"),
  baseDomain: text("base_domain"),
  supportEmail: text("support_email"),
  licenseAgreed: integer("license_agreed", { mode: "boolean" }).notNull().default(false),
  currentStep: integer("current_step").notNull().default(1),
  setupComplete: integer("setup_complete", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

// ── Printful catalog (admin-curated product list) ──────────────────────────

export const printfulCatalog = sqliteTable("printful_catalog", {
  id: text("id").primaryKey(),
  printfulProductId: integer("printful_product_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  catalogImageUrl: text("catalog_image_url").notNull(),
  podCostCents: integer("pod_cost_cents").notNull(),
  availableColors: text("available_colors").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  defaultMockupVariantId: integer("default_mockup_variant_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})
