import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
// import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions } from 'chatgpt'
// import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt'
import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions } from '../chatgptProxy'
import { ChatGPTAPI,ChatGPTUnofficialProxyAPI } from '../chatgptProxy'

import { SocksProxyAgent } from 'socks-proxy-agent'
import httpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'
import {sendResponse, loadBalancer, parseKeys, sleep} from '../utils'
import {generateUUID, isNotEmptyString} from '../utils/is'
import jwt_decode from 'jwt-decode'
import dayjs from 'dayjs'
import type { ApiModel, ChatContext, ChatGPTUnofficialProxyAPIOptions, ModelConfig,JWT } from '../types'
import LRUMap from 'lru-cache'
import type { RequestOptions, SetProxyOptions } from './types'
import {initCron} from "../utils/checkCron";
import {chatBardProcess, replaceImageTags} from "../bard/bardApi";
import {createChannel, initChannelCategory, idChannelCache, dateChannelMap} from "./coze";
import {ChatCozeError} from "./types";
import {getCurrentDate} from "../utils/commUtils";

const originalLog = console.log;

console.log = (...args: any[]) => {
	const localTime = new Date();
	const time = localTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
	const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');

	originalLog(`[${time}] ${message}`);
};



const { HttpsProxyAgent } = httpsProxyAgent

// 创建一个LRUMap实例，设置最大容量为200，过期时间为24小时
const ipCache = new LRUMap<string, string>({ max: 200, ttl: 1000 * 60 * 60 * 24});


dotenv.config()

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] 提供错误的API密钥 | Incorrect API key provided',
  403: '[OpenAI] 服务器拒绝访问，请稍后再试 | Server refused to access, please try again later',
  502: '[OpenAI] 错误的网关 |  Bad Gateway',
  503: '[OpenAI] 服务器繁忙，请稍后再试 | Server is busy, please try again later',
  504: '[OpenAI] 网关超时 | Gateway Time-out',
  500: '[OpenAI] 服务器繁忙，请稍后再试 | Internal Server Error',
}

const timeoutMs: number = !isNaN(+process.env.TIMEOUT_MS) ? +process.env.TIMEOUT_MS : 100 * 1000
const disableDebug: boolean = process.env.OPENAI_API_DISABLE_DEBUG === 'true'

let apiModel: ApiModel
const model = isNotEmptyString(process.env.OPENAI_API_MODEL) ? process.env.OPENAI_API_MODEL : 'gpt-3.5-turbo'

if (!isNotEmptyString(process.env.OPENAI_API_KEY) && !isNotEmptyString(process.env.OPENAI_ACCESS_TOKEN))
  throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

// let api: ChatGPTAPI | ChatGPTUnofficialProxyAPI
let api: ChatGPTUnofficialProxyAPI
let apiAcess: ChatGPTAPI

let accessTokens = parseKeys(process.env.OPENAI_ACCESS_TOKEN)
let nextBalancer =  loadBalancer(accessTokens)
export { ipCache,accessTokens,apiModel };
export function setAccessTokens(newTokens) {
	accessTokens = newTokens;
	nextBalancer =  loadBalancer(accessTokens);
}


const maxRetry: number = !isNaN(+process.env.MAX_RETRY) ? +process.env.MAX_RETRY : accessTokens.length;
const retryIntervalMs = !isNaN(+process.env.RETRY_INTERVAL_MS) ? +process.env.RETRY_INTERVAL_MS : 500;

