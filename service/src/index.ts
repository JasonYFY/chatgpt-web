import express from 'express'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'
import {
	apiContextCache,
	extractLastAssistantContent,
	extractLastUserContent,
	extractSystemContent
} from "./chatgpt/apiToToken";

const app = express()
const router = express.Router()

app.use(express.static('public'))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')
  try {
    const { prompt, options = {}, systemMessage, temperature, top_p,usingGpt4 } = req.body as RequestProps

		//获取客户端ip
		let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress
		if(clientIP){
			//改造下，由于获取不了真实ip,所以需加上用户代理信息（包含了用户代理信息，它提供了关于客户端使用的浏览器、操作系统和设备的详细信息）作为key
			clientIP = clientIP+req.headers['user-agent'];
		}
		let firstChunk = true
		//记录上一次输出的内容
		let previousContent = '';
    await chatReplyProcess({
      message: prompt,
			clientIP: clientIP,
      lastContext: options,
      process: (chat: ChatMessage) => {
				//console.log('chat响应的信息：',chat)
				if(firstChunk && chat.text===prompt){
					//console.log('chat响应的信息是提问的问题',prompt)
					return;
				}
				if(chat.text.length>previousContent.length){
					let currentContent = chat.text.substring(previousContent.length);
					previousContent = chat.text;
					chat.text = currentContent;
					//console.log('chat响应的信息：',chat)
					res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
					firstChunk = false;
				}
      },
      systemMessage,
      temperature,
      top_p,
			usingGpt4,
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/chat/completions', [ auth, limiter], async (req, res) => {
	const headers: { [key: string]: string } = {
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
		'Content-Type': 'text/event-stream',
		'Access-Control-Allow-Origin': '*',
	}

	res.writeHead(200, headers)

	try {
		//获取请求的用户
		let user = req.headers['user'] || req.socket.remoteAddress;

		const {messages} = req.body;
		//获取询问的内容,取最后一个角色为user的用户内容
		const msg = extractLastUserContent(messages);
		//console.log('询问的内容：',msg)
		const sysMsg = extractSystemContent(messages);
		//console.log('sys的信息：',sysMsg)

		//记录上一次输出的内容
		let previousContent = '';
		//判断是否第一次返回
		let firstChunk = true;
		//记录最后一次输出的信息
		let preInfo;
		//需要输出一个换行
		res.write(`data:\n\n`);

		const lastInfo = apiContextCache.get(user);
		if(msg.trim()==="继续"){
			//console.log('body的信息：',messages)
			let lastAssContext = extractLastAssistantContent(messages);
			//console.log('上一次响应的内容：',lastAssContext);
			console.log('上一次回答的信息：',lastInfo);
			if(lastInfo){
				lastAssContext = lastAssContext.replace(/\n \(还有剩余结果，请回复【继续】查看！\)/, '');
				//console.log('上一次响应的内容(替换后)：',lastAssContext);
				const remainContext = lastInfo.text.replace(lastAssContext,'');
				const chunkData = `{"choices": [{"delta": {"content": ${JSON.stringify(remainContext)}}}]}`;
				console.log('响应的剩余的信息：', chunkData);
				res.write(`data: ${chunkData}\n\n`);
				return;
			}
		}

		let lastContext;
		if(lastInfo){
			let lastAssContext = extractLastAssistantContent(messages);
			if(lastAssContext){
				//请求的信息有连续提问信息时，才用原来的会话id
				lastContext = {conversationId:lastInfo.conversationId,parentMessageId:lastInfo.id}
			}
		}
		//console.log('请求的lastContext：', lastContext);
		await chatReplyProcess({
			message: sysMsg+msg,
			clientIP: user,
			lastContext: lastContext,
			process: (chat: ChatMessage) => {
				if(firstChunk && chat.text===sysMsg+msg){
					//console.log('chat响应的信息是提问的问题',prompt)
					return;
				}
				//console.log('chat响应的信息：',chat)
				if(chat.text.length>previousContent.length){
					let currentContent = chat.text.substring(previousContent.length);
					previousContent = chat.text;
					const chunkData = `{"choices": [{"delta": {"content": ${JSON.stringify(currentContent)}}}]}`;
					//console.log('响应的信息：', chunkData);
					res.write(`data: ${chunkData}\n\n`);
					firstChunk = false;
				}
				preInfo = chat;
			}
		})
		//保存下输出的内容，用于中断后可“继续”回复后续内容
		apiContextCache.set(user,preInfo);
		//console.log('响应结束,总的输出内容：',preInfo)

	}
	catch (error) {
		console.error('chat/completions报错了：',error);
		const errorData = `{"choices": [{"delta": {"content": ${JSON.stringify(error)}}}]}`;
		res.write(`data: ${errorData}\n\n`);
	}finally {
		res.end()
	}
})



app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

const port = process.env.SERVICE_PORT || 3002
app.listen(port, () => globalThis.console.log(`Server is running on port ${port}`))
