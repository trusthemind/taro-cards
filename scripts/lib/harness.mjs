/** Minimal assertion + HTTP helpers shared by the test scripts. */

export const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

const state = { pass: 0, fail: 0, skipped: [], lines: [] }

export function section(title) {
  state.lines.push('')
  state.lines.push(`== ${title} ==`)
}

export function check(name, ok, detail = '') {
  ok ? state.pass++ : state.fail++
  state.lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

/** An observation worth printing that is not a pass/fail assertion. */
export function note(text) {
  state.lines.push(`NOTE  ${text}`)
}

export function skip(name, why) {
  state.skipped.push(`${name} (${why})`)
}

/** Prints everything collected and returns the process exit code. */
export function report() {
  console.log(state.lines.join('\n'))
  if (state.skipped.length) {
    console.log('')
    for (const s of state.skipped) console.log(`SKIP  ${s}`)
  }
  console.log(`\n${state.pass} passed, ${state.fail} failed, ${state.skipped.length} skipped`)
  return state.fail === 0 ? 0 : 1
}

/** Cookie jar so the visitor identity survives across requests. */
export function makeJar() {
  const jar = new Map()
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(res) {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(';')
        const i = pair.indexOf('=')
        jar.set(pair.slice(0, i), pair.slice(i + 1))
      }
    },
    set: (k, v) => jar.set(k, v),
    get: k => jar.get(k),
    clear: () => jar.clear(),
  }
}

export async function req(jar, path, init = {}) {
  const headers = { ...(init.headers || {}) }
  const cookie = jar.header()
  if (cookie) headers.cookie = cookie
  const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' })
  jar.absorb(res)
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json, text, res }
}

/** Fails fast with a readable message when the dev server isn't up. */
export async function requireServer() {
  try {
    await fetch(BASE + '/api/subscription', { signal: AbortSignal.timeout(5000) })
  } catch {
    console.error(`\nNo dev server on ${BASE}. Start one with \`pnpm dev\` first.\n`)
    process.exit(1)
  }
}
