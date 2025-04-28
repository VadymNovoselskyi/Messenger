import { goto } from '$app/navigation';
import { page } from '$app/state';
import { SessionCipher } from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolAddress } from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolStore } from './SignalProtocolStore';
import { chatsStore } from './ChatsStore.svelte';
import { sendPreKeyMessage } from './api.svelte';
import {
	API,
	type APIMessage,
	type APIResponse,
	type createChatResponse,
	type errorResponse,
	type messagePayload,
	type readUpdateResponse,
	type receiveMessageResponse,
	type receivePreKeyMessageResponse,
	type responsePayload
} from './types/apiTypes';
import { apiToUsedChat, generateId, getCookie, getOtherUsername } from './utils.svelte';
import type { StoredMessage } from './types/dataTypes';

export class WsService {
	private static instance: WsService;
	private static KEEP_ALIVE_INTERVAL = 30_000;
	private ws: WebSocket | null = null;

	private messageHandler = this.handleServerMessage.bind(this);
	private pingTimeoutId: number | null = null;
	private pendingRequests = new Map<
		string,
		{ resolve: (value: responsePayload) => void; reject: (reason: any) => void }
	>();

	private constructor() {}

	public static getInstance() {
		if (!WsService.instance) {
			const instance = new WsService();
			this.instance = instance;
		}
		return this.instance;
	}

	public async getWs(): Promise<WebSocket> {
		console.log(`getting ws: ${this.ws?.readyState}`);
		if (
			!this.ws ||
			this.ws.readyState === WebSocket.CLOSING ||
			this.ws.readyState === WebSocket.CLOSED
		) {
			this.ws = new WebSocket(`ws://${page.url.host}/api/`);
			this.ws.addEventListener('message', this.messageHandler);
		} else if (this.ws?.readyState === WebSocket.OPEN) return this.ws;

		return new Promise((resolve, reject) => {
			console.log('waiting for ws to open');
			this.ws!.addEventListener(
				'open',
				() => {
					this.ws!.send(JSON.stringify(WsService.createAPICall(API.AUTHENTICATE, {})));
					this.resetPingTimeout();
					resolve(this.ws!);
				},
				{ once: true }
			);
			this.ws!.addEventListener(
				'close',
				() => {
					this.ws!.removeEventListener('message', this.messageHandler);
					this.ws = null;
					reject(new Error('WebSocket connection closed'));
				},
				{ once: true }
			);
			this.ws!.addEventListener(
				'error',
				(event) => {
					console.error('WebSocket connection error:', event);
					reject(new Error('Failed to connect to WebSocket'));
				},
				{ once: true }
			);
		});
	}

	public async sendRequest(message: APIMessage, timeout?: number): Promise<responsePayload> {
		const ws = await this.getWs();
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(message.id, { resolve, reject });
			ws.send(JSON.stringify(message));

			if (timeout) {
				setTimeout(() => {
					if (this.pendingRequests.has(message.id)) {
						this.pendingRequests.delete(message.id);
						reject(new Error('Request timed out'));
					}
				}, timeout);
			}
		});
	}

	public async handleServerMessage(event: MessageEvent): Promise<void> {
		const data: APIResponse = JSON.parse(event.data);
		console.log(data);
		const { api, id, status, payload } = data;

		if (status === 'ERROR') {
			const { message } = payload as errorResponse;
			if (message === 'Invalid Token. Login again' || message === 'invalid signature') {
				goto('/login');
			} else {
				alert(message);
				return;
			}
		}

		if (this.pendingRequests.has(id)) {
			const { resolve, reject } = this.pendingRequests.get(id)!;
			if (status === 'ERROR') {
				const { message } = payload as errorResponse;
				reject(`Error from server: ${message}`);
			} else resolve(payload);

			this.pendingRequests.delete(id);
		} else if (api === API.RECEIVE_MESSAGE) {
			const { chatId, message } = payload as receiveMessageResponse;

			const chat = chatsStore.getChat(chatId);
			if (!chat) throw new Error(`Chat with id ${chatId} not found`);

			const senderAddress: SignalProtocolAddress = new SignalProtocolAddress(
				getOtherUsername(chatId),
				1
			);

			const store = SignalProtocolStore.getInstance();
			const sessionCipher = new SessionCipher(store, senderAddress);
			const cipherMessage = message.ciphertext;
			const cipherBinary = atob(cipherMessage.body!);

			if (cipherMessage.type === 3) {
				try {
					console.log('decryptPreKeyWhisperMessage');
					await sessionCipher.decryptPreKeyWhisperMessage(cipherBinary!, 'binary');
					sendPreKeyMessage(chatId, '');
					return;
				} catch (e) {
					console.error(e);
				}
			}
			if (cipherMessage.type !== 1) throw new Error(`Unknown message type: ${cipherMessage.type}`);

			const bufferText = await sessionCipher.decryptWhisperMessage(cipherBinary!, 'binary');

			const plaintext = new TextDecoder().decode(new Uint8Array(bufferText!));
			if (!plaintext) return;

			const messageToStore: StoredMessage = {
				...message,
				plaintext
			};
			await chatsStore.handleIncomingMessage(messageToStore);
			chatsStore.sortChats();
		} else if (api === API.RECEIVE_PRE_KEY_MESSAGE) {
			const { chatId, ciphertext } = payload as receivePreKeyMessageResponse;
			const chat = chatsStore.getChat(chatId);
			if (!chat) throw new Error(`Chat with id ${chatId} not found`);

			const senderAddress: SignalProtocolAddress = new SignalProtocolAddress(
				getOtherUsername(chatId),
				1
			);

			const store = SignalProtocolStore.getInstance();
			const sessionCipher = new SessionCipher(store, senderAddress);
			const cipherBinary = atob(ciphertext.body!);

			if (ciphertext.type === 3) {
				try {
					console.log('decryptPreKeyWhisperMessage');
					await sessionCipher.decryptPreKeyWhisperMessage(cipherBinary!, 'binary');
					sendPreKeyMessage(chatId, '');
					return;
				} catch (e) {
					console.error(e);
				}
			}
			if (ciphertext.type !== 1) throw new Error(`Unknown message type: ${ciphertext.type}`);

			await sessionCipher.decryptWhisperMessage(cipherBinary!, 'binary');
		} else if (api === API.READ_UPDATE) {
			const { chatId, sequence } = payload as readUpdateResponse;
			const chat = chatsStore.getChat(chatId);
			if (!chat) throw new Error(`Chat with id ${chatId} not found`);

			await chatsStore.handleIncomingReadUpdate(chatId, sequence);
		} else if (api === API.CREATE_CHAT) {
			const { createdChat } = payload as createChatResponse;
			const createdUsedChat = apiToUsedChat(createdChat);
			await chatsStore.addChat(createdUsedChat);
			chatsStore.sortChats();
			return;
		} else if (api === API.PING) {
			this.handlePing();
		} else {
			console.warn('Received response for unknown request ID:', id);
		}
	}

	private resetPingTimeout() {
		if (this.pingTimeoutId) clearTimeout(this.pingTimeoutId);
		this.pingTimeoutId = window.setTimeout(() => this.getWs(), WsService.KEEP_ALIVE_INTERVAL + 10_000);
	}

	private async handlePing() {
		const ws = await this.getWs();
		ws.send(JSON.stringify({ api: API.PONG }));
		this.resetPingTimeout();
	}

	public static createAPICall(api: API, payload: messagePayload): APIMessage {
		return {
			api,
			id: generateId(),
			token: getCookie('token'),
			payload
		};
	}
}

export const wsService = WsService.getInstance();
