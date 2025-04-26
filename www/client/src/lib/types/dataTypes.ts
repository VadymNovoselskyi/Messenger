import type { MessageType } from '@privacyresearch/libsignal-protocol-typescript';

export type UsedChat = {
	_id: string;
	users: {
		_id: string;
		username: string;
	}[];
	messages: StoredMessage[];
	unreadCount: number;
	lastSequence: number;
	lastModified: string;
};

export type StoredChat = {
	_id: string;
	users: {
		_id: string;
		username: string;
	}[];
	lastSequence: number;
	lastModified: string;
};

export type ApiChat = {
	_id: string;
	users: {
		_id: string;
		username: string;
	}[];
	messages: ApiMessage[];
	lastSequence: number;
	lastModified: string;
};

export type StoredMessage = {
	_id: string;
	chatId: string;
	from: string;
	ciphertext: MessageType;
	plaintext?: string;
	sequence: number;
	sendTime: string;
};

export type PendingMessage = StoredMessage & {
	tempId: string;
	plaintext: string;
};

export type ApiMessage = {
	_id: string;
	chatId: string;
	from: string;
	ciphertext: MessageType;
	sequence: number;
	sendTime: string;
};

export type Link = {
	path: string;
	title: string;
	pathsToCheck?: string[];
};
