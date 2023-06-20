import {auth} from "../middleware/auth";
import {limiter} from "../middleware/limiter";
import {router} from "../index";
import LRUMap from 'lru-cache'
import {ChatMessage} from "chatgpt";


// 创建一个LRUMap实例，设置最大容量为1000，过期时间为1小时 用于保存上一次输出的内容
export const apiContextCache = new LRUMap<string, ChatMessage>({ max: 1000, maxAge: 10 * 60 * 6000  });

export interface Message {
	role: string;
	content: string;
}

export function extractLastUserContent(messages: Message[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].role === 'user') {
			return messages[i].content;
		}
	}
	return undefined;
}

export function extractLastAssistantContent(messages: Message[]): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].role === 'assistant') {
			return messages[i].content;
		}
	}
	return undefined;
}

export function extractSystemContent(messages: Message[]): string | undefined {
	for (let i = 0 ; i <= messages.length - 1; i++) {
		if (messages[i].role === 'system') {
			return messages[i].content;
		}
	}
	return undefined;
}


