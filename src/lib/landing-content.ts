// Pure, client-safe landing-page content model: types, defaults, validation, merge.
// DB access lives in landing-content-db.ts (server-only). Do NOT import db,
// next/headers, or any server-only module here — the admin editor form
// (a client component) imports types and defaults from this file.

export type LandingHero = { headline?: string; subtext?: string; ctaLabel?: string }
export type LandingStep = { title: string; description: string }
export type LandingTestimonial = { name: string; title?: string; quote: string }
export type LandingFaq = { question: string; answer: string }

// Sparse document: a section key exists only when the operator customized it.
// Absent → render code defaults; present-but-empty list → section hidden.
export type StoredLandingContent = {
  hero?: LandingHero
  howItWorks?: LandingStep[]
  testimonials?: LandingTestimonial[]
  faqs?: LandingFaq[]
}

export type EffectiveLandingContent = {
  hero: Required<LandingHero>
  howItWorks: LandingStep[]
  testimonials: LandingTestimonial[]
  faqs: LandingFaq[]
  customized: {
    hero: boolean
    howItWorks: boolean
    testimonials: boolean
    faqs: boolean
  }
}

export const LANDING_LIMITS = {
  heroHeadline: 120,
  heroSubtext: 300,
  heroCtaLabel: 40,
  stepTitle: 60,
  stepDescription: 300,
  testimonialName: 80,
  testimonialTitle: 120,
  testimonialQuote: 500,
  faqQuestion: 200,
  faqAnswer: 1000,
  maxListItems: 20,
} as const

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}

export const LANDING_DEFAULTS: {
  hero: Required<LandingHero>
  howItWorks: LandingStep[]
  faqs: LandingFaq[]
} = {
  hero: {
    headline: "Raise money with merch your community actually wants",
    subtext:
      "Design custom apparel, share your campaign, and let supporters buy directly — printing and shipping are handled on demand, so you never touch inventory or risk a dollar.",
    ctaLabel: "Get Started — Free",
  },
  howItWorks: [
    {
      title: "Pick your products",
      description:
        "Choose from a curated catalog of quality tees, hoodies, and more — set your own prices and fundraising goal.",
    },
    {
      title: "Add your design",
      description:
        "Upload your logo or artwork, or generate a design with AI, and preview it on real product mockups before you launch.",
    },
    {
      title: "Share and raise funds",
      description:
        "Publish your campaign page and share the link. Supporters order online, items ship to their door, and profits go to your organization.",
    },
  ],
  faqs: [
    {
      question: "How much does it cost to start?",
      answer:
        "Nothing. Creating a campaign is free. Products are printed on demand when a supporter orders, so there are no upfront costs and no unsold boxes.",
    },
    {
      question: "Do we have to handle inventory or shipping?",
      answer:
        "No. Every order is printed and shipped directly to the supporter's home. Your organization never stores, packs, or ships anything.",
    },
    {
      question: "How does our organization get paid?",
      answer:
        "Connect your organization's bank account once (powered by Stripe). Profits from each sale are paid out to your account automatically.",
    },
    {
      question: "Who can run a campaign?",
      answer:
        "Schools, PTAs, sports teams, clubs, and community groups — any organization that wants to raise money with custom merch.",
    },
  ],
}

// Shared across every request in the server process and imported by the admin
// editor form. Frozen so accidental in-place mutation throws instead of
// silently corrupting the shipped defaults. Statement form (not reassignment)
// keeps the declared type free of readonly ripple.
deepFreeze(LANDING_DEFAULTS)

export type LandingValidation =
  | { ok: true; value: StoredLandingContent }
  | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

// Trimmed string, "" when absent, or null when not a string / over the limit.
function cleanText(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return ""
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > max ? null : t
}

