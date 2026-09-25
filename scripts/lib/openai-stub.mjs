/**
 * A tiny stand-in for the OpenAI Responses API, so the model path of the app
 * (streaming, charging, saving to the journal, the daily card text) can be
 * exercised without a key or network.
 *
 *   node scripts/lib/openai-stub.mjs          # listens on :4010
 *   OPENAI_API_KEY=sk-stub OPENAI_BASE_URL=http://localhost:4010/v1 pnpm dev
 *   OPENAI_STUB=http://localhost:4010 pnpm test:api
 *
 * It answers every request with a fixed reading and remembers the last request
 * at GET /__last, which lets the suite assert what the prompt contained. It
 * says nothing about the quality of real model output.
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 4010)
const REPLY = 'Відповідь: скоріше так.\n\nМинуле — Блазень. Ви почали з відкритим серцем.\n\nЩо можна зробити: зробіть один маленький крок сьогодні.\n\nЯкої сфери стосується ваше питання?'
let last = null

const usage = { input_tokens: 100, output_tokens: 40, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } }

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/__last') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(last))
  }
  let body = ''
  for await (const chunk of req) body += chunk
  last = { path: req.url, body: JSON.parse(body || '{}') }

  const id = 'resp_' + Date.now()
  const created_at = Math.floor(Date.now() / 1000)
  const model = last.body.model ?? 'gpt-4o-mini'
  const message = { type: 'message', id: 'msg_' + Date.now(), role: 'assistant', status: 'completed' }

  if (!last.body.stream) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({
      id, object: 'response', created_at, model, status: 'completed',
      output: [{ ...message, content: [{ type: 'output_text', text: REPLY, annotations: [] }] }],
      usage,
    }))
  }

  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = event => res.write(`data: ${JSON.stringify(event)}\n\n`)
  send({ type: 'response.created', response: { id, created_at, model } })
  send({ type: 'response.output_item.added', output_index: 0, item: message })
  for (const piece of REPLY.match(/[\s\S]{1,24}/g)) {
    send({ type: 'response.output_text.delta', item_id: message.id, delta: piece })
  }
  send({ type: 'response.output_item.done', output_index: 0, item: message })
  send({ type: 'response.completed', response: { usage } })
  res.end('data: [DONE]\n\n')
}).listen(PORT, () => console.log(`openai stub on http://localhost:${PORT}`))
