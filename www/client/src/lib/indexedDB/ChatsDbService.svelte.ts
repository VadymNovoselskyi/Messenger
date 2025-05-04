import type { StoredChat } from "$lib/types/dataTypes";

export class ChatsDbService {
	private static instance: ChatsDbService;
	private db!: IDBDatabase;
	private dbName = 'AccountStorage';
	private chatsStoreName = 'chats';

	public static async getInstance(): Promise<ChatsDbService> {
		if (!ChatsDbService.instance) {
			const instance = new ChatsDbService();
			await instance.open();
			ChatsDbService.instance = instance;
		}
		return ChatsDbService.instance;
	}

	private open(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = window.indexedDB.open(this.dbName, 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				const chatsStore = db.createObjectStore(this.chatsStoreName, { keyPath: '_id' });
				chatsStore.createIndex('by-lastModified', 'lastModified');
			};
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};
			request.onerror = () => reject(request.error);
		});
	}

	/** add or update a chat */
	public async putChat(chat: StoredChat): Promise<void> {
		const tx = this.db.transaction(this.chatsStoreName, 'readwrite');
		tx.objectStore(this.chatsStoreName).put(chat);
		return new Promise((res, rej) => {
			tx.oncomplete = () => res();
			tx.onerror = () => rej(tx.error);
		});
	}

	/** Get the metadata for a single chat by _id. */
	public async getChat(chatId: string): Promise<StoredChat | undefined> {
		const tx = this.db.transaction(this.chatsStoreName, 'readonly');
		const store = tx.objectStore(this.chatsStoreName);
		const req = store.get(chatId);

		return new Promise((resolve, reject) => {
			req.onsuccess = () => {
				resolve(req?.result);
			};
			req.onerror = () => reject(req.error);
		});
	}

	/** Get chats, sorted by timestamp descending, limited to maxCount. */
	public async getLatestChats(maxCount: number = 10): Promise<StoredChat[]> {
		const tx = this.db.transaction(this.chatsStoreName, 'readonly');
		const store = tx.objectStore(this.chatsStoreName);
		const idx = store.index('by-lastModified');
		const req = idx.openCursor(null, 'prev');

		const result: StoredChat[] = [];
		return new Promise((resolve, reject) => {
			req.onsuccess = () => {
				const cursor = req.result;
				if (!cursor || result.length >= maxCount) {
					return resolve(result);
				}
				result.push(cursor.value);
				cursor.continue();
			};
			req.onerror = () => reject(req.error);
		});
	}

	/** Get chats by date, direction, and limit. */
	public async getChatsByDate(
		start: string,
		limit: number,
		direction: 'UP' | 'DOWN'
	): Promise<StoredChat[]> {
		const tx = this.db.transaction(this.chatsStoreName, 'readonly');
		const store = tx.objectStore(this.chatsStoreName);
		const idx = store.index('by-lastModified');
		const req =
			direction === 'DOWN'
				? idx.openCursor(IDBKeyRange.upperBound(start, true), 'prev')
				: idx.openCursor(IDBKeyRange.lowerBound(start, true), 'next');

		const result: StoredChat[] = [];
		return new Promise((resolve, reject) => {
			req.onsuccess = () => {
				const cursor = req.result;
				if (!cursor || result.length >= limit) {
					return resolve(result);
				}
				result.push(cursor.value);
				cursor.continue();
			};
			req.onerror = () => reject(req.error);
		});
	}

	/** Get the number of chats in the database. */
	public async getChatsCount(): Promise<number> {
		const tx = this.db.transaction(this.chatsStoreName, 'readonly');
		const store = tx.objectStore(this.chatsStoreName);
		const req = store.count();
		return new Promise((resolve, reject) => {
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}
}

let instancePromise: Promise<ChatsDbService> | null = null;
export function getChatsDbService(): Promise<ChatsDbService> {
	if (!instancePromise) {
		instancePromise = ChatsDbService.getInstance();
	}
	return instancePromise;
}
