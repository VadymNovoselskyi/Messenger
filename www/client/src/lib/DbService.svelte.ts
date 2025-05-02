import { browser } from '$app/environment';
import type { StoredMessage, StoredChat, PendingMessage } from '$lib/types/dataTypes';
import { getCookie } from './utils.svelte';

export class DbService {
	private static instance: DbService;
	private db!: IDBDatabase;
	private dbName = 'AccountStorage';
	private messagesStoreName = 'messages';
	private pendingStoreName = 'pending';
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

				// pending store, keyed by id, and has autoIncrement
				const pendingStore = db.createObjectStore(this.pendingStoreName, {
					keyPath: 'tempId',
					autoIncrement: true
				});

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

	/** Fetch the latest `limit` messages for a chat, by bounding the sequence. */
	public async getLatestMessages(chatId: string, limit: number = 20): Promise<StoredMessage[]> {
		const chat = await this.getChat(chatId);
		if (!chat || chat.lastSequence <= 0) {
			return [];
		}
		const lastReadSequence = chat.users.find(
			(user) => user._id === getCookie('userId')
		)!.lastReadSequence;

		const unreadCount = chat.lastSequence - lastReadSequence;
		const high = lastReadSequence + Math.min(unreadCount, Math.round(limit / 2));
		const low = Math.max(high - limit + 1, 0);

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

	/** Fetch the last message for a chat. */
	public async getLastMessage(chatId: string): Promise<StoredMessage | undefined> {
		const chat = await this.getChat(chatId);
		if (!chat || chat.lastSequence <= 0) {
			return undefined;
		}

		const tx = this.db.transaction(this.messagesStoreName, 'readonly');
		const idx = tx.objectStore(this.messagesStoreName).index('by-chat-seq');
		const range = IDBKeyRange.bound([chatId, chat.lastSequence], [chatId, chat.lastSequence]);
		const req = idx.openCursor(range, 'prev');

		return new Promise((resolve, reject) => {
			req.onsuccess = () => {
				const cursor = req.result;
				if (!cursor) {
					return resolve(undefined);
				}
				resolve(cursor.value);
				cursor.continue();
			};
			req.onerror = () => reject(req.error);
		});
	}

	/** Fetch messages by index. */
	public async getMessagesByIndex(
		chatId: string,
		low: number,
		high: number
	): Promise<StoredMessage[]> {
		const chat = await this.getChat(chatId);
		if (!chat || chat.lastSequence <= 0) {
			return [];
		}

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

	/** add or update a pending message */
	public async putPendingMessage(message: PendingMessage): Promise<void> {
		const tx = this.db.transaction(this.pendingStoreName, 'readwrite');
		tx.objectStore(this.pendingStoreName).put(message);
		return new Promise((res, rej) => {
			tx.oncomplete = () => res();
			tx.onerror = () => rej(tx.error);
		});
	}

	/** promote a pending message to a stored message */
	public async promotePendingMessage(tempId: string, message: StoredMessage): Promise<void> {
		const tx = this.db.transaction(this.pendingStoreName, 'readwrite');
		const pendingMessage = tx.objectStore(this.pendingStoreName).get(tempId);
		if (!pendingMessage) return;
		tx.objectStore(this.pendingStoreName).delete(tempId);
		await this.putMessage(message);
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
		const req = idx.openCursor(null, 'prev');

		const result: StoredChat[] = [];
		return new Promise((resolve, reject) => {
			req.onsuccess = () => {
				const cursor = req.result;
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

let instancePromise: Promise<DbService> | null = null;
export function getDbService(): Promise<DbService> {
	if (!browser) {
		return Promise.reject(new Error('DbService only available in the browser'));
	}
	if (!instancePromise) {
		instancePromise = DbService.getInstance();
	}
	return instancePromise;
}
