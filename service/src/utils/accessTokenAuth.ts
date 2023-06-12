import { format, parseISO, addMinutes, isAfter } from 'date-fns';
import * as querystring from 'querystring';
import axios from 'axios';

export class Auth0 {
	session_token: string | null;
	email: string;
	password: string;
	use_cache: boolean;
	session: any;
	req_kwargs: any;
	access_token: string | null;
	expires: Date | null;
	user_agent: string;
	api_prefix: string;

	constructor(email: string, password: string, proxy: string | null = null, use_cache: boolean = true) {
		this.session_token = null;
		this.email = email;
		this.password = password;
		this.use_cache = use_cache;
		this.session = axios.create();
		this.req_kwargs = {
			proxies: proxy
				? {
					http: proxy,
					https: proxy,
				}
				: null,
			verify: true,
			timeout: 5000,
		};
		this.access_token = null;
		this.expires = null;
		this.user_agent =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';
		this.api_prefix = process.env.CHATGPT_API_PREFIX || 'https://ai.fakeopen.com';
	}

	private static checkEmail(email: string): boolean {
		const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/;
		return regex.test(email);
	}

	auth(login_local: boolean = true): string {
		if (this.use_cache && this.access_token && this.expires && isAfter(new Date(), this.expires)) {
			return this.access_token;
		}

		if (!Auth0.checkEmail(this.email) || !this.password) {
			throw new Error('Invalid email or password.');
		}

		return login_local ? this.partTwo() : this.getAccessTokenProxy();
	}

	private partTwo(): string {
		const code_challenge = 'w6n3Ix420Xhhu-Q5-mOOEyuPZmAsJHUbBpO8Ub7xBCY';
		const code_verifier = 'yGrXROHx_VazA0uovsxKfE263LMFcrSrdm4SlC-rob8';

		const url = `https://auth0.openai.com/authorize?client_id=pdlLIX2Y72MIl2rhLhTE9VV9bN905kBh&audience=https%3A%2F%2Fapi.openai.com%2Fv1&redirect_uri=com.openai.chat%3A%2F%2Fauth0.openai.com%2Fios%2Fcom.openai.chat%2Fcallback&scope=openid%20email%20profile%20offline_access%20model.request%20model.read%20organization.read%20offline&response_type=code&code_challenge=${code_challenge}&code_challenge_method=S256&prompt=login`;

		return this.partThree(code_verifier, url);
	}

	private partThree(code_verifier: string, url: string): string {
		const headers = {
			'User-Agent': this.user_agent,
			Referer: 'https://ios.chat.openai.com/',
		};

		try {
			const resp = this.session.get(url, { headers, ...this.req_kwargs });
			console.log('resp:',resp);
			if (resp.status === 200) {
				const urlParams = querystring.parseUrl(resp.url).query;
				const state = urlParams.state as string;
				return '';
				//return this.partFour(code_verifier, state);
			} else {
				throw new Error('Error requesting login URL.');
			}
		} catch (error) {
			if (error instanceof IndexError) {
				throw new Error('Rate limit hit.');
			} else {
				throw new Error('Error requesting login URL.');
			}
		}
	}


	/*private partThree(code_verifier: string, url: string): string {
		const headers = {
			'User-Agent': this.user_agent,
			Referer: 'https://ios.chat.openai.com/',
		};

		return this.session
			.get(url, { headers, ...this.req_kwargs })
			.then((resp: any) => {
				try {
					const urlParams = querystring.parseUrl(resp.url).query;
					console.log('urlParams:',urlParams);
					const state = urlParams.state as string;
					return this.partFour(code_verifier, state);
				} catch (error) {
					throw new Error('Rate limit hit.');
				}
			})
			.catch((e) => {
				console.log('error:',e);
				throw new Error('Error requesting login URL.');
			});
	}*/

	private partFour(code_verifier: string, state: string): string {
		const url = 'https://auth0.openai.com/u/login/identifier?state=' + state;
		const headers = {
			'User-Agent': this.user_agent,
			Referer: url,
			Origin: 'https://auth0.openai.com',
		};
		const data = {
			state,
			username: this.email,
			'js-available': 'true',
			'webauthn-available': 'true',
			'is-brave': 'false',
			'webauthn-platform-available': 'false',
			action: 'default',
		};

		return this.session
			.post(url, data, { headers, ...this.req_kwargs })
			.then((resp: any) => {
				if (resp.status === 302) {
					return this.partFive(code_verifier, state);
				} else {
					throw new Error('Error checking email.');
				}
			})
			.catch(() => {
				throw new Error('Error checking email.');
			});
	}

