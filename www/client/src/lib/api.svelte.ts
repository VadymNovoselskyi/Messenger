import { goto } from '$app/navigation';
import * as utils from '$lib/utils.svelte';
import * as dataTypes from '$lib/types/dataTypes';
import * as apiTypes from '$lib/types/apiTypes';
import * as signalTypes from './types/signalTypes';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolStore } from './SignalProtocolStore';
import { getDbService } from './DbService.svelte';
import { chatsStore } from './ChatsStore.svelte';
import { WsService, wsService } from './WsService.svelte';
import { messagesStore } from './MessagesStore.svelte';
import { getCookie } from '$lib/utils.svelte';
import type { StoredChat } from '$lib/types/dataTypes';

export async function syncChats(chatIds: string[]): Promise<void> {
	try {
		const call = WsService.createAPICall(apiTypes.API.FETCH_CHATS_UPDATES, {
			chatIds
		});
		const response = await wsService.sendRequest(call);
		const { chats } = response as apiTypes.fetchChatsUpdatesResponse;

		const store = SignalProtocolStore.getInstance();
		for (const chat of chats) {
			const usedChat = utils.toStoredChat(chat);
			const missedMessages = chat.messages;
			const address = new libsignal.SignalProtocolAddress(utils.getOtherUsername(chat._id), 1);
			const sessionCipher = new libsignal.SessionCipher(store, address);

			for (const message of missedMessages) {
				const decryptedMessage: dataTypes.StoredMessage = message;

				const ciphertext = message.ciphertext;
				const cipherBinary = atob(ciphertext.body!);
				const plaintext = await sessionCipher.decryptWhisperMessage(cipherBinary!, 'binary');
				decryptedMessage.plaintext = new TextDecoder().decode(new Uint8Array(plaintext!));
				await messagesStore.addMessage(decryptedMessage);
			}
			await chatsStore.updateChat(chat);
		}
		chatsStore.sortChats();
	} catch (error) {
		console.error('Error in getChats:', error);
		throw error;
	}
}

export async function sendReadUpdate(chatId: string, sequence: number): Promise<void> {
	const chat = chatsStore.getChat(chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);
	await chatsStore.updateChat(chat);

	const call = WsService.createAPICall(apiTypes.API.READ_UPDATE, { chatId, sequence });
	try {
		wsService.sendRequest(call);
	} catch (error) {
		console.error('Error in sendReadUpdate:', error);
		throw error;
	}
}

export async function createChat(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	const usernameInput = (event.currentTarget as HTMLFormElement).username as HTMLInputElement;
	const username = usernameInput.value;
	if (!username) return;
	usernameInput.value = '';

	const call = WsService.createAPICall(apiTypes.API.CREATE_CHAT, { username });
	try {
		const response = await wsService.sendRequest(call);
		const { createdChat, preKeyBundle } = response as apiTypes.createChatResponse;
		if (!preKeyBundle) throw new Error(`no preKeyBundle received`);

		const createdStoredChat = utils.toStoredChat(createdChat);
		await chatsStore.addChat(createdStoredChat);
		chatsStore.sortChats();

		await handleSessionBootstrap(username, createdStoredChat, preKeyBundle);
		return;
	} catch (error) {
		console.error('Error in createChat:', error);
		throw error;
	}
}

export async function login(event: SubmitEvent): Promise<void> {
	const { usernameLogin, passwordLogin } = event.currentTarget as HTMLFormElement;
	const username = usernameLogin.value;
	const password = passwordLogin.value;
	usernameLogin.value = '';
	passwordLogin.value = '';

	const call = WsService.createAPICall(apiTypes.API.LOGIN, { username, password });
	try {
		const response = await wsService.sendRequest(call);
		const { userId, token } = response as apiTypes.loginResponse;
		utils.setCookie('userId', userId, 28);
		utils.setCookie('token', token, 28);
		goto('/');
	} catch (error) {
		console.error('Error in login:', error);
		throw error;
	}
}

export async function signup(event: SubmitEvent): Promise<void> {
	const { usernameSignup, passwordSignup } = event.currentTarget as HTMLFormElement;
	const username = usernameSignup.value;
	const password = passwordSignup.value;
	usernameSignup.value = '';
	passwordSignup.value = '';

	const call = WsService.createAPICall(apiTypes.API.SIGNUP, { username, password });
	try {
		const response = await wsService.sendRequest(call);
		const { userId, token } = response as apiTypes.signupResponse;
		utils.setCookie('userId', userId, 28);
		utils.setCookie('token', token, 28);
		goto('/');
	} catch (error) {
		console.error('Error in signup:', error);
		throw error;
	}
}

