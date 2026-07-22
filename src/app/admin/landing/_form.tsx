"use client"

import { useActionState, useState } from "react"
import {
  LANDING_DEFAULTS,
  type LandingFaq,
  type LandingStep,
  type LandingTestimonial,
  type StoredLandingContent,
} from "@/lib/landing-content"
import { Button } from "@/components/ui/button"
import { saveLandingContentAction, type SaveState } from "./_actions"

type HeroValue = { headline: string; subtext: string; ctaLabel: string }
type Section<T> = { customized: boolean; value: T }

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function SectionHeader({
  title,
  customized,
  onReset,
}: {
  title: string
  customized: boolean
  onReset: () => void
}) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <h2 className="font-semibold">{title}</h2>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            customized ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"
          }`}
        >
          {customized ? "Customized" : "Default"}
        </span>
        {customized ? (
          <button type="button" onClick={onReset} className="text-xs text-blue-600 hover:underline">
            Reset to default
          </button>
        ) : null}
      </div>
    </div>
  )
}

const inputClass = "w-full border rounded-md px-3 py-2 text-sm"

export function LandingEditorForm({ stored }: { stored: StoredLandingContent }) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    saveLandingContentAction,
    {}
  )

  const [hero, setHero] = useState<Section<HeroValue>>(() => ({
    customized: stored.hero !== undefined,
    value: {
      headline: stored.hero?.headline ?? LANDING_DEFAULTS.hero.headline,
      subtext: stored.hero?.subtext ?? LANDING_DEFAULTS.hero.subtext,
      ctaLabel: stored.hero?.ctaLabel ?? LANDING_DEFAULTS.hero.ctaLabel,
    },
  }))
  const [steps, setSteps] = useState<Section<LandingStep[]>>(() => ({
    customized: stored.howItWorks !== undefined,
    value: stored.howItWorks ?? [...LANDING_DEFAULTS.howItWorks],
  }))
  const [testimonials, setTestimonials] = useState<Section<LandingTestimonial[]>>(() => ({
    customized: stored.testimonials !== undefined,
    value: stored.testimonials ?? [],
  }))
  const [faqs, setFaqs] = useState<Section<LandingFaq[]>>(() => ({
    customized: stored.faqs !== undefined,
    value: stored.faqs ?? [...LANDING_DEFAULTS.faqs],
  }))

  // Sparse document: only customized sections are persisted (design D2).
  const doc: StoredLandingContent = {
    ...(hero.customized ? { hero: hero.value } : {}),
    ...(steps.customized ? { howItWorks: steps.value } : {}),
    ...(testimonials.customized ? { testimonials: testimonials.value } : {}),
    ...(faqs.customized ? { faqs: faqs.value } : {}),
  }

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      <input type="hidden" name="content" value={JSON.stringify(doc)} />

      {/* Hero */}
      <section className="bg-white rounded-lg border">
        <SectionHeader
          title="Hero"
          customized={hero.customized}
          onReset={() => setHero({ customized: false, value: { ...LANDING_DEFAULTS.hero } })}
        />
        <div className="p-4 space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Headline</span>
            <input
              className={`${inputClass} mt-1`}
              value={hero.value.headline}
              onChange={(e) =>
                setHero({ customized: true, value: { ...hero.value, headline: e.target.value } })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Subtext</span>
            <textarea
              className={`${inputClass} mt-1`}
              rows={3}
              value={hero.value.subtext}
              onChange={(e) =>
                setHero({ customized: true, value: { ...hero.value, subtext: e.target.value } })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">CTA button label</span>
            <input
              className={`${inputClass} mt-1`}
              value={hero.value.ctaLabel}
              onChange={(e) =>
                setHero({ customized: true, value: { ...hero.value, ctaLabel: e.target.value } })
              }
            />
          </label>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white rounded-lg border">
        <SectionHeader
          title="How it works (3 steps)"
          customized={steps.customized}
          onReset={() => setSteps({ customized: false, value: [...LANDING_DEFAULTS.howItWorks] })}
        />
        <div className="p-4 space-y-4">
          {steps.value.map((step, i) => (
            <div key={i} className="border rounded-md p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Step {i + 1}</p>
              <input
                className={inputClass}
                placeholder="Title"
                value={step.title}
                onChange={(e) =>
                  setSteps({
                    customized: true,
                    value: steps.value.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)),
                  })
                }
              />
              <textarea
                className={inputClass}
                rows={2}
                placeholder="Description"
                value={step.description}
                onChange={(e) =>
                  setSteps({
                    customized: true,
                    value: steps.value.map((s, j) =>
                      j === i ? { ...s, description: e.target.value } : s
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white rounded-lg border">
        <SectionHeader
          title="Testimonials"
          customized={testimonials.customized}
          onReset={() => setTestimonials({ customized: false, value: [] })}
        />
        <div className="p-4 space-y-4">
          {testimonials.value.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No testimonials yet — the section stays hidden on the landing page until you add one.
            </p>
          ) : null}
          {testimonials.value.map((t, i) => (
            <div key={i} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">#{i + 1}</p>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      const next = move(testimonials.value, i, i - 1)
                      if (next !== testimonials.value) setTestimonials({ customized: true, value: next })
                    }}
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      const next = move(testimonials.value, i, i + 1)
                      if (next !== testimonials.value) setTestimonials({ customized: true, value: next })
                    }}
                  >
                    ↓ Down
                  </button>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() =>
                      setTestimonials({
                        customized: true,
                        value: testimonials.value.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
              <input
                className={inputClass}
                placeholder="Name"
                value={t.name}
                onChange={(e) =>
                  setTestimonials({
                    customized: true,
                    value: testimonials.value.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    ),
                  })
                }
              />
              <input
                className={inputClass}
                placeholder="Title — e.g. PTA President, Lincoln Elementary (optional)"
                value={t.title ?? ""}
                onChange={(e) =>
                  setTestimonials({
                    customized: true,
                    value: testimonials.value.map((x, j) =>
                      j === i ? { ...x, title: e.target.value } : x
                    ),
                  })
                }
              />
              <textarea
                className={inputClass}
                rows={3}
                placeholder="Quote"
                value={t.quote}
                onChange={(e) =>
                  setTestimonials({
                    customized: true,
                    value: testimonials.value.map((x, j) =>
                      j === i ? { ...x, quote: e.target.value } : x
                    ),
                  })
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setTestimonials({
                customized: true,
                value: [...testimonials.value, { name: "", title: "", quote: "" }],
              })
            }
          >
            + Add testimonial
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white rounded-lg border">
        <SectionHeader
          title="FAQ"
          customized={faqs.customized}
          onReset={() => setFaqs({ customized: false, value: [...LANDING_DEFAULTS.faqs] })}
        />
        <div className="p-4 space-y-4">
          {faqs.value.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No FAQs — the section stays hidden on the landing page.
            </p>
          ) : null}
          {faqs.value.map((f, i) => (
            <div key={i} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">#{i + 1}</p>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      const next = move(faqs.value, i, i - 1)
                      if (next !== faqs.value) setFaqs({ customized: true, value: next })
                    }}
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      const next = move(faqs.value, i, i + 1)
                      if (next !== faqs.value) setFaqs({ customized: true, value: next })
                    }}
                  >
                    ↓ Down
                  </button>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() =>
                      setFaqs({ customized: true, value: faqs.value.filter((_, j) => j !== i) })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
              <input
                className={inputClass}
                placeholder="Question"
                value={f.question}
                onChange={(e) =>
                  setFaqs({
                    customized: true,
                    value: faqs.value.map((x, j) =>
                      j === i ? { ...x, question: e.target.value } : x
                    ),
                  })
                }
              />
              <textarea
                className={inputClass}
                rows={2}
                placeholder="Answer"
                value={f.answer}
                onChange={(e) =>
                  setFaqs({
                    customized: true,
                    value: faqs.value.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)),
                  })
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setFaqs({
                customized: true,
                value: [...faqs.value, { question: "", answer: "" }],
              })
            }
          >
            + Add FAQ
          </Button>
        </div>
      </section>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-green-600">Saved. The landing page is updated.</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}
