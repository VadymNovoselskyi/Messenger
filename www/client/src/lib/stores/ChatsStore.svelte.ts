import { getDbService } from './DbService.svelte';
import type { PendingMessage, StoredChat, StoredMessage, UsedChat } from '$lib/types/dataTypes';
import { getCookie, storedToUsedChat, usedToStoredChat } from '$lib/utils';

export class ChatsStore {
	private static instance: ChatsStore;
	private _chats = $state<UsedChat[]>([]);
	private getDb = getDbService;

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

	/* Retrieves a chat by its ID */
	public getChat(chatId: string): UsedChat | undefined {
		return this._chats.find((chat) => chat._id === chatId);
	}

	/* Adds a new chat to the store */
	public async addChat(chat: UsedChat): Promise<void> {
		this._chats.push(chat);
		await (await this.getDb()).putChat($state.snapshot(chat));
	}

	/* Adds multiple chats to the store */
	public addChats(chats: UsedChat[]): void {
		this._chats.push(...chats);
	}

	/* Updates an existing chat in the store */
	public async updateChat(chatToUpdate: UsedChat): Promise<void> {
		const i = this._chats.findIndex((c) => c._id === chatToUpdate._id);
		if (i === -1) return;
		this._chats[i] = chatToUpdate;

		const storedChat = usedToStoredChat(chatToUpdate);
		await (await this.getDb()).putChat($state.snapshot(storedChat));
	}

	/* Adds a new message to a chat */
	public async addMessage(message: StoredMessage): Promise<void> {
		const i = this._chats.findIndex((c) => c._id === message.chatId);
		if (i === -1) return;
		const chat = this._chats[i];
		chat.messages.push(message);

		await (await this.getDb()).putMessage($state.snapshot(message));
	}

	/* Updates an existing message in a chat */
	public async updateMessage(message: StoredMessage): Promise<void> {
		const i = this._chats.findIndex((c) => c._id === message.chatId);
		if (i === -1) return;
		const chat = this._chats[i];
		const messageIndex = chat.messages.findIndex((m) => m._id === message._id);
		if (messageIndex === -1) return;
		chat.messages[messageIndex] = message;

		await (await this.getDb()).putMessage($state.snapshot(message));
	}

	/* Adds a new pending message to a chat */
	public async addPendingMessage(message: PendingMessage): Promise<void> {
		const i = this._chats.findIndex((c) => c._id === message.chatId);
		if (i === -1) return;
		this._chats[i].messages.push(message);

		await (await this.getDb()).putPendingMessage($state.snapshot(message));
	}

	/* Promotes a pending message to a stored message */
	public async promotePendingMessage(tempId: string, message: StoredMessage): Promise<void> {
		const i = this._chats.findIndex((c) => c._id === message.chatId);
		if (i === -1) return;
		const chat = this._chats[i];
		const messageIndex = chat.messages.findIndex((m) => m._id === tempId);
		if (messageIndex === -1) return;
		chat.messages[messageIndex] = message;

		await (await this.getDb()).promotePendingMessage(tempId, $state.snapshot(message));
	}

	/* Sorts chats by last modified date */
	public sortChats(): void {
		this._chats = this._chats.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
	}

	/* Returns the index of a chat in the store */
	public indexOf(chat: UsedChat): number {
		return this._chats.indexOf(chat);
	}
}

export const chatsStore = ChatsStore.getInstance();
