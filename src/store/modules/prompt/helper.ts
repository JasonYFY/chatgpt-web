import { ss } from '@/utils/storage'
//import ChatGPTPromptTemplate from '../../../assets/ChatGPTPromptTemplate.json'

const LOCAL_NAME = 'promptStore'
//const ChatGPTPromptTemplateList = ChatGPTPromptTemplate

export type PromptList = []

export interface PromptStore {
  promptList: PromptList
}

export function getLocalPromptList(): PromptStore {
  const promptStore: PromptStore | undefined = ss.get(LOCAL_NAME)
	return promptStore ?? { promptList: [] }
  // @ts-ignore
	//return promptStore ?? { promptList: ChatGPTPromptTemplateList }
}

export function setLocalPromptList(promptStore: PromptStore): void {
  ss.set(LOCAL_NAME, promptStore)
}
