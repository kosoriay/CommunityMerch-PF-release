import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { uploadToR2 } from "@/lib/providers/r2"

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be PNG, JPEG, SVG, or WebP" }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split(".").pop() ?? "png"
  const key = `uploads/${crypto.randomUUID()}.${ext}`

  const url = await uploadToR2(key, buffer, file.type)
  return NextResponse.json({ url })
}
