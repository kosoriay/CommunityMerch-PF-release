import { describe, it, expect } from "vitest"
import { imageFallback } from "./catalog-utils"

const CATALOG = "https://files.cdn.printful.com/products/71/4011.jpg"

describe("imageFallback", () => {
  it("falls back to the catalog photo when the mockup fails", () => {
    expect(imageFallback({
      currentSrc: "https://printful-upload.example/tmp/dead.png",
      fallbackUrl: CATALOG,
      alreadyFellBack: false,
    })).toEqual({ src: CATALOG })
  })

  it("hides the image only after the fallback itself has failed", () => {
    // 2回目で止めないと onError が再入して無限ループになる
    expect(imageFallback({
      currentSrc: CATALOG, fallbackUrl: CATALOG, alreadyFellBack: true,
    })).toEqual({ hide: true })
  })

  it("hides rather than re-assigning the same url", () => {
    expect(imageFallback({
      currentSrc: CATALOG, fallbackUrl: CATALOG, alreadyFellBack: false,
    })).toEqual({ hide: true })
  })

  it("hides when there is no catalog photo to fall back to", () => {
    expect(imageFallback({
      currentSrc: "https://x/dead.png", fallbackUrl: "", alreadyFellBack: false,
    })).toEqual({ hide: true })
  })

  it("hides once it has already fallen back, even when the src no longer matches", () => {
    // ブラウザでは img.src が絶対URLで読み戻るので、カタログ側が相対パスだと
    // currentSrc === fallbackUrl は外れる。そのとき onError の再入を止めるのは
    // このフラグだけである（設計 2026-09-11 §9）。
    expect(imageFallback({
      currentSrc: "https://printful-upload.example/tmp/dead.png",
      fallbackUrl: CATALOG,
      alreadyFellBack: true,
    })).toEqual({ hide: true })
  })
})
