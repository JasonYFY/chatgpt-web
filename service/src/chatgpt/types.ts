import type { ChatMessage } from 'chatgpt'
import type fetch from 'node-fetch'

export interface RequestOptions {
  message: string
  lastContext?: { conversationId?: string; parentMessageId?: string }
  process?: (chat: ChatMessage) => void
  systemMessage?: string
	clientIP?: string
  temperature?: number
  top_p?: number
	model?:string
	imageFileName?:string
}

export interface SetProxyOptions {
  fetch?: typeof fetch
}

export interface UsageResponse {
  total_usage: number
}

// @ts-ignore
export class ChatCozeError extends Error {
	statusCode?: string
	message?: string
}
