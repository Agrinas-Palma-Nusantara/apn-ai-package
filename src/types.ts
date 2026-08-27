export type ChatWidgetPosition = 'bottom-right' | 'bottom-left'

export interface Citation {
  id: string | null
  documentId: string | null
  title: string
  snippet: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  citations: Citation[]
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export type ChatStreamEvent =
  | { type: 'status'; stage: string; label: string; elapsedMs: number }
  | { type: 'citations'; citations: Citation[]; warnings: string[] }
  | { type: 'token'; content: string; replace: boolean }
  | { type: 'done'; content?: string; citations?: Citation[]; followUpQuestions?: string[] }
  | { type: 'clarification'; number: string; candidates: Array<{ division: string; title: string }> }
  | { type: 'error'; code?: string; message: string }
  | { type: 'closed' }

export interface ChatClientConfig {
  apiBaseUrl: string
  getAccessToken: () => Promise<string>
}

export interface StreamMessageInput {
  message: string
  history?: ChatHistoryItem[]
  signal?: AbortSignal
  onEvent: (event: ChatStreamEvent) => void
}

export interface ChatClient {
  streamMessage(input: StreamMessageInput): Promise<void>
  fetchDocument(documentId: string, signal?: AbortSignal): Promise<Blob>
}

export interface ChatWidgetConfig extends ChatClientConfig {
  position?: ChatWidgetPosition
  zIndex?: number
}

export interface ChatWidgetController {
  open(): void
  close(): void
  newConversation(): void
  destroy(): void
}
