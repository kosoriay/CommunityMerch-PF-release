'use client'

import { useState, useRef, useSyncExternalStore } from 'react'
import { MessageCircle, Mic, MicOff, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { submitFeedback } from '@/lib/feedback'

// Neither SpeechRecognition nor webkitSpeechRecognition are guaranteed in the TS DOM lib
declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition
    webkitSpeechRecognition?: new () => ISpeechRecognition
  }
}

interface ISpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: ISpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

interface ISpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

// SpeechRecognition availability is fixed for the page's lifetime; a no-op subscribe is sufficient.
const subscribeSpeechSupport = () => () => {}
const getSpeechSupported = () =>
  !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const isSpeechSupported = useSyncExternalStore(
    subscribeSpeechSupport,
    getSpeechSupported,
    () => false,
  )
  const [status, setStatus] = useState<Status>('idle')
  const [lastInputType, setLastInputType] = useState<'text' | 'voice'>('text')
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  const startRecording = () => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'ja-JP'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e) => {
      setContent((prev) => prev + e.results[0][0].transcript)
      setLastInputType('voice')
      setIsRecording(false)
    }
    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)
    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  const handleSubmit = async () => {
    if (!content.trim() || status === 'sending') return
    setStatus('sending')
    try {
      await submitFeedback({ content: content.trim(), inputType: lastInputType })
      setStatus('sent')
      setContent('')
      setTimeout(() => {
        setStatus('idle')
        setIsOpen(false)
      }, 2000)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="bg-white rounded-xl border shadow-lg p-4 w-72 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">フィードバックを送る</p>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close feedback"
            >
              <X size={16} />
            </button>
          </div>

          {status === 'sent' ? (
            <p className="text-center text-sm py-4 text-muted-foreground">
              送信しました！ありがとうございます 🙏
            </p>
          ) : (
            <>
              <textarea
                className="w-full text-sm border rounded-lg p-2 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="気づいたことをどうぞ..."
                value={content}
                onChange={(e) => { setContent(e.target.value); setLastInputType('text') }}
              />

              <div className="flex items-center gap-2">
                {isSpeechSupported && (
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    title={isRecording ? 'Stop recording' : 'Voice input'}
                    aria-label={isRecording ? 'Stop recording' : 'Voice input'}
                    className={`p-2 rounded-full border transition-colors ${
                      isRecording
                        ? 'text-red-500 border-red-300 animate-pulse'
                        : 'text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                )}
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={handleSubmit}
                  disabled={!content.trim() || status === 'sending'}
                >
                  <Send size={14} className="mr-1" />
                  {status === 'sending' ? '送信中...' : '送信'}
                </Button>
              </div>

              {status === 'error' && (
                <p className="text-xs text-red-500">
                  送信に失敗しました。もう一度お試しください。
                </p>
              )}
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen((o) => !o)}
        className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Open feedback"
      >
        <MessageCircle size={20} />
      </button>
    </div>
  )
}
