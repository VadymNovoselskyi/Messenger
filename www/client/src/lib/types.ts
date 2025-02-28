export interface Link {
	path: string;
	title: string;
	pathsToCheck?: string[];
}

export interface User {
	_id: string;
	username: string;
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
