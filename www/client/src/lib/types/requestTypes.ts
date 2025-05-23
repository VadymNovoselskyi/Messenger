import type { MessageType, PreKeyType } from '@privacyresearch/libsignal-protocol-typescript';
import type { ApiChat, ApiMessage } from './dataTypes';
import * as signalTypes from './signalTypes';

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
	| sendPreKeyWhisperMessageResponse;

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
	preKeyBundle: signalTypes.PreKeyBundle<string>;
};

export type addPreKeysPayload = {
	preKeys: PreKeyType<string>[];
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
	preKeyBundle: signalTypes.PreKeyBundle<string>;
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
