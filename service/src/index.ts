import express from 'express'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'
import {Auth0} from "./utils/accessTokenAuth";

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
    await chatReplyProcess({
      message: prompt,
			clientIP: clientIP,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
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


router.post('/getAccessToken', async (req, res) => {
	try {
		const { username,password } = req.body as { username: string,password:string }
		console.log('getAccessToken接口的参数:', req.body);
		if (username&&password){
			const auth0 = new Auth0('yifangyu_jason@163.com', 'Yfy.159177');
			auth0.auth()
				.then((accessToken: string) => {
					// 身份验证成功，可以使用访问令牌进行后续操作
					console.log('Access Token:', accessToken);
					// 在这里执行其他操作...
				})
				.catch((error: Error) => {
					// 身份验证失败，处理错误
					console.error('Authentication Error:', error.message);
				});
			res.send({ status: 'Success', message: 'successfully', data: null })
		}else{
			res.send({ status: 'Fail', message: 'no params', data: null })
		}
	}
	catch (error) {
		res.send({ status: 'Fail', message: error.message, data: null })
	}
})


app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

const port = process.env.SERVICE_PORT || 3002
app.listen(port, () => globalThis.console.log(`Server is running on port ${port}`))