export function validateLandingContent(input: unknown): LandingValidation {
  if (!isRecord(input)) return { ok: false, error: "Content must be an object." }
  const out: StoredLandingContent = {}

  if (input.hero !== undefined) {
    if (!isRecord(input.hero)) return { ok: false, error: "Hero must be an object." }
    const headline = cleanText(input.hero.headline, LANDING_LIMITS.heroHeadline)
    const subtext = cleanText(input.hero.subtext, LANDING_LIMITS.heroSubtext)
    const ctaLabel = cleanText(input.hero.ctaLabel, LANDING_LIMITS.heroCtaLabel)
    if (headline === null) {
      return { ok: false, error: `Hero headline must be text within ${LANDING_LIMITS.heroHeadline} characters.` }
    }
    if (subtext === null) {
      return { ok: false, error: `Hero subtext must be text within ${LANDING_LIMITS.heroSubtext} characters.` }
    }
    if (ctaLabel === null) {
      return { ok: false, error: `Hero CTA label must be text within ${LANDING_LIMITS.heroCtaLabel} characters.` }
    }
    // Empty fields are dropped so resolve() falls back field-by-field (design D2).
    const hero: LandingHero = {}
    if (headline) hero.headline = headline
    if (subtext) hero.subtext = subtext
    if (ctaLabel) hero.ctaLabel = ctaLabel
    out.hero = hero
  }

  if (input.howItWorks !== undefined) {
    if (!Array.isArray(input.howItWorks) || input.howItWorks.length !== 3) {
      return { ok: false, error: "How-it-works must contain exactly 3 steps." }
    }
    const steps: LandingStep[] = []
    for (const [i, raw] of input.howItWorks.entries()) {
      if (!isRecord(raw)) return { ok: false, error: `Step ${i + 1} must be an object.` }
      const title = cleanText(raw.title, LANDING_LIMITS.stepTitle)
      const description = cleanText(raw.description, LANDING_LIMITS.stepDescription)
      if (!title) {
        return { ok: false, error: `Step ${i + 1} needs a title within ${LANDING_LIMITS.stepTitle} characters.` }
      }
      if (!description) {
        return { ok: false, error: `Step ${i + 1} needs a description within ${LANDING_LIMITS.stepDescription} characters.` }
      }
      steps.push({ title, description })
    }
    out.howItWorks = steps
  }

  if (input.testimonials !== undefined) {
    if (!Array.isArray(input.testimonials)) return { ok: false, error: "Testimonials must be a list." }
    const items: LandingTestimonial[] = []
    for (const [i, raw] of input.testimonials.entries()) {
      if (!isRecord(raw)) return { ok: false, error: `Testimonial ${i + 1} must be an object.` }
      const name = cleanText(raw.name, LANDING_LIMITS.testimonialName)
      const title = cleanText(raw.title, LANDING_LIMITS.testimonialTitle)
      const quote = cleanText(raw.quote, LANDING_LIMITS.testimonialQuote)
      if (name === null) {
        return { ok: false, error: `Testimonial ${i + 1} name must be within ${LANDING_LIMITS.testimonialName} characters.` }
      }
      if (title === null) {
        return { ok: false, error: `Testimonial ${i + 1} title must be within ${LANDING_LIMITS.testimonialTitle} characters.` }
      }
      if (quote === null) {
        return { ok: false, error: `Testimonial ${i + 1} quote must be within ${LANDING_LIMITS.testimonialQuote} characters.` }
      }
      if (!name && !title && !quote) continue // all-empty row from the form — skip it
      if (!name) return { ok: false, error: `Testimonial ${i + 1} needs a name.` }
      if (!quote) return { ok: false, error: `Testimonial ${i + 1} needs a quote.` }
      items.push(title ? { name, title, quote } : { name, quote })
    }
    if (items.length > LANDING_LIMITS.maxListItems) {
      return { ok: false, error: `At most ${LANDING_LIMITS.maxListItems} testimonials.` }
    }
    out.testimonials = items
  }

  if (input.faqs !== undefined) {
    if (!Array.isArray(input.faqs)) return { ok: false, error: "FAQs must be a list." }
    const items: LandingFaq[] = []
    for (const [i, raw] of input.faqs.entries()) {
      if (!isRecord(raw)) return { ok: false, error: `FAQ ${i + 1} must be an object.` }
      const question = cleanText(raw.question, LANDING_LIMITS.faqQuestion)
      const answer = cleanText(raw.answer, LANDING_LIMITS.faqAnswer)
      if (question === null) {
        return { ok: false, error: `FAQ ${i + 1} question must be within ${LANDING_LIMITS.faqQuestion} characters.` }
      }
      if (answer === null) {
        return { ok: false, error: `FAQ ${i + 1} answer must be within ${LANDING_LIMITS.faqAnswer} characters.` }
      }
      if (!question && !answer) continue
      if (!question) return { ok: false, error: `FAQ ${i + 1} needs a question.` }
      if (!answer) return { ok: false, error: `FAQ ${i + 1} needs an answer.` }
      items.push({ question, answer })
    }
    if (items.length > LANDING_LIMITS.maxListItems) {
      return { ok: false, error: `At most ${LANDING_LIMITS.maxListItems} FAQs.` }
    }
    out.faqs = items
  }

  return { ok: true, value: out }
}

// Parse the raw DB value. Any failure (bad JSON, bad shape) → {} so the landing
// page can only ever degrade to defaults, never break (design D6).
export function parseStoredContent(raw: string | null | undefined): StoredLandingContent {
  if (!raw) return {}
  try {
    const result = validateLandingContent(JSON.parse(raw))
    if (!result.ok) {
      console.error("landing_content failed validation:", result.error)
      return {}
    }
    return result.value
  } catch (e) {
    console.error("landing_content is not valid JSON:", e)
    return {}
  }
}

export function resolveLandingContent(stored: StoredLandingContent): EffectiveLandingContent {
  return {
    hero: {
      headline: stored.hero?.headline ?? LANDING_DEFAULTS.hero.headline,
      subtext: stored.hero?.subtext ?? LANDING_DEFAULTS.hero.subtext,
      ctaLabel: stored.hero?.ctaLabel ?? LANDING_DEFAULTS.hero.ctaLabel,
    },
    howItWorks: stored.howItWorks ?? LANDING_DEFAULTS.howItWorks,
    // No default entries — social proof is never fabricated (spec requirement).
    testimonials: stored.testimonials ?? [],
    faqs: stored.faqs ?? LANDING_DEFAULTS.faqs,
    customized: {
      hero: stored.hero !== undefined,
      howItWorks: stored.howItWorks !== undefined,
      testimonials: stored.testimonials !== undefined,
      faqs: stored.faqs !== undefined,
    },
  }
}
