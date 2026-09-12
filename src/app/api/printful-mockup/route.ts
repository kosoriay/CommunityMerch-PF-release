import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { generateMockup } from "@/lib/providers/printful-mockup"
import { rehostMockup, designPreviewKeyBase, isR2Configured } from "@/lib/mockup-rehost"

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let designUrl: string
  let printfulProductId: number
  let variantId: number
  try {
    const body = await request.json() as { designUrl?: string; printfulProductId?: number; variantId?: number }
    designUrl = body.designUrl ?? ""
    printfulProductId = body.printfulProductId ?? 0
    variantId = body.variantId ?? 0
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!designUrl) {
    return NextResponse.json({ error: "designUrl is required" }, { status: 400 })
  }
  if (!printfulProductId || !variantId) {
    return NextResponse.json({ error: "printfulProductId and variantId are required" }, { status: 400 })
  }

  try {
    const mockupUrl = await generateMockup(designUrl, printfulProductId, variantId)

    // Printful が返すのは一時置き場のURLで、実測10日以下で 403 になる。この列には
    // 再生成経路が無いので（設計 §10）、ここで複製しないと永久に腐る。
    if (!isR2Configured()) return NextResponse.json({ mockupUrl })

    const durable = await rehostMockup(mockupUrl, designPreviewKeyBase())
    if (!durable) {
      return NextResponse.json({ error: "Mockup generation failed" }, { status: 502 })
    }
    return NextResponse.json({ mockupUrl: durable })
  } catch (err) {
    console.error("[printful-mockup] generation failed:", err)
    return NextResponse.json({ error: "Mockup generation failed" }, { status: 502 })
  }
}
