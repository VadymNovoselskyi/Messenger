import type { PreKeyBundle, StringifiedPreKeyBundle } from './signalTypes';

/** API endpoints enumeration */
export enum API {
	GET_CHATS = 'getChats',
	SEND_MESSAGE = 'sendMessage',
	RECEIVE_MESSAGE = 'receiveMessage',
	READ_UPDATE = 'readUpdate',
	EXTRA_MESSAGES = 'extraMessages',
	EXTRA_NEW_MESSAGES = 'extraNewMessages',
	READ_ALL = 'readAll',
	CREATE_CHAT = 'createChat',
	LOGIN = 'login',
	SIGNUP = 'signup',
	SEND_KEYS = 'sendKeys'
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
	| sendMessagePayload
	| readUpdatePayload
	| getExtraMessagesPayload
	| getExtraNewMessagesPayload
	| readAllPayload
	| createChatPayload
	| loginPayload
	| signupPayload
	| sendKeysPayload;

/** Union type for response payloads */
export type responsePayload =
	| getChatsResponse
	| sendMessageResponse
	| receiveMessageResponse
	| readUpdateResponse
	| getExtraMessagesResponse
	| getExtraNewMessagesResponse
	| readAllResponse
	| createChatResponse
	| loginResponse
	| signupResponse
	| errorResponse
	| sendKeysResponse;

/** Chat representation */
export interface Chat {
	_id: string; //ID type?
	users: User[];
	messages: Message[];
	latestMessages: Message[];
	unreadCount: number;
	receivedUnreadCount: number;
	receivedNewCount: number;
	lastModified: string; //ISO-Date
}

/** User representation */
export interface User {
	_id: string;
	username: string;
}

/** Message representation */
export interface Message {
	_id: string;
	from: string; //User
	text: string;
	sendTime: string; //ISO-date
	sending?: boolean;
}

export interface Link {
	path: string;
	title: string;
	pathsToCheck?: string[];
}

export type getChatsPayload = Record<string, never>;

export type sendMessagePayload = {
	chatId: string;
	text: string;
	tempMessageId: string;
};

export type readUpdatePayload = {
	chatId: string;
	messageId: string;
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

//Responses
export type getChatsResponse = {
	chats: Chat[];
};

export type sendMessageResponse = {
	chatId: string;
	message: Message;
	tempMessageId: string;
};

export type receiveMessageResponse = {
	chatId: string;
	message: Message;
};

export type readUpdateResponse = {
	chatId: string;
	lastSeen: string; //ISO-time
};

export type getExtraMessagesResponse = {
	chatId: string;
	extraMessages: Message[];
};

export type getExtraNewMessagesResponse = {
	chatId: string;
	extraNewMessages: Message[];
};

export type readAllResponse = Record<string, never>;

export type createChatResponse = {
	createdChat: Chat;
	preKeyBundle?: StringifiedPreKeyBundle
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

export type errorResponse = {
	message: string;
};
