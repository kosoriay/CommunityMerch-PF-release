// src/lib/feedback.ts

export type ClientFeedbackInput = {
  content: string
  inputType: 'text' | 'voice'
}

export async function submitFeedback(input: ClientFeedbackInput): Promise<void> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw new Error(`Feedback submission failed: ${res.status}`)
  }
}
