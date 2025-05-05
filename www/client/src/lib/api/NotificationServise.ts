import { SignalProtocolDb } from '$lib/indexedDB/SignalProtocolDb.svelte';
import { chatsStore } from '$lib/stores/ChatsStore.svelte';
import { getOtherUserChatMetadata } from '$lib/utils/chatMetadataUtils.svelte';
import * as notifTypes from '$lib/types/notificationTypes';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { messagesStore } from '$lib/stores/MessagesStore.svelte';
import { getCookie } from '$lib/utils/cookieUtils';
import type { StoredChat, StoredMessage } from '$lib/types/dataTypes';

export function handleNotification(
	api: notifTypes.NotificationApi,
	payload: notifTypes.NotificationMessagePayload
) {
	switch (api) {
		case notifTypes.NotificationApi.INCOMING_MESSAGE:
			return handleIncomingMessage(payload as notifTypes.incomingMessageResponse);
		case notifTypes.NotificationApi.INCOMING_READ:
			return handleIncomingRead(payload as notifTypes.incomingReadResponse);
		case notifTypes.NotificationApi.INCOMING_CHAT:
			return handleIncomingChat(payload as notifTypes.incomingChatResponse);
	}
}

async function handleIncomingMessage(payload: notifTypes.incomingMessageResponse) {
	const { chatId, message } = payload;

	let chat = chatsStore.getLoadedChat(chatId);
	if (!chat) {
		chat = await chatsStore.getChat(chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);
		chatsStore.sortChats();
	}

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

async function handleIncomingRead(payload: notifTypes.incomingReadResponse) {
	const { chatId, sequence } = payload;

	let chat = chatsStore.getLoadedChat(chatId);
	if (!chat) {
		chat = await chatsStore.getChat(chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);
		chatsStore.sortChats();
	}

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

async function handleIncomingChat(payload: notifTypes.incomingChatResponse) {
	const { createdChat } = payload;
	await chatsStore.addChat(createdChat);
	messagesStore.addEmptyChat(createdChat._id);
	chatsStore.sortChats();
	return;
}
