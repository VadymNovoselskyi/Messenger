import type { ApiMessage, ApiChat } from "./dataTypes";

/* Notification APIs */
export enum NotificationApi {
	INCOMING_MESSAGE = 'incomingMessage',
	INCOMING_READ = 'incomingRead',
	INCOMING_CHAT = 'incomingChat'
}

export type NotificationApiMessage = {
	api: NotificationApi;
	id: string;
	payload: NotificationMessagePayload;
};
export type NotificationMessagePayload =
	| incomingMessageResponse
	| incomingReadResponse
	| incomingChatResponse;

/* Notification APIs payloads */
export type incomingMessageResponse = {
	chatId: string;
	message: ApiMessage;
};

export type incomingReadResponse = {
	chatId: string;
	sequence: number;
};

export type incomingChatResponse = {
	createdChat: ApiChat;
};
