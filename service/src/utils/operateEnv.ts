import * as fs from 'fs';

export function updateEnvFile(key: string, value: string): void {
	const envFilePath = '.env';

	try {
		// 读取 .env 文件内容
		const envFileContent = fs.readFileSync(envFilePath, 'utf8');

		// 将 .env 文件内容按行拆分为数组
		const lines = envFileContent.split('\n');

		// 遍历每一行，查找并更新指定的键值对
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line.startsWith(key + '=')) {
				lines[i] = `${key}=${value}`;
				break;
			}
		}

		// 将更新后的内容写回 .env 文件
		const updatedEnvFileContent = lines.join('\n');
		fs.writeFileSync(envFilePath, updatedEnvFileContent, 'utf8');

		console.log('.env 文件已更新');
	} catch (error) {
		console.error('无法更新 .env 文件', error);
	}
}
