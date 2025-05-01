import { getDbService } from './DbService.svelte';
import type { PendingMessage, StoredChat, StoredMessage } from './types/dataTypes';
import { getCookie } from './utils.svelte';

export class MessagesStore {
	private static instance: MessagesStore;
	private _messages = $state<Record<string, StoredMessage[]>>({});
	private _hasLoaded = $state(false);
	private getDb = getDbService;

	private constructor() {}

	public static getInstance() {
		if (!MessagesStore.instance) {
			MessagesStore.instance = new MessagesStore();
		}
		return MessagesStore.instance;
	}

	/* Loads the latest messages for a list of chats */
	public async loadLatestMessages(chatIds: string[]): Promise<void> {
		for (const chatId of chatIds) {
			const messages = await (await this.getDb()).getLatestMessages(chatId);
			this._messages[chatId] = messages;
		}
		this._hasLoaded = true;
	}

	/* Returns the latest message for each chat */
	public getLatestMessages(): Record<string, StoredMessage | undefined> {
		return Object.fromEntries(
			Object.entries(this._messages).map(([chatId, messages]) => [
				chatId,
				messages[messages.length - 1]
			])
		);
	}

	/* Returns all messages for a chat */
	public getChatMessages(chatId: string): StoredMessage[] {
		return this._messages[chatId] ?? [];
	}

	/* Adds a new message to a chat */
	public async addMessage(message: StoredMessage): Promise<void> {
		const messages = this._messages[message.chatId];
		if (!messages) this._messages[message.chatId] = [message];
		else messages.push(message);

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
		if (!messages) this._messages[pendingMessage.chatId] = [pendingMessage];
		else messages.push(pendingMessage);
		console.log(
			`addPendingMessage: ${pendingMessage.chatId}, ${this._messages[pendingMessage.chatId]?.length}`
		);

		await (await this.getDb()).putPendingMessage($state.snapshot(pendingMessage));
	}

	/* Handles a pending message promotion */
	public async handlePendingMessagePromotion(
		tempId: string,
		message: StoredMessage
	): Promise<void> {
		const messages = this._messages[message.chatId];
		if (!messages) return;
		const index = messages.findIndex((m) => m._id === tempId);
		if (index === -1) return;
		messages[index] = message;
		console.log(`handlePendingMessagePromotion: ${tempId}, ${messages?.length}`);

		await (await this.getDb()).promotePendingMessage(tempId, $state.snapshot(message));
	}

	public get hasLoaded(): boolean {
		return this._hasLoaded;
	}
}

export const messagesStore = MessagesStore.getInstance();
