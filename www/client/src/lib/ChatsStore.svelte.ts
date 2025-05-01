import { getDbService } from './DbService.svelte';
import type { PendingMessage, StoredChat, StoredMessage } from '$lib/types/dataTypes';
import { getCookie } from '$lib/utils.svelte';

export class ChatsStore {
	private static instance: ChatsStore;
	private _chats = $state<StoredChat[]>([]);
	private _hasLoaded = $state(false);
	private getDb = getDbService;

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
		const chats = await (await this.getDb()).getLatestChats();
		this._chats.push(...chats);
		this._hasLoaded = true;
		return chats.map((chat) => chat._id);
	}

	public get chats(): StoredChat[] {
		return this._chats;
	}

	/* Retrieves a chat by its ID */
	public getChat(chatId: string): StoredChat | undefined {
		return this._chats.find((chat) => chat._id === chatId);
	}

	/* Adds a new chat to the store */
	public async addChat(chat: StoredChat): Promise<void> {
		const i = this._chats.findIndex((c) => c._id === chat._id);
		if (i !== -1) this._chats[i] = chat;
		else this._chats.push(chat);

		await (await this.getDb()).putChat($state.snapshot(chat));
	}

	/* Updates an existing chat in the store */
	public async updateChat(chatToUpdate: StoredChat): Promise<void> {
		const i = this._chats.findIndex((c) => c._id === chatToUpdate._id);
		if (i === -1) return;
		this._chats[i] = chatToUpdate;

		await (await this.getDb()).putChat($state.snapshot(chatToUpdate));
	}

	/* Sorts chats by last modified date */
	public sortChats(): void {
		this._chats = this._chats.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
	}

	/* Returns the index of a chat in the store */
	public indexOf(chat: StoredChat): number {
		return this._chats.indexOf(chat);
	}

	public get hasLoaded(): boolean {
		return this._hasLoaded;
	}
}

export const chatsStore = ChatsStore.getInstance();
