import type { StoredChat, UsedChat } from '$lib/types/dataTypes';

export class ChatsStore {
	private static instance: ChatsStore;
	private _chats: UsedChat[];
	private listeners = new Set<(chats: UsedChat[]) => void>();

	private constructor() {
		this._chats = [];
	}

	public static getInstance() {
		if (!ChatsStore.instance) {
			const instance = new ChatsStore();
			this.instance = instance;
		}
		return this.instance;
	}

	public subscribe(callback: (value: UsedChat[]) => void): () => void {
		console.log(`New subscriber`);
		callback(this._chats); // immediately send current data
		this.listeners.add(callback); // register for future updates
		return () => this.listeners.delete(callback); // unsubscribe
	}

	private notify() {
		console.log(`Notifying: ${this.listeners.size}`);
		for (const callback of this.listeners) callback(this._chats);
	}

	public sortChats(): void {
		this._chats = this._chats.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
		this.notify();
	}

	public get chats(): UsedChat[] {
		return this._chats;
	}

	public getChat(chatId: string): UsedChat | undefined {
		return this._chats.find((chat) => chat._id === chatId);
	}

	public addChat(chat: UsedChat): void {
		this._chats.push(chat);
		this.notify();
	}
	public addChats(chats: UsedChat[]): void {
		this._chats.push(...chats);
		this.notify();
	}

	public updateChat(chatToUpdate: UsedChat): void {
		const i = this._chats.findIndex((c) => c._id === chatToUpdate._id);
		if (i === -1) return;
		this._chats.splice(i, 1, chatToUpdate);
		this.notify();
	}

	public indexOf(chat: UsedChat): number {
		return this._chats.indexOf(chat);
	}
}

export const chatsStore = ChatsStore.getInstance();
