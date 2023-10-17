import {isNotEmptyString} from "../utils/is";
import {postData} from "../utils/checkCron";

const bardUrl = isNotEmptyString(process.env.BARD_URL) ? process.env.BARD_URL : 'http://127.0.0.1:8082/getAnswerOfBard';

export async function chatBardProcess(ask: string,conversationId:string) {
	const data = {
		content: ask,
		conversationId: conversationId
	};
	const resp = await postData(bardUrl, data);
	console.log('bard响应参数：',resp);
	return resp;
}
