import MindsDB from 'mindsdb-js-sdk';
import axios from 'axios';

export function initMindDB(){
	try {
		//console.info('连接MindsDB用户名：',process.env.MINDSDB_USER);
		//console.info('连接MindsDB密码：',process.env.MINDSDB_PASSWORD);
		const customAxios = axios.create({
			timeout: 180000,
		});
		MindsDB.connect({
			user: process.env.MINDSDB_USER,
			password: process.env.MINDSDB_PASSWORD,
			httpClient:customAxios
		});
	} catch(error) {
		console.error('连接MindsDB报错了：',error);
	}
}

export async function sendMindDB(msg: string) {

	console.log('去问MindsDB：',msg);
	var mysql = require('mysql');
	const query = `SELECT response FROM mindsdb.gpt4hassio WHERE text=${mysql.escape(msg)}`;
	//若有sql语句，则需单引号替换成双引号才行
	let newQuery = query.replace(/'/g, '"');
	console.log('MindsDB的SQL：',newQuery);
	let matchingUserRow = '';
	try {
		const queryResult = await MindsDB.SQL.runQuery(newQuery);
		console.log('MindsDB的响应：',queryResult);
		if (queryResult.rows.length > 0) {
			matchingUserRow = queryResult.rows[0];
			//console.log('查询MindsDB的值：',matchingUserRow);
		}
		if(queryResult.error_message){
			matchingUserRow = queryResult.error_message;
		}
	} catch (error) {
		console.error('查询MindsDB报错了：',error);
		throw error;
	}
	return matchingUserRow;
}
