import {isNotEmptyString} from "../utils/is";
import {
	fetchData,
	getCurrentDate,
	getCurrentDateSubTwoDay,
	parseJsonString,
	postData
} from "../utils/commUtils";
import {updateEnvFile} from "../utils/operateEnv";
import * as dotenv from "dotenv";
import cron from 'node-cron';

dotenv.config();
const cozeUrl = isNotEmptyString(process.env.OPENAI_API_BASE_URL) ? process.env.OPENAI_API_BASE_URL : 'http://127.0.0.1:7077';
//用于保存回话id和频道的映射缓存
export const idChannelCache = new Map<string,string>();
//频道类别信息的map
export const channelParentMap = new Map();
//记录当前频道类别id
let currentChannelCategoryId = '';
// 设定定时任务的执行规律
const schedule = isNotEmptyString(process.env.COZE_CHECK) ? process.env.COZE_CHECK : '08 0 * * *';


//创建频道
export async function createChannel(name: string){
	const data = {
		"name": name,
		"parentId": currentChannelCategoryId
	};
	const resp = await postData(cozeUrl+'/api/channel/create', data);
	console.log('创建频道响应参数：',resp);
	// @ts-ignore
	if (resp.success){
		// @ts-ignore
		return resp.data.id;
	}
	return undefined;
}


//创建频道
export async function createChannelCategory(name: string) {
	const data = {
		"name": name,
	};
	const resp = await postData(cozeUrl + '/api/channel/createCategory', data);
	console.log('创建频道类别响应参数：', resp);
	// @ts-ignore
	if (resp.success) {
		// @ts-ignore
		return resp.data.id;
	}
	return undefined;
}

//维护频道类别--用于每天创建和删除类别
export async function vindicateChannelCategoryCron() {
	//删除2天之前的频道类别
	const currentDatePlusTwoDay = getCurrentDateSubTwoDay();
	console.log(`准备删除${currentDatePlusTwoDay}天及之前的频道类别`);
	// 遍历 Map，并根据条件删除元素
	channelParentMap.forEach(async (value, key) => {
		if (key <= currentDatePlusTwoDay) {
			console.log(`${key}的频道类别为2天及之前的，准备删除`);
			const resp = await fetchData(cozeUrl+'/api/channel/del/'+value);
			console.log('删除频道类别响应参数：',resp);
			// @ts-ignore
			if (resp.success){
				channelParentMap.delete(key);
			}
		}
	});
	await createCurrentDateChannelCategory()
}

//初始化频道类别信息
export async function initChannelCategory(){
	try {
		if(isNotEmptyString(process.env.CHANNEL_PARENT_INFO)){
			//获取登录用户的json数组，并转化成map集合
			parseJsonString(process.env.CHANNEL_PARENT_INFO).forEach((channelParentInfo: any) => {
				channelParentMap.set(channelParentInfo.date, channelParentInfo.channelId);
			});

			await createCurrentDateChannelCategory()
			//维护频道类别--用于每天创建和删除类别
			cron.schedule(schedule, vindicateChannelCategoryCron);
		}
	} catch(error) {
		console.error('初始化频道类别信息报错了：',error);
	}
}
//创建当前日期的频道类别
async function createCurrentDateChannelCategory() {
	const currentDate = getCurrentDate()
	const currentId = channelParentMap.get(currentDate);
	if(!currentId){
		//检查是否有当前日期的频道类别，若没有，则创建
		console.log(`没有当前日期${currentDate}的频道类别，准备创建`)
		const id = await createChannelCategory(currentDate)
		if (id){
			console.log(`创建频道类别${currentDate}成功`)
			currentChannelCategoryId = id;
			channelParentMap.set(currentDate,id)
		}
		//保存频道类别信息
		saveChannelParent()
	}else{
		currentChannelCategoryId = currentId;
	}
}

//保存频道类别信息
function saveChannelParent() {
	// 将 Map 转换成对象数组
	let jsonArray = Array.from(channelParentMap.entries()).map(([key, value]) => {
		return { "date":key,"channelId":value };
	});

	// 将数组转换成 JSON 字符串
	let jsonString = JSON.stringify(jsonArray);

	console.log('准备保存的频道类型json:',jsonString);
	updateEnvFile('CHANNEL_PARENT_INFO',jsonString);
}
