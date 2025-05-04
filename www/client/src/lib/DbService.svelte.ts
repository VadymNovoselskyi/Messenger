import { browser } from '$app/environment';
import type { StoredMessage, StoredChat, PendingMessage } from '$lib/types/dataTypes';
import { getCookie, getMyChatMetadata } from './utils.svelte';

export class DbService {
	private static instance: DbService;
	private db!: IDBDatabase;
	private dbName = 'AccountStorage';
	private messagesStoreName = 'messages';
	private pendingMessagesStoreName = 'pendingMessages';
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
				const pendingStore = db.createObjectStore(this.pendingMessagesStoreName, {
					keyPath: 'tempId',
					autoIncrement: true
				});

				// chats store, keyed by id
				const chatsStore = db.createObjectStore(this.chatsStoreName, { keyPath: '_id' });
				chatsStore.createIndex('by-lastModified', 'lastModified');
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

		const lastReadSequence = getMyChatMetadata(chatId).lastReadSequence;
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
		const tx = this.db.transaction(this.pendingMessagesStoreName, 'readwrite');
		tx.objectStore(this.pendingMessagesStoreName).put(message);
		return new Promise((res, rej) => {
			tx.oncomplete = () => res();
			tx.onerror = () => rej(tx.error);
		});
	}

	/** promote a pending message to a stored message */
	public async promotePendingMessage(tempId: string, message: StoredMessage): Promise<void> {
		const tx = this.db.transaction(this.pendingMessagesStoreName, 'readwrite');
		const pendingMessage = tx.objectStore(this.pendingMessagesStoreName).get(tempId);
		if (!pendingMessage) return;
		tx.objectStore(this.pendingMessagesStoreName).delete(tempId);
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
				: idx.openCursor(IDBKeyRange.lowerBound(start, true), 'prev');

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

	/** Get the index of a chat in the database. */
	public async getChatIndex(chatId: string): Promise<number> {
		const tx = this.db.transaction(this.chatsStoreName, 'readonly');
		const store = tx.objectStore(this.chatsStoreName);
		const req = store.get(chatId);
		return new Promise((resolve, reject) => {
			req.onsuccess = () => resolve(req.result);
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
