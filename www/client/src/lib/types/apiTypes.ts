import type { MessageType } from '@privacyresearch/libsignal-protocol-typescript';
import type { StringifiedPreKey, StringifiedPreKeyBundle } from './signalTypes';
import type { ApiChat, ApiMessage } from './dataTypes';

/* Request APIs */
export enum RequestApi {
	SEND_AUTH = 'sendAuth',
	SEND_MESSAGE = 'sendMessage',
	SEND_READ_UPDATE = 'sendReadUpdate',
	SYNC_ACTIVE_CHATS = 'syncActiveChats',
	SYNC_ALL_CHATS_METADATA = 'syncAllChatsMetadata',
	CREATE_CHAT = 'createChat',
	LOGIN = 'login',
	SIGNUP = 'signup',
	SEND_PRE_KEY_BUNDLE = 'sendPreKeyBundle',
	ADD_PRE_KEYS = 'addPreKeys',
	SEND_PRE_KEY_WHISPER_MESSAGE = 'sendPreKeyWhisperMessage'
}

export type RequestApiMessage = {
	api: RequestApi;
	id: string;
	token?: string | null;
	payload: RequestMessagePayload;
};
export type RequestMessagePayload =
	| sendAuthPayload
	| sendMessagePayload
	| sendReadUpdatePayload
	| syncActiveChatsPayload
	| syncAllChatsMetadataPayload
	| createChatPayload
	| loginPayload
	| signupPayload
	| sendPreKeyBundlePayload
	| addPreKeysPayload
	| sendPreKeyWhisperMessagePayload;

export type ResponseApiMessage = {
	api: RequestApi;
	id: string;
	status: 'SUCCESS' | 'ERROR';
	payload: ResponseMessagePayload;
};
export type ResponseMessagePayload =
	| sendAuthResponse
	| sendMessageResponse
	| sendReadUpdateResponse
	| syncActiveChatsResponse
	| syncAllChatsMetadataResponse
	| createChatResponse
	| loginResponse
	| signupResponse
	| sendPreKeyBundleResponse
	| addPreKeysResponse
	| sendPreKeyWhisperMessageResponse
	| errorResponse;

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

/* System APIs */
export enum SystemApi {
	ACK = 'ack',
	PING = 'ping',
	PONG = 'pong'
}

export type SystemApiMessage = {
	api: SystemApi;
};

/* Request APIs payloads */
export type sendAuthPayload = Record<string, never>;
export type sendMessagePayload = {
	chatId: string;
	ciphertext: MessageType;
};

export type sendReadUpdatePayload = {
	chatId: string;
	sequence: number;
};

export type syncActiveChatsPayload = {
	chatIds: string[];
};

export type syncAllChatsMetadataPayload = Record<string, never>;

export type createChatPayload = {
	username: string;
};

export type loginPayload = {
	username: string;
	password: string;
};

export type signupPayload = {
	username: string;
	password: string;
};

export type sendPreKeyBundlePayload = {
	preKeyBundle: StringifiedPreKeyBundle;
};

export type addPreKeysPayload = {
	preKeys: StringifiedPreKey[];
};

export type sendPreKeyWhisperMessagePayload = {
	chatId: string;
	ciphertext: MessageType;
};

/* Response APIs payloads */
export type sendAuthResponse = Record<string, never>;

export type sendMessageResponse = { sentMessage: ApiMessage };

export type sendReadUpdateResponse = {
	chatId: string;
	sequence: number;
};

export type syncActiveChatsResponse = {
	chats: ApiChat[];
};

export type syncAllChatsMetadataResponse = {
	chats: ApiChat[];
	newChats: ApiChat[];
	isComplete: boolean;
};

export type createChatResponse = {
	createdChat: ApiChat;
	preKeyBundle?: StringifiedPreKeyBundle;
};

export type loginResponse = {
	userId: string;
	token: string; //JWT
};

export type signupResponse = {
	userId: string;
	token: string; //JWT
};

export type sendPreKeyBundleResponse = Record<string, never>;

export type addPreKeysResponse = Record<string, never>;

export type sendPreKeyWhisperMessageResponse = Record<string, never>;

export type errorResponse = {
	message: string;
};

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
