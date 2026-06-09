import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { generateMockup } from "@/lib/providers/printful-mockup"

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
    return NextResponse.json({ mockupUrl })
  } catch (err) {
    console.error("[printful-mockup] generation failed:", err)
    return NextResponse.json({ error: "Mockup generation failed" }, { status: 502 })
  }
}
