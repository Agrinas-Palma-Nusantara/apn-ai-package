import type { ChatStreamEvent, Citation } from './types.js'

type RawCitation = {
  id?: unknown
  document_id?: unknown
  title?: unknown
  snippet?: unknown
}

function citations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const raw = item as RawCitation
    if (typeof raw.title !== 'string' || !raw.title) return []
    return [{
      id: typeof raw.id === 'string' ? raw.id : null,
      documentId: typeof raw.document_id === 'string' ? raw.document_id : null,
      title: raw.title,
      snippet: typeof raw.snippet === 'string' ? raw.snippet : null,
    }]
  })
}

export function parseSseFrame(frame: string): ChatStreamEvent | null {
  let eventName = 'message'
  const dataLines: string[] = []
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim()
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  const data = dataLines.join('\n')
  if (!data) return null
  if (data === '[DONE]') return { type: 'closed' }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(data) as Record<string, unknown>
  } catch {
    return null
  }

  switch (eventName) {
    case 'status':
      return {
        type: 'status',
        stage: typeof payload.stage === 'string' ? payload.stage : 'processing',
        label: typeof payload.label === 'string' ? payload.label : 'Memproses',
        elapsedMs: typeof payload.elapsed_ms === 'number' ? payload.elapsed_ms : 0,
      }
    case 'meta':
      return {
        type: 'citations',
        citations: citations(payload.sources),
        warnings: Array.isArray(payload.warnings)
          ? payload.warnings.filter((item): item is string => typeof item === 'string')
          : [],
      }
    case 'token':
      return typeof payload.content === 'string'
        ? { type: 'token', content: payload.content, replace: payload.replace === true }
        : null
    case 'done':
      return {
        type: 'done',
        content: typeof payload.content === 'string' ? payload.content : undefined,
        citations: Array.isArray(payload.sources) ? citations(payload.sources) : undefined,
        followUpQuestions: Array.isArray(payload.follow_up_questions)
          ? payload.follow_up_questions.filter((item): item is string => typeof item === 'string')
          : undefined,
      }
    case 'clarification': {
      const candidates = Array.isArray(payload.candidates)
        ? payload.candidates.flatMap((item) => {
            if (!item || typeof item !== 'object') return []
            const candidate = item as Record<string, unknown>
            return typeof candidate.division === 'string' && typeof candidate.title === 'string'
              ? [{ division: candidate.division, title: candidate.title }]
              : []
          })
        : []
      return {
        type: 'clarification',
        number: typeof payload.number === 'string' ? payload.number : '',
        candidates,
      }
    }
    case 'error':
      return {
        type: 'error',
        message: typeof payload.message === 'string' ? payload.message : 'Chat gagal diproses.',
      }
    default:
      return null
  }
}

export async function consumeSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const frames = buffer.split(/\r?\n\r?\n/)
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const event = parseSseFrame(frame)
      if (event) onEvent(event)
    }
    if (done) break
  }

  const finalEvent = parseSseFrame(buffer)
  if (finalEvent) onEvent(finalEvent)
}
