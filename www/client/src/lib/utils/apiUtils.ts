import { NotificationApi, type NotificationApiMessage } from '$lib/types/notificationTypes';
import { type RequestMessagePayload, type RequestApiMessage, type ResponseApiMessage, RequestApi } from '$lib/types/requestTypes';
import { type SystemApiMessage, type ErrorApiMessage, ErrorApi, SystemApi } from '$lib/types/systemTypes';

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
	return Object.values(RequestApi).includes(message.api as RequestApi);
}

export function messageIsNotification(message: any): message is NotificationApiMessage {
	return Object.values(NotificationApi).includes(message.api as NotificationApi);
}

export function messageIsSystem(message: any): message is SystemApiMessage {
	return Object.values(SystemApi).includes(message.api as SystemApi);
}

export function messageIsError(message: any): message is ErrorApiMessage {
	return Object.values(ErrorApi).includes(message.api as ErrorApi);
}
