import type { ComponentType } from 'react'

/**
 * Sender identities available for app emails.
 * Both addresses send through the verified notify.liftcamp.app infrastructure;
 * the visible From: header uses the root domain.
 */
export const SENDERS = {
  hello: { name: 'LiftCamp', address: 'hello@liftcamp.app' },
  alan: { name: 'Alan at LiftCamp', address: 'alan@liftcamp.app' },
} as const

export type SenderKey = keyof typeof SENDERS

/** Used when a template does not specify a sender. */
export const DEFAULT_SENDER: SenderKey = 'hello'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
  /** Which sender identity this email comes from. Defaults to 'hello'. */
  from?: SenderKey
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,
}
