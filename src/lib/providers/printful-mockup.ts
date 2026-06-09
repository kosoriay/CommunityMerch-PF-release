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
  variantId: number,
  designUrl: string
): Promise<string> {
  const body = {
    variant_ids: [variantId],
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

async function pollMockupTask(taskKey: string, maxAttempts = 15): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000))

    const res = await fetch(`${BASE_URL}/mockup-generator/task?task_key=${taskKey}`, {
      headers: { Authorization: AUTH },
    })
    if (!res.ok) throw new Error(`Printful mockup poll failed: ${res.status}`)

    const data = await res.json() as { result: MockupTaskResult }
    const { status, mockups } = data.result

    if (status === "completed" && mockups && mockups.length > 0) {
      const frontMockup = mockups.find((m) => m.placement === "front") ?? mockups[0]
      return frontMockup.mockup_url
    }
    if (status === "failed") throw new Error("Printful mockup generation failed")
  }
  throw new Error("Printful mockup timed out after 30 seconds")
}

export async function generateMockup(
  designUrl: string,
  printfulProductId: number,
  variantId: number
): Promise<string> {
  const taskKey = await createMockupTask(printfulProductId, variantId, designUrl)
  return pollMockupTask(taskKey)
}
