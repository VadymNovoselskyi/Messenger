import { getDbService } from './DbService.svelte';
import type { PendingMessage, StoredChat, StoredMessage } from './types/dataTypes';
import { getCookie } from './utils.svelte';

export class MessagesStore {
	private static instance: MessagesStore;
	private _messages = $state<Record<string, StoredMessage[]>>({});
	private _lastMessages = $state<Record<string, StoredMessage | undefined>>({});
	private _hasLoaded = $state(false);
	private getDb = getDbService;

	private constructor() {}

	public static getInstance() {
		if (!MessagesStore.instance) {
			MessagesStore.instance = new MessagesStore();
		}
		return MessagesStore.instance;
	}

	public getLastMessages(): Record<string, StoredMessage | undefined> {
		return this._lastMessages;
	}

	/* Loads the latest messages for a list of chats */
	public async loadLatestMessages(chatIds: string[]): Promise<void> {
		for (const chatId of chatIds) {
			const messages = await (await this.getDb()).getLatestMessages(chatId);
			this._messages[chatId] = messages;
		}
		this._lastMessages = await this.loadLastMessages();
		this._hasLoaded = true;
	}

	/* Returns all messages for a chat */
	public getChatMessages(chatId: string): StoredMessage[] {
		return this._messages[chatId] ?? [];
	}

	/* Adds a new message to a chat */
	public async addMessage(message: StoredMessage, isNecessary = true): Promise<void> {
		const messages = this._messages[message.chatId];
		if (!messages) {
			this._messages[message.chatId] = [message];
			this._lastMessages[message.chatId] = message;
		} else {
			if (isNecessary && (this._messages[message.chatId]?.at(-1)?.sequence ?? 0) === message.sequence - 1) {
				messages.push(message);
			}
			if ((this._lastMessages[message.chatId]?.sequence ?? 0) < message.sequence) {
				this._lastMessages[message.chatId] = message;
			}
		}

		await (await this.getDb()).putMessage($state.snapshot(message));
	}

	/* Updates an existing message in a chat */
	public async updateMessage(message: StoredMessage): Promise<void> {
		const messages = this._messages[message.chatId];
		if (!messages) return;
		const index = messages.findIndex((m) => m._id === message._id);
		if (index === -1) return;
		messages[index] = message;

		await (await this.getDb()).putMessage($state.snapshot(message));
	}

	/* Adds a new pending message to a chat */
	public async addPendingMessage(pendingMessage: PendingMessage): Promise<void> {
		const messages = this._messages[pendingMessage.chatId];
		if (!messages) {
			this._messages[pendingMessage.chatId] = [pendingMessage];
			this._lastMessages[pendingMessage.chatId] = pendingMessage;
		} else {
			if (
				(this._messages[pendingMessage.chatId]?.at(-1)?.sequence ?? 0) ===
				pendingMessage.sequence - 1
			) {
				messages.push(pendingMessage);
			}
			if ((this._lastMessages[pendingMessage.chatId]?.sequence ?? 0) < pendingMessage.sequence) {
				this._lastMessages[pendingMessage.chatId] = pendingMessage;
			}
		}

		await (await this.getDb()).putPendingMessage($state.snapshot(pendingMessage));
	}

	/* Handles a pending message promotion */
	public async handlePendingMessagePromotion(
		tempId: string,
		message: StoredMessage
	): Promise<void> {
		const messages = this._messages[message.chatId];
		if (!messages) return;
		if (this._lastMessages[message.chatId]!.sequence < message.sequence) {
			this._lastMessages[message.chatId] = message;
		}
		const index = messages.findIndex((m) => m._id === tempId);
		if (index !== -1) messages[index] = message;

		await (await this.getDb()).promotePendingMessage(tempId, $state.snapshot(message));
	}

	public addEmptyChat(chatId: string) {
		this._messages[chatId] = [];
		this._lastMessages[chatId] = undefined;
	}

	/* Returns the latest message for each chat */
	private async loadLastMessages(): Promise<Record<string, StoredMessage | undefined>> {
		const db = await this.getDb();
		const lastMessages: Record<string, StoredMessage | undefined> = {};
		for (const chatId of Object.keys(this._messages)) {
			lastMessages[chatId] = await db.getLastMessage(chatId);
		}
		return lastMessages;
	}

	public get hasLoaded(): boolean {
		return this._hasLoaded;
	}
}

export const messagesStore = MessagesStore.getInstance();
