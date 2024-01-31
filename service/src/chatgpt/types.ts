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
//用于保存频道信息
export interface channelInfo {
	channelId: string
	createTime:string
}
