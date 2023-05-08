import * as openai from 'openai';
import * as concurrent from 'concurrent';
import { UploadFile } from 'fastify-multer/lib/interfaces';


function uploadFileToStream(uploadFile: UploadFile) {
	const streamifier = require('streamifier');
	const stream = streamifier.createReadStream(uploadFile.buffer);
	stream.name = uploadFile.filename;
	return stream;
}

async function processAudioApi(
	audio: UploadFile,
	timeout: number = 100000,
	model: string = 'whisper-1'
): Promise<string> {
	try {
		const fileStream = uploadFileToStream(audio);

		const params = {
			model: model,
			file: fileStream,
			request_timeout: timeout,
		};
		const transcript = await createAsync(params);

		if (transcript === null) {
			return 'ChatGptWebServerError:SomethingWrongInOpenaiWhisperApi';
		}

		const prompt = transcript['text'];
		console.info(`audio prompt: ${prompt}`);

		return prompt ? `data: ${prompt}` : 'ChatGptWebServerError:PromptIsEmpty';
	} catch (error) {
		console.error(error);
		return 'ChatGptWebServerError:SomethingWrong';
	}
}

async function createAsync(params: any): Promise<openai.Response<openai.Audio>> {
	const func = create;
	const { result, error } = await concurrent.try(() => func(params), {
		onRetry: (e: any) => e instanceof openai.error.RateLimitError,
		retries: 5,
		maxDelay: 60 * 1000, // 1 minute
	});

	if (error) {
		console.error(error);
		return null;
	}

	return result;
}

function create(params: any): Promise<openai.Response<openai.Audio>> {
	return openai.Audio.transcribe(params);
}
