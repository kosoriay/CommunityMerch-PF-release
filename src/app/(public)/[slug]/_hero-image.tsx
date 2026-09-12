"use client"

import { imageFallback } from "@/lib/catalog-utils"

/**
 * 公開ページの主画像。**`onError` を持たせるためだけのクライアント境界である。**
 *
 * `page.tsx` は async なサーバーコンポーネント（認証と DB を読む）なので、
 * `"use client"` を付けることはできない。要素1つだけを切り出すのがいちばん churn が
 * 小さく、同じディレクトリの `_admin-banner.tsx` と同じ形になる。
 *
 * 判定は `imageFallback` に任せる。**2つ目の判定関数を書かないこと** — 書くと、
 * 片方だけ直した修正が起きる（レビュー I2）。
 *
 * デザインプレビュー列には夜間バッチの修復経路が無い（設計 §10）。腐ったプレビュー
 * を抱えた既存キャンペーンでも、ここでアップロード済みのデザイン画像へ落ちる。
 */
export function CampaignHeroImage({
  src,
  fallbackUrl,
  alt,
}: {
  src: string
  fallbackUrl: string
  alt: string
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      className="max-h-80 object-contain rounded-lg"
      onError={(e) => {
        const img = e.currentTarget
        const next = imageFallback({
          currentSrc: img.src,
          fallbackUrl,
          alreadyFellBack: img.dataset.fellBack === "1",
        })
        if ("hide" in next) {
          img.style.display = "none"
          return
        }
        img.dataset.fellBack = "1"
        img.src = next.src
      }}
      onLoad={(e) => {
        // カード側（`_cart.tsx`）と同じ理由で戻す。命令的に書いた display と
        // dataset は React が戻さない（レビュー I1）。
        const img = e.currentTarget
        img.style.display = ""
        delete img.dataset.fellBack
      }}
    />
  )
}
