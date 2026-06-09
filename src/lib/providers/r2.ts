import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

// Lazy initialization — env vars read at call time, not module load time
// (Turbopack compiles modules before runtime env vars are available)
let _r2: S3Client | null = null
let _bucket: string | null = null
let _publicUrl: string | null = null

function getR2() {
  if (!_r2) {
    if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID) throw new Error("CLOUDFLARE_R2_ACCOUNT_ID is required")
    if (!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) throw new Error("CLOUDFLARE_R2_ACCESS_KEY_ID is required")
    if (!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) throw new Error("CLOUDFLARE_R2_SECRET_ACCESS_KEY is required")
    if (!process.env.CLOUDFLARE_R2_BUCKET_NAME) throw new Error("CLOUDFLARE_R2_BUCKET_NAME is required")
    if (!process.env.CLOUDFLARE_R2_PUBLIC_URL) throw new Error("CLOUDFLARE_R2_PUBLIC_URL is required")

    _r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    })
    _bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME
    _publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, "")
  }
  return { r2: _r2, bucket: _bucket!, publicUrl: _publicUrl! }
}

export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const { r2, bucket, publicUrl } = getR2()
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))
  return `${publicUrl}/${key}`
}
