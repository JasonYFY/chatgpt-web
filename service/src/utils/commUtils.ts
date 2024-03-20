import dayjs from "dayjs";
import fetch from "node-fetch";
import {a} from "js-tiktoken/dist/core-0e8c0717";

export function parseJsonString(jsonString: string): any {
	try {
		return JSON.parse(jsonString);
	} catch (error) {
		console.error('Error parsing JSON:', error);
		return null;
	}
}

export function getCurrentDate(): string {
	return dayjs().format('YYYY-MM-DD');
}


//获取2天后的日期
export function getCurrentDatePlusTwoDay(): string {
	const nextDay = dayjs().add(2, 'day');
	return nextDay.format('YYYY-MM-DD');
}

//获取3前天的日期
export function getCurrentDateSubTwoDay(): string {
	const nextDay = dayjs().subtract(3, 'day');
	return nextDay.format('YYYY-MM-DD');
}

export async function fetchData(url: string) {
	console.log('get请求的url:', url)
	const openaiapikey = process.env.OPENAI_API_KEY;
	try {
		const response = await fetch(url, {
			headers: {
				'Authorization': openaiapikey,
				'proxy-secret': openaiapikey
			}
		});
		return await response.json();
	} catch (error) {
		console.error('get请求发生错误:', error);
	}
}

export async function postData(url: string, data: Record<string, any>) {
	try {
		const openaiapikey = process.env.OPENAI_API_KEY;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': openaiapikey,
				'proxy-secret': openaiapikey
			},
			body: JSON.stringify(data)
		});

		return await response.json();
	} catch (error) {
		console.error('Error:', error);
	}
}
