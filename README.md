# `@pt-agrinas-palma-nusantara/chat-widget`

Headless TypeScript client and branded Web Component for the shared APN Chat Platform.

## Install from GitHub Packages

Add the APN package scope to the consuming app's `.npmrc`:

```ini
@pt-agrinas-palma-nusantara:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install --save-exact @pt-agrinas-palma-nusantara/chat-widget@0.1.0
```

The GitHub token used by npm needs `read:packages`. Publish manually with a token that has `write:packages`:

```bash
npm publish
```

## Better Auth adapter

Keep the Client App secret on the server. This generic route validates the local Better Auth session before exchanging its app-local subject for a five-minute Chat Token:

```ts
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  const subject = session?.user?.ssoId ?? session?.user?.id
  if (!subject) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const response = await fetch(`${process.env.CHAT_PLATFORM_URL}/api/integrations/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Chat-Client-Id': process.env.CHAT_CLIENT_ID!,
      'X-Chat-Client-Secret': process.env.CHAT_CLIENT_SECRET!,
    },
    body: JSON.stringify({ subject }),
  })

  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

Derive `subject` from the authenticated server session. Never accept it directly from browser input.

## Mount the popup

### React / Next.js

Render the adapter once near the root layout. It mounts the isolated Web Component and cleans it up automatically:

```tsx
'use client'

import { ChatAgriaUI } from '@pt-agrinas-palma-nusantara/chat-widget/react'

export function AppChat() {
  return (
    <ChatAgriaUI
      apiBaseUrl="https://chat-api.agrinas.id"
      getAccessToken={async () => {
        const response = await fetch('/api/chat-token')
        if (!response.ok) throw new Error('Chat access unavailable')
        return (await response.json()).access_token
      }}
    />
  )
}
```

React is a peer dependency, so the package uses the consuming application's existing React runtime. The framework-neutral core remains available without React.

### Web Component / plain TypeScript

```ts
import { mountChatWidget } from '@pt-agrinas-palma-nusantara/chat-widget'

const widget = mountChatWidget({
  apiBaseUrl: 'https://chat-api.agrinas.id',
  getAccessToken: async () => {
    const response = await fetch('/api/chat-token')
    if (!response.ok) throw new Error('Chat access unavailable')
    const body = await response.json()
    return body.access_token
  },
  position: 'bottom-right',
})

// Optional imperative controls:
widget.open()
widget.close()
widget.newConversation()
widget.destroy()
```

The widget uses Shadow DOM, fixed APN branding, and only exposes position and z-index options. Messages live only in widget memory and disappear on refresh, `newConversation()`, or `destroy()`. Assistant responses render a safe Markdown subset (paragraphs, lists, headings, emphasis, inline code, and HTTP links). Citation links fetch document files with the same short-lived Bearer Chat Token; tokens are never placed in document URLs.

## Headless client

```ts
import { createChatClient } from '@pt-agrinas-palma-nusantara/chat-widget'

const chat = createChatClient({ apiBaseUrl, getAccessToken })

await chat.streamMessage({
  message: 'Apa prosedur pengadaan langsung?',
  history: [
    { role: 'user', content: 'Apa batas pengadaan langsung?' },
    { role: 'assistant', content: 'Batasnya berbeda menurut unit.' },
  ],
  onEvent: console.log,
})
```

Only the ten most recent history items are sent. The stateless integration endpoint never creates a backend conversation.

Documents can also be fetched from the headless client:

```ts
const pdf = await chat.fetchDocument(documentId)
```
