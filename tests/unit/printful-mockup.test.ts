import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock fetch globally before any imports that use it
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Ensure env var is set before module import
process.env.PRINTFUL_API_KEY = "test-key"

const { generateMockup } = await import("@/lib/providers/printful-mockup")

describe("generateMockup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("calls create-task with the given productId and variantId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { task_key: "task-abc" } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          status: "completed",
          mockups: [{ placement: "front", variant_ids: [4012], mockup_url: "https://cdn.example.com/mockup.jpg" }],
        },
      }),
    })

    const url = await generateMockup("https://example.com/design.png", 71, 4012)

    expect(url).toBe("https://cdn.example.com/mockup.jpg")
    const [createUrl, createOpts] = mockFetch.mock.calls[0]
    expect(createUrl).toContain("/mockup-generator/create-task/71")
    const body = JSON.parse(createOpts.body as string)
    expect(body.variant_ids).toEqual([4012])
  })

  it("uses a different productId and variantId when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { task_key: "task-xyz" } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          status: "completed",
          mockups: [{ placement: "front", variant_ids: [9427], mockup_url: "https://cdn.example.com/kids.jpg" }],
        },
      }),
    })

    const url = await generateMockup("https://example.com/design.png", 307, 9427)

    expect(url).toBe("https://cdn.example.com/kids.jpg")
    const [createUrl] = mockFetch.mock.calls[0]
    expect(createUrl).toContain("/mockup-generator/create-task/307")
  })

  it("throws when the API returns an error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Bad request",
    })

    await expect(
      generateMockup("https://example.com/design.png", 71, 4012)
    ).rejects.toThrow("Printful mockup task creation failed")
  })
})
