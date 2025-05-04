import { goto } from '$app/navigation';
import { page } from '$app/state';
import { SessionCipher } from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolAddress } from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolDb } from '../indexedDB/SignalProtocolDb.svelte';
import { chatsStore } from '../stores/ChatsStore.svelte';
import { messagesStore } from '../stores/MessagesStore.svelte';

import { getCookie } from '$lib/utils/cookieUtils';
import { getOtherUserChatMetadata } from '$lib/utils/chatMetadataUtils.svelte';
import * as apiTypes from '../types/apiTypes';
import type { StoredChat, StoredMessage } from '../types/dataTypes';
import {
	createApiRequestMessage,
	messageIsNotification,
	messageIsResponse,
	messageIsSystem
} from '$lib/utils/apiUtils';
import { SystemApi } from '../types/apiTypes';
import { handleNotification } from '$lib/api/NotificationServise';
import { sendAuth } from '$lib/api/RequestService';

export class WsService {
	private static instance: WsService;
	private static KEEP_ALIVE_INTERVAL = 30_000;
	private ws: WebSocket | null = null;

	private messageHandler = this.handleServerMessage.bind(this);
	private pingTimeoutId: number | null = null;
	private pendingRequests = new Map<
		string,
		{
			resolve: (value: apiTypes.ResponseMessagePayload) => void;
			reject: (reason: any) => void;
		}
	>();

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

	public async sendRequest(
		message: apiTypes.RequestApiMessage,
		timeout?: number
	): Promise<apiTypes.ResponseMessagePayload> {
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
		const data:
			| apiTypes.ResponseApiMessage
			| apiTypes.NotificationApiMessage
			| apiTypes.SystemApiMessage = JSON.parse(event.data);

		console.log(data);

		if (messageIsResponse(data)) {
			const { api, id, status, payload } = data;
			this.sendAck(id);

			if (this.pendingRequests.has(id)) {
				const { resolve, reject } = this.pendingRequests.get(id)!;
				if (status === 'SUCCESS') resolve(payload);
				else if (status === 'ERROR') {
					const { message } = payload as apiTypes.errorResponse;
					if (
						message === 'jwt expired' ||
						message === 'No token provided' ||
						message === 'Unauthenticated'
					) {
						goto('/login');
						return;
					}
					alert(message);
					reject(`Error from server: ${message}`);
				}
				this.pendingRequests.delete(id);
			} else alert('Unknown request ID: ' + id);

		} else if (messageIsNotification(data)) {
			this.sendAck(data.id);
			handleNotification(data.api, data.payload);
		} else if (messageIsSystem(data)) {
			if (data.api === apiTypes.SystemApi.PING) {
				this.handlePing();
				return;
			}
		}
	}

	private async sendAck(id: string) {
		const ws = await this.getWs();
		ws.send(JSON.stringify({ api: SystemApi.ACK, id }));
	}

	private async handlePing() {
		const ws = await this.getWs();
		ws.send(JSON.stringify({ api: SystemApi.PONG }));
		this.resetPingTimeout();
	}

	private handleOpen(resolve: (value: WebSocket) => void) {
		sendAuth();
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

	private resetPingTimeout() {
		if (this.pingTimeoutId) clearTimeout(this.pingTimeoutId);
		this.pingTimeoutId = window.setTimeout(
			() => this.getWs(),
			WsService.KEEP_ALIVE_INTERVAL + 10_000
		);
	}
}

export const wsService = WsService.getInstance();
