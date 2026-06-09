import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { auth } from "@/lib/auth"
import { validatePrompt, generateDesignImage } from "@/lib/providers/openai"

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let prompt: string
  try {
    const body = await request.json() as { prompt?: string }
    prompt = (body.prompt ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const validation = validatePrompt(prompt)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: 400 })
  }

  const imageBuffer = await generateDesignImage(prompt)
  const filename = `${crypto.randomUUID()}.png`

  // Use R2 if configured, otherwise fall back to local public/uploads/ for development
  if (process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
    const { uploadToR2 } = await import("@/lib/providers/r2")
    const key = `ai-designs/${filename}`
    const url = await uploadToR2(key, imageBuffer, "image/png")
    return NextResponse.json({ url })
  } else {
    // Dev fallback: save to public/uploads/
    const uploadDir = join(process.cwd(), "public", "uploads")
    await mkdir(uploadDir, { recursive: true })
    await writeFile(join(uploadDir, filename), imageBuffer)
    return NextResponse.json({ url: `/uploads/${filename}` })
  }
}
