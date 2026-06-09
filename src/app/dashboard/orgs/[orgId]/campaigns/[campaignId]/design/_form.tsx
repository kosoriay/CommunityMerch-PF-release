"use client"

import { useState, useRef, useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

type ActionState = { error?: string } | undefined

type Props = {
  orgId: string
  campaignId: string
  existingUrl: string | null
  existingMockupUrl: string | null
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
}

export function DesignForm({ orgId, campaignId, existingUrl, existingMockupUrl, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl)
  const [mockupUrl, setMockupUrl] = useState<string | null>(existingMockupUrl)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    setMockupUrl(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      setUploadedUrl(data.url!)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      setGenerateError("Please enter a prompt")
      return
    }
    setGenerating(true)
    setGenerateError(null)
    setMockupUrl(null)

    try {
      // Step 1: Generate AI design
      const genRes = await fetch("/api/ai-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      const genData = await genRes.json() as { url?: string; error?: string }
      if (!genRes.ok) throw new Error(genData.error ?? "AI generation failed")
      const designUrl = genData.url!
      setUploadedUrl(designUrl)

      // Step 2: Generate T-shirt mockup (non-fatal if fails)
      const mockRes = await fetch("/api/printful-mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designUrl }),
      })
      const mockData = await mockRes.json() as { mockupUrl?: string; error?: string }
      if (mockRes.ok && mockData.mockupUrl) {
        setMockupUrl(mockData.mockupUrl)
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  const isLoading = uploading || generating

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="designFileUrl" value={uploadedUrl ?? ""} />
      <input type="hidden" name="mockupUrl" value={mockupUrl ?? ""} />

      {state?.error && (
        <div className="text-sm text-red-600" role="alert">{state.error}</div>
      )}

      {/* AI Generation Section */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">✨ AI Design Generation</Label>
        <p className="text-sm text-muted-foreground">
          Describe your design and let AI create it. Results are transparent PNG, ready for printing.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Lincoln Elementary PTA 2026, school bear mascot, friendly"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            variant="outline"
          >
            {generating ? "Generating..." : "✨ Generate"}
          </Button>
        </div>
        {generateError && (
          <p className="text-sm text-red-600" role="alert">{generateError}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-muted-foreground">or upload your own</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Upload Section */}
      <div className="space-y-3">
        <Label>Logo / Design file</Label>
        <p className="text-sm text-muted-foreground">
          PNG, SVG, JPEG, WebP — max 5MB. Use a transparent background for best results.
        </p>

        {uploadedUrl ? (
          <div className="space-y-3">
            <div className="flex gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Design file</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedUrl}
                  alt="Design preview"
                  className="h-32 w-32 object-contain border rounded bg-slate-50"
                />
              </div>
              {mockupUrl && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">T-shirt preview</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mockupUrl}
                    alt="T-shirt mockup"
                    className="h-32 w-32 object-contain border rounded bg-slate-50"
                  />
                </div>
              )}
              {generating && (
                <div className="h-32 w-32 border rounded bg-slate-50 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground text-center">
                    Generating<br />mockup...
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-green-700">
                {generating ? "Generating mockup..." : "✓ Design ready"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setUploadedUrl(null)
                  setMockupUrl(null)
                  if (fileRef.current) fileRef.current.value = ""
                }}
                className="text-xs text-muted-foreground underline"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              id="file-upload"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            <Label
              htmlFor="file-upload"
              className="cursor-pointer text-sm text-blue-600 hover:underline font-medium"
            >
              {uploading ? "Uploading..." : "Click to upload logo"}
            </Label>
            <p className="text-xs text-muted-foreground mt-1">PNG, SVG, JPEG, WebP up to 5MB</p>
          </div>
        )}

        {uploadError && (
          <p className="text-sm text-red-600" role="alert">{uploadError}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isLoading || pending}>
          {pending ? "Saving..." : "Save & Continue →"}
        </Button>
        <Link
          href={`/dashboard/orgs/${orgId}/campaigns`}
          className={buttonVariants({ variant: "outline" })}
        >
          Save as draft
        </Link>
      </div>
    </form>
  )
}