// Create a PreKey Bundle for publishing or for use by the SessionBuilder.
export async function sendPreKeys(keys: signalTypes.unorgonizedKeys): Promise<void> {
	const preKeyBundle: signalTypes.StringifiedPreKeyBundle = {
		registrationId: keys.registrationId,
		identityKey: utils.arrayBufferToBase64(keys.identityKeyPair.pubKey),
		signedPreKey: {
			keyId: keys.signedPreKey.keyId,
			publicKey: utils.arrayBufferToBase64(keys.signedPreKey.keyPair.pubKey),
			signature: utils.arrayBufferToBase64(keys.signedPreKey.signature)
		},
		preKeys: []
	};
	for (const preKey of keys.oneTimePreKeys) {
		preKeyBundle.preKeys.push({
			keyId: preKey.keyId,
			publicKey: utils.arrayBufferToBase64(preKey.keyPair.pubKey)
		});
	}

	const call = WsService.createAPICall(apiTypes.API.SEND_KEYS, { preKeyBundle });
	try {
		await wsService.sendRequest(call);
	} catch (error) {
		console.error('Error in signup:', error);
		throw error;
	}
}

export async function sendMessage(chatId: string, text: string) {
	try {
		const chat = chatsStore.getChat(chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		const address = new libsignal.SignalProtocolAddress(utils.getOtherUsername(chatId), 1);
		const store = SignalProtocolStore.getInstance();
		const sessionCipher = new libsignal.SessionCipher(store, address);

		const ciphertext = await sessionCipher.encrypt(utils.textToArrayBuffer(text));
		const base64Body = btoa(ciphertext.body!);
		ciphertext.body = base64Body;

		const tempId = utils.generateId();
		const pendingMessage: dataTypes.PendingMessage = {
			_id: tempId,
			sequence: -1,
			tempId: tempId,
			chatId,
			from: utils.getCookie('userId') ?? '',
			ciphertext,
			plaintext: text,
			sendTime: new Date().toISOString(),
			isPending: true
		};
		await messagesStore.addPendingMessage(pendingMessage);
		chatsStore.sortChats();

		const call = WsService.createAPICall(apiTypes.API.SEND_MESSAGE, { chatId, ciphertext });
		const { sentMessage } = (await wsService.sendRequest(call)) as apiTypes.sendMessageResponse;
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

export async function sendPreKeyMessage(chatId: string, text: string = 'ESTABLISH_SESSION_SENDER') {
	const chat = chatsStore.getChat(chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);

	const address = new libsignal.SignalProtocolAddress(utils.getOtherUsername(chatId), 1);
	const store = SignalProtocolStore.getInstance();
	const sessionCipher = new libsignal.SessionCipher(store, address);

	const ciphertext = await sessionCipher.encrypt(utils.textToArrayBuffer(text));
	const base64Body = btoa(ciphertext.body!);
	ciphertext.body = base64Body;
	const call = WsService.createAPICall(apiTypes.API.SEND_PRE_KEY_MESSAGE, { chatId, ciphertext });
	await wsService.sendRequest(call);
}

async function handleSessionBootstrap(
	username: string,
	createdChat: dataTypes.StoredChat,
	preKeyBundle: signalTypes.StringifiedPreKeyBundle
) {
	const { _id } = createdChat;
	const { registrationId, identityKey, signedPreKey, preKeys } = preKeyBundle;
	const serializedPreKey: libsignal.DeviceType = {
		registrationId,
		identityKey: utils.base64ToArrayBuffer(identityKey),
		signedPreKey: {
			keyId: signedPreKey.keyId,
			publicKey: utils.base64ToArrayBuffer(signedPreKey.publicKey),
			signature: utils.base64ToArrayBuffer(signedPreKey.signature)
		},
		preKey:
			preKeys && preKeys.length
				? { keyId: preKeys[0].keyId, publicKey: utils.base64ToArrayBuffer(preKeys[0].publicKey) }
				: undefined
	};

	const receiverAddress: libsignal.SignalProtocolAddress = new libsignal.SignalProtocolAddress(
		username,
		1
	);
	const receiverDevice: libsignal.DeviceType = {
		identityKey: serializedPreKey.identityKey,
		signedPreKey: serializedPreKey.signedPreKey,
		preKey: serializedPreKey.preKey,
		registrationId: serializedPreKey.registrationId
	};

	const store = SignalProtocolStore.getInstance();
	const sessionBuilder = new libsignal.SessionBuilder(store, receiverAddress);
	await sessionBuilder.processPreKey(receiverDevice);

	sendPreKeyMessage(_id);
}
