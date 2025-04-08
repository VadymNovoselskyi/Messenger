import { page } from '$app/state';
import { goto } from '$app/navigation';
import { memory } from '$lib/stores/memory.svelte';
import * as utils from '$lib/utils';
import * as types from '$lib/types';
import * as signalTypes from './signalTypes';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { SignalProtocolStore } from './stores/SignalProtocolStore';

const pendingRequests = new Map<
	string,
	{ resolve: (value: types.responsePayload) => void; reject: (reason: any) => void }
>();

// Helper: constructs an API message
function createAPICall(api: types.API, payload: types.messagePayload): types.APIMessage {
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

export async function getChats(): Promise<void> {
	const call = createAPICall(types.API.GET_CHATS, {});
	try {
		const response = await sendRequest(call);
		const { chats } = response as types.getChatsResponse;
		memory.chats = chats;
		utils.sortChats();
	} catch (error) {
		console.error('Error in getChats:', error);
		throw error;
	}
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
	const chat = memory.chats.find((chat) => chat._id === chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);

	const tempMID = utils.generateId();
	const currentTime = new Date().toISOString();
	chat.messages.push({
		_id: tempMID,
		from: utils.getCookie('userId') ?? '',
		text,
		sendTime: currentTime,
		sending: true
	});
	chat.lastModified = currentTime;
	utils.sortChats();

	// Create and send API call for sending a message
	const call = createAPICall(types.API.SEND_MESSAGE, {
		chatId,
		text,
		tempMessageId: tempMID
	});
	try {
		const response = await sendRequest(call);
		const { chatId, message, tempMessageId } = response as types.sendMessageResponse;
		const chat = memory.chats.find((chat) => chat._id === chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		const index = chat.messages.findIndex((msg) => msg._id === tempMessageId);
		if (index === -1) {
			alert(`Couldn't find message with tempMessageId: ${tempMessageId}`);
			return;
		}
		chat.messages[index] = message;
		chat.lastModified = message.sendTime;
		utils.sortChats();
	} catch (error) {
		console.error('Error in sendMessage:', error);
		throw error;
	}
}

export async function sendReadUpdate(chatId: string, messageId: string): Promise<void> {
	const call = createAPICall(types.API.READ_UPDATE, { chatId, messageId });
	try {
		sendRequest(call);
	} catch (error) {
		console.error('Error in sendReadUpdate:', error);
		throw error;
	}
}

export async function getExtraMessages(chatId: string, currentIndex: number): Promise<void> {
	const call = createAPICall(types.API.EXTRA_MESSAGES, { chatId, currentIndex });
	try {
		const response = await sendRequest(call);
		const { extraMessages } = response as types.getExtraMessagesResponse;
		const chat = memory.chats.find((chat) => chat._id === chatId);
		if (!chat) {
			alert(`No chat to add extra messages ${chatId}`);
			return;
		}
		chat.messages = [...extraMessages, ...chat.messages];
	} catch (error) {
		console.error('Error in getExtraMessages:', error);
		throw error;
	}
}

export async function getExtraNewMessages(chatId: string, unreadCount: number): Promise<void> {
	const call = createAPICall(types.API.EXTRA_NEW_MESSAGES, { chatId, unreadCount });
	try {
		const response = await sendRequest(call);
		const { extraNewMessages } = response as types.getExtraNewMessagesResponse;
		const chat = memory.chats.find((chat) => chat._id === chatId);
		if (!chat) {
			alert(`No chat to add extra messages ${chatId}`);
			return;
		}
		chat.messages = [...chat.messages, ...extraNewMessages];
		chat.receivedUnreadCount += extraNewMessages.length;
	} catch (error) {
		console.error('Error in getExtraNewMessages:', error);
		throw error;
	}
}

export async function readAllUpdate(chatId: string): Promise<void> {
	const call = createAPICall(types.API.READ_ALL, { chatId });
	try {
		await sendRequest(call);
		const chat = memory.chats.find((chat) => chat._id === chatId);
		if (!chat) {
			alert(`No chat to read all ${chatId}`);
			return;
		}
		// Reset messages and unread counts in UI
		chat.messages = [];
		chat.latestMessages = [];
		chat.unreadCount = 0;
		chat.receivedUnreadCount = 0;
		chat.receivedNewCount = 0;
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

	const call = createAPICall(types.API.CREATE_CHAT, { username });
	try {
		const response = await sendRequest(call);
		const { createdChat, preKeyBundle } = response as types.createChatResponse;
		if (!preKeyBundle) throw new Error(`no preKeyBundle received`);
		handleSessionBootstrap(username, createdChat, preKeyBundle);

		memory.chats = [createdChat, ...memory.chats];
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

	const call = createAPICall(types.API.LOGIN, { username, password });
	try {
		const response = await sendRequest(call);
		const { userId, token } = response as types.loginResponse;
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

	const call = createAPICall(types.API.SIGNUP, { username, password });
	try {
		const response = await sendRequest(call);
		const { userId, token } = response as types.signupResponse;
		utils.setCookie('userId', userId, 28);
		utils.setCookie('token', token, 28);
		goto('/');
	} catch (error) {
		console.error('Error in signup:', error);
		throw error;
	}
}

export async function sendKeys(keys: signalTypes.unorgonizedKeys): Promise<void> {
	// Create a PreKey Bundle for publishing or for use by the SessionBuilder.
	// You might choose one of your one-time pre-keys (say, the first one) to include in the bundle.
	const preKeyBundle: signalTypes.StringifiedPreKeyBundle = {
		registrationId: keys.registrationId,
		identityKey: utils.arrayBufferToBase64(keys.identityKeyPair.pubKey), // Public part of the identity key
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

	const call = createAPICall(types.API.SEND_KEYS, { preKeyBundle });
	try {
		await sendRequest(call);
	} catch (error) {
		console.error('Error in signup:', error);
		throw error;
	}
}

export async function sendEncMessage(chatId: string, ciphertext: libsignal.MessageType) {
	const chat = memory.chats.find((chat) => chat._id === chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);

	// Create and send API call for sending a message
	const call = createAPICall(types.API.SEND_ENC_MESSAGE, {
		chatId,
		ciphertext
	});
	try {
		const response = await sendRequest(call);
		// const { chatId, message } = response as types.sendEncMessageResponse;
		// const chat = memory.chats.find((chat) => chat._id === chatId);
		// if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		// const index = chat.messages.findIndex((msg) => msg._id === tempMessageId);
		// if (index === -1) {
		// 	alert(`Couldn't find message with tempMessageId: ${tempMessageId}`);
		// 	return;
		// }
		// chat.messages[index] = message;
		// chat.lastModified = message.sendTime;
		// utils.sortChats();
	} catch (error) {
		console.error('Error in sendMessage:', error);
		throw error;
	}
}

async function handleSessionBootstrap(
	username: string,
	createdChat: types.Chat,
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
			preKeys && preKeys.length > 0
				? { keyId: preKeys[0].keyId, publicKey: utils.base64ToArrayBuffer(preKeys[0].publicKey) }
				: undefined
	};
	const receiverAddressType: libsignal.SignalProtocolAddressType = {
		name: username,
		deviceId: 1,
		equals: (other: libsignal.SignalProtocolAddressType) => true
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

	const store = new SignalProtocolStore();
	const sessionBuilder = new libsignal.SessionBuilder(store, receiverAddressType);

	// Start session as initiator
	const session = await sessionBuilder.processPreKey(receiverDevice);
	console.log(session);
	store.storeSession(`${username}.1`, session);

	const senderSessionCipher = new libsignal.SessionCipher(store, receiverAddress);
	const ciphertext = await senderSessionCipher.encrypt(utils.base64ToArrayBuffer('V2F6enVw'));
	console.log(ciphertext);
	sendEncMessage(_id, ciphertext);
}

async function sendRequest(
	message: types.APIMessage,
	timeout?: number
): Promise<types.responsePayload> {
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

export function handleServerMessage(event: MessageEvent): void {
	const data: types.APIResponse = JSON.parse(event.data);
	console.log(data);
	const { api, id, status, payload } = data;
	if (pendingRequests.has(id)) {
		const { resolve, reject } = pendingRequests.get(id)!;
		if (status === 'ERROR') {
			const { message } = payload as types.errorResponse;
			if (message === 'Invalid Token. Login again' || message === 'invalid signature') {
				goto('/login');
			} else {
				alert(message);
			}
			reject(message);
		} else {
			resolve(payload);
		}
		pendingRequests.delete(id);
	} else if (api === types.API.RECEIVE_MESSAGE) {
		const { chatId, message } = payload as types.receiveMessageResponse;
		const chat = memory.chats.find((chat) => chat._id === chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);
		chat.latestMessages = [...chat.latestMessages, message];
		chat.unreadCount++;
		chat.receivedUnreadCount++;
		chat.receivedNewCount++;
		chat.lastModified = message.sendTime;
		utils.sortChats();
	} else if (api === types.API.READ_UPDATE) {
		const { chatId, lastSeen } = payload as types.readUpdateResponse;
		console.log(chatId, lastSeen);
	} else {
		console.warn('Received response for unknown request ID:', id);
	}
}
