import "server-only"
import { uploadToR2 } from "@/lib/providers/r2"

/**
 * Printful のモックアップURLは `printful-upload.s3-accelerate.amazonaws.com/tmp/…`
 * という一時置き場を指し、**実測10日以下で 403 になる**（設計 2026-09-11 §1）。
 * 永続状態として保存できないので、生成直後に R2 へ複製してURLを差し替える。
 *
 * 規約 4.6 の用途制限（Printful 商品の広告・販売に限る）はそのまま守る。保持期間は
 * cron の分岐1が管理する（設計 §8.1）。
 */

/** `src/app/api/upload/route.ts` の上限に揃える。 */
export const MAX_MOCKUP_BYTES = 5 * 1024 * 1024

/** 拡張子は Content-Type から決める。ここに無い型は保存しない。 */
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

/**
 * R2 が設定されていない開発環境では複製しない（設計 D7）。`uploadToR2` は未設定だと
 * 例外を投げるので、呼ぶ前に判定する。
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  )
}

function slugifyColor(color: string): string {
  return color.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

/**
 * キーに uuid を入れる。決定的キーにすると再生成で同じURLに別の中身が載り、
 * `r2.dev` のキャッシュが古い画像を返し得る。古いコピーは孤児掃除が回収する（設計 §5.3）。
 */
export function campaignMockupKeyBase(
  campaignId: string,
  printfulVariantId: string,
  color: string
): string {
  return `mockups/${campaignId}/${printfulVariantId}-${slugifyColor(color)}-${crypto.randomUUID()}`
}

/**
 * デザインステップのプレビュー用。キャンペーンIDを鍵の一部にしない — このルートは
 * クライアントから呼ばれ、キャンペーンIDを信用できない（設計 §10）。
 */
export function designPreviewKeyBase(): string {
  return `mockups/design-previews/${crypto.randomUUID()}`
}

/**
 * 一時URLの中身を R2 に置き直し、永続URLを返す。**できなければ null を返す。**
 *
 * 失敗時に元の一時URLを返してはいけない。列に Printful のURLが入ると不変条件
 * （設計 §5.1）が破れ、cron の分岐2が毎晩貼り替えを試み続ける。
 *
 * `sourceUrl` は **Printful API のレスポンス由来のものだけ**を渡すこと。
 * クライアント由来のURLを渡せるようにすると SSRF になる（設計 §12.1）。
 */
export async function rehostMockup(sourceUrl: string, keyBase: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) {
      console.warn(`[mockup-rehost] source returned ${res.status}: ${sourceUrl}`)
      return null
    }

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    const ext = EXT_BY_TYPE[contentType]
    if (!ext) {
      console.warn(`[mockup-rehost] refusing content-type "${contentType}" for ${sourceUrl}`)
      return null
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_MOCKUP_BYTES) {
      console.warn(`[mockup-rehost] refusing ${buffer.byteLength} bytes for ${sourceUrl}`)
      return null
    }

    return await uploadToR2(`${keyBase}.${ext}`, buffer, contentType)
  } catch (err) {
    console.warn(`[mockup-rehost] failed for ${sourceUrl}:`, err)
    return null
  }
}
