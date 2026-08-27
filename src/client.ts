import { consumeSse } from './sse.js'
import type {
  ChatClient,
  ChatClientConfig,
  StreamMessageInput,
} from './types.js'

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

export function createChatClient(config: ChatClientConfig): ChatClient {
  const baseUrl = normalizeBaseUrl(config.apiBaseUrl)
  let cachedToken: { value: string; expiresAt: number } | null = null

  async function token(force = false): Promise<string> {
    if (!force && cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
      return cachedToken.value
    }
    const value = await config.getAccessToken()
    let expiresAt = Date.now() + 60_000
    try {
      const encoded = (value.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
      const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')
      const payload = JSON.parse(atob(padded)) as { exp?: number }
      if (typeof payload.exp === 'number') expiresAt = payload.exp * 1000
    } catch {
      // Non-JWT test/dev tokens get a short cache window.
    }
    cachedToken = { value, expiresAt }
    return value
  }

  async function request(path: string, init: RequestInit): Promise<Response> {
    const send = async (forceToken: boolean) => fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
        Authorization: `Bearer ${await token(forceToken)}`,
      },
    })
    let response = await send(false)
    if (response.status === 401) response = await send(true)
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { detail?: string } | null
      throw new Error(detail?.detail ?? `Chat API request failed (${response.status})`)
    }
    return response
  }

  return {
    async streamMessage(input: StreamMessageInput) {
      const response = await request('/api/integrations/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message: input.message,
          history: (input.history ?? []).slice(-10),
        }),
        signal: input.signal,
      })
      if (!response.body) throw new Error('Chat stream tidak tersedia.')
      await consumeSse(response.body, input.onEvent)
    },
  }
}
