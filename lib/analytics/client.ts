'use client'

import { track as vercelTrack } from '@vercel/analytics'
import type { ClientEvent } from './events'

/**
 * Records a browser-side product event: in our own counters (see
 * /api/admin/stats) and, where the plan allows custom events, in Vercel
 * Analytics. Fire-and-forget — analytics must never block the UI.
 */
export function trackEvent(name: ClientEvent, properties?: Record<string, string | number | boolean>) {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      keepalive: true,
    }).catch(() => {})
    vercelTrack(name, properties)
  } catch {
    // ignore
  }
}
