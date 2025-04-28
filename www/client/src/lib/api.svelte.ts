import { page } from '$app/state';
import { goto } from '$app/navigation';
import { memory } from '$lib/stores/memory.svelte';
import * as utils from '$lib/utils.svelte';
import * as dataTypes from '$lib/types/dataTypes';
import * as apiTypes from '$lib/types/apiTypes';
import * as signalTypes from './types/signalTypes';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolStore } from './stores/SignalProtocolStore';
import { getDbService } from './stores/DbService.svelte';
import { chatsStore } from './stores/ChatsStore.svelte';

const pendingRequests = new Map<
	string,
	{ resolve: (value: apiTypes.responsePayload) => void; reject: (reason: any) => void }
>();

// Helper: constructs an API message
function createAPICall(api: apiTypes.API, payload: apiTypes.messagePayload): apiTypes.APIMessage {
	return {
		api,
		id: utils.generateId(),
		token: utils.getCookie('token'),
		payload
	};
}

export async function getWS(): Promise<WebSocket> {
	if (
		!memory.ws ||
		memory.ws.readyState === WebSocket.CLOSING ||
		memory.ws.readyState === WebSocket.CLOSED
	) {
		memory.ws = new WebSocket(`${page.url.origin}/api/`);
		memory.ws.addEventListener('message', handleServerMessage);
	}

	return new Promise((resolve, reject) => {
		if (memory.ws!.readyState === WebSocket.OPEN) {
			resolve(memory.ws!);
		} else {
			memory.ws!.addEventListener('open', () => resolve(memory.ws!), { once: true });
			memory.ws!.addEventListener(
				'error',
				(event) => {
					console.error('WebSocket connection error:', event);
					reject(new Error('Failed to connect to WebSocket'));
				},
				{ once: true }
			);
		}
	});
}

export async function loadAndSyncChats(): Promise<void> {
	const latestChats = await (await getDbService()).getLatestChats();
	const convertedChats = await Promise.all(
		latestChats.map(async (chat) => {
			const messages = await (await getDbService()).getLatestMessages(chat._id);
			return utils.storedToUsedChat(chat, messages);
		})
	);
	chatsStore.addChats(convertedChats);
	chatsStore.sortChats();

	const call = createAPICall(apiTypes.API.GET_CHATS, {});
	try {
		const response = await sendRequest(call);
		// const { chats } = response as apiTypes.getChatsResponse;
		// memory.chats = chats.map((chat) => utils.apiToUsedChat(chat));
		// chatsStore.sortChats();
	} catch (error) {
		console.error('Error in getChats:', error);
		throw error;
	}
}

export async function sendReadUpdate(chatId: string, sequence: number): Promise<void> {
	const chat = chatsStore.getChat(chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);
	await chatsStore.updateChat(chat);

	const call = createAPICall(apiTypes.API.READ_UPDATE, { chatId, sequence });
	try {
		sendRequest(call);
	} catch (error) {
		console.error('Error in sendReadUpdate:', error);
		throw error;
	}
}

export async function getExtraMessages(chatId: string, currentIndex: number): Promise<void> {
	const call = createAPICall(apiTypes.API.EXTRA_MESSAGES, { chatId, currentIndex });
	try {
		const response = await sendRequest(call);
		const { extraMessages } = response as apiTypes.getExtraMessagesResponse;

		const chat = chatsStore.getChat(chatId);
		if (!chat) {
			alert(`No chat to add extra messages ${chatId}`);
			return;
		}
		chat.messages = [
			...extraMessages.map((message) => utils.toStoredMessage(message)),
			...chat.messages
		];
	} catch (error) {
		console.error('Error in getExtraMessages:', error);
		throw error;
	}
}

