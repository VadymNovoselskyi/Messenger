import type { PendingMessage, StoredChat, StoredMessage } from '$lib/types/dataTypes';
import { messagesStore } from '$lib/stores/MessagesStore.svelte';
import { getChatsDbService } from '$lib/indexedDB/ChatsDbService.svelte';

export class ChatsStore {
	private static instance: ChatsStore;
	private static LOAD_CHATS_COUNT = 6;
	private _loadedChats = $state<StoredChat[]>([]);
	private _hasLoaded = $state(false);
	private _chatsCount = $state(0);
	private getChatsDb = getChatsDbService;

	private constructor() {}

	public static getInstance() {
		if (!ChatsStore.instance) {
			const instance = new ChatsStore();
			this.instance = instance;
		}
		return this.instance;
	}

	/* Loads multiple chats from the database */
	public async loadLatestChats(): Promise<string[]> {
		const chats = await (await this.getChatsDb()).getLatestChats(ChatsStore.LOAD_CHATS_COUNT);
		this._loadedChats.push(...chats);
		this._hasLoaded = true;
		this._chatsCount = await (await this.getChatsDb()).getChatsCount();
		return chats.map((chat) => chat._id);
	}

	/* Loads chats from the database by date */
	// public async loadChatsByDate(date: string): Promise<string[]> {
	// 	const newerChats = await (
	// 		await this.getDb()
	// 	).getChatsByDate(date, Math.floor(ChatsStore.LOAD_CHATS_COUNT / 2), 'UP');
	// 	const olderChats = await (
	// 		await this.getDb()
	// 	).getChatsByDate(date, Math.floor(ChatsStore.LOAD_CHATS_COUNT / 2), 'DOWN');

	// 	const chats = [...newerChats, ...olderChats];
	// 	this._loadedChats.push(...chats);
	// 	this._hasLoaded = true;
	// 	this._chatsCount = await (await this.getDb()).getChatsCount();
	// 	return chats.map((chat) => chat._id);
	// }

	public get loadedChats(): StoredChat[] {
		return this._loadedChats;
	}

	/* Retrieves a loaded chat by its ID */
	public getLoadedChat(chatId: string): StoredChat | undefined {
		return this._loadedChats.find((chat) => chat._id === chatId);
	}

	/* Retrieves a chat by its ID */
	public async getChat(chatId: string): Promise<StoredChat | undefined> {
		let chat = this._loadedChats.find((chat) => chat._id === chatId);
		if (!chat) {
			chat = await (await this.getChatsDb()).getChat(chatId);
			if (chat) {
				await messagesStore.loadLatestMessages([chatId]);
				this._loadedChats.push(chat);
			}
		}
		return chat;
	}

	/* Adds a new chat to the store */
	public async addChat(chat: StoredChat): Promise<void> {
		const i = this._loadedChats.findIndex((c) => c._id === chat._id);
		if (i !== -1) this._loadedChats[i] = chat;
		else this._loadedChats.push(chat);
		this._chatsCount++;

		await (await this.getChatsDb()).putChat($state.snapshot(chat));
	}

	/* Adds multiple loaded chats to the store */
	public async addLoadedChats(chats: StoredChat[], direction: 'UP' | 'DOWN'): Promise<void> {
		if (direction === 'UP') this._loadedChats.unshift(...chats);
		else this._loadedChats.push(...chats);
		this._chatsCount += chats.length;
	}

	/* Updates an existing chat in the store */
	public async updateChat(chatToUpdate: StoredChat): Promise<void> {
		const i = this._loadedChats.findIndex((c) => c._id === chatToUpdate._id);
		if (i === -1) return;
		this._loadedChats[i] = chatToUpdate;

		await (await this.getChatsDb()).putChat($state.snapshot(chatToUpdate));
	}

	/* Sorts chats by last modified date */
	public sortChats(): void {
		this._loadedChats = this._loadedChats.sort((a, b) =>
			b.lastModified.localeCompare(a.lastModified)
		);
	}

	/* Returns the index of a chat in the store */
	public indexOf(chat: StoredChat): number {
		return this._loadedChats.indexOf(chat);
	}

	public get hasLoaded(): boolean {
		return this._hasLoaded;
	}

	public get chatsCount(): number {
		return this._chatsCount;
	}
}

export const chatsStore = ChatsStore.getInstance();
