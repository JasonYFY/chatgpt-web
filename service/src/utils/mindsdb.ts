import MindsDB from 'mindsdb-js-sdk';

try {
	await MindsDB.connect({
		user: process.env.MINDSDB_USER,
		password: process.env.MINDSDB_PASSWORD
	});
} catch(error) {
	console.log('连接MindsDB报错了：',error);
}

export async function sendMindDB(msg: string) {

	var mysql = require('mysql');
	const query = `SELECT * FROM my_db.customer_data WHERE user=${mysql.escape(msg)}`;
	let matchingUserRow = '';
	try {
		const queryResult = await MindsDB.SQL.runQuery(query);
		if (queryResult.rows.length > 0) {
			matchingUserRow = queryResult.rows[0];
			console.log('查询MindsDB的值：',matchingUserRow);
		}
	} catch (error) {
		console.log('查询MindsDB报错了：',error);
	}
	return matchingUserRow;
}