export async function getExtraNewMessages(chatId: string, unreadCount: number): Promise<void> {
	const call = createAPICall(apiTypes.API.EXTRA_NEW_MESSAGES, { chatId, unreadCount });
	try {
		const response = await sendRequest(call);
		const { extraNewMessages } = response as apiTypes.getExtraNewMessagesResponse;

		const chat = chatsStore.getChat(chatId);
		if (!chat) {
			alert(`No chat to add extra messages ${chatId}`);
			return;
		}
		chat.messages = [
			...chat.messages,
			...extraNewMessages.map((message) => utils.toStoredMessage(message))
		];
	} catch (error) {
		console.error('Error in getExtraNewMessages:', error);
		throw error;
	}
}

export async function readAllUpdate(chatId: string): Promise<void> {
	const call = createAPICall(apiTypes.API.READ_ALL, { chatId });
	try {
		await sendRequest(call);

		const chat = chatsStore.getChat(chatId);
		if (!chat) {
			alert(`No chat to read all ${chatId}`);
			return;
		}
		// Reset messages and unread counts in UI
		chat.messages = [];
		chat.lastSequence = 0;
	} catch (error) {
		console.error('Error in readAllUpdate:', error);
		throw error;
	}
}

export async function createChat(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	const usernameInput = (event.currentTarget as HTMLFormElement).username as HTMLInputElement;
	const username = usernameInput.value;
	if (!username) return;
	usernameInput.value = '';

	const call = createAPICall(apiTypes.API.CREATE_CHAT, { username });
	try {
		const response = await sendRequest(call);
		const { createdChat, preKeyBundle } = response as apiTypes.createChatResponse;
		if (!preKeyBundle) throw new Error(`no preKeyBundle received`);

		const createdUsedChat = utils.apiToUsedChat(createdChat);
		await chatsStore.addChat(createdUsedChat);
		chatsStore.sortChats();

		await handleSessionBootstrap(username, createdUsedChat, preKeyBundle);
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

	const call = createAPICall(apiTypes.API.LOGIN, { username, password });
	try {
		const response = await sendRequest(call);
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

	const call = createAPICall(apiTypes.API.SIGNUP, { username, password });
	try {
		const response = await sendRequest(call);
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

	const call = createAPICall(apiTypes.API.SEND_KEYS, { preKeyBundle });
	try {
		await sendRequest(call);
	} catch (error) {
		console.error('Error in signup:', error);
		throw error;
	}
}

export async function sendEncMessage(chatId: string, text: string) {
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
		await chatsStore.addPendingMessage(pendingMessage);
		chatsStore.sortChats();

		const call = createAPICall(apiTypes.API.SEND_ENC_MESSAGE, { chatId, ciphertext });
		const { sentMessage } = (await sendRequest(call)) as apiTypes.sendEncMessageResponse;
		const messageToStore: dataTypes.StoredMessage = {
			...sentMessage,
			plaintext: text
		};
		await chatsStore.handlePendingMessagePromotion(tempId, messageToStore);
		return;
	} catch (error) {
		console.error('Error in sendEncMessage:', error);
		throw error;
	}
}

async function sendPreKeyMessage(chatId: string, text: string = 'ESTABLISH_SESSION_SENDER') {
	const chat = chatsStore.getChat(chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);

	const address = new libsignal.SignalProtocolAddress(utils.getOtherUsername(chatId), 1);
	const store = SignalProtocolStore.getInstance();
	const sessionCipher = new libsignal.SessionCipher(store, address);

	const ciphertext = await sessionCipher.encrypt(utils.textToArrayBuffer(text));
	const base64Body = btoa(ciphertext.body!);
	ciphertext.body = base64Body;
	const call = createAPICall(apiTypes.API.SEND_PRE_KEY_MESSAGE, { chatId, ciphertext });
	await sendRequest(call);
}

async function handleSessionBootstrap(
	username: string,
	createdChat: dataTypes.UsedChat,
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

async function sendRequest(
	message: apiTypes.APIMessage,
	timeout?: number
): Promise<apiTypes.responsePayload> {
	const ws = await getWS();
	return new Promise((resolve, reject) => {
		pendingRequests.set(message.id, { resolve, reject });
		ws.send(JSON.stringify(message));

		if (timeout) {
			setTimeout(() => {
				if (pendingRequests.has(message.id)) {
					pendingRequests.delete(message.id);
					reject(new Error('Request timed out'));
				}
			}, timeout);
		}
	});
}

async function handleServerMessage(event: MessageEvent): Promise<void> {
	const data: apiTypes.APIResponse = JSON.parse(event.data);
	console.log(data);
	const { api, id, status, payload } = data;
	if (pendingRequests.has(id)) {
		const { resolve, reject } = pendingRequests.get(id)!;
		if (status === 'ERROR') {
			const { message } = payload as apiTypes.errorResponse;
			if (message === 'Invalid Token. Login again' || message === 'invalid signature') {
				goto('/login');
			} else {
				alert(message);
			}
			reject(`Error from server: ${message}`);
		} else {
			resolve(payload);
		}
		pendingRequests.delete(id);
	} else if (api === apiTypes.API.RECEIVE_MESSAGE) {
		const { chatId, message } = payload as apiTypes.receiveMessageResponse;

		const chat = chatsStore.getChat(chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		const senderAddress: libsignal.SignalProtocolAddress = new libsignal.SignalProtocolAddress(
			utils.getOtherUsername(chatId),
			1
		);

		const store = SignalProtocolStore.getInstance();
		const sessionCipher = new libsignal.SessionCipher(store, senderAddress);
		const cipherMessage = message.ciphertext;
		const cipherBinary = atob(cipherMessage.body!);

		if (cipherMessage.type === 3) {
			try {
				console.log('decryptPreKeyWhisperMessage');
				await sessionCipher.decryptPreKeyWhisperMessage(cipherBinary!, 'binary');
				sendPreKeyMessage(chatId, '');
				return;
			} catch (e) {
				console.error(e);
			}
		}
		if (cipherMessage.type !== 1) throw new Error(`Unknown message type: ${cipherMessage.type}`);

		const bufferText = await sessionCipher.decryptWhisperMessage(cipherBinary!, 'binary');

		const plaintext = new TextDecoder().decode(new Uint8Array(bufferText!));
		if (!plaintext) return;

		const messageToStore: dataTypes.StoredMessage = {
			...message,
			plaintext
		};

		await chatsStore.handleIncomingMessage(messageToStore);
		chatsStore.sortChats();
	} else if (api === apiTypes.API.RECEIVE_PRE_KEY_MESSAGE) {
		const { chatId, ciphertext } = payload as apiTypes.receivePreKeyMessageResponse;

		const chat = chatsStore.getChat(chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		const senderAddress: libsignal.SignalProtocolAddress = new libsignal.SignalProtocolAddress(
			utils.getOtherUsername(chatId),
			1
		);

		const store = SignalProtocolStore.getInstance();
		const sessionCipher = new libsignal.SessionCipher(store, senderAddress);
		const cipherBinary = atob(ciphertext.body!);

		if (ciphertext.type === 3) {
			try {
				console.log('decryptPreKeyWhisperMessage');
				await sessionCipher.decryptPreKeyWhisperMessage(cipherBinary!, 'binary');
				sendPreKeyMessage(chatId, '');
				return;
			} catch (e) {
				console.error(e);
			}
		}
		if (ciphertext.type !== 1) throw new Error(`Unknown message type: ${ciphertext.type}`);

		await sessionCipher.decryptWhisperMessage(cipherBinary!, 'binary');
	} else if (api === apiTypes.API.READ_UPDATE) {
		const { chatId, sequence } = payload as apiTypes.readUpdateResponse;
		const chat = chatsStore.getChat(chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		await chatsStore.handleIncomingReadUpdate(chatId, sequence);
	} else if (api === apiTypes.API.CREATE_CHAT) {
		const { createdChat } = payload as apiTypes.createChatResponse;
		const createdUsedChat = utils.apiToUsedChat(createdChat);
		await chatsStore.addChat(createdUsedChat);
		chatsStore.sortChats();
		return;
	} else {
		console.warn('Received response for unknown request ID:', id);
	}
}
