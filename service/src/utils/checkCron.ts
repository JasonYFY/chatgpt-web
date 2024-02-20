import cron from 'node-cron';
import {isNotEmptyString} from "./is";
import jwt_decode from 'jwt-decode'
import dayjs from 'dayjs'
import {parseKeys} from './index'
import {JWT} from "../types";
import {ipCache,accessTokens,setAccessTokens} from "../chatgpt";
import {updateEnvFile} from "./operateEnv";
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path';
import {getCurrentDatePlusTwoDay, parseJsonString, postData} from "./commUtils";

dotenv.config();
// 设定定时任务的执行规律
const schedule = isNotEmptyString(process.env.TOKEN_CHECK) ? process.env.TOKEN_CHECK : '10 0 * * *';
const loginUrl = isNotEmptyString(process.env.TOKEN_LOGIN_URL) ? process.env.TOKEN_LOGIN_URL : 'http://127.0.0.1:8080/chatgpt/login';
const loginUrlOfMicros = isNotEmptyString(process.env.TOKEN_LOGIN_MICROS_URL) ? process.env.TOKEN_LOGIN_MICROS_URL : 'http://127.0.0.1:8082/getTokenOfOpenAi';
//定义用户登录信息的map
let userInfoMap = new Map();


export async function initCron(){
	try {
		if(isNotEmptyString(process.env.TOKEN_USER_INFO)){
			console.log('启动定时任务,schedule:',schedule);
			//获取登录用户的json数组，并转化成map集合
			const userInfoArray = parseJsonString(process.env.TOKEN_USER_INFO);
			userInfoArray.forEach((userInfo: any) => {
				const username = userInfo.username;
				userInfoMap.set(username, userInfo);
			});
			cron.schedule(schedule, checkTokenExpires);
			cron.schedule(schedule, deleteAllFiles);
		}

	} catch(error) {
		console.error('定时任务报错了：',error);
	}
}


function deleteAllFiles(): void {
	const directoryPath = "./uploads"
	console.log('定时任务开始--删除所有的文件');
	try {
		// 确保路径存在
		if (!fs.existsSync(directoryPath)) {
			console.error('Directory does not exist:', directoryPath);
			return;
		}

		// 获取指定路径下的所有文件
		const files = fs.readdirSync(directoryPath);

		// 遍历所有文件
		for (const file of files) {
			// 获取文件路径
			const filePath = path.join(directoryPath, file);

			// 检查是否为文件
			const isFile = fs.statSync(filePath).isFile();

			// 删除文件
			if (isFile) {
				fs.unlinkSync(filePath);
				console.log(`Deleted file: ${filePath}`);
			}
		}
	} catch (err) {
		console.error('Error deleting files:', err);
	}
}


async function checkTokenExpires() {
	console.log('定时任务开始--检查token是否快过期');
	//提前两天去检查更新
	const currentDatePlusTwoDay = getCurrentDatePlusTwoDay();
	for (let i = 0; i < accessTokens.length; i++) {
		const jwt = jwt_decode(accessTokens[i]) as JWT;
		if (jwt.exp) {
			const expirationTime = dayjs.unix(jwt.exp).format('YYYY-MM-DD');
			if (currentDatePlusTwoDay >= expirationTime) {
				const email = jwt["https://api.openai.com/profile"].email;
				console.log('准备过期了，email:',email,',过期时间:',dayjs.unix(jwt.exp).format('YYYY-MM-DD HH:mm:ss'));
				//console.log('userInfoMap:',...userInfoMap);
				//取出参数
				console.log('准备执行的email：',email.trim());
				const userInfo = userInfoMap.get(email.trim());
				console.log('准备执行的userInfo：',userInfo);
				if(userInfo){
					var accessToken;
					if(userInfo.type){
						for (let i = 0; i < accessTokens.length; i++) {
							console.log('[浏览器方式]准备登录获取token,username:', email);
							const resp = await postData(loginUrlOfMicros, userInfo);
							console.log('响应参数：', resp);
							if (!resp || resp.status !== 'success') {
								console.error('[浏览器方式] 报错：', resp.message)
							}
							accessToken = resp.data;
							if(accessToken){
								console.log('[浏览器方式] 获取成功，不再循环获取');
								break;
							}
							console.log('[浏览器方式] 获取失败，准备循环获取，第',i+1,'次');
						}
					}else{
						//console.log('准备登录获取token,userInfo:',userInfo);
						const resp = await postData(loginUrl, userInfo);
						console.log('响应参数：',resp);
						accessToken = resp.accessToken;
					}
					if(accessToken){
						//替换配置文件的内容
						let openaiaccesstoken = process.env.OPENAI_ACCESS_TOKEN;
						process.env.OPENAI_ACCESS_TOKEN = openaiaccesstoken.replace(accessTokens[i],accessToken);
						console.log('更改后的OPENAI_ACCESS_TOKEN：',process.env.OPENAI_ACCESS_TOKEN);
						updateEnvFile('OPENAI_ACCESS_TOKEN',process.env.OPENAI_ACCESS_TOKEN);
						//清空ipCache
						ipCache.clear();
						//重新赋值
						setAccessTokens(parseKeys(process.env.OPENAI_ACCESS_TOKEN));
					}

				}
			}
		}
	}
	console.log('定时任务结束--检查token是否快过期');
}



