import { page } from '$app/state';
import { goto } from '$app/navigation';
import { memory } from '$lib/stores/memory.svelte';
import { generateId, setCookie, getCookie, sortChats } from '$lib/utils';
import type {
	APICall,
	createChatResponse,
	getChatsResponse,
	getExtraMessagesResponse,
	getExtraNewMessagesResponse,
	loginResponse,
	Message,
	response,
	sendMessagePayload,
	sendMessageResponse,
	signupPayload,
	signupResponse
} from '$lib/types';
import { API } from '$lib/types';

const pendingRequests = new Map();

export function getWS(): Promise<WebSocket> {
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
	const requestId = generateId();
	const message: APICall = {
		api: API.GET_CHATS,
		id: requestId,
		token: getCookie('token'),
		payload: {}
	};

	try {
		const response = await sendRequest(message);
		const { chats } = response as getChatsResponse;
		memory.chats = chats;
		sortChats();
	} catch (error) {
		console.error('Error in getChats:', error);
		return Promise.reject(error);
	}
}

export async function sendMessage(event: Event): Promise<void> {
	event.preventDefault();
	const messageInput: HTMLInputElement = (event.currentTarget as HTMLFormElement).message;
	const input = messageInput.value;
	if (!input) return;
	messageInput.value = '';

	const chatId = page.params.chatId;
	const chat = memory.chats.find((chat) => chat._id === chatId);
	if (!chat) {
		throw new Error(`Chat with id ${chatId} not found`);
	}

	if (chat.unreadCount) {
		await readAllUpdate(chatId);
		await new Promise(resolve => setTimeout(resolve, 2000))
		await getExtraMessages(chatId, 0);
		await new Promise(resolve => setTimeout(resolve, 2000))
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

	const requestId = generateId();
	const apiCall: APICall = {
		api: API.SEND_MESSAGE,
		id: requestId,
		token: getCookie('token'),
		payload: {
			chatId,
			text: input,
			tempMessageId: tempMID
		}
	};
	try {
		const response = await sendRequest(apiCall);
		const {
			chatId,
			message,
			tempMessageId
		}: { chatId: string; message: Message; tempMessageId: string } =
			response as sendMessageResponse;

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
		return Promise.reject(error);
	}
}

export async function sendReadUpdate(chatId: string, messageId: string): Promise<void> {
	const requestId = generateId();
	const message: APICall = {
		api: API.READ_UPDATE,
		id: requestId,
		token: getCookie('token'),
		payload: {
			chatId,
			messageId
		}
	};

	try {
		sendRequest(message);
	} catch (error) {
		console.error('Error in sendReadUpdate:', error);
		return Promise.reject(error);
	}
}

export async function getExtraMessages(chatId: string, currentIndex: number): Promise<void> {
	const requestId = generateId();
	const message: APICall = {
		api: API.EXTRA_MESSAGES,
		id: requestId,
		token: getCookie('token'),
		payload: {
			chatId,
			currentIndex
		}
	};

	try {
		const response = await sendRequest(message);
		const { chatId, extraMessages }: { chatId: string; extraMessages: Message[] } =
			response as getExtraMessagesResponse;
		const chat = memory.chats.find((chat) => chat._id === chatId);

		if (!chat) {
			alert(`No chat to add extra messages ${chatId}`);
			return;
		}
		chat.messages = [...extraMessages, ...chat.messages];
	} catch (error) {
		console.error('Error in getExtraMessages:', error);
		return Promise.reject(error);
	}
}

export async function getExtraNewMessages(chatId: string, unreadCount: number): Promise<void> {
	const requestId = generateId();
	const message: APICall = {
		api: API.EXTRA_NEW_MESSAGES,
		id: requestId,
		token: getCookie('token'),
		payload: {
			chatId,
			unreadCount
		}
	};

	try {
		const response = await sendRequest(message);
		const { chatId, extraNewMessages }: { chatId: string; extraNewMessages: Message[] } =
			response as getExtraNewMessagesResponse;
		const chat = memory.chats.find((chat) => chat._id === chatId);

		if (!chat) {
			alert(`No chat to add extra messages ${chatId}`);
			return;
		}
		chat.messages = [...chat.messages, ...extraNewMessages];
		chat.receivedUnreadCount += extraNewMessages.length;
	} catch (error) {
		console.error('Error in getExtraNewMessages:', error);
		return Promise.reject(error);
	}
}

export async function readAllUpdate(chatId: string): Promise<void> {
	const requestId = generateId();
	const message: APICall = {
		api: API.READ_ALL,
		id: requestId,
		token: getCookie('token'),
		payload: { chatId }
	};

	try {
		await sendRequest(message);
		const chat = memory.chats.find((chat) => chat._id === chatId);

		if (!chat) {
			alert(`No chat to read all ${chatId}`);
			return;
		}
		chat.messages = [];
		chat.latestMessages = [];
		chat.unreadCount = 0;
		chat.receivedUnreadCount = 0;
		chat.receivedNewCount = 0;
	} catch (error) {
		console.error('Error in readAllUpdate:', error);
		return Promise.reject(error);
	}
}

export async function createChat(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	const usernameInput = (event.currentTarget as HTMLFormElement).username;
	const username = usernameInput.value;
	if (!username) return;
	usernameInput.value = '';

	const requestId = generateId();
	const message: APICall = {
		api: API.CREATE_CHAT,
		id: requestId,
		token: getCookie('token'),
		payload: {
			username
		}
	};

	try {
		const response = await sendRequest(message);
		const { createdChat } = response as createChatResponse;
		memory.chats = [createdChat, ...memory.chats];
	} catch (error) {
		console.error('Error in createChat:', error);
		return Promise.reject(error);
	}
}

export async function login(event: SubmitEvent): Promise<void> {
	const { usernameLogin, passwordLogin } = event.currentTarget as HTMLFormElement;
	const username = usernameLogin.value;
	const password = passwordLogin.value;

	usernameLogin.value = '';
	passwordLogin.value = '';

	const requestId = generateId();
	const message: APICall = {
		api: API.LOGIN,
		id: requestId,
		token: getCookie('token'),
		payload: {
			username,
			password
		}
	};

	try {
		const response = await sendRequest(message);
		const { userId, token } = response as loginResponse;
		setCookie('userId', userId, 28);
		setCookie('token', token, 28);
		console.log(getCookie('token'));
		goto('/');
	} catch (error) {
		console.error('Error in login:', error);
		return Promise.reject(error);
	}
}

export async function signup(event: SubmitEvent): Promise<void> {
	const { usernameSignup, passwordSignup } = event.currentTarget as HTMLFormElement;
	const username = usernameSignup.value;
	const password = passwordSignup.value;

	usernameSignup.value = '';
	passwordSignup.value = '';

	const requestId = generateId();
	const message: APICall = {
		api: API.SIGNUP,
		id: requestId,
		token: getCookie('token'),
		payload: {
			username,
			password
		}
	};

	try {
		const response = await sendRequest(message);
		const { userId, token } = response as signupResponse;
		setCookie('userId', userId, 28);
		setCookie('token', token, 28);
		console.log(getCookie('token'));
		goto('/');
	} catch (error) {
		console.error('Error in signup:', error);
		return Promise.reject(error);
	}
}

async function sendRequest(message: APICall, timeout?: number): Promise<response> {
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
	const data = JSON.parse(event.data);
	console.log(data);
	const { api, id, status, payload } = data;

	if (pendingRequests.has(id)) {
		const { resolve, reject } = pendingRequests.get(id);
		if (status === 'error') {
			if (payload.message === 'Invalid Token. Login again') goto('/login');
			else alert(payload.message);
			reject(payload.message);
			return;
		} else resolve(payload);

		pendingRequests.delete(id);
	} else if (api === 'receive_message') {
		const { chatId, message }: { chatId: string; message: Message } = payload;
		const chat = memory.chats.find((chat) => chat._id === chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		chat.latestMessages = [...chat.latestMessages, message];
		chat.unreadCount++;
		chat.receivedUnreadCount++;
		chat.receivedNewCount++;
		chat.lastModified = message.sendTime;
		sortChats();
	} else if (api === 'read_update') {
		console.log(payload.chatId, payload.lastSeen);
	} else {
		console.warn('Received response for unknown request ID:', id);
	}
}
