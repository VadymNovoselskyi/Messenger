import { page } from '$app/state';
import { goto } from '$app/navigation';
import { memory } from '$lib/stores/memory.svelte';
import { generateId, setCookie, getCookie, sortChats } from '$lib/utils';
import type {
	APIMessage,
	APIResponse,
	createChatResponse,
	errorResponse,
	getChatsResponse,
	getExtraMessagesResponse,
	getExtraNewMessagesResponse,
	loginResponse,
	Message,
	messagePayload,
	readUpdateResponse,
	receiveMessageResponse,
	responsePayload,
	sendMessagePayload,
	sendMessageResponse,
	signupPayload,
	signupResponse
} from '$lib/types';
import { API } from '$lib/types';

const pendingRequests = new Map<
	string,
	{ resolve: (value: responsePayload) => void; reject: (reason: any) => void }
>();

// Helper: constructs an API message
function createAPICall(api: API, payload: messagePayload): APIMessage {
	return {
		api,
		id: generateId(),
		token: getCookie('token'),
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
	const call = createAPICall(API.GET_CHATS, {});
	try {
		const response = await sendRequest(call);
		const { chats } = response as getChatsResponse;
		memory.chats = chats;
		sortChats();
	} catch (error) {
		console.error('Error in getChats:', error);
		throw error;
	}
}

export async function sendMessage(event: Event): Promise<void> {
	event.preventDefault();
	const messageInput = (event.currentTarget as HTMLFormElement).message as HTMLInputElement;
	const input = messageInput.value;
	if (!input) return;
	messageInput.value = '';

	const chatId = page.params.chatId;
	const chat = memory.chats.find((chat) => chat._id === chatId);
	if (!chat) throw new Error(`Chat with id ${chatId} not found`);

	// Update UI immediately and reset unread if needed
	if (chat.unreadCount) {
		await readAllUpdate(chatId);
		await getExtraMessages(chatId, 0);
		memory.chats = [...memory.chats];
	}

	const tempMID = generateId();
	const currentTime = new Date().toISOString();
	chat.messages.push({
		_id: tempMID,
		from: getCookie('userId') ?? '',
		text: input,
		sendTime: currentTime,
		sending: true
	});
	chat.lastModified = currentTime;
	sortChats();

	// Create and send API call for sending a message
	const call = createAPICall(API.SEND_MESSAGE, { chatId, text: input, tempMessageId: tempMID });
	try {
		const response = await sendRequest(call);
		const { chatId, message, tempMessageId } = response as sendMessageResponse;
		const chat = memory.chats.find((chat) => chat._id === chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		const index = chat.messages.findIndex((msg) => msg._id === tempMessageId);
		if (index === -1) {
			alert(`Couldn't find message with tempMessageId: ${tempMessageId}`);
			return;
		}
		chat.messages[index] = message;
		chat.lastModified = message.sendTime;
		sortChats();
	} catch (error) {
		console.error('Error in sendMessage:', error);
		throw error;
	}
}

export async function sendReadUpdate(chatId: string, messageId: string): Promise<void> {
	const call = createAPICall(API.READ_UPDATE, { chatId, messageId });
	try {
		sendRequest(call);
	} catch (error) {
		console.error('Error in sendReadUpdate:', error);
		throw error;
	}
}

export async function getExtraMessages(chatId: string, currentIndex: number): Promise<void> {
	const call = createAPICall(API.EXTRA_MESSAGES, { chatId, currentIndex });
	try {
		const response = await sendRequest(call);
		const { extraMessages } = response as getExtraMessagesResponse;
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
	const call = createAPICall(API.EXTRA_NEW_MESSAGES, { chatId, unreadCount });
	try {
		const response = await sendRequest(call);
		const { extraNewMessages } = response as getExtraNewMessagesResponse;
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
	const call = createAPICall(API.READ_ALL, { chatId });
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

	const call = createAPICall(API.CREATE_CHAT, { username });
	try {
		const response = await sendRequest(call);
		const { createdChat } = response as createChatResponse;
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

	const call = createAPICall(API.LOGIN, { username, password });
	try {
		const response = await sendRequest(call);
		const { userId, token } = response as loginResponse;
		setCookie('userId', userId, 28);
		setCookie('token', token, 28);
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

	const call = createAPICall(API.SIGNUP, { username, password });
	try {
		const response = await sendRequest(call);
		const { userId, token } = response as signupResponse;
		setCookie('userId', userId, 28);
		setCookie('token', token, 28);
		goto('/');
	} catch (error) {
		console.error('Error in signup:', error);
		throw error;
	}
}

async function sendRequest(message: APIMessage, timeout?: number): Promise<responsePayload> {
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
	const data: APIResponse = JSON.parse(event.data);
	console.log(data);
	const { api, id, status, payload } = data;
	if (pendingRequests.has(id)) {
		const { resolve, reject } = pendingRequests.get(id)!;
		if (status === 'ERROR') {
			const { message } = payload as errorResponse;
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
	} else if (api === API.RECEIVE_MESSAGE) {
		const { chatId, message } = payload as receiveMessageResponse;
		const chat = memory.chats.find((chat) => chat._id === chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);
		chat.latestMessages = [...chat.latestMessages, message];
		chat.unreadCount++;
		chat.receivedUnreadCount++;
		chat.receivedNewCount++;
		chat.lastModified = message.sendTime;
		sortChats();
	} else if (api === API.READ_UPDATE) {
		const { chatId, lastSeen } = payload as readUpdateResponse;
		console.log(chatId, lastSeen);
	} else {
		console.warn('Received response for unknown request ID:', id);
	}
}
