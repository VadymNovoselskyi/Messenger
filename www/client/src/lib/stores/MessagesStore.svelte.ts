import { getMessagesDbService } from '$lib/indexedDB/MessagesDbService.svelte';
import type { PendingMessage, StoredMessage } from '$lib/types/dataTypes';

export class MessagesStore {
	private static instance: MessagesStore;
	private _loadedMessages = $state<Record<string, StoredMessage[]>>({});
	private _lastMessages = $state<Record<string, StoredMessage | undefined>>({});
	private _hasLoaded = $state(false);
	private getMessagesDb = getMessagesDbService;

	private constructor() {}

	public static getInstance() {
		if (!MessagesStore.instance) {
			MessagesStore.instance = new MessagesStore();
		}
		return MessagesStore.instance;
	}

	public get lastMessages(): Record<string, StoredMessage | undefined> {
		return this._lastMessages;
	}

	/* Loads the latest messages for a list of chats */
	public async loadLatestMessages(chatIds: string[]): Promise<void> {
		for (const chatId of chatIds) {
			const messages = await (await this.getMessagesDb()).getLatestMessages(chatId);
			const lastMessage = await (await this.getMessagesDb()).getLastMessage(chatId);
			this._loadedMessages[chatId] = messages;
			this._lastMessages[chatId] = lastMessage;
		}
		this._hasLoaded = true;
	}

	/* Returns all loaded messages for a chat */
	public getLoadedChatMessages(chatId: string): StoredMessage[] {
		return this._loadedMessages[chatId] ?? [];
	}

	/* Adds a new message to a chat */
	public async addMessage(message: StoredMessage, isNecessary = true): Promise<void> {
		const messages = this._loadedMessages[message.chatId];
		if (!messages) {
			this._loadedMessages[message.chatId] = [message];
			this._lastMessages[message.chatId] = message;
		} else {
			if (
				isNecessary &&
				(this._loadedMessages[message.chatId]?.at(-1)?.sequence ?? 0) === message.sequence - 1
			) {
				messages.push(message);
			}
			if ((this._lastMessages[message.chatId]?.sequence ?? 0) < message.sequence) {
				this._lastMessages[message.chatId] = message;
			}
		}

		await (await this.getMessagesDb()).putMessage($state.snapshot(message));
	}

	/* Updates an existing message in a chat */
	public async updateMessage(message: StoredMessage): Promise<void> {
		const messages = this._loadedMessages[message.chatId];
		if (!messages) return;
		const index = messages.findIndex((m) => m._id === message._id);
		if (index === -1) return;
		messages[index] = message;

		await (await this.getMessagesDb()).putMessage($state.snapshot(message));
	}

	/* Adds a new pending message to a chat */
	public async addPendingMessage(pendingMessage: PendingMessage): Promise<void> {
		const messages = this._loadedMessages[pendingMessage.chatId];
		if (!messages) {
			this._loadedMessages[pendingMessage.chatId] = [pendingMessage];
			this._lastMessages[pendingMessage.chatId] = pendingMessage;
		} else {
			if (
				(this._loadedMessages[pendingMessage.chatId]?.at(-1)?.sequence ?? 0) ===
				pendingMessage.sequence - 1
			) {
				messages.push(pendingMessage);
			}
			if ((this._lastMessages[pendingMessage.chatId]?.sequence ?? 0) < pendingMessage.sequence) {
				this._lastMessages[pendingMessage.chatId] = pendingMessage;
			}
		}

		await (await this.getMessagesDb()).putPendingMessage($state.snapshot(pendingMessage));
	}

	/* Handles a pending message promotion */
	public async handlePendingMessagePromotion(
		tempId: string,
		message: StoredMessage
	): Promise<void> {
		const messages = this._loadedMessages[message.chatId];
		if (!messages) return;
		if (this._lastMessages[message.chatId]!.sequence < message.sequence) {
			this._lastMessages[message.chatId] = message;
		}
		const index = messages.findIndex((m) => m._id === tempId);
		if (index !== -1) messages[index] = message;

		await (await this.getMessagesDb()).promotePendingMessage(tempId, $state.snapshot(message));
	}

	/* Adds an empty chat to the store */
	public addEmptyChat(chatId: string) {
		this._loadedMessages[chatId] = [];
		this._lastMessages[chatId] = undefined;
	}

	/* Returns the last message for each chat */
	private async loadLastMessages(): Promise<Record<string, StoredMessage | undefined>> {
		const db = await this.getMessagesDb();
		const lastMessages: Record<string, StoredMessage | undefined> = {};
		for (const chatId of Object.keys(this._loadedMessages)) {
			lastMessages[chatId] = await db.getLastMessage(chatId);
		}
		return lastMessages;
	}

	public get hasLoaded(): boolean {
		return this._hasLoaded;
	}
}

export const messagesStore = MessagesStore.getInstance();