(async () => {
  if (isNotEmptyString(process.env.OPENAI_API_KEY)) {
    const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

    const options: ChatGPTAPIOptions = {
      apiKey: process.env.OPENAI_API_KEY,
      completionParams: { model },
      debug: !disableDebug,
    }

    // increase max token limit if use gpt-4
    if (model.toLowerCase().includes('gpt-4')) {
      // if use 32k model
      if (model.toLowerCase().includes('32k')) {
        options.maxModelTokens = 32768
        options.maxResponseTokens = 8192
      }
      else {
        options.maxModelTokens = 8192
        options.maxResponseTokens = 2048
      }
    }
    else if (model.toLowerCase().includes('gpt-3.5')) {
      if (model.toLowerCase().includes('16k')) {
        options.maxModelTokens = 16384
        options.maxResponseTokens = 4096
      }
    }

    if (isNotEmptyString(OPENAI_API_BASE_URL))
      options.apiBaseUrl = `${OPENAI_API_BASE_URL}/v1`

    setupProxy(options)

		apiAcess = new ChatGPTAPI({ ...options })
    //apiModel = 'ChatGPTAPI'
		//初始化频道类别信息
		initChannelCategory()
  }

	//启动定时任务
	initCron();
	const options: ChatGPTUnofficialProxyAPIOptions = {
		accessToken: process.env.OPENAI_ACCESS_TOKEN,
		apiReverseProxyUrl: isNotEmptyString(process.env.API_REVERSE_PROXY) ? process.env.API_REVERSE_PROXY : 'https://ai.fakeopen.com/api/conversation',
		model,
		debug: !disableDebug,
	}

	setupProxy(options)

	api = new ChatGPTUnofficialProxyAPI({ ...options })
	apiModel = 'ChatGPTUnofficialProxyAPI'

})()

async function chatReplyProcess(options: RequestOptions) {
  const { message, lastContext, process, systemMessage
		,clientIP, temperature, top_p,model,imageFileName } = options

	try {

		console.log('Client IP:', clientIP); // 打印客户端IP地址
		console.log('model:', model);
		console.log('文件名称:', imageFileName);
		if (model&&model==='bard'){
			//访问bard
			let conversationIdBard
			if (!lastContext || !lastContext.conversationId){
				conversationIdBard = 'bard-'+generateUUID()
			}else{
				conversationIdBard = lastContext.conversationId
			}
			const respOfBard = await chatBardProcess(message,conversationIdBard,imageFileName);

			let respMsg = respOfBard.msg
			if(respOfBard){
				if (respOfBard.imageLinks){
					//把图片嵌入文字中
					console.log('respOfBard.imageLinks:', respOfBard.imageLinks.length);
					for (let i = 0; i < respOfBard.imageLinks.length; i++) {
						const imageLink = respOfBard.imageLinks[i];
						respMsg = replaceImageTags(respMsg,imageLink,respOfBard.imageLinks[i+1]);
						i = i+2;
					}
				}
				return sendResponse({ type: 'Bard'
					, data: {id:generateUUID(),conversationId:conversationIdBard,text:respMsg}})
			}
		}


    let options: SendMessageOptions = { timeoutMs }

    /*if (apiModel === 'ChatGPTAPI') {
      if (isNotEmptyString(systemMessage))
        options.systemMessage = systemMessage
      options.completionParams = { model, temperature, top_p }
    }*/

		//查询ip缓存中是否有token
		let ipToken = ipCache.get(clientIP);
    if (lastContext != null) {
      if (apiModel === 'ChatGPTAPI')
        options.parentMessageId = lastContext.parentMessageId
			else if(model==='gpt4-coze'){
				options = {...lastContext}
			}else{
				if (ipToken) {
					//有token才赋值上下文 需要判断conversationId是否为coze的，否则不要用
					if(lastContext && lastContext.conversationId
						&& !lastContext.conversationId.includes('coze')
						&& !lastContext.conversationId.includes('bard')
						&& lastContext.parentMessageId){
						// conversationId 和 parentMessageId 都存在时才赋值
						options = {...lastContext}
					}

				}
			}

    }

		let retryCount = 0
		if (apiModel === 'ChatGPTUnofficialProxyAPI' && model==='gpt-3.5-turbo') {
			//console.log('Client IP:', clientIP) // 打印客户端IP地址
			if (process)
				options.onProgress = process
			let response: ChatMessage | void

			//定义重试时是否需要重新获取token
			let retryNextToken = false;
			while (!response && retryCount++ < maxRetry) {
				// 将客户端IP地址存储到LRUMap中
				if (!ipToken || retryNextToken) {
					//没有在缓存里,获取一个新的保存
					ipToken = nextBalancer();
					console.log('新ip保存下token。(是否为重新获取：',retryNextToken);
					retryNextToken = false;
				}
				//让数据保存久点
				ipCache.set(clientIP, ipToken);

				//重新赋值
				(api as ChatGPTUnofficialProxyAPI).accessToken = ipToken;
				response = await api.sendMessage(message, options).catch((error: any) => {
					if (error.statusCode === 404 || error.statusCode === 403){
						console.log('报错了404或者403，',error);
						const { conversationId, parentMessageId, ...rest } = options;
						options = { ...rest };
						console.log('准备重新新执行retryCount：',retryCount);
					}else if (error.statusCode === 429){
						// 429 Too Many Requests
						console.log('报错了429',error);
						if(!lastContext || !lastContext.conversationId || !lastContext.parentMessageId){
							console.log('没有上下文关联，重试时可重新获取token');
							retryNextToken = true;
						}
						if(retryCount===maxRetry){
							throw new Error("多人使用中，请稍后再试！（或可新建聊天再试）");
						}
						console.log('准备重新新执行retryCount：',retryCount);
					}else if (error.statusCode === 401){
						console.log('报错了401',error);
						//401是由于token过期了，所以需要换一个
						retryNextToken = true;
					}else{
						console.error('未知错误',error);
						throw error
					}
				});
				if(!response){
					console.log('等待：',retryIntervalMs);
					await sleep(retryIntervalMs);
				}
				if (response && !response.text.trim()){
					console.log('响应为空字符串：',response);
					response = undefined
				}
			}
			//console.log('响应的消息：',response);
			return sendResponse({ type: 'Success', data: response })
		}


		if(!options.conversationId){
			//创建一个自定义的回话id
			options.conversationId = 'coze-'+generateUUID()
		}

		//查找是否有对应的频道id
		let channelId = idChannelCache.get(options.conversationId);
		if (!channelId){
			console.log(`新conversationId:${options.conversationId}，需要创建频道`)
			channelId = await creatChannel(clientIP, options);
		}
		let responseApi
		//最大的重试次数
		const maxRetryNum = 2;
		while (!responseApi && retryCount++ < maxRetryNum) {
			responseApi = await apiAcess.sendMessageCoze(message, channelId, {
				...options,
				onProgress: (partialResponse) => {
					process?.(partialResponse)
				},
			}).catch(async (error: any) => {
				console.error('访问Coze报错', error);
				if (retryCount<maxRetryNum){
					const errorMessage = error.message;
					if(errorMessage.includes('prompt已超过限制')) throw error

					console.log('有可能是频道有问题，重新获取频道，重新新执行retryCount：', retryCount);
					channelId = await creatChannel(clientIP, options);
				}else{
					throw error
				}
			})
		}

    return sendResponse({ type: 'Success', data: responseApi })
  }
  catch (error: any) {
    const code = error.statusCode
    global.console.log(error)
    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
    return sendResponse({ type: 'Fail', message: error.message ?? 'Please check the back-end console' })
  }
}

