import OpenAI from "openai"
import type { ImagesResponse } from "openai/resources/images"

// Lazily instantiated — validatePrompt is a pure function and must not require the key at import time.
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required")
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

const BLOCKED_TERMS = [
  "disney", "mickey", "minnie", "frozen", "elsa", "marvel", "spider-man", "batman",
  "superman", "avengers", "dc comics", "pokemon", "pikachu", "nintendo", "mario",
  "nfl", "nba", "mlb", "nhl", "fifa", "uefa", "olympics",
  "nike", "adidas", "under armour", "apple", "google", "facebook", "instagram",
  "coca-cola", "pepsi", "starbucks", "mcdonalds",
]

export type PromptValidation = { valid: true } | { valid: false; reason: string }

export function validatePrompt(prompt: string): PromptValidation {
  if (prompt.trim().length < 5) {
    return { valid: false, reason: "Prompt is too short (minimum 5 characters)" }
  }
  if (prompt.length > 500) {
    return { valid: false, reason: "Prompt is too long (maximum 500 characters)" }
  }
  const lower = prompt.toLowerCase()
  for (const term of BLOCKED_TERMS) {
    if (lower.includes(term)) {
      return {
        valid: false,
        reason: `"${term}" references copyrighted IP and cannot be used. Describe the concept instead.`,
      }
    }
  }
  return { valid: true }
}

export async function generateDesignImage(prompt: string): Promise<Buffer> {
  const enhancedPrompt = `${prompt}. Flat vector graphic design suitable for custom merchandise and t-shirt printing. Bold, clean lines. Minimal colors.`

  const client = getOpenAI()
  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt: enhancedPrompt,
    n: 1,
    size: "1024x1024",
    background: "transparent",
    output_format: "png",
  } as Parameters<typeof client.images.generate>[0]) as ImagesResponse

  const b64 = response.data?.[0]?.b64_json
  if (!b64) throw new Error("OpenAI returned no image data")
  return Buffer.from(b64, "base64")
}
