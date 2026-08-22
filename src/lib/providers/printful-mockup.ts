const BASE_URL = "https://api.printful.com"
const AUTH = `Bearer ${process.env.PRINTFUL_API_KEY}`

type MockupTaskResult = {
  status: "pending" | "processing" | "completed" | "failed"
  mockups?: Array<{
    placement: string
    variant_ids: number[]
    mockup_url: string
  }>
}

async function createMockupTask(
  printfulProductId: number,
  variantIds: number[],
  designUrl: string
): Promise<string> {
  // placement と印刷領域はアパレル前面の寸法である。マグ・帽子・トートには
  // 合わないので、それらには色別モックアップを作らない（mockup-generator.ts が
  // 弾き、mockup_attempted_at を打って cron を収束させる）。
  // per-product placement は別件（設計 §8.4 / §15）。
  const body = {
    variant_ids: variantIds,
    files: [
      {
        placement: "front",
        image_url: designUrl,
        position: {
          area_width: 1800,
          area_height: 2400,
          width: 1500,
          height: 1500,
          top: 400,
          left: 150,
        },
      },
    ],
  }

  const res = await fetch(`${BASE_URL}/mockup-generator/create-task/${printfulProductId}`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Printful mockup task creation failed: ${res.status} ${err}`)
  }
  const data = await res.json() as { result: { task_key: string } }
  return data.result.task_key
}

async function pollMockupTask(taskKey: string, maxAttempts = 15): Promise<Map<number, string>> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000))

    const res = await fetch(`${BASE_URL}/mockup-generator/task?task_key=${taskKey}`, {
      headers: { Authorization: AUTH },
    })
    if (!res.ok) throw new Error(`Printful mockup poll failed: ${res.status}`)

    const data = await res.json() as { result: MockupTaskResult }
    const { status, mockups } = data.result

    if (status === "completed" && mockups && mockups.length > 0) {
      // 返却順は要求順と一致しない（実測 2026-08-19、設計 §5.3）。
      const byVariant = new Map<number, string>()
      for (const mockup of mockups) {
        if (mockup.placement !== "front") continue
        for (const variantId of mockup.variant_ids) byVariant.set(variantId, mockup.mockup_url)
      }
      return byVariant
    }
    if (status === "failed") throw new Error("Printful mockup generation failed")
  }
  throw new Error("Printful mockup timed out after 30 seconds")
}

export async function generateMockups(
  designUrl: string, printfulProductId: number, variantIds: number[]
): Promise<Map<number, string>> {
  if (variantIds.length === 0) return new Map()
  const taskKey = await createMockupTask(printfulProductId, variantIds, designUrl)
  return pollMockupTask(taskKey)
}

/** 単数版。`/api/printful-mockup` のデザイン工程が使っている。 */
export async function generateMockup(
  designUrl: string, printfulProductId: number, variantId: number
): Promise<string> {
  const url = (await generateMockups(designUrl, printfulProductId, [variantId])).get(variantId)
  if (!url) throw new Error(`Printful returned no front mockup for variant ${variantId}`)
  return url
}
