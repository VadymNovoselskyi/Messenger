import type { MessageType } from '@privacyresearch/libsignal-protocol-typescript';

export type StoredChat = {
	_id: string;
	users: {
		_id: string;
		username: string;
		lastReadSequence: number;
	}[];
	lastSequence: number;
	lastModified: string;
};

export type ApiChat = {
	_id: string;
	users: {
		_id: string;
		username: string;
		lastReadSequence: number;
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
	isPending?: boolean;
};

export type PendingMessage = StoredMessage & {
	tempId: string;
	plaintext: string;
	isPending: true;
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
