/**
 * R2 の公開URLについての純粋な判定。**依存を持たない。**
 *
 * cron・孤児掃除・デザイン保存がこれを使う。それぞれのテストは
 * `@/lib/providers/r2` などを部分的なモック工場で差し替えているので、依存を持つ
 * モジュールに置くと、述語に関心の無いテストにまでモックの追従が伝播する。
 */

/**
 * そのURLを保存してよいか。**自前ホストのものだけを受け入れる。**
 *
 * `publicUrl` が null（R2 未設定）なら判定しない（設計 D7）。開発環境では
 * `/api/printful-mockup` が Printful の一時URLを返すので、拒むと進めなくなる。
 */
export function acceptableMockupUrl(
  url: string | null | undefined,
  publicUrl: string | null
): boolean {
  if (!url) return true
  if (!publicUrl) return true
  return url.startsWith(`${publicUrl}/`)
}

/**
 * `designs.mockup_url` に何を残すか。**保存できない値は null にする。**
 *
 * ここが「決めるべきだったのに決めていなかった」一点である。提出されたプレビュー
 * URLが保存できず、代わりも来なかったとき列は何になるか — 答えは null。死んだ
 * プレビューはプレビュー無しより価値が低く、残せば壊れた画像が永久に残る。
 *
 * **既存の値も検査する。** このブランチ以前、この列に入っていたのは Printful の
 * 一時URLだけだった。`incoming ?? existing` で書き戻すと腐った値が毎回復活し、
 * 列は決して直らない（レビュー C1）。
 *
 * `publicUrl` が null（R2 未設定）なら `acceptableMockupUrl` が全部通すので、
 * 開発環境では `incoming ?? existing` と同じ振る舞いになる。
 */
export function resolveStoredMockupUrl(
  incoming: string | null | undefined,
  existing: string | null | undefined,
  publicUrl: string | null
): string | null {
  if (incoming && acceptableMockupUrl(incoming, publicUrl)) return incoming
  if (existing && acceptableMockupUrl(existing, publicUrl)) return existing
  return null
}

/**
 * `mockup_urls` の値が自前ホストでない ＝ 貼り替えが必要。cron の分岐2が使う。
 *
 * **迷ったら「貼り替える」に倒す。** JSON が壊れている・空である場合も true。
 * 貼り替えは冪等で失敗しても翌日また試せるので、取りこぼすほうが害が大きい。
 *
 * 未生成（null）は false。それは分岐4の担当である。
 */
export function needsRehost(mockupUrls: string | null, publicUrl: string | null): boolean {
  if (!publicUrl) return false
  if (!mockupUrls) return false

  let parsed: unknown
  try {
    parsed = JSON.parse(mockupUrls)
  } catch {
    return true
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return true

  const values = Object.values(parsed as Record<string, unknown>)
  if (values.length === 0) return true

  return values.some((v) => typeof v !== "string" || !acceptableMockupUrl(v, publicUrl))
}

/**
 * 文字列から自前ホストのキーを全部拾う。
 *
 * **`JSON.parse` を使わない。** `mockup_urls` は JSON だが、壊れていたときに参照を
 * 取りこぼすと、生きている画像を孤児と判定して消す。ここは「多めに拾う」側へ倒す
 * （`needsRehost` は逆に「貼り替える」側へ倒す — 取りこぼしても再生成で済むから。
 * **倒す向きが逆であることが重要。**）
 *
 * **キーは1つ足りないと生きたファイルを消し、1つ多くても何も壊れない。** だから
 * 判定に迷う値は「捨てる」のではなく「両方入れる」。捕捉した生の値と、それを
 * trim した値が異なるなら、両方とも集合に加える —— ファイル名自体が空白で終わる
 * キー（trim すると別物になる）と、キー本体ではない空白が前後に付いた値
 * （trim しないと別物になる）のどちらも実際に起こり、ここではどちらが本物かを
 * 判定できない。多めに拾った分は掃除が1件スキップされるだけで安全である。
 */
export function referencedKeysFrom(
  rawValues: (string | null | undefined)[],
  publicUrl: string | null
): Set<string> {
  const keys = new Set<string>()
  if (!publicUrl) return keys

  const escaped = publicUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // JSON 文字列の終端（`"` と `\`）だけで止める。**空白やアポストロフィで止めては
  // いけない。** キーの末尾は利用者のファイル名そのものである（`api/upload/route.ts`
  // が `uploads/<uuid>.<元ファイル名の拡張子>` を作り、符号化しない）。空白で止めると
  // キーが半分しか拾えず、参照集合から漏れた**生きている印刷用ファイル**が7日後に
  // 消えていた（レビュー I4）。多めに拾う側が安全な側である。
  const pattern = new RegExp(`${escaped}/([^"\\\\]+)`, "g")

  const addDecoded = (value: string) => {
    try {
      keys.add(decodeURIComponent(value))
    } catch {
      // 不正なパーセント符号。生の値のまま入れる（拾わないより良い）
      keys.add(value)
    }
  }

  for (const raw of rawValues) {
    if (!raw) continue
    for (const match of raw.matchAll(pattern)) {
      const captured = match[1]
      addDecoded(captured)
      const trimmed = captured.trim()
      if (trimmed && trimmed !== captured) addDecoded(trimmed)
    }
  }

  return keys
}
