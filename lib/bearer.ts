import 'server-only'
import { timingSafeEqual } from 'node:crypto'

/** Constant-time check of `Authorization: Bearer <expected>`. */
export function hasBearer(request: Request, expected: string | undefined): boolean {
  if (!expected) return false
  const header = request.headers.get('authorization') ?? ''
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ''))
  const want = Buffer.from(expected)
  return given.length === want.length && timingSafeEqual(given, want)
}
