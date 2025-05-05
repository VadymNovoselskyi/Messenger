import { goto } from '$app/navigation';
import { page } from '$app/state';

import * as systemTypes from '../types/systemTypes';
import * as requestTypes from '../types/requestTypes';
import * as notificationTypes from '../types/notificationTypes';

import {
	messageIsError,
	messageIsNotification,
	messageIsResponse,
	messageIsSystem
} from '$lib/utils/apiUtils';
import { SystemApi } from '../types/systemTypes';
import { handleNotification } from '$lib/api/NotificationServise';
import { sendAuth } from '$lib/api/RequestService';
import { getCookie } from '$lib/utils/cookieUtils';

export class WsService {
	private static instance: WsService;
	private static KEEP_ALIVE_INTERVAL = 30_000;
	private ws: WebSocket | null = null;

	private messageHandler = this.handleServerMessage.bind(this);
	private pingTimeoutId: number | null = null;
	private pendingRequests = new Map<
		string,
		{
			resolve: (value: requestTypes.ResponseMessagePayload) => void;
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
		message: requestTypes.RequestApiMessage,
		timeout?: number
	): Promise<requestTypes.ResponseMessagePayload> {
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
			| requestTypes.ResponseApiMessage
			| notificationTypes.NotificationApiMessage
			| systemTypes.SystemApiMessage
			| systemTypes.ErrorApiMessage = JSON.parse(event.data);

		if (messageIsSystem(data)) {
			if (data.api === systemTypes.SystemApi.PING) {
				this.handlePing();
				return;
			}
		}

		console.log(data);
		if (messageIsError(data)) {
			const { id, payload } = data as systemTypes.ErrorApiMessage;
			const { message } = payload;
			if (this.pendingRequests.has(id)) {
				const { reject } = this.pendingRequests.get(id)!;
				reject(new Error(message));
				this.pendingRequests.delete(id);
			}
			if (
				message === 'JWT expired' ||
				message === 'No token provided' ||
				message === 'Unauthenticated'
			) {
				goto('/login');
				return;
			}
			alert(message);
			return;
		} else if (messageIsResponse(data)) {
			const { id, payload } = data as requestTypes.ResponseApiMessage;

			this.sendAck(id);
			if (!this.pendingRequests.has(id)) {
				alert('Unknown request ID: ' + id);
				return;
			}

			const { resolve } = this.pendingRequests.get(id)!;
			resolve(payload);
			this.pendingRequests.delete(id);
		} else if (messageIsNotification(data)) {
			this.sendAck(data.id);
			handleNotification(data.api, data.payload);
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

	private async handleOpen(resolve: (value: WebSocket) => void) {
		if (getCookie('token')) await sendAuth();
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
