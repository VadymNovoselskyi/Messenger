import type { StoredChat, StoredMessage, UsedChat } from '$lib/types/dataTypes';

export class ChatsStore {
	private static instance: ChatsStore;
	private _chats = $state<UsedChat[]>([]);
	private listeners = new Set<(chats: UsedChat[]) => void>();

	private constructor() {}

	public static getInstance() {
		if (!ChatsStore.instance) {
			const instance = new ChatsStore();
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

	public updateChat(chatToUpdate: UsedChat): void {
		const i = this._chats.findIndex((c) => c._id === chatToUpdate._id);
		if (i === -1) return;
		this._chats[i] = chatToUpdate;
	}

	public forceUpdateChat(chat: UsedChat): void;
	public forceUpdateChat(chatId: string): void;
	public forceUpdateChat(chatOrId: UsedChat | string): void {
		const chatId = typeof chatOrId === 'string' ? chatOrId : chatOrId._id;
		const i = this._chats.findIndex((c) => c._id === chatId);
		if (i === -1) return;
		this._chats[i] = typeof chatOrId === 'string' ? { ...this._chats[i] } : { ...chatOrId };
	}

	public addMessage(message: StoredMessage): void {
		const i = this._chats.findIndex((c) => c._id === message.chatId);
		if (i === -1) return;
		this._chats[i].messages.push(message);
	}
	public updateMessage(message: StoredMessage, tempId: string): void {
		const i = this._chats.findIndex((c) => c._id === message.chatId);
		if (i === -1) return;
		const chat = this._chats[i];
		const messageIndex = chat.messages.findIndex((m) => m._id === tempId);
		if (messageIndex === -1) return;
		chat.messages[messageIndex] = message;
	}
	public forceUpdateMessages(chatId: string): void {
		const i = this._chats.findIndex((c) => c._id === chatId);
		if (i === -1) return;
		this._chats[i].messages = [...this._chats[i].messages];
	}

	public sortChats(): void {
		this._chats = this._chats.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
	}

	public indexOf(chat: UsedChat): number {
		return this._chats.indexOf(chat);
	}

	//Svelte Store
	public subscribe(callback: (value: UsedChat[]) => void): () => void {
		// console.log(`New subscriber`);
		callback(this._chats); // immediately send current data
		this.listeners.add(callback); // register for future updates
		return () => this.listeners.delete(callback); // unsubscribe
	}

	public notify() {
		// console.log(`Notifying: ${this.listeners.size}`);
		for (const callback of this.listeners) callback(this._chats);
	}
}

export const chatsStore = ChatsStore.getInstance();
