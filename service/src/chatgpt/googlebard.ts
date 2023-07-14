import { Bard } from "googlebard";
import {RequestOptions} from "./types";



export { chatBardProcess }
async function chatBardProcess(ask: string) {
	console.log('询问：',ask);
	let cookies = `__Secure-1PSID=YAiFHmw7F5sFa6HNO43F4CqzXSRejdM6KFEouuaCThoD8n4dDo3I-s9TzkZWJYcHhYtjMw.`;
	let bot = new Bard(cookies);
	console.log('连接成功');
	let conversationId = "fd7d95b9d7cc6cbcf31c683c20a121ab";

	await bot.askStream(
		(res) => {
			console.log(res);
		}, // returns the response
		ask,
		conversationId,
	);
}
