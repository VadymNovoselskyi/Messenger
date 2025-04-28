import type { MessageType } from '@privacyresearch/libsignal-protocol-typescript';
import type { StringifiedPreKeyBundle } from './signalTypes';
import type { ApiChat, ApiMessage } from './dataTypes';

/** API endpoints enumeration */
export enum API {
	AUTHENTICATE = 'authenticate',
	GET_CHATS = 'getChats',
	RECEIVE_MESSAGE = 'receiveMessage',
	RECEIVE_PRE_KEY_MESSAGE = 'receivePreKeyMessage',
	READ_UPDATE = 'readUpdate',
	EXTRA_MESSAGES = 'extraMessages',
	EXTRA_NEW_MESSAGES = 'extraNewMessages',
	READ_ALL = 'readAll',
	CREATE_CHAT = 'createChat',
	LOGIN = 'login',
	SIGNUP = 'signup',
	SEND_KEYS = 'sendKeys',
	SEND_PRE_KEY_MESSAGE = 'sendPreKeyMessage',
	SEND_ENC_MESSAGE = 'sendEncMessage',
	PING = 'ping',
	PONG = 'pong',
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
	| getChatsPayload
	| readUpdatePayload
	| getExtraMessagesPayload
	| getExtraNewMessagesPayload
	| readAllPayload
	| createChatPayload
	| loginPayload
	| signupPayload
	| sendKeysPayload
	| sendPreKeyMessagePayload
	| sendEncMessagePayload;

/** Union type for response payloads */
export type responsePayload =
	| getChatsResponse
	| receiveMessageResponse
	| receivePreKeyMessageResponse
	| readUpdateResponse
	| getExtraMessagesResponse
	| getExtraNewMessagesResponse
	| readAllResponse
	| createChatResponse
	| loginResponse
	| signupResponse
	| errorResponse
	| sendKeysResponse
	| sendPreKeyMessageResponse
	| sendEncMessageResponse;

export type getChatsPayload = Record<string, never>;

export type readUpdatePayload = {
	chatId: string;
	sequence: number;
};

export type getExtraMessagesPayload = {
	chatId: string;
	currentIndex: number;
};

export type getExtraNewMessagesPayload = {
	chatId: string;
	unreadCount: number;
};

export type readAllPayload = {
	chatId: string;
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

export type sendKeysPayload = {
	preKeyBundle: StringifiedPreKeyBundle;
};

export type sendEncMessagePayload = {
	chatId: string;
	ciphertext: MessageType;
};

export type sendPreKeyMessagePayload = {
	chatId: string;
	ciphertext: MessageType;
};

//Responses
export type getChatsResponse = {
	chats: ApiChat[];
};

export type receiveMessageResponse = {
	chatId: string;
	message: ApiMessage;
};

export type receivePreKeyMessageResponse = {
	chatId: string;
	ciphertext: MessageType;
};

export type readUpdateResponse = {
	chatId: string;
	sequence: number;
};

export type getExtraMessagesResponse = {
	chatId: string;
	extraMessages: ApiMessage[];
};

export type getExtraNewMessagesResponse = {
	chatId: string;
	extraNewMessages: ApiMessage[];
};

export type readAllResponse = Record<string, never>;

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

export type sendKeysResponse = Record<string, never>;

export type sendPreKeyMessageResponse = Record<string, never>;

export type sendEncMessageResponse = { sentMessage: ApiMessage };

export type errorResponse = {
	message: string;
};
