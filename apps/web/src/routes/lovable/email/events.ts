import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

type Reason = 'bounce' | 'complaint' | 'unsubscribe'

function statusFor(reason: Reason): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function messageFor(reason: Reason): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    default:
      return 'Recipient unsubscribed'
  }
}

function serviceClient() {
  const supabaseUrl = import.meta.env['VITE_SUPABASE_URL']
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration')
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Notification-only bookkeeping: Lovable enforces suppression at send time.
async function record(
  reason: Reason,
  recipient: string,
  messageId: string | null,
  eventId: string,
) {
  const supabase = serviceClient()
  const email = recipient.toLowerCase()

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: eventId,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('Failed to write suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'system',
    recipient_email: email,
    status: statusFor(reason),
    error_message: messageFor(reason),
    metadata: null,
  })

  if (logError) {
    console.error('Failed to insert email_send_log', {
      event_id: eventId,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('Failed to write send log')
  }
}

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              await record(
                'bounce',
                event.data.recipient,
                event.data.message_id ?? null,
                event.event_id,
              )
            },
            'email.complaint': async (event) => {
              await record(
                'complaint',
                event.data.recipient,
                event.data.message_id ?? null,
                event.event_id,
              )
            },
            'email.unsubscribed': async (event) => {
              await record(
                'unsubscribe',
                event.data.recipient,
                event.data.message_id ?? null,
                event.event_id,
              )
            },
          },
        })
        return handler(request)
      },
    },
  },
})
