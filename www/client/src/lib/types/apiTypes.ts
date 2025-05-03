import type { MessageType } from '@privacyresearch/libsignal-protocol-typescript';
import type { StringifiedPreKey, StringifiedPreKeyBundle } from './signalTypes';
import type { ApiChat, ApiMessage } from './dataTypes';

/** API endpoints enumeration */
export enum API {
	AUTHENTICATE = 'authenticate',
	SEND_MESSAGE = 'sendMessage',
	SEND_PRE_KEY_WHISPER_MESSAGE = 'sendPreKeyWhisperMessage',
	RECEIVE_MESSAGE = 'receiveMessage',
	READ_UPDATE = 'readUpdate',
	CREATE_CHAT = 'createChat',
	SYNC_ACTIVE_CHATS = 'syncActiveChats',
	SYNC_ALL_CHATS_METADATA = 'syncAllChatsMetadata',
	LOGIN = 'login',
	SIGNUP = 'signup',
	SEND_PRE_KEY_BUNDLE = 'sendPreKeyBundle',
	ADD_PRE_KEYS = 'addPreKeys',
	ACK = 'ack',
	PING = 'ping',
	PONG = 'pong'
}

/** Structure for API call messages */
export interface APIMessage {
	api: API;
	id: string;
	token?: string | null;
	payload: messagePayload;
}

export interface APIResponse {
	api: API;
	id: string;
	status: 'SUCCESS' | 'ERROR';
	token?: string | null;
	payload: responsePayload;
}

/** Union type for request payloads */
export type messagePayload =
	| fetchUpdatesPayload
	| syncAllChatsMetadataPayload
	| syncActiveChatsPayload
	| readUpdatePayload
	| createChatPayload
	| loginPayload
	| signupPayload
	| sendPreKeyBundlePayload
	| addPreKeysPayload
	| sendPreKeyWhisperMessagePayload
	| sendMessagePayload;

/** Union type for response payloads */
export type responsePayload =
	| fetchUpdatesResponse
	| syncAllChatsMetadataResponse
	| syncActiveChatsResponse
	| receiveMessageResponse
	| readUpdateResponse
	| createChatResponse
	| loginResponse
	| signupResponse
	| errorResponse
	| sendPreKeyBundleResponse
	| addPreKeysResponse
	| sendPreKeyWhisperMessageResponse
	| sendMessageResponse;

export type fetchUpdatesPayload = Record<string, never>;

export type syncActiveChatsPayload = {
	chatIds: string[];
};

export type syncAllChatsMetadataPayload = Record<string, never>;

export type readUpdatePayload = {
	chatId: string;
	sequence: number;
};

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

export type sendMessagePayload = {
	chatId: string;
	ciphertext: MessageType;
};

export type sendPreKeyWhisperMessagePayload = {
	chatId: string;
	ciphertext: MessageType;
};

//Responses
export type fetchUpdatesResponse = {
	chats: ApiChat[];
};

export type syncActiveChatsResponse = {
	chats: ApiChat[];
};

export type syncAllChatsMetadataResponse = {
	chats: ApiChat[];
	newChats: ApiChat[];
	isComplete: boolean;
};

export type receiveMessageResponse = {
	chatId: string;
	message: ApiMessage;
};

export type readUpdateResponse = {
	chatId: string;
	sequence: number;
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

export type sendMessageResponse = { sentMessage: ApiMessage };

export type errorResponse = {
	message: string;
};