	private partFive(code_verifier: string, state: string): string {
		const url = 'https://auth0.openai.com/u/login/password?state=' + state;
		const headers = {
			'User-Agent': this.user_agent,
			Referer: url,
			Origin: 'https://auth0.openai.com',
		};
		const data = {
			state,
			username: this.email,
			password: this.password,
			action: 'default',
		};

		return this.session
			.post(url, data, { headers, ...this.req_kwargs })
			.then((resp: any) => {
				if (resp.status === 302) {
					const location = resp.headers.location;
					if (!location.startsWith('/authorize/resume?')) {
						throw new Error('Login failed.');
					}

					return this.partSix(code_verifier, location, url);
				} else if (resp.status === 400) {
					throw new Error('Wrong email or password.');
				} else {
					throw new Error('Error login.');
				}
			})
			.catch(() => {
				throw new Error('Error login.');
			});
	}

	private partSix(code_verifier: string, location: string, ref: string): string {
		const url = 'https://auth0.openai.com' + location;
		const headers = {
			'User-Agent': this.user_agent,
			Referer: ref,
		};

		return this.session
			.get(url, { headers, ...this.req_kwargs })
			.then((resp: any) => {
				if (resp.status === 302) {
					const location = resp.headers.location;
					if (!location.startsWith('com.openai.chat://auth0.openai.com/ios/com.openai.chat/callback?')) {
						throw new Error('Login callback failed.');
					}

					return this.getAccessToken(code_verifier, resp.headers.location);
				} else {
					throw new Error('Error login.');
				}
			})
			.catch(() => {
				throw new Error('Error login.');
			});
	}

	private getAccessToken(code_verifier: string, callback_url: string): string {
		const urlParams = querystring.parseUrl(callback_url).query;

		if ('error' in urlParams) {
			const error = urlParams.error as string;
			const error_description = urlParams.error_description as string | undefined;
			throw new Error(`${error}: ${error_description}`);
		}

		if (!('code' in urlParams)) {
			throw new Error('Error getting code from callback URL.');
		}

		const url = 'https://auth0.openai.com/oauth/token';
		const headers = {
			'User-Agent': this.user_agent,
		};
		const data = {
			redirect_uri: 'com.openai.chat://auth0.openai.com/ios/com.openai.chat/callback',
			grant_type: 'authorization_code',
			client_id: 'pdlLIX2Y72MIl2rhLhTE9VV9bN905kBh',
			code: urlParams.code as string,
			code_verifier: code_verifier,
		};

		return this.session
			.post(url, data, { headers, ...this.req_kwargs })
			.then((resp: any) => {
				if (resp.status === 200) {
					const json = resp.json();
					if (!json.access_token) {
						throw new Error('Failed to get access token. Please check if you need a proxy.');
					}

					this.access_token = json.access_token;
					const expires_at = new Date().getTime() + json.expires_in * 1000 - 5 * 60 * 1000;
					this.expires = new Date(expires_at).toISOString();
					return this.access_token;
				} else {
					throw new Error(resp.text());
				}
			})
			.catch((error: any) => {
				throw new Error(error);
			});
	}

	public getAccessTokenProxy(): string {
		const url = `${this.api_prefix}/api/auth/login`;
		const headers = {
			'User-Agent': this.user_agent,
		};
		const data = {
			username: this.email,
			password: this.password,
		};

		return this.session
			.post(url, data, { headers, ...this.req_kwargs })
			.then((resp: any) => {
				if (resp.status === 200) {
					const json = resp.json();
					if (!json.accessToken) {
						throw new Error('Failed to get access token.');
					}

					this.access_token = json.accessToken;
					this.expires = new Date(json.expires) - 5 * 60 * 1000;
					return this.access_token;
				} else {
					throw new Error('Error getting access token.');
				}
			})
			.catch(() => {
				throw new Error('Error getting access token.');
			});
	}
}
