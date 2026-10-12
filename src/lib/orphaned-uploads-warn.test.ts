import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/client", () => ({ db: { select: vi.fn() } }))
vi.mock("@/lib/providers/r2", () => ({
  r2PublicUrlOrNull: vi.fn(() => "https://pub-abc.r2.dev"),
  deleteFromR2: vi.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
  listR2Objects: vi.fn().mockResolvedValue([]),
}))

import { sweepOrphanedUploads, SWEPT_PREFIXES } from "./orphaned-uploads"
import { SWEPT_PREFIXES as SOURCE_PREFIXES } from "./r2-keys"
import { db } from "@/lib/db/client"
import { listR2Objects, r2PublicUrlOrNull } from "@/lib/providers/r2"

const PUB = "https://pub-abc.r2.dev"
const OLD = "https://pub-old.r2.dev"
const NOW = new Date("2026-08-16T12:00:00Z")
const DAY = 86_400_000

/** designs.design_file_url に `file` を1行だけ置く。ほかの表は空。 */
function armDesignFile(file: string) {
  vi.mocked(r2PublicUrlOrNull).mockReturnValue(PUB)
  vi.mocked(db.select)
    .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([{ file, mockup: null }]) } as never)
    .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([]) } as never)
    .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([]) } as never)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listR2Objects).mockResolvedValue([])
})

describe("sweepOrphanedUploads base-change detection", () => {
  it("re-exports SWEPT_PREFIXES from its new home", () => {
    expect(SWEPT_PREFIXES).toBe(SOURCE_PREFIXES)
  })

  it("warns exactly once, naming the env var, when a reference matches by path shape only", async () => {
    armDesignFile(`${OLD}/uploads/live.png`)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await sweepOrphanedUploads(NOW, { dryRun: true })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain("CLOUDFLARE_R2_PUBLIC_URL")
    warn.mockRestore()
  })

  it("is silent when every reference is on the current base", async () => {
    armDesignFile(`${PUB}/uploads/live.png`)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await sweepOrphanedUploads(NOW, { dryRun: true })

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("does not select an old-base file that a design still points at", async () => {
    armDesignFile(`${OLD}/uploads/live.png`)
    vi.mocked(listR2Objects).mockImplementation(async (prefix: string) =>
      prefix === "uploads/"
        ? [
            { key: "uploads/live.png", lastModified: new Date(NOW.getTime() - 100 * DAY) },
            { key: "uploads/dead.png", lastModified: new Date(NOW.getTime() - 100 * DAY) },
          ]
        : []
    )
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await sweepOrphanedUploads(NOW, { dryRun: true })

    expect(result.keys).toEqual(["uploads/dead.png"])
    warn.mockRestore()
  })
})
