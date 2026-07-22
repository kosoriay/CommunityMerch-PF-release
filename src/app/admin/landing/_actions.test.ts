import { describe, it, expect, vi, beforeEach } from "vitest"

const getSession = vi.fn()
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
const revalidatePath = vi.fn()
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))
const updateLandingContent = vi.fn()
vi.mock("@/lib/landing-content-db", () => ({
  updateLandingContent: (...args: unknown[]) => updateLandingContent(...args),
}))

import { saveLandingContentAction } from "./_actions"

function formWith(content: string): FormData {
  const fd = new FormData()
  fd.set("content", content)
  return fd
}

beforeEach(() => {
  getSession.mockReset()
  updateLandingContent.mockReset()
  revalidatePath.mockReset()
})

describe("saveLandingContentAction", () => {
  it("rejects when there is no session", async () => {
    getSession.mockResolvedValue(null)
    const result = await saveLandingContentAction({}, formWith("{}"))
    expect(result.error).toBeTruthy()
    expect(updateLandingContent).not.toHaveBeenCalled()
  })

  it("rejects non-admin platform staff", async () => {
    getSession.mockResolvedValue({ user: { platformRole: "platform_staff" } })
    const result = await saveLandingContentAction({}, formWith("{}"))
    expect(result.error).toBeTruthy()
    expect(updateLandingContent).not.toHaveBeenCalled()
  })

  it("rejects invalid JSON", async () => {
    getSession.mockResolvedValue({ user: { platformRole: "platform_admin" } })
    const result = await saveLandingContentAction({}, formWith("{oops"))
    expect(result.error).toBeTruthy()
    expect(updateLandingContent).not.toHaveBeenCalled()
  })

  it("rejects content that fails validation", async () => {
    getSession.mockResolvedValue({ user: { platformRole: "platform_admin" } })
    const result = await saveLandingContentAction(
      {},
      formWith(JSON.stringify({ howItWorks: [] }))
    )
    expect(result.error).toBeTruthy()
    expect(updateLandingContent).not.toHaveBeenCalled()
  })

  it("saves a valid sparse document and revalidates /", async () => {
    getSession.mockResolvedValue({ user: { platformRole: "platform_admin" } })
    const doc = { hero: { headline: "Hi" } }
    const result = await saveLandingContentAction({}, formWith(JSON.stringify(doc)))
    expect(result).toEqual({ saved: true })
    expect(updateLandingContent).toHaveBeenCalledWith(doc)
    expect(revalidatePath).toHaveBeenCalledWith("/")
  })
})
