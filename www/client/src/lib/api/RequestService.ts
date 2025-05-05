import { goto } from '$app/navigation';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import * as utils from '$lib/utils/utils.svelte';
import { getCookie, setCookie } from '$lib/utils/cookieUtils';
import { getOtherUserChatMetadata } from '$lib/utils/chatMetadataUtils.svelte';
import * as signalUtils from '$lib/utils/signalUtils';
import * as parserUtils from '$lib/utils/parserUtils';

import * as dataTypes from '$lib/types/dataTypes';
import * as requestTypes from '$lib/types/requestTypes';
import * as signalTypes from '../types/signalTypes';
import { SignalProtocolDb } from '../indexedDB/SignalProtocolDb.svelte';
import { chatsStore } from '../stores/ChatsStore.svelte';
import { wsService } from '../services/WsService.svelte';
import { messagesStore } from '../stores/MessagesStore.svelte';
import type { StoredChat } from '$lib/types/dataTypes';
import { SessionRecord } from '@privacyresearch/libsignal-protocol-typescript/lib/session-record';
import { createApiRequestMessage } from '$lib/utils/apiUtils';

export async function sendAuth() {
	const call = createApiRequestMessage(requestTypes.RequestApi.SEND_AUTH, {});
	await wsService.sendRequest(call);
}

/**
 * Sends a message to a chat.
 * @param chatId The _id of the chat to send the message to.
 * @param text The text of the message to send.
 */
