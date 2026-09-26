/**
 * Product events. Client-safe: the list is shared by the server tracker and
 * the client helper, and only CLIENT_EVENTS may be posted from the browser —
 * everything that matters for money or retention is recorded server-side,
 * where it can't be faked or blocked by an ad blocker.
 */
export const SERVER_EVENTS = [
  'reading_started',
  'reading_completed',
  'followup_asked',
  'ai_unavailable',
  'checkout_started',
  'checkout_completed',
  'trial_started',
  'daily_card_viewed',
  'signup',
  'login',
  'reminder_sent',
] as const

export const CLIENT_EVENTS = [
  'paywall_shown',
  'pricing_viewed',
  'spread_selected',
  'premium_spread_blocked',
  'history_viewed',
  'signin_prompt_shown',
] as const

export type ServerEvent = (typeof SERVER_EVENTS)[number]
export type ClientEvent = (typeof CLIENT_EVENTS)[number]
export type AnalyticsEvent = ServerEvent | ClientEvent

export const ALL_EVENTS: readonly AnalyticsEvent[] = [...SERVER_EVENTS, ...CLIENT_EVENTS]

export function isClientEvent(value: unknown): value is ClientEvent {
  return typeof value === 'string' && (CLIENT_EVENTS as readonly string[]).includes(value)
}

/** Retention checkpoints, in days since first visit. */
export const RETENTION_DAYS = [1, 7, 30] as const
