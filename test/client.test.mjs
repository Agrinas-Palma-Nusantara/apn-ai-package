import assert from 'node:assert/strict'
import test from 'node:test'

import { createChatClient } from '../dist/index.js'
import { parseSseFrame } from '../dist/sse.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function streamResponse(frames = 'event: done\ndata: {"content":"Selesai"}\n\n') {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(frames))
      controller.close()
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

test('streams to stateless endpoint with only the ten latest history items', async (context) => {
  const previousFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = previousFetch })
  let requestUrl
  let requestBody
  globalThis.fetch = async (url, init) => {
    requestUrl = url
    requestBody = JSON.parse(init.body)
    assert.equal(init.headers.Authorization, 'Bearer token')
    return streamResponse()
  }
  const history = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `message-${index}`,
  }))
  const client = createChatClient({
    apiBaseUrl: 'https://chat.example/',
    getAccessToken: async () => 'token',
  })

  await client.streamMessage({ message: 'lanjut', history, onEvent() {} })

  assert.equal(requestUrl, 'https://chat.example/api/integrations/chat/stream')
  assert.deepEqual(Object.keys(requestBody).sort(), ['history', 'message'])
  assert.equal(requestBody.history.length, 10)
  assert.equal(requestBody.history[0].content, 'message-2')
})

test('refreshes token once after 401', async (context) => {
  const previousFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = previousFetch })
  let requests = 0
  let tokenCalls = 0
  globalThis.fetch = async () => {
    requests += 1
    return requests === 1 ? jsonResponse({ detail: 'expired' }, 401) : streamResponse()
  }
  const client = createChatClient({
    apiBaseUrl: 'https://chat.example',
    getAccessToken: async () => `token-${++tokenCalls}`,
  })

  await client.streamMessage({ message: 'Halo', onEvent() {} })

  assert.equal(requests, 2)
  assert.equal(tokenCalls, 2)
})

test('parses citation and token SSE frames', () => {
  const token = parseSseFrame('event: token\ndata: {"content":"Halo","replace":false}')
  const meta = parseSseFrame('event: meta\ndata: {"sources":[{"title":"SOP APN","snippet":"Langkah pertama"}],"warnings":[]}')

  assert.deepEqual(token, { type: 'token', content: 'Halo', replace: false })
  assert.equal(meta.citations[0].title, 'SOP APN')
  assert.equal(meta.citations[0].snippet, 'Langkah pertama')
})

test('streams events and forwards AbortSignal', async (context) => {
  const previousFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = previousFetch })
  let receivedSignal
  globalThis.fetch = async (_url, init) => {
    receivedSignal = init.signal
    return streamResponse('event: token\ndata: {"content":"Jawaban","replace":false}\n\n')
  }
  const abort = new AbortController()
  const events = []
  const client = createChatClient({
    apiBaseUrl: 'https://chat.example',
    getAccessToken: async () => 'token',
  })

  await client.streamMessage({
    message: 'Halo',
    signal: abort.signal,
    onEvent: (event) => events.push(event),
  })

  assert.equal(receivedSignal, abort.signal)
  assert.equal(events[0].content, 'Jawaban')
})