async function creatChannel(clientIP: string, options: SendMessageOptions) {
	const currentDate = getCurrentDate();
	let channelId = await createChannel(currentDate,clientIP)
	if (channelId) {
		idChannelCache.set(options.conversationId, channelId);
		//记录日期->频道id的map
		let channelArray:Array<string> = dateChannelMap.get(currentDate);
		if (!channelArray){
			channelArray =  []
		}
		channelArray.push(channelId)
		dateChannelMap.set(currentDate,channelArray);
	}
	return channelId;
}

async function fetchBalance() {
	// 计算起始日期和结束日期
	const now = new Date();
	const startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
	const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

	const OPENAI_API_KEY = process.env.OPENAI_API_KEY
	const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

  if (!isNotEmptyString(OPENAI_API_KEY))
    return Promise.resolve('-')

  const API_BASE_URL = isNotEmptyString(OPENAI_API_BASE_URL)
    ? OPENAI_API_BASE_URL
    : 'https://api.openai.com'

	// 设置API请求URL和请求头
	const urlSubscription = `${API_BASE_URL}/v1/dashboard/billing/subscription`; // 查是否订阅
	const urlBalance = `${API_BASE_URL}/dashboard/billing/credit_grants`; // 查普通账单
	const urlUsage = `${API_BASE_URL}/v1/dashboard/billing/usage?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}`; // 查使用量
	const headers = {
		"Authorization": "Bearer " + OPENAI_API_KEY,
		"Content-Type": "application/json"
	};

  try {
		// 获取API限额
		let response = await fetch(urlSubscription, {headers});

		if (!response.ok) {
			console.log("您的账户已被封禁，请登录OpenAI进行查看。");
			return;
		}
		const subscriptionData = await response.json();
		const totalAmount = subscriptionData.hard_limit_usd;

		// 获取已使用量
		response = await fetch(urlUsage, {headers});
		const usageData = await response.json();
		const totalUsage = usageData.total_usage / 100;

		// 计算剩余额度
		const balance = totalAmount - totalUsage;

		// 输出余额信息
		console.log(`balance: ${balance.toFixed(3)}`);
		console.log(`使用量: ${totalUsage.toFixed(3)}`);

		return Promise.resolve(balance.toFixed(3))

  }
  catch {
    return Promise.resolve('-')
  }
}


