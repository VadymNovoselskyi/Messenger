import type { StoredChat, UsedChat } from '$lib/types/dataTypes';

export class ChatStore {
	private static instance: ChatStore;
	private _chats: UsedChat[];

	private constructor() {
		this._chats = [];
	}

	public static getInstance() {
		if (!ChatStore.instance) {
			const instance = new ChatStore();
			this.instance = instance;
		}
		return this.instance;
	}

	public get chats(): UsedChat[] {
		return this._chats;
	}

	public getChat(chatId: string): UsedChat | undefined {
		return this._chats.find((chat) => chat._id === chatId);
	}

	public addChat(chat: UsedChat): void {
		this._chats.push(chat);
	}
	public addChats(chats: UsedChat[]): void {
		this._chats.push(...chats);
	}

	public indexOf(chat: UsedChat): number {
		return this._chats.indexOf(chat);
	}
}
