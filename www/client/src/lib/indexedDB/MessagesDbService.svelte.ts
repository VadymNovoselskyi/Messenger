import { getChatsDbService } from './ChatsDbService.svelte';
import { getMyChatMetadata } from '$lib/utils/chatMetadataUtils.svelte';
import type { StoredMessage, PendingMessage } from '$lib/types/dataTypes';

export class MessagesDbService {
	private static instance: MessagesDbService;
	private db!: IDBDatabase;
	private dbName = 'AccountStorage';
	private messagesStoreName = 'messages';
	private pendingMessagesStoreName = 'pendingMessages';

	public static async getInstance(): Promise<MessagesDbService> {
		if (!MessagesDbService.instance) {
			const instance = new MessagesDbService();
			await instance.open();
			MessagesDbService.instance = instance;
		}
		return MessagesDbService.instance;
	}

	private open(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = window.indexedDB.open(this.dbName, 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				const messageStore = db.createObjectStore(this.messagesStoreName, { keyPath: '_id' });
				messageStore.createIndex('by-chat-seq', ['chatId', 'sequence'], { unique: true });

				db.createObjectStore(this.pendingMessagesStoreName, {
					keyPath: 'tempId',
					autoIncrement: true
				});
			};
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};
			request.onerror = () => reject(request.error);
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
		const chat = await (await getChatsDbService()).getChat(chatId);
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
		const chat = await (await getChatsDbService()).getChat(chatId);
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
		const chat = await (await getChatsDbService()).getChat(chatId);
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
}

let instancePromise: Promise<MessagesDbService> | null = null;
export function getMessagesDbService(): Promise<MessagesDbService> {
	if (!instancePromise) {
		instancePromise = MessagesDbService.getInstance();
	}
	return instancePromise;
}
