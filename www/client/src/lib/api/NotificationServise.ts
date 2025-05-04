import { SignalProtocolDb } from '$lib/indexedDB/SignalProtocolDb.svelte';
import { chatsStore } from '$lib/stores/ChatsStore.svelte';
import { getOtherUserChatMetadata } from '$lib/utils/chatMetadataUtils.svelte';
import * as apiTypes from '$lib/types/apiTypes';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { messagesStore } from '$lib/stores/MessagesStore.svelte';
import { getCookie } from '$lib/utils/cookieUtils';
import type { StoredChat, StoredMessage } from '$lib/types/dataTypes';

export function handleNotification(
	api: apiTypes.NotificationApi,
	payload: apiTypes.NotificationMessagePayload
) {
	switch (api) {
		case apiTypes.NotificationApi.INCOMING_MESSAGE:
			return handleIncomingMessage(payload as apiTypes.incomingMessageResponse);
		case apiTypes.NotificationApi.INCOMING_READ:
			return handleIncomingRead(payload as apiTypes.incomingReadResponse);
		case apiTypes.NotificationApi.INCOMING_CHAT:
			return handleIncomingChat(payload as apiTypes.incomingChatResponse);
	}
}

async function handleIncomingMessage(payload: apiTypes.incomingMessageResponse) {
	const { chatId, message } = payload;

	const chat = chatsStore.getLoadedChat(chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);

	const senderAddress: libsignal.SignalProtocolAddress = new libsignal.SignalProtocolAddress(
		getOtherUserChatMetadata(chatId)._id,
		1
	);

	const store = SignalProtocolDb.getInstance();
	const sessionCipher = new libsignal.SessionCipher(store, senderAddress);
	const cipherMessage = message.ciphertext;
	const cipherBinary = atob(cipherMessage.body!);

	if (cipherMessage.type === 3) {
		await sessionCipher.decryptPreKeyWhisperMessage(cipherBinary!, 'binary');
		return;
	}
	if (cipherMessage.type !== 1) throw new Error(`Unknown message type: ${cipherMessage.type}`);

	const bufferText = await sessionCipher.decryptWhisperMessage(cipherBinary!, 'binary');

	const plaintext = new TextDecoder().decode(new Uint8Array(bufferText!));
	if (!plaintext) return;

	const messageToStore: StoredMessage = { ...message, plaintext };
	const lastModified =
		chat.lastModified.localeCompare(message.sendTime) > 0 ? chat.lastModified : message.sendTime;
	const lastSequence = Math.max(chat.lastSequence, message.sequence);
	const updatedChat: StoredChat = {
		_id: chat._id,
		users: chat.users.map((user) => {
			if (user._id !== getCookie('userId')) {
				return { ...user, lastReadSequence: lastSequence };
			}
			return user;
		}),
		lastSequence,
		lastModified
	};

	await chatsStore.updateChat(updatedChat);
	await messagesStore.addMessage(messageToStore);
	chatsStore.sortChats();
}

async function handleIncomingRead(payload: apiTypes.incomingReadResponse) {
	const { chatId, sequence } = payload;
	const chat = chatsStore.getLoadedChat(chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);

	const lastSequence = Math.max(getOtherUserChatMetadata(chatId).lastReadSequence, sequence);
	const updatedChat = {
		...chat,
		users: chat.users.map((user) => {
			if (user._id !== getCookie('userId')) {
				return { ...user, lastReadSequence: lastSequence };
			}
			return user;
		})
	};
	await chatsStore.updateChat(updatedChat);
}

async function handleIncomingChat(payload: apiTypes.incomingChatResponse) {
	const { createdChat } = payload;
	await chatsStore.addChat(createdChat);
	messagesStore.addEmptyChat(createdChat._id);
	chatsStore.sortChats();
	return;
}
