'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { resendVerificationAction } from '@/app/(auth)/actions'
import { Alert, Button } from '@/components/ui/primitives'

export function ResendVerification() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  function resend() {
    setMessage(null)
    startTransition(async () => {
      const result = await resendVerificationAction()
      setMessage(
        result.ok
          ? { tone: 'success', text: 'Sent. Check your inbox — and your spam folder.' }
          : { tone: 'danger', text: result.error },
      )
    })
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" onClick={resend} isLoading={pending}>
        {!pending && <Send aria-hidden className="size-4" />}
        {pending ? 'Sending…' : 'Resend confirmation email'}
      </Button>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  )
}
