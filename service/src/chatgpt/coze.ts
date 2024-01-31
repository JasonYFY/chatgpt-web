
//用于保存ip和频道的映射缓存
import {channelInfo} from "./types";
import {postData} from "../utils/checkCron";
import {isNotEmptyString} from "../utils/is";

const cozeUrl = isNotEmptyString(process.env.OPENAI_API_BASE_URL) ? process.env.OPENAI_API_BASE_URL : 'http://127.0.0.1:7077';
export const ipChannelCache = new Map<string,channelInfo>();

export async function createChannel(name: string){
	const data = {
		"name": name,
		"parentId": "1202072372614533190"
	};
	const resp = await postData(cozeUrl+'/api/channel/create', data);
	console.log('创建频道响应参数：',resp);
	// @ts-ignore
	if (resp.success){
		// @ts-ignore
		return resp.data;
	}
	return undefined;
}