function formatDate(date) {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');

	return `${year}-${month}-${day}`;
}


function formatDateUse(): string[] {
	const today = new Date()
	const year = today.getFullYear()
	const month = today.getMonth() + 1
	const lastDay = new Date(year, month, 0)
	const formattedFirstDay = `${year}-${month.toString().padStart(2, '0')}-01`
	const formattedLastDay = `${year}-${month.toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`
	return [formattedFirstDay, formattedLastDay]
}

async function chatConfig() {
	let balance = '-';
	if (apiModel === 'ChatGPTAPI'){
		balance = await fetchBalance();
	}
  const reverseProxy = process.env.API_REVERSE_PROXY ?? '-'
  const httpsProxy = (process.env.HTTPS_PROXY || process.env.ALL_PROXY) ?? '-'
  const socksProxy = (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT)
    ? (`${process.env.SOCKS_PROXY_HOST}:${process.env.SOCKS_PROXY_PORT}`)
    : '-';

	let accessTokenExpirationTime = ''
	if (apiModel === 'ChatGPTUnofficialProxyAPI' && process.env.OPENAI_ACCESS_TOKEN) {
		try {

			for (let i = 0; i < accessTokens.length; i++) {
				const jwt = jwt_decode(accessTokens[i]) as JWT
				console.log(jwt);
				if (jwt.exp){
					accessTokenExpirationTime += dayjs.unix(jwt.exp).format('YYYY-MM-DD HH:mm:ss');
					if(i<accessTokens.length-1)
						accessTokenExpirationTime+=',';
				}
			}
		}
		catch (error) {
			console.warn('[jwt_decode]', error)
		}
	}
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: { apiModel, reverseProxy, timeoutMs, socksProxy, httpsProxy, balance,accessTokenExpirationTime },
  })
}

function setupProxy(options: SetProxyOptions) {
  if (isNotEmptyString(process.env.SOCKS_PROXY_HOST) && isNotEmptyString(process.env.SOCKS_PROXY_PORT)) {
    const agent = new SocksProxyAgent({
      hostname: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT,
      userId: isNotEmptyString(process.env.SOCKS_PROXY_USERNAME) ? process.env.SOCKS_PROXY_USERNAME : undefined,
      password: isNotEmptyString(process.env.SOCKS_PROXY_PASSWORD) ? process.env.SOCKS_PROXY_PASSWORD : undefined,
    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else if (isNotEmptyString(process.env.HTTPS_PROXY) || isNotEmptyString(process.env.ALL_PROXY)) {
    const httpsProxy = process.env.HTTPS_PROXY || process.env.ALL_PROXY
    if (httpsProxy) {
      const agent = new HttpsProxyAgent(httpsProxy)
      options.fetch = (url, options) => {
        return fetch(url, { agent, ...options })
      }
    }
  }
  else {
    options.fetch = (url, options) => {
      return fetch(url, { ...options })
    }
  }
}

function currentModel(): ApiModel {
  return apiModel
}

export type { ChatContext, ChatMessage }

export { chatReplyProcess, chatConfig, currentModel }
