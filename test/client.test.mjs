import assert from 'node:assert/strict'
import test from 'node:test'

import { createChatClient } from '../dist/index.js'
import { normalizeListSpacing, parseSourceNumbers } from '../dist/rich-text.js'
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

test('keeps numbered markdown items in one continuous list', () => {
  const input = '1. Persiapan\n\n1. Investigasi\n\n1. Pelaporan'

  assert.equal(
    normalizeListSpacing(input),
    '1. Persiapan\n1. Investigasi\n1. Pelaporan',
  )
})

test('parses source tokens without duplicates', () => {
  assert.deepEqual(parseSourceNumbers('[sumber: 6, 4, 6]'), [6, 4])
})

test('fetches citation documents with bearer auth and refreshes once after 401', async (context) => {
  const previousFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = previousFetch })
  const requests = []
  let tokenCalls = 0
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init })
    if (requests.length === 1) return jsonResponse({ detail: 'expired' }, 401)
    return new Response(new Blob(['pdf'], { type: 'application/pdf' }), { status: 200 })
  }
  const client = createChatClient({
    apiBaseUrl: 'https://chat.example/',
    getAccessToken: async () => `token-${++tokenCalls}`,
  })

  const blob = await client.fetchDocument('document id')

  assert.equal(requests.length, 2)
  assert.equal(requests[1].url, 'https://chat.example/api/integrations/documents/document%20id/file')
  assert.equal(requests[1].init.headers.Authorization, 'Bearer token-2')
  assert.equal(blob.type, 'application/pdf')
  assert.equal(await blob.text(), 'pdf')
})

test('forwards document abort signal and reports API errors', async (context) => {
  const previousFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = previousFetch })
  const abort = new AbortController()
  let receivedSignal
  globalThis.fetch = async (_url, init) => {
    receivedSignal = init.signal
    return jsonResponse({ detail: 'Document not found' }, 404)
  }
  const client = createChatClient({
    apiBaseUrl: 'https://chat.example',
    getAccessToken: async () => 'token',
  })

  await assert.rejects(
    client.fetchDocument('missing', abort.signal),
    /Document not found/,
  )
  assert.equal(receivedSignal, abort.signal)
})

test('propagates document network failures', async (context) => {
  const previousFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = previousFetch })
  globalThis.fetch = async () => { throw new TypeError('network down') }
  const client = createChatClient({
    apiBaseUrl: 'https://chat.example',
    getAccessToken: async () => 'token',
  })

  await assert.rejects(client.fetchDocument('document'), /network down/)
})
