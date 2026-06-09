import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

type FeedbackPayload = {
  orgId: string
  userId: string
  content: string
  inputType: 'text' | 'voice'
  timestamp: string
  source: 'admin-dashboard'
  appVersion: string
  schemaVersion: '1'
}

function isValidInput(body: unknown): body is { content: string; inputType: 'text' | 'voice' } {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.content === 'string' &&
    b.content.length > 0 &&
    b.content.length <= 2000 &&
    (b.inputType === 'text' || b.inputType === 'voice')
  )
}

export async function POST(req: Request): Promise<Response> {
  // 1. Verify session
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse and validate client input
  const body = await req.json().catch(() => null)
  if (!isValidInput(body)) {
    return Response.json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // 3. Build payload server-side (orgId + userId from session, not from client)
  const payload: FeedbackPayload = {
    orgId: 'platform',
    userId: session.user.id,
    content: body.content,
    inputType: body.inputType,
    timestamp: new Date().toISOString(),
    source: 'admin-dashboard',
    appVersion: process.env.npm_package_version ?? 'unknown',
    schemaVersion: '1',
  }

  // 4. Send to webhook or mock
  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      })
    } catch (err) {
      // Redact webhook URL from error message to prevent secret leakage in logs
      const errName = err instanceof Error ? err.name : 'UnknownError'
      console.error('[FeedbackWidget] webhook delivery failed:', errName)
    }
  } else {
    console.log('[FeedbackWidget] mock submit:', payload)
  }

  return Response.json({ ok: true })
}
