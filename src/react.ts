'use client'

import { useEffect, useRef } from 'react'

import type { ChatWidgetConfig } from './types.js'
import { mountChatWidget } from './widget.js'

export type ChatAgriaUIProps = ChatWidgetConfig

/** Declarative React adapter for the framework-neutral AGRIA Web Component. */
export function ChatAgriaUI({
  apiBaseUrl,
  getAccessToken,
  position,
  zIndex,
}: ChatAgriaUIProps): null {
  const tokenGetter = useRef(getAccessToken)
  tokenGetter.current = getAccessToken

  useEffect(() => {
    const controller = mountChatWidget({
      apiBaseUrl,
      getAccessToken: () => tokenGetter.current(),
      position,
      zIndex,
    })
    return () => controller.destroy()
  }, [apiBaseUrl, position, zIndex])

  return null
}