export async function sendMessage(chatId: string, text: string) {
	try {
		const chat = chatsStore.getLoadedChat(chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		const address = new libsignal.SignalProtocolAddress(getOtherUserChatMetadata(chatId)._id, 1);
		const store = SignalProtocolDb.getInstance();
		const sessionCipher = new libsignal.SessionCipher(store, address);

		const ciphertext = await sessionCipher.encrypt(parserUtils.textToArrayBuffer(text));
		const base64Body = btoa(ciphertext.body!);
		ciphertext.body = base64Body;

		const tempId = utils.generateRequestId();
		const pendingMessage: dataTypes.PendingMessage = {
			_id: tempId,
			sequence: chat.lastSequence + 1,
			tempId: tempId,
			chatId,
			from: getCookie('userId') ?? '',
			ciphertext,
			plaintext: text,
			sendTime: new Date().toISOString(),
			isPending: true
		};
		await messagesStore.addPendingMessage(pendingMessage);
		chatsStore.sortChats();

		const call = createApiRequestMessage(requestTypes.RequestApi.SEND_MESSAGE, { chatId, ciphertext });
		const { sentMessage } = (await wsService.sendRequest(call)) as requestTypes.sendMessageResponse;
		const lastModified =
			chat.lastModified.localeCompare(sentMessage.sendTime) > 0
				? chat.lastModified
				: sentMessage.sendTime;
		const lastSequence = Math.max(chat.lastSequence, sentMessage.sequence);

		const messageToStore: dataTypes.StoredMessage = {
			...sentMessage,
			plaintext: text
		};
		const updatedChat: StoredChat = {
			_id: chat._id,
			users: chat.users.map((user) => {
				if (user._id === getCookie('userId')) {
					return { ...user, lastReadSequence: lastSequence };
				}
				return user;
			}),
			lastSequence,
			lastModified
		};

		await messagesStore.handlePendingMessagePromotion(tempId, messageToStore);
		await chatsStore.updateChat(updatedChat);
		chatsStore.sortChats();
		return;
	} catch (error) {
		console.error('Error in sendEncMessage:', error);
		throw error;
	}
}

/**
 * Sends a read update to the server.
 * @param chatId The _id of the chat to send the read update to.
 * @param sequence The sequence number of the message to send the read update to.
 */
export async function sendReadUpdate(chatId: string, sequence: number): Promise<void> {
	const chat = chatsStore.getLoadedChat(chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);
	await chatsStore.updateChat(chat);

	const call = createApiRequestMessage(requestTypes.RequestApi.SEND_READ_UPDATE, { chatId, sequence });
	try {
		wsService.sendRequest(call);
	} catch (error) {
		console.error('Error in sendReadUpdate:', error);
		throw error;
	}
}

/**
 * Syncs the active chats with the server.
 * @param chatIds The _ids of the chats to sync.
 * @returns The _ids of the chats that are incomplete.
 */
export async function syncActiveChats(chatIds: string[]): Promise<string[]> {
	try {
		const call = createApiRequestMessage(requestTypes.RequestApi.SYNC_ACTIVE_CHATS, {
			chatIds
		});
		const response = await wsService.sendRequest(call);
		const { chats } = response as requestTypes.syncActiveChatsResponse;

		const store = SignalProtocolDb.getInstance();

		const incompleteChatIds: string[] = [];
		for (const chat of chats) {
			const missedMessages = chat.messages;
			await chatsStore.updateChat(chat);
			const address = new libsignal.SignalProtocolAddress(
				getOtherUserChatMetadata(chat._id)._id,
				1
			);
			const sessionCipher = new libsignal.SessionCipher(store, address);

			for (const [index, message] of missedMessages.entries()) {
				const decryptedMessage: dataTypes.StoredMessage = message;

				const ciphertext = message.ciphertext;
				const cipherBinary = atob(ciphertext.body!);
				if (ciphertext.type === 3) {
					await sessionCipher.decryptPreKeyWhisperMessage(cipherBinary!, 'binary');
					continue;
				}
				const plaintext = await sessionCipher.decryptWhisperMessage(cipherBinary!, 'binary');
				decryptedMessage.plaintext = new TextDecoder().decode(new Uint8Array(plaintext!));
				await messagesStore.addMessage(decryptedMessage, index < 20 ? true : false);
			}
			if (missedMessages.length && chat.lastSequence > missedMessages.at(-1)!.sequence) {
				incompleteChatIds.push(chat._id);
			}
		}
		chatsStore.sortChats();
		return incompleteChatIds;
	} catch (error) {
		console.error('Error in getChats:', error);
		throw error;
	}
}

/**
 * Syncs all the chats metadata with the server.
 * @returns Whether the sync is complete.
 */
export async function syncAllChatsMetadata(): Promise<boolean> {
	try {
		const call = createApiRequestMessage(requestTypes.RequestApi.SYNC_ALL_CHATS_METADATA, {});
		const response = await wsService.sendRequest(call);
		const { chats, newChats, isComplete } = response as requestTypes.syncAllChatsMetadataResponse;

		for (const chat of chats) await chatsStore.updateChat(chat);
		for (const chat of newChats) await chatsStore.addChat(chat);
		if (newChats.length) await syncActiveChats(newChats.map((chat) => chat._id));
		chatsStore.sortChats();
		return isComplete;
	} catch (error) {
		console.error('Error in getChats:', error);
		throw error;
	}
}

/**
 * Creates a new chat with the server.
 * @param event The submit event of the form.
 */
export async function createChat(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	const usernameInput = (event.currentTarget as HTMLFormElement).username as HTMLInputElement;
	const username = usernameInput.value;
	if (!username) return;
	usernameInput.value = '';

	const call = createApiRequestMessage(requestTypes.RequestApi.CREATE_CHAT, { username });
	try {
		const response = await wsService.sendRequest(call);
		const { createdChat, preKeyBundle } = response as requestTypes.createChatResponse;
		if (!preKeyBundle) throw new Error(`no preKeyBundle received`);

		await chatsStore.addChat(createdChat);
		messagesStore.addEmptyChat(createdChat._id);
		chatsStore.sortChats();

		await signalUtils.handleSessionBootstrap(createdChat, preKeyBundle);
		await sendPreKeyWhisperMessage(createdChat._id);

		// Remove the pending pre-key from the session, to send type 1 messages
		const store = SignalProtocolDb.getInstance();
		const receiverAddress = new libsignal.SignalProtocolAddress(
			getOtherUserChatMetadata(createdChat._id)._id,
			1
		);
		const addressStr = receiverAddress.toString();
		const serialized = await store.loadSession(addressStr);
		const record = SessionRecord.deserialize(serialized);
		record!.getOpenSession()!.pendingPreKey = undefined;
		await store.storeSession(addressStr, record.serialize());
		return;
	} catch (error) {
		console.error('Error in createChat:', error);
		throw error;
	}
}

/**
 * Logs in a user with the server.
 * @param event The submit event of the form.
 */
export async function login(event: SubmitEvent): Promise<void> {
	const { usernameLogin, passwordLogin } = event.currentTarget as HTMLFormElement;
	const username = usernameLogin.value;
	const password = passwordLogin.value;
	usernameLogin.value = '';
	passwordLogin.value = '';

	const call = createApiRequestMessage(requestTypes.RequestApi.LOGIN, { username, password });
	try {
		const response = await wsService.sendRequest(call);
		const { userId, token } = response as requestTypes.loginResponse;
		setCookie('userId', userId, 28);
		setCookie('token', token, 28);
		goto('/');
	} catch (error) {
		console.error('Error in login:', error);
		throw error;
	}
}

/**
 * Signs up a user with the server.
 * @param event The submit event of the form.
 */
export async function signup(event: SubmitEvent): Promise<void> {
	const { usernameSignup, passwordSignup } = event.currentTarget as HTMLFormElement;
	const username = usernameSignup.value;
	const password = passwordSignup.value;
	usernameSignup.value = '';
	passwordSignup.value = '';

	const call = createApiRequestMessage(requestTypes.RequestApi.SIGNUP, { username, password });
	try {
		const response = await wsService.sendRequest(call);
		const { userId, token } = response as requestTypes.signupResponse;
		setCookie('userId', userId, 28);
		setCookie('token', token, 28);
		goto('/');
	} catch (error) {
		console.error('Error in signup:', error);
		throw error;
	}
}

/**
 * Sends a pre-key bundle to the server.
 * @param keys The unorgonized keys to send.
 */
export async function sendPreKeyBundle(keys: signalTypes.unorgonizedKeys): Promise<void> {
	const preKeyBundle: signalTypes.StringifiedPreKeyBundle = {
		registrationId: keys.registrationId,
		identityKey: parserUtils.arrayBufferToBase64(keys.identityKeyPair.pubKey),
		signedPreKey: {
			keyId: keys.signedPreKey.keyId,
			publicKey: parserUtils.arrayBufferToBase64(keys.signedPreKey.keyPair.pubKey),
			signature: parserUtils.arrayBufferToBase64(keys.signedPreKey.signature)
		},
		preKeys: []
	};
	for (const preKey of keys.oneTimePreKeys) {
		preKeyBundle.preKeys.push({
			keyId: preKey.keyId,
			publicKey: parserUtils.arrayBufferToBase64(preKey.keyPair.pubKey)
		});
	}

	const call = createApiRequestMessage(requestTypes.RequestApi.SEND_PRE_KEY_BUNDLE, { preKeyBundle });
	try {
		await wsService.sendRequest(call);
	} catch (error) {
		console.error('Error in sendPreKeys:', error);
		throw error;
	}
}

/**
 * Adds more pre-keys to the server.
 * @param preKeys The pre-keys to add.
 */
export async function addPreKeys(preKeys: libsignal.PreKeyPairType<ArrayBuffer>[]): Promise<void> {
	const stringifiedPreKeys: signalTypes.StringifiedPreKey[] = [];
	for (const preKey of preKeys) {
		stringifiedPreKeys.push({
			keyId: preKey.keyId,
			publicKey: parserUtils.arrayBufferToBase64(preKey.keyPair.pubKey)
		});
	}

	const call = createApiRequestMessage(requestTypes.RequestApi.ADD_PRE_KEYS, {
		preKeys: stringifiedPreKeys
	});
	try {
		await wsService.sendRequest(call);
	} catch (error) {
		console.error('Error in sendPreKeys:', error);
		throw error;
	}
}

/**
 * Sends a pre-key whisper message to the server.
 * @param chatId The _id of the chat to send the pre-key whisper message to.
 * @param text The text of the pre-key whisper message to send.
 */
export async function sendPreKeyWhisperMessage(
	chatId: string,
	text: string = 'ESTABLISH_SESSION_SENDER'
) {
	const chat = chatsStore.getLoadedChat(chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);

	const address = new libsignal.SignalProtocolAddress(getOtherUserChatMetadata(chatId)._id, 1);
	const store = SignalProtocolDb.getInstance();
	const sessionCipher = new libsignal.SessionCipher(store, address);

	const ciphertext = await sessionCipher.encrypt(parserUtils.textToArrayBuffer(text));
	const base64Body = btoa(ciphertext.body!);
	ciphertext.body = base64Body;

	const call = createApiRequestMessage(requestTypes.RequestApi.SEND_PRE_KEY_WHISPER_MESSAGE, {
		chatId,
		ciphertext
	});
	await wsService.sendRequest(call);
}
