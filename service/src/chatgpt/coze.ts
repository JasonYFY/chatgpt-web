import {isNotEmptyString} from "../utils/is";
import {fetchData, getCurrentDateSubTwoDay, postData} from "../utils/commUtils";
import * as dotenv from "dotenv";
import cron from 'node-cron';

dotenv.config();
const cozeUrl = isNotEmptyString(process.env.OPENAI_API_BASE_URL) ? process.env.OPENAI_API_BASE_URL : 'http://127.0.0.1:7077';
//用于保存回话id和频道的映射缓存
export const idChannelCache = new Map<string,string>();
//记录日期->频道id的map
export const dateChannelMap = new Map<string,Array<string>>();
// 设定定时任务的执行规律
const schedule = isNotEmptyString(process.env.COZE_CHECK) ? process.env.COZE_CHECK : '08 0 * * *';


//创建频道
export async function createChannel(date:string,name: string){
	const data = {
		"name": date+"_"+name,
		"parentId": "1202072372614533190"
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


//创建频道类别
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

//维护频道--用于每天删除频道
export async function vindicateChannelCron() {
	//删除2天之前的频道类别
	const currentDatePlusTwoDay = getCurrentDateSubTwoDay();
	console.log(`准备删除${currentDatePlusTwoDay}天及之前的频道类别`);
	// 遍历 Map，并根据条件删除元素
	dateChannelMap.forEach(async (value, key) => {
		if (key <= currentDatePlusTwoDay) {
			console.log(`${key}的频道为2天及之前的，准备删除`);
			for (let item of value) {
				const resp = await fetchData(cozeUrl+'/api/channel/del/'+item);
				console.log('删除频道类别响应参数：',resp);
			}
			// @ts-ignore
			if (resp.success){
				dateChannelMap.delete(key);
			}
		}
	});
}

//启动频道维护
export async function initChannelCategory(){
	//维护频道类别--用于每天删除频道
	cron.schedule(schedule, vindicateChannelCron);
}

