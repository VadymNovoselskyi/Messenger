import type { MessageType } from '@privacyresearch/libsignal-protocol-typescript';

export type UsedChat = {
	_id: string;
	users: {
		_id: string;
		username: string;
	}[];
	messages: StoredMessage[];
	latestMessages: StoredMessage[];
	unreadCount: number;
	receivedUnreadCount: number;
	receivedNewCount: number;
	lastModified: string; //ISO-Date
};

export type StoredChat = {
	_id: string;
	users: {
		_id: string;
		username: string;
	}[];
	messageCounter: number;
	lastModified: string; //ISO-Date
};

export type StoredMessage = {
	_id: string;
	chatId: string;
	from: string;
	ciphertext: MessageType;
	plaintext?: string;
	sequence: number;
	sendTime: string; //ISO-date
	sending?: boolean;
	// status?: "SENDING" | "SENT";
};

export type ApiChat = {
	_id: string;
	users: {
		_id: string;
		username: string;
	}[];
	messages: ApiMessage[];
	messageCounter: number;
	lastModified: string; //ISO-Date
};

export type ApiMessage = {
	_id: string;
	chatId: string;
	from: string;
	ciphertext: MessageType;
	sequence: number;
	sendTime: string; //ISO-date
};

export type Link = {
	path: string;
	title: string;
	pathsToCheck?: string[];
};
