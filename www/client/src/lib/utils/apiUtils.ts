import type { RequestApiMessage, RequestApi, RequestMessagePayload, NotificationApiMessage, SystemApiMessage, ResponseApiMessage } from '$lib/types/apiTypes';
import { getCookie } from './cookieUtils';
import { generateRequestId } from './utils.svelte';

export function createApiRequestMessage(api: RequestApi, payload: RequestMessagePayload, id?: string): RequestApiMessage {
	return {
		api,
		id: id ?? generateRequestId(),
		token: getCookie('token'),
		payload
	};
}

export function messageIsResponse(message: any): message is ResponseApiMessage {
	return message.api !== undefined && message.id !== undefined && message.status !== undefined && message.payload !== undefined;
}

export function messageIsNotification(message: any): message is NotificationApiMessage {
	return message.api !== undefined && message.payload !== undefined;
}

export function messageIsSystem(message: any): message is SystemApiMessage {
	return message.api !== undefined;
}


