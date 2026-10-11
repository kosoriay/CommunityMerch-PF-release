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

/**
 * こちらが書き込む接頭辞。孤児掃除はここ以外を対象にしない。
 *
 * `mockups/` は 2026-09-11 に追加した。**同時に参照集合へモックアップ列を入れてある** —
 * 片方だけ入れると、生きている画像が7日後に消える。
 * 置き場所は `orphaned-uploads.ts` から移した（ここは依存ゼロなので、モック工場に
 * 左右されずに参照側と検知側が同じ値を使える）。
 */
export const SWEPT_PREFIXES = ["uploads/", "ai-designs/", "mockups/"] as const

/**
 * R2 を使うのに必要な環境変数。`getR2()`（providers/r2.ts）と `isR2Configured()`
 * （mockup-rehost.ts）が**同じ一覧**を読む。片方だけ増えて食い違うのを防ぐ。
 */
export const REQUIRED_R2_ENV_VARS = [
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET_NAME",
  "CLOUDFLARE_R2_PUBLIC_URL",
] as const

/** 画像の Content-Type と拡張子の対応。**唯一の表**（`/api/upload` と複製が共有する）。 */
export const EXT_BY_MIME: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
}

/** MIME から拡張子を決められないときの値。判定できなければ安全側（未知の拡張子）。 */
const FALLBACK_UPLOAD_EXT = "bin"

/** 正規の拡張子のほかに、利用者の綴りとして受け入れる別名。 */
const EXT_ALIASES_BY_MIME: Readonly<Record<string, readonly string[]>> = {
  "image/jpeg": ["jpeg"],
}

/**
 * `/api/upload` が R2 のキーに入れる拡張子。**ファイル名は信用せず、検証済みの MIME から
 * 決める。** ファイル名の拡張子は、`[a-z0-9]{1,8}` に収まり、かつその MIME と
 * 矛盾しないときだけ採る（`.html` を `image/png` に付けない）。ドットが無いときは
 * `"noext".split(".").pop()` が名前全体を返すので、ここで自前で判定する。
 */
export function uploadExtensionFor(fileName: string, mimeType: string): string {
  const canonical = EXT_BY_MIME[mimeType] ?? FALLBACK_UPLOAD_EXT
  const dot = fileName.lastIndexOf(".")
  if (dot < 0) return canonical

  const candidate = fileName.slice(dot + 1).toLowerCase()
  if (!/^[a-z0-9]{1,8}$/.test(candidate)) return canonical

  const accepted = [canonical, ...(EXT_ALIASES_BY_MIME[mimeType] ?? [])]
  return accepted.includes(candidate) ? candidate : canonical
}

/** 絶対URLの先頭 `https?://<host>/` に続く、こちらが書き込む接頭辞（ホストは問わない）。 */
const PATH_SHAPE_PATTERN = new RegExp(
  `(https?://[^/"\\\\\\s]+)/((?:${SWEPT_PREFIXES.map((p) => p.replace("/", "")).join("|")})/[^"\\\\]+)`,
  "g"
)

/** パーセント符号を復号する。不正な符号は生の値のまま返す（拾わないより良い）。 */
function decodeKey(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * 孤児掃除の「消さない」集合。**cron の削除リストには使わない**（それは
 * `referencedKeysFrom` のまま）。
 *
 * `CLOUDFLARE_R2_PUBLIC_URL` を変えると、旧ベースで保存されたURLが現行ベースの
 * 厳密な照合から漏れ、使用中のファイルが7日後に消える（`designs.design_file_url` は
 * Printful へ送るので注文が止まる）。そこで、**ホストを問わず**パスが
 * `SWEPT_PREFIXES` で始まる絶対URLのキーも足す。途中の `/a/uploads/` と、ホストの
 * 無い相対パスは対象外。多めに拾うのは安全（消さないだけ）。`publicUrl` が null でも
 * 走らせる — 保護は集合に足すだけなので、設定が欠けたときも倒れる向きが安全側になる。
 *
 * `pathOnlyCount` = 現行ベースでは説明できず、パスの形だけで拾えたキーの数。
 * 非ゼロは「ベースが変わった形跡」。ここではログを出さない（呼び出し側の仕事）。
 *
 * **既知の穴（バグではなく、緩い走査の限界）:**
 * - JSON エスケープされた `https:\/\/`（スラッシュが `\/`）は拾えない
 * - スキームの大文字（`HTTPS://`）は拾えない
 * - スキーム相対 `//host/uploads/...` は拾えない
 * - 旧ベース自身がパス区間を含む場合（`https://h/media/uploads/x`）は途中一致なので拾えない
 * - 無関係なホストの `uploads/`・`ai-designs/`・`mockups/` パスも「パスの形だけ」に数える。
 *   警告はノイズになり得る（件数は目安）
 */
export function collectProtectedKeys(
  rawValues: (string | null | undefined)[],
  publicUrl: string | null
): { keys: Set<string>; pathOnlyCount: number } {
  const strictKeys = referencedKeysFrom(rawValues, publicUrl)
  const keys = new Set(strictKeys)
  const currentBaseKeys = new Set<string>()
  const foreignKeys = new Set<string>()

  for (const raw of rawValues) {
    if (!raw) continue
    for (const match of raw.matchAll(PATH_SHAPE_PATTERN)) {
      const captured = match[2]
      // 厳密側と同じ流儀: 生の値・trim 版・`?`/`#` を除いた版を、復号して全部入れる。
      // 数えるのは除いた版（= キー本体）だけ。同じURLを二重に数えない
      const stripped = captured.split(/[?#]/)[0]
      const bare = decodeKey(stripped)
      for (const variant of [captured, captured.trim(), stripped, stripped.trim()]) {
        if (variant) keys.add(decodeKey(variant))
      }
      const isCurrentBase = publicUrl !== null && match[1] === publicUrl
      ;(isCurrentBase ? currentBaseKeys : foreignKeys).add(bare)
    }
  }

  // 現行ベースの照合（厳密側を含む）で説明できないものだけを数える
  let pathOnlyCount = 0
  for (const key of foreignKeys) {
    if (!strictKeys.has(key) && !currentBaseKeys.has(key)) pathOnlyCount += 1
  }

  return { keys, pathOnlyCount }
}
