export interface APICall {
	api: string;
	id: string;
	token?: string | null;
	payload: Object;
}

export interface Message {
	_id: string;
	from: string; //User
	text: string;
	sendTime: string; //ISO-date
	isReceived?: boolean;
}

export interface Chat {
	_id: string; //ID type?
	users: User[];
	messages: Message[];
	unreadMessagesCount: number;
	showingUnreadMessagesCount: number;
	lastModified: string; //ISO-Date
}

export interface User {
	_id: string;
	username: string;
}

export interface Link {
	path: string;
	title: string;
	pathsToCheck?: string[];
}