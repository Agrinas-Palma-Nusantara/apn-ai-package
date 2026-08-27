import { createChatClient } from './client.js'
import { APN_LOGO_DATA_URL } from './logo.js'
import { normalizeListSpacing, parseSourceNumbers } from './rich-text.js'
import type {
  ChatClient,
  ChatMessage,
  ChatStreamEvent,
  ChatWidgetConfig,
  ChatWidgetController,
} from './types.js'

const ELEMENT_NAME = 'agrinas-chat-widget'

const SEND_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`
const STOP_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"></rect></svg>`
const PLUS_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
const CLOSE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
const DOC_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`

const styles = `
  :host {
    --apn-green: #1b6e39;
    --apn-green-dark: #14532b;
    --apn-green-light: #258545;
    --apn-green-subtle: #eaf4ed;
    --apn-green-pill: #e1efe5;
    --apn-surface: #ffffff;
    --apn-bg: #f8faf8;
    --apn-text-main: #132218;
    --apn-text-muted: #5e6f64;
    --apn-text-hint: #899a8f;
    --apn-border: #e2ebe5;
    --apn-border-subtle: #edf2ee;
    --apn-shadow-panel: 0 16px 40px -6px rgba(15, 52, 27, 0.18), 0 4px 16px -2px rgba(0, 0, 0, 0.06);
    --apn-shadow-launcher: 0 10px 24px -4px rgba(27, 109, 55, 0.4), 0 4px 10px -2px rgba(27, 109, 55, 0.2);
    --apn-widget-z-index: 2147483000;
    --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-smooth: cubic-bezier(0.23, 1, 0.32, 1);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  button, textarea { font: inherit; color: inherit; }

  .launcher {
    position: fixed;
    z-index: var(--apn-widget-z-index);
    bottom: 24px;
    width: 56px;
    height: 56px;
    border: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, #1f783e 0%, #15572c 100%);
    color: #ffffff;
    cursor: pointer;
    box-shadow: var(--apn-shadow-launcher);
    display: grid;
    place-items: center;
    transition: transform 200ms var(--ease-spring), box-shadow 200ms ease;
    outline: none;
  }
  .launcher:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 14px 28px -4px rgba(27, 109, 55, 0.48), 0 6px 12px -2px rgba(27, 109, 55, 0.25);
  }
  .launcher:active {
    transform: scale(0.94);
  }
  .launcher:focus-visible {
    outline: 3px solid rgba(37, 133, 69, 0.45);
    outline-offset: 3px;
  }
  .launcher svg { width: 26px; height: 26px; }

  .right { right: 24px; }
  .left { left: 24px; }

  .panel {
    position: fixed;
    z-index: var(--apn-widget-z-index);
    bottom: 92px;
    width: 384px;
    height: min(620px, calc(100vh - 116px));
    background: var(--apn-surface);
    color: var(--apn-text-main);
    border: 1px solid var(--apn-border);
    border-radius: 20px;
    box-shadow: var(--apn-shadow-panel);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    opacity: 0;
    transform: scale(0.95) translateY(10px);
    pointer-events: none;
    visibility: hidden;
    transition: opacity 220ms var(--ease-smooth), transform 220ms var(--ease-spring), visibility 220ms;
  }
  .panel.right { transform-origin: bottom right; }
  .panel.left { transform-origin: bottom left; }

  .panel.open {
    opacity: 1;
    transform: scale(1) translateY(0);
    pointer-events: auto;
    visibility: visible;
  }

  /* Header */
  .header {
    height: 66px;
    padding: 12px 14px 12px 16px;
    border-bottom: 1px solid var(--apn-border-subtle);
    display: flex;
    align-items: center;
    gap: 12px;
    background: #ffffff;
    flex-shrink: 0;
  }
  .brand {
    width: 40px;
    height: 40px;
    border: 1px solid rgba(27, 110, 57, 0.1);
    border-radius: 12px;
    background: linear-gradient(145deg, #fffef8 0%, #f4f8f4 100%);
    display: grid;
    place-items: center;
    box-shadow: 0 4px 12px rgba(21, 87, 44, 0.12);
    flex-shrink: 0;
  }
  .brand img {
    display: block;
    width: 25px;
    height: 34px;
    object-fit: contain;
  }
  .identity { min-width: 0; flex: 1; }
  .identity-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14.5px;
    font-weight: 700;
    color: var(--apn-text-main);
    letter-spacing: -0.01em;
  }
  .identity-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    background: var(--apn-green-pill);
    color: var(--apn-green);
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .identity-sub {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
    color: var(--apn-text-muted);
    font-size: 11.5px;
  }
  .online-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
    display: inline-block;
  }
  .header-actions { display: flex; gap: 4px; }
  .icon-button {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--apn-text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: background-color 150ms ease, color 150ms ease, transform 120ms ease;
  }
  .icon-button:hover { background: #edf4ef; color: var(--apn-text-main); }
  .icon-button:active { transform: scale(0.92); }
  .icon-button:focus-visible { outline: 2px solid var(--apn-green); outline-offset: 1px; }

  /* Messages */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: var(--apn-bg);
    scroll-behavior: smooth;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .messages::-webkit-scrollbar { width: 5px; }
  .messages::-webkit-scrollbar-track { background: transparent; }
  .messages::-webkit-scrollbar-thumb { background: #d8e2db; border-radius: 999px; }
  .messages::-webkit-scrollbar-thumb:hover { background: #bccbc0; }

  /* Empty State */
  .empty {
    margin: auto 0;
    padding: 18px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .empty-avatar {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    background: linear-gradient(145deg, #fffef8 0%, #f0f7f1 100%);
    display: grid;
    place-items: center;
    margin-bottom: 16px;
    box-shadow: inset 0 0 0 1px rgba(27, 110, 57, 0.08), 0 8px 24px rgba(27, 110, 57, 0.08);
  }
  .empty-avatar img {
    display: block;
    width: 31px;
    height: 44px;
    object-fit: contain;
  }
  .empty strong {
    display: block;
    color: var(--apn-text-main);
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 6px;
    letter-spacing: -0.01em;
  }
  .empty p {
    color: var(--apn-text-muted);
    font-size: 13px;
    line-height: 1.5;
    max-width: 280px;
    margin-bottom: 0;
  }

  /* Message Bubble */
  .message { display: flex; width: 100%; }
  .message.user { justify-content: flex-end; }
  .message.assistant { justify-content: flex-start; }
  .bubble {
    max-width: 86%;
    padding: 10px 13px;
    font-size: 13px;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .assistant .bubble {
    background: #ffffff;
    color: var(--apn-text-main);
    border: 1px solid var(--apn-border);
    border-radius: 16px 16px 16px 4px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  }
  .user .bubble {
    background: linear-gradient(135deg, #1b6e39 0%, #258545 100%);
    color: #ffffff;
    border-radius: 16px 16px 4px 16px;
    font-weight: 450;
    box-shadow: 0 3px 10px rgba(27, 110, 57, 0.2);
    white-space: pre-wrap;
  }

  /* Safe rich text */
  .rich-text { display: grid; gap: 8px; }
  .rich-text p, .rich-text li { line-height: 1.58; }
  .rich-text ul, .rich-text ol { display: grid; gap: 5px; padding-left: 20px; }
  .rich-text li::marker { color: var(--apn-green); font-weight: 700; }
  .rich-text h2, .rich-text h3, .rich-text h4 {
    color: var(--apn-text-main);
    font-size: 13px;
    line-height: 1.45;
    font-weight: 750;
  }
  .rich-text strong { font-weight: 720; color: #0f2818; }
  .rich-text em { color: var(--apn-text-muted); }
  .rich-text code {
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--apn-green-subtle);
    color: var(--apn-green-dark);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em;
  }
  .rich-text a { color: var(--apn-green); text-underline-offset: 2px; }
  .inline-citation {
    display: inline-flex;
    align-items: center;
    margin: 0 1px;
    padding: 1px 5px;
    border: 1px solid #cfe2d5;
    border-radius: 999px;
    background: var(--apn-green-subtle);
    color: var(--apn-green) !important;
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1.4;
    text-decoration: none;
    vertical-align: 1px;
    font-family: inherit;
    cursor: pointer;
  }
  button.inline-citation { appearance: none; }
  button.inline-citation:hover { background: var(--apn-green-pill); border-color: #a9cdb5; }
  button.inline-citation:focus-visible { outline: 2px solid var(--apn-green); outline-offset: 1px; }
  span.inline-citation { cursor: default; }

  /* Citations */
  .citations {
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px solid var(--apn-border-subtle);
    white-space: normal;
  }
  .citations summary {
    cursor: pointer;
    color: var(--apn-green);
    font-size: 11.5px;
    font-weight: 650;
    list-style: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--apn-green-subtle);
    user-select: none;
    transition: background-color 150ms ease;
  }
  .citations summary::-webkit-details-marker { display: none; }
  .citations summary:hover { background: var(--apn-green-pill); }
  .citations summary .chevron { transition: transform 180ms ease; }
  .citations[open] summary .chevron { transform: rotate(90deg); }

  .citation-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }
  .citation {
    padding: 8px 10px;
    background: #f8faf8;
    border-left: 2.5px solid var(--apn-green);
    border-radius: 0 8px 8px 0;
    color: var(--apn-text-muted);
    font-size: 11px;
    line-height: 1.45;
  }
  .citation-title {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--apn-text-main);
    font-size: 11.5px;
    font-weight: 700;
    margin-bottom: 2px;
    text-decoration: none;
  }
  button.citation-title { appearance: none; width: 100%; border: 0; background: transparent; text-align: left; cursor: pointer; }
  button.citation-title:hover { color: var(--apn-green); text-decoration: underline; text-underline-offset: 2px; }
  button.citation-title:focus-visible { outline: 2px solid var(--apn-green); outline-offset: 2px; border-radius: 4px; }
  .citation-title svg { color: var(--apn-green); flex-shrink: 0; }

  /* Thinking and streaming */
  .thinking {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 24px;
    color: var(--apn-text-muted);
  }
  .pixel-grid {
    display: grid;
    grid-template-columns: repeat(3, 4px);
    gap: 2px;
    flex: 0 0 auto;
  }
  .pixel-grid i {
    width: 4px;
    height: 4px;
    border-radius: 1px;
    background: var(--apn-green);
    opacity: 0.16;
    animation: pixelOn 650ms ease-in-out var(--delay) infinite;
  }
  .thinking-label {
    color: transparent;
    font-size: 11.5px;
    font-weight: 600;
    background: linear-gradient(90deg, var(--apn-text-hint) 30%, var(--apn-text-main) 50%, var(--apn-text-hint) 70%);
    background-size: 200% 100%;
    background-clip: text;
    animation: shimmerText 1.4s linear infinite;
  }
  .thinking-time {
    color: var(--apn-text-hint);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }
  .stream-state {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    color: var(--apn-text-hint);
    font-size: 10.5px;
  }
  .stream-cursor {
    width: 5px;
    height: 13px;
    border-radius: 2px;
    background: var(--apn-green);
    animation: cursorBlink 800ms steps(2, end) infinite;
  }

  @keyframes pixelOn { 0%, 100% { opacity: .16; transform: scale(.85); } 48% { opacity: 1; transform: scale(1); } }
  @keyframes shimmerText { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  @keyframes cursorBlink { 50% { opacity: .2; } }

  /* Status */
  .status {
    min-height: 18px;
    padding: 0 16px 4px;
    color: var(--apn-text-muted);
    background: #ffffff;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }
  .status:empty { display: none; }
  .status.error { color: #d92d20; font-weight: 500; }

  /* Composer */
  .composer {
    padding: 10px 14px 12px;
    border-top: 1px solid var(--apn-border-subtle);
    background: #ffffff;
    flex-shrink: 0;
  }
  form {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    background: #f8faf8;
    border: 1px solid #d4ded7;
    border-radius: 16px;
    padding: 6px 6px 6px 12px;
    transition: border-color 180ms var(--ease-smooth), box-shadow 180ms var(--ease-smooth), background-color 180ms ease;
  }
  form:focus-within {
    background: #ffffff;
    border-color: var(--apn-green);
    box-shadow: 0 0 0 3px rgba(37, 133, 69, 0.12);
  }
  textarea {
    flex: 1;
    min-height: 24px;
    max-height: 96px;
    resize: none;
    border: 0 !important;
    outline: 0 !important;
    box-shadow: none !important;
    color: var(--apn-text-main);
    background: transparent;
    line-height: 1.45;
    font-size: 13px;
    padding: 4px 0;
  }
  textarea::placeholder { color: var(--apn-text-hint); }

  .send {
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    border: 0;
    border-radius: 10px;
    background: var(--apn-green);
    color: white;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: transform 150ms var(--ease-spring), background-color 150ms ease, opacity 150ms ease;
  }
  .send:hover:not(:disabled) { background: var(--apn-green-dark); }
  .send:active:not(:disabled) { transform: scale(0.92); }
  .send:disabled { opacity: 0.4; cursor: default; }

  .disclaimer {
    margin: 7px 4px 0;
    text-align: center;
    color: var(--apn-text-hint);
    font-size: 9.5px;
    line-height: 1.3;
  }

  @media (max-width: 640px) {
    .panel {
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      border-radius: 0;
      bottom: 0;
    }
    .launcher { bottom: 18px; }
    .right { right: 18px; }
    .left { left: 18px; }
    .panel.open + .launcher { visibility: hidden; }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel, .launcher, .icon-button, .send, .pixel-grid i, .thinking-label, .stream-cursor {
      transition: none !important;
      animation: none !important;
    }
  }
`

type WidgetElement = HTMLElement & ChatWidgetController & {
  configure(config: ChatWidgetConfig): void
}

const PROVISIONAL_REFUSAL = /^(maaf[, ]|saya (?:belum|tidak)|informasi (?:yang )?(?:cukup )?tidak)/i
type OpenDocument = (documentId: string, title: string) => void

function appendInlineRichText(
  parent: HTMLElement,
  text: string,
  sources: ChatMessage['citations'],
  openDocument: OpenDocument,
): void {
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[sumber:\s*\d+(?:\s*,\s*\d+)*\]|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/gi
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) parent.append(document.createTextNode(text.slice(cursor, index)))
    const token = match[0]
    if (/^\[sumber:/i.test(token)) {
      for (const number of parseSourceNumbers(token)) {
        const source = sources[number - 1]
        const element = document.createElement(source?.documentId ? 'button' : 'span')
        element.className = 'inline-citation'
        element.textContent = `[${number}]`
        element.setAttribute('aria-label', source ? `Buka sumber ${number}: ${source.title}` : `Sumber ${number}`)
        element.setAttribute('title', source?.title ?? `Sumber ${number}`)
        if (element instanceof HTMLButtonElement && source?.documentId) {
          element.type = 'button'
          element.addEventListener('click', () => openDocument(source.documentId!, source.title))
        }
        parent.append(element)
      }
      cursor = index + token.length
      continue
    }
    let element: HTMLElement
    if (token.startsWith('**')) {
      element = document.createElement('strong')
      element.textContent = token.slice(2, -2)
    } else if (token.startsWith('*')) {
      element = document.createElement('em')
      element.textContent = token.slice(1, -1)
    } else if (token.startsWith('`')) {
      element = document.createElement('code')
      element.textContent = token.slice(1, -1)
    } else {
      const separator = token.lastIndexOf('](')
      element = document.createElement('a')
      element.textContent = token.slice(1, separator)
      element.setAttribute('href', token.slice(separator + 2, -1))
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noreferrer noopener')
    }
    parent.append(element)
    cursor = index + token.length
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)))
}

function renderRichText(
  text: string,
  sources: ChatMessage['citations'],
  openDocument: OpenDocument,
): HTMLElement {
  const root = document.createElement('div')
  root.className = 'rich-text'
  let list: HTMLUListElement | HTMLOListElement | null = null

  for (const rawLine of normalizeListSpacing(text).split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      list = null
      continue
    }
    const unordered = line.match(/^[-•]\s+(.+)$/)
    const ordered = line.match(/^\d+[.)]\s+(.+)$/)
    if (unordered || ordered) {
      const kind = unordered ? 'ul' : 'ol'
      if (!list || list.tagName.toLowerCase() !== kind) {
        list = document.createElement(kind)
        root.append(list)
      }
      const item = document.createElement('li')
      appendInlineRichText(item, (unordered ?? ordered)?.[1] ?? line, sources, openDocument)
      list.append(item)
      continue
    }
    list = null
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    const headingLevel = Math.min((heading?.[1]?.length ?? 0) + 1, 4)
    const block = document.createElement(heading ? `h${headingLevel}` : 'p')
    appendInlineRichText(block, heading?.[2] ?? line, sources, openDocument)
    root.append(block)
  }
  return root
}

function elementClass(): CustomElementConstructor {
  return class AgrinasChatWidgetElement extends HTMLElement {
    private config: ChatWidgetConfig | null = null
    private client: ChatClient | null = null
    private messages: ChatMessage[] = []
    private sending = false
    private status = ''
    private error = ''
    private abortController: AbortController | null = null
    private activeAssistantId: string | null = null
    private thinkingStartedAt = 0
    private elapsedTimer: number | null = null
    private panel!: HTMLElement
    private launcher!: HTMLButtonElement
    private messagesElement!: HTMLElement
    private statusElement!: HTMLElement
    private textarea!: HTMLTextAreaElement
    private sendButton!: HTMLButtonElement

    constructor() {
      super()
      this.attachShadow({ mode: 'open' })
    }

    connectedCallback() {
      if (!this.shadowRoot || this.shadowRoot.childElementCount > 0) return
      this.shadowRoot.innerHTML = `
        <style>${styles}</style>
        <section class="panel right" role="dialog" aria-label="AGRIA, Asisten APN" aria-hidden="true">
          <header class="header">
            <div class="brand" aria-hidden="true"><img src="${APN_LOGO_DATA_URL}" alt="" /></div>
            <div class="identity">
              <div class="identity-name">
                <span>AGRIA</span>
                <span class="identity-badge">AI</span>
              </div>
              <div class="identity-sub">
                <span class="online-dot"></span>
                <span>Asisten dokumen APN</span>
              </div>
            </div>
            <div class="header-actions">
              <button class="icon-button new" type="button" aria-label="Mulai chat baru" title="Mulai chat baru">${PLUS_ICON}</button>
              <button class="icon-button close" type="button" aria-label="Tutup chat" title="Tutup chat">${CLOSE_ICON}</button>
            </div>
          </header>
          <div class="messages" aria-live="polite"></div>
          <div class="status" aria-live="polite"></div>
          <div class="composer">
            <form>
              <textarea rows="1" maxlength="8000" placeholder="Tanyakan apa saja..." aria-label="Pesan"></textarea>
              <button class="send" type="submit" aria-label="Kirim pesan">${SEND_ICON}</button>
            </form>
            <p class="disclaimer">Jawaban dihasilkan oleh AI. Selalu verifikasi ke dokumen sumber resmi.</p>
          </div>
        </section>
        <button class="launcher right" type="button" aria-label="Buka AGRIA" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      `
      this.panel = this.shadowRoot.querySelector('.panel')!
      this.launcher = this.shadowRoot.querySelector('.launcher')!
      this.messagesElement = this.shadowRoot.querySelector('.messages')!
      this.statusElement = this.shadowRoot.querySelector('.status')!
      this.textarea = this.shadowRoot.querySelector('textarea')!
      this.sendButton = this.shadowRoot.querySelector('.send')!
      this.launcher.addEventListener('click', () => this.open())
      this.shadowRoot.querySelector('.close')!.addEventListener('click', () => this.close())
      this.shadowRoot.querySelector('.new')!.addEventListener('click', () => this.newConversation())
      this.shadowRoot.querySelector('form')!.addEventListener('submit', (event) => {
        event.preventDefault()
        void this.send()
      })
      this.textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          void this.send()
        }
      })
      this.textarea.addEventListener('input', () => {
        this.textarea.style.height = 'auto'
        this.textarea.style.height = `${Math.min(this.textarea.scrollHeight, 96)}px`
      })
      this.shadowRoot.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Escape') this.close()
      })
      this.applyPosition()
      this.render()
    }

    configure(config: ChatWidgetConfig) {
      this.config = config
      this.client = createChatClient(config)
      this.style.setProperty('--apn-widget-z-index', String(config.zIndex ?? 2147483000))
      this.applyPosition()
    }

    open() {
      if (!this.client) throw new Error('Chat widget belum dikonfigurasi.')
      this.panel.classList.add('open')
      this.panel.setAttribute('aria-hidden', 'false')
      this.launcher.setAttribute('aria-expanded', 'true')
      this.dispatchEvent(new CustomEvent('agrinas-chat:open', { bubbles: true, composed: true }))
      queueMicrotask(() => this.textarea.focus())
    }

    close() {
      this.panel.classList.remove('open')
      this.panel.setAttribute('aria-hidden', 'true')
      this.launcher.setAttribute('aria-expanded', 'false')
      this.launcher.focus()
      this.dispatchEvent(new CustomEvent('agrinas-chat:close', { bubbles: true, composed: true }))
    }

    newConversation() {
      this.abortController?.abort()
      this.abortController = null
      this.messages = []
      this.sending = false
      this.activeAssistantId = null
      this.status = ''
      this.error = ''
      this.stopElapsedTimer()
      this.render()
      this.textarea.focus()
    }

    destroy() {
      this.abortController?.abort()
      this.stopElapsedTimer()
      this.remove()
    }

    private applyPosition() {
      if (!this.shadowRoot) return
      const position = this.config?.position ?? 'bottom-right'
      for (const element of this.shadowRoot.querySelectorAll('.panel, .launcher')) {
        element.classList.toggle('left', position === 'bottom-left')
        element.classList.toggle('right', position === 'bottom-right')
      }
    }

    private async send(customText?: string) {
      const content = (customText ?? this.textarea.value).trim()
      if (!content || this.sending || !this.client) return
      const history = this.messages
        .filter((message) => message.content.trim())
        .slice(-10)
        .map((message) => ({ role: message.role, content: message.content }))
      const assistantId = `assistant-${Date.now()}`
      this.messages.push(
        { id: `user-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString(), citations: [] },
        { id: assistantId, role: 'assistant', content: '', createdAt: new Date().toISOString(), citations: [] },
      )
      this.textarea.value = ''
      this.textarea.style.height = 'auto'
      this.sending = true
      this.activeAssistantId = assistantId
      this.error = ''
      this.status = 'Memahami pertanyaan'
      this.startElapsedTimer()
      this.abortController = new AbortController()
      this.render()

      try {
        await this.client.streamMessage({
          message: content,
          history,
          signal: this.abortController.signal,
          onEvent: (event) => this.handleStreamEvent(assistantId, event),
        })
      } catch (error) {
        if (!this.abortController.signal.aborted) {
          this.error = error instanceof Error ? error.message : 'Chat gagal diproses.'
          this.dispatchEvent(new CustomEvent('agrinas-chat:error', {
            detail: { message: this.error },
            bubbles: true,
            composed: true,
          }))
        }
      } finally {
        if (this.abortController?.signal.aborted) {
          const assistant = this.messages.find((message) => message.id === assistantId)
          if (assistant && !assistant.content.trim()) {
            this.messages = this.messages.filter((message) => message.id !== assistantId)
          }
        }
        this.sending = false
        this.activeAssistantId = null
        this.status = ''
        this.abortController = null
        this.stopElapsedTimer()
        this.render()
      }
    }

    private handleStreamEvent(assistantId: string, event: ChatStreamEvent) {
      const assistant = this.messages.find((message) => message.id === assistantId)
      if (event.type === 'status') this.status = event.label
      if (event.type === 'token' && assistant) {
        assistant.content = event.replace ? event.content : assistant.content + event.content
      }
      if (event.type === 'citations' && assistant) assistant.citations = event.citations
      if (event.type === 'done' && assistant) {
        if (event.content !== undefined) assistant.content = event.content
        if (event.citations !== undefined) assistant.citations = event.citations
      }
      if (event.type === 'error') {
        if (event.code === 'provider_unavailable' && assistant) {
          assistant.content = event.message
          assistant.citations = []
          this.error = ''
        } else {
          this.error = event.message
        }
      }
      this.render()
    }

    private startElapsedTimer() {
      this.stopElapsedTimer()
      this.thinkingStartedAt = performance.now()
      this.elapsedTimer = window.setInterval(() => this.updateElapsed(), 100)
    }

    private stopElapsedTimer() {
      if (this.elapsedTimer !== null) window.clearInterval(this.elapsedTimer)
      this.elapsedTimer = null
      this.thinkingStartedAt = 0
    }

    private elapsedLabel(): string {
      if (!this.thinkingStartedAt) return '0.0s'
      const seconds = (performance.now() - this.thinkingStartedAt) / 1000
      if (seconds < 60) return `${seconds.toFixed(1)}s`
      return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`
    }

    private updateElapsed() {
      if (!this.shadowRoot) return
      for (const element of this.shadowRoot.querySelectorAll<HTMLElement>('[data-elapsed]')) {
        element.textContent = this.elapsedLabel()
      }
    }

    private createThinkingState(compact = false): HTMLElement {
      const state = document.createElement('div')
      state.className = compact ? 'stream-state' : 'thinking'
      state.setAttribute('role', 'status')

      if (compact) {
        const cursor = document.createElement('span')
        cursor.className = 'stream-cursor'
        cursor.setAttribute('aria-hidden', 'true')
        const label = document.createElement('span')
        label.textContent = this.status || 'Menyusun jawaban'
        const elapsed = document.createElement('span')
        elapsed.className = 'thinking-time'
        elapsed.dataset.elapsed = ''
        elapsed.textContent = this.elapsedLabel()
        state.append(cursor, label, elapsed)
        return state
      }

      const grid = document.createElement('span')
      grid.className = 'pixel-grid'
      grid.setAttribute('aria-hidden', 'true')
      const delays = [90, 0, 90, 180, 90, 180, 270, 180, 270]
      for (const delay of delays) {
        const pixel = document.createElement('i')
        pixel.style.setProperty('--delay', `${delay}ms`)
        grid.append(pixel)
      }
      const label = document.createElement('span')
      label.className = 'thinking-label'
      label.textContent = this.status || 'Menyusun jawaban'
      const elapsed = document.createElement('span')
      elapsed.className = 'thinking-time'
      elapsed.dataset.elapsed = ''
      elapsed.textContent = this.elapsedLabel()
      state.append(grid, label, elapsed)
      return state
    }

    private async openDocument(documentId: string, title: string) {
      if (!this.client) return
      const target = window.open('', '_blank')
      if (!target) {
        this.error = 'Dokumen tidak dapat dibuka. Izinkan pop-up untuk situs ini.'
        this.render()
        return
      }
      target.opener = null
      target.document.title = title
      target.document.body.textContent = 'Memuat dokumen…'
      target.focus()
      try {
        const blob = await this.client.fetchDocument(documentId)
        const objectUrl = URL.createObjectURL(blob)
        target.location.replace(objectUrl)
        target.focus()
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      } catch (error) {
        target.close()
        this.error = error instanceof Error ? error.message : 'Dokumen gagal dibuka.'
        this.render()
      }
    }

    private render() {
      if (!this.messagesElement) return
      this.messagesElement.replaceChildren()
      if (this.messages.length === 0) {
        const state = document.createElement('div')
        state.className = 'empty'
        
        const avatar = document.createElement('div')
        avatar.className = 'empty-avatar'
        avatar.setAttribute('aria-hidden', 'true')
        const logo = document.createElement('img')
        logo.src = APN_LOGO_DATA_URL
        logo.alt = ''
        avatar.append(logo)
        
        const title = document.createElement('strong')
        title.textContent = 'Tanyakan apa saja'
        
        const subtitle = document.createElement('p')
        subtitle.textContent = 'Cari jawaban dari dokumen internal APN.'

        state.append(avatar, title, subtitle)
        this.messagesElement.append(state)
      } else {
        for (const item of this.messages) {
          const row = document.createElement('article')
          row.className = `message ${item.role}`
          const bubble = document.createElement('div')
          bubble.className = 'bubble'
          
          const active = item.id === this.activeAssistantId && this.sending
          const holdProvisional = active && PROVISIONAL_REFUSAL.test(item.content.trim())
          if (item.role === 'assistant' && active && (!item.content || holdProvisional)) {
            bubble.append(this.createThinkingState())
          } else if (item.role === 'assistant') {
            bubble.append(renderRichText(
              item.content,
              item.citations,
              (documentId, title) => void this.openDocument(documentId, title),
            ))
            if (active) bubble.append(this.createThinkingState(true))
          } else {
            bubble.textContent = item.content
          }

          if (item.citations && item.citations.length > 0) {
            const details = document.createElement('details')
            details.className = 'citations'
            const summary = document.createElement('summary')
            summary.innerHTML = `<svg class="chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg> ${item.citations.length} sumber referensi`
            details.append(summary)
            
            const citationList = document.createElement('div')
            citationList.className = 'citation-list'
            
            for (const source of item.citations) {
              const citation = document.createElement('div')
              citation.className = 'citation'
              const citationTitle = document.createElement(source.documentId ? 'button' : 'strong')
              citationTitle.className = 'citation-title'
              if (citationTitle instanceof HTMLButtonElement && source.documentId) {
                citationTitle.type = 'button'
                citationTitle.setAttribute('aria-label', `Buka dokumen: ${source.title}`)
                citationTitle.addEventListener('click', () => void this.openDocument(source.documentId!, source.title))
              }
              const citationIcon = document.createElement('span')
              citationIcon.innerHTML = DOC_ICON
              const citationLabel = document.createElement('span')
              citationLabel.textContent = source.title
              citationTitle.append(citationIcon, citationLabel)
              citation.append(citationTitle)
              if (source.snippet) {
                const snippet = document.createElement('div')
                snippet.style.marginTop = '2px'
                snippet.textContent = source.snippet
                citation.append(snippet)
              }
              citationList.append(citation)
            }
            details.append(citationList)
            bubble.append(details)
          }
          row.append(bubble)
          this.messagesElement.append(row)
        }
      }
      this.statusElement.textContent = this.error
      this.statusElement.className = this.error ? 'status error' : 'status'
      this.sendButton.innerHTML = this.sending ? STOP_ICON : SEND_ICON
      this.sendButton.setAttribute('aria-label', this.sending ? 'Hentikan jawaban' : 'Kirim pesan')
      this.sendButton.disabled = false
      this.sendButton.onclick = this.sending
        ? (event) => {
            event.preventDefault()
            this.abortController?.abort()
          }
        : null
      this.messagesElement.scrollTop = this.messagesElement.scrollHeight
    }
  }
}

export function registerAgrinasChatWidget(): void {
  if (typeof customElements === 'undefined') return
  if (!customElements.get(ELEMENT_NAME)) customElements.define(ELEMENT_NAME, elementClass())
}

export function mountChatWidget(config: ChatWidgetConfig): ChatWidgetController {
  if (typeof document === 'undefined') throw new Error('Chat widget hanya dapat dipasang di browser.')
  registerAgrinasChatWidget()
  const element = document.createElement(ELEMENT_NAME) as WidgetElement
  element.configure(config)
  document.body.append(element)
  return element
}
