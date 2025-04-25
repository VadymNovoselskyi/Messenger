import type { UsedChat, StoredMessage, StoredChat } from '$lib/types/dataTypes';

export class DbService {
	private static instance: DbService;
	private db!: IDBDatabase;
	private dbName = 'AccountStorage';
	private messagesStoreName = 'messages';
	private chatsStoreName = 'chats';

	public static async getInstance(): Promise<DbService> {
		if (!DbService.instance) {
			const instance = new DbService();
			await instance.open();
			DbService.instance = instance;
		}
		return DbService.instance;
	}

	private open(): Promise<void> {
		return new Promise((resolve, reject) => {
			const req = indexedDB.open(this.dbName, 1);
			req.onupgradeneeded = () => {
				const db = req.result;

				// messages store, keyed by id, and index by chatId+sequence for queries
				const messageStore = db.createObjectStore(this.messagesStoreName, { keyPath: '_id' });
				messageStore.createIndex('by-chat-seq', ['chatId', 'sequence'], { unique: true });

				// chats store, keyed by id
				const chatsStore = db.createObjectStore(this.chatsStoreName, { keyPath: '_id' });
				chatsStore.createIndex('by-timestamp', 'lastModified');
			};
			req.onsuccess = () => {
				this.db = req.result;
				resolve();
			};
			req.onerror = () => reject(req.error);
		});
	}

	/** add or update a message */
	public async putMessage(message: StoredMessage): Promise<void> {
		const tx = this.db.transaction(this.messagesStoreName, 'readwrite');
		tx.objectStore(this.messagesStoreName).put(message);
		return new Promise((res, rej) => {
			tx.oncomplete = () => res();
			tx.onerror = () => rej(tx.error);
		});
	}

	/**
	 * Fetch the latest `limit` messages for a chat, by bounding the sequence.
	 */
	public async getLatestMessages(chatId: string, limit: number = 20): Promise<StoredMessage[]> {
		const chat = await this.getChat(chatId);
		if (!chat || chat.messageCounter <= 0) {
			return [];
		}
		const high = chat.messageCounter;
		const low = Math.max(1, high - limit + 1);

		const tx = this.db.transaction(this.messagesStoreName, 'readonly');
		const idx = tx.objectStore(this.messagesStoreName).index('by-chat-seq');
		const range = IDBKeyRange.bound([chatId, low], [chatId, high]);
		const req = idx.openCursor(range, 'prev');

		const result: StoredMessage[] = [];
		return new Promise((resolve, reject) => {
			req.onsuccess = () => {
				const cursor = req.result;
				if (!cursor) {
					return resolve(result.reverse());
				}
				result.push(cursor.value);
				cursor.continue();
			};
			req.onerror = () => reject(req.error);
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

	/**
	 * Fetch the metadata for a single chat by ID.
	 */
	public async getChat(chatId: string): Promise<StoredChat | null> {
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

	/**
	 * Get chats, sorted by timestamp descending, limited to maxCount.
	 */
	public async getLatestChats(maxCount: number = 10): Promise<StoredChat[]> {
		const tx = this.db.transaction(this.chatsStoreName, 'readonly');
		const store = tx.objectStore(this.chatsStoreName);
		const idx = store.index('by-timestamp');
		// Open cursor over the whole index, newest-first:
		const req = idx.openCursor(null, 'prev');

		const result: StoredChat[] = [];
		return new Promise((resolve, reject) => {
			req.onsuccess = () => {
				const cursor = req.result;
				// Stop if either no more records, or we've reached the limit:
				if (!cursor || result.length >= maxCount) {
					return resolve(result.reverse());
				}
				result.push(cursor.value);
				cursor.continue();
			};
			req.onerror = () => reject(req.error);
		});
	}
}
