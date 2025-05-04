import { goto } from '$app/navigation';
import { page } from '$app/state';
import { SessionCipher } from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolAddress } from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolStore } from './SignalProtocolStore';
import { chatsStore } from './ChatsStore.svelte';
import { sendPreKeyWhisperMessage } from './api.svelte';
import {
	API,
	type APIMessage,
	type APIResponse,
	type createChatResponse,
	type errorResponse,
	type messagePayload,
	type readUpdateResponse,
	type receiveMessageResponse,
	type responsePayload
} from './types/apiTypes';
import { toStoredChat, generateId, getCookie, getOtherUserChatMetadata } from './utils.svelte';
import type { StoredChat, StoredMessage } from './types/dataTypes';
import { messagesStore } from './MessagesStore.svelte';

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
		if (
			!this.ws ||
			this.ws.readyState === WebSocket.CLOSING ||
			this.ws.readyState === WebSocket.CLOSED
		) {
			this.ws = new WebSocket(`ws://${page.url.host}/api/`);
			this.ws.addEventListener('message', this.messageHandler);
		} else if (this.ws?.readyState === WebSocket.OPEN) return this.ws;

		return new Promise((resolve, reject) => {
			this.ws!.addEventListener('open', this.handleOpen.bind(this, resolve), { once: true });
			this.ws!.addEventListener('close', this.handleClose.bind(this, reject), { once: true });
			this.ws!.addEventListener('error', this.handleError.bind(this, reject), { once: true });
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
		const { api, id, status, payload } = data;

		if (api === API.PING) {
			this.handlePing();
			return;
		}
		console.log(data);

		if (status === 'ERROR') {
			const { message } = payload as errorResponse;
			if (
				message === 'jwt expired' ||
				message === 'No token provided' ||
				message === 'Unauthenticated'
			) {
				goto('/login');
			} else {
				alert(message);
			}
		} else {
			this.sendRequest(WsService.createAPICall(API.ACK, {}, id));
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

			const chat = chatsStore.getLoadedChat(chatId);
			if (!chat) throw new Error(`Chat with id ${chatId} not found`);

			const senderAddress: SignalProtocolAddress = new SignalProtocolAddress(
				getOtherUserChatMetadata(chatId)._id,
				1
			);

			const store = SignalProtocolStore.getInstance();
			const sessionCipher = new SessionCipher(store, senderAddress);
			const cipherMessage = message.ciphertext;
			const cipherBinary = atob(cipherMessage.body!);

			if (cipherMessage.type === 3) {
				await sessionCipher.decryptPreKeyWhisperMessage(cipherBinary!, 'binary');
				return;
			}
			if (cipherMessage.type !== 1) throw new Error(`Unknown message type: ${cipherMessage.type}`);

			const bufferText = await sessionCipher.decryptWhisperMessage(cipherBinary!, 'binary');

			const plaintext = new TextDecoder().decode(new Uint8Array(bufferText!));
			if (!plaintext) return;

			const messageToStore: StoredMessage = {
				...message,
				plaintext
			};
			const lastModified =
				chat.lastModified.localeCompare(message.sendTime) > 0
					? chat.lastModified
					: message.sendTime;
			const lastSequence = Math.max(chat.lastSequence, message.sequence);
			const updatedChat: StoredChat = {
				_id: chat._id,
				users: chat.users.map((user) => {
					if (user._id !== getCookie('userId')) {
						return { ...user, lastReadSequence: lastSequence };
					}
					return user;
				}),
				lastSequence,
				lastModified
			};

			await chatsStore.updateChat(updatedChat);
			await messagesStore.addMessage(messageToStore);
			chatsStore.sortChats();
		} else if (api === API.READ_UPDATE) {
			const { chatId, sequence } = payload as readUpdateResponse;
			const chat = chatsStore.getLoadedChat(chatId);
			if (!chat) throw new Error(`Chat with id ${chatId} not found`);

			const lastSequence = Math.max(getOtherUserChatMetadata(chatId).lastReadSequence, sequence);
			const updatedChat = {
				...chat,
				users: chat.users.map((user) => {
					if (user._id !== getCookie('userId')) {
						return { ...user, lastReadSequence: lastSequence };
					}
					return user;
				})
			};
			await chatsStore.updateChat(updatedChat);
		} else if (api === API.CREATE_CHAT) {
			const { createdChat } = payload as createChatResponse;
			const createdStoredChat = toStoredChat(createdChat);
			await chatsStore.addChat(createdStoredChat);
			messagesStore.addEmptyChat(createdStoredChat._id);
			chatsStore.sortChats();
			return;
		} else {
			console.warn('Received response for unknown request ID:', id);
		}
	}

	private resetPingTimeout() {
		if (this.pingTimeoutId) clearTimeout(this.pingTimeoutId);
		this.pingTimeoutId = window.setTimeout(
			() => this.getWs(),
			WsService.KEEP_ALIVE_INTERVAL + 10_000
		);
	}

	private async handlePing() {
		const ws = await this.getWs();
		ws.send(JSON.stringify({ api: API.PONG }));
		this.resetPingTimeout();
	}

	private handleOpen(resolve: (value: WebSocket) => void) {
		this.sendRequest(WsService.createAPICall(API.AUTHENTICATE, {}));
		this.resetPingTimeout();
		resolve(this.ws!);
	}

	private handleClose(reject: (reason: any) => void) {
		this.ws!.removeEventListener('message', this.messageHandler);
		this.ws!.close();
		this.ws = null;
		reject(new Error('WebSocket connection closed'));
	}

	private handleError(reject: (reason: any) => void) {
		this.ws!.removeEventListener('message', this.messageHandler);
		this.ws!.close();
		this.ws = null;
		reject(new Error('WebSocket connection error'));
	}

	public static createAPICall(api: API, payload: messagePayload, id?: string): APIMessage {
		return {
			api,
			id: id ?? generateId(),
			token: getCookie('token'),
			payload
		};
	}
}

export const wsService = WsService.getInstance();
