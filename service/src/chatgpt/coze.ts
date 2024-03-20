import {isNotEmptyString} from "../utils/is";
import {fetchData, getCurrentDateSubThreeDay, postData} from "../utils/commUtils";
import * as dotenv from "dotenv";
import cron from 'node-cron';
import {CustomMap} from "../utils/CustomMap";

dotenv.config();
const cozeUrl = isNotEmptyString(process.env.OPENAI_API_BASE_URL) ? process.env.OPENAI_API_BASE_URL : 'http://127.0.0.1:7077';
//用于保存回话id和频道的映射缓存
export const idChannelCache = new CustomMap<string,string,string>();
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
	const currentDatePlusThreeDay = getCurrentDateSubThreeDay();
	console.log(`准备删除${currentDatePlusThreeDay}天及之前的频道`);
	// 遍历 Map，并根据条件删除元素
	idChannelCache.forEach(async (key, value, dateValue) => {
		if (dateValue <= currentDatePlusThreeDay) {
			console.log(`${value}的频道为${currentDatePlusThreeDay}天及之前的，准备删除`);
			const resp = await fetchData(cozeUrl+'/api/channel/del/'+value);
			console.log('删除频道响应参数：',resp);
			if (resp.success){
				idChannelCache.delete(key);
			}
		}
	});
}

//启动频道维护
export async function initChannelCategory(){
	//维护频道类别--用于每天删除频道
	cron.schedule(schedule, vindicateChannelCron);
}

