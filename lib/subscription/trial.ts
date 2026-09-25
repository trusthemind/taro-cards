import 'server-only'
import { env } from '@/lib/config/env'
import { hasUsedTrial } from '@/lib/account'

/**
 * Free-trial length for this visitor: first subscription only, and one per
 * email once we know it (signed in, or from a previous Checkout). Shared by
 * checkout and /api/subscription so the button promises what Checkout gives.
 *
 * A visitor who clears cookies and pays with a new email can get a second
 * trial; the card is still required up front, which is Stripe's own guard.
 */
export async function trialDaysFor(hadSubscription: boolean, email: string | null): Promise<number> {
  if (env.trialDays <= 0 || hadSubscription) return 0
  if (email && (await hasUsedTrial(email))) return 0
  return env.trialDays
}
