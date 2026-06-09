import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth before importing the route
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

import { POST } from '@/app/api/feedback/route'
import { auth } from '@/lib/auth'

const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    platformRole: 'platform_staff',
  },
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/feedback', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const res = await POST(makeRequest({ content: 'hello', inputType: 'text' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 for empty content', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as never)

    const res = await POST(makeRequest({ content: '', inputType: 'text' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 400 for invalid inputType', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as never)

    const res = await POST(makeRequest({ content: 'hello', inputType: 'invalid' }))

    expect(res.status).toBe(400)
  })

  it('returns 200 and logs mock when FEEDBACK_WEBHOOK_URL is not set', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as never)
    delete process.env.FEEDBACK_WEBHOOK_URL

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const res = await POST(makeRequest({ content: 'great feature!', inputType: 'text' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[FeedbackWidget] mock submit:',
      expect.objectContaining({
        userId: 'user-123',
        content: 'great feature!',
        inputType: 'text',
        schemaVersion: '1',
        source: 'admin-dashboard',
      })
    )
  })
})
