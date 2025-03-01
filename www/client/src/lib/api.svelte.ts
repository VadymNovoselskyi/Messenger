import { page } from '$app/state';
import { goto } from '$app/navigation';
import { memory } from '$lib/stores/memory.svelte';
import { generateId, setCookie, getCookie, sortChats } from '$lib/utils';
import type { APICall, Message } from '$lib/types';

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

export async function requestChats(): Promise<void> {
	const requestId = generateId();
	const message: APICall = {
		api: 'get_chats',
		id: requestId,
		token: getCookie('token'),
		payload: {}
	};

	try {
		const payload = await sendRequest(message);
		memory.chats = payload.chats;
		sortChats();
	} catch (error) {
		console.error('Error in requestChats:', error);
		return Promise.reject(error);
	}
}

export async function getExtraMessages(cid: string, currentIndex: number): Promise<void> {
	const requestId = generateId();
	const message: APICall = {
		api: 'extra_messages',
		id: requestId,
		token: getCookie('token'),
		payload: {
			cid,
			currentIndex
		}
	};

	try {
		const { cid, extraMessages }: { cid: string; extraMessages: Message[] } =
			await sendRequest(message);
		const chat = memory.chats.find((chat) => chat._id === cid);

		if (!chat) {
			alert(`No chat to add extra messages ${cid}`);
			return;
		}
		chat.messages = [...extraMessages, ...chat.messages];
	} catch (error) {
		console.error('Error in getExtraMessages:', error);
		return Promise.reject(error);
	}
}

export async function getExtraNewMessages(cid: string, unreadMessagesCount: number): Promise<void> {
	const requestId = generateId();
	const message: APICall = {
		api: 'extra_new_messages',
		id: requestId,
		token: getCookie('token'),
		payload: {
			cid,
			unreadMessagesCount
		}
	};

	try {
		const { cid, extraNewMessages }: { cid: string; extraNewMessages: Message[] } =
			await sendRequest(message);
		const chat = memory.chats.find((chat) => chat._id === cid);

		if (!chat) {
			alert(`No chat to add extra messages ${cid}`);
			return;
		}
		chat.messages = [...chat.messages, ...extraNewMessages];
	} catch (error) {
		console.error('Error in getExtraNewMessages:', error);
		return Promise.reject(error);
	}
}

export async function sendMessage(event: Event): Promise<void> {
	event.preventDefault();
	const messageInput: HTMLInputElement = (event.currentTarget as HTMLFormElement).message;
	const input = messageInput.value;
	if (!input) return;
	messageInput.value = '';

	const cid = page.params.cid;
	const tempMID = generateId();
	const chat = memory.chats.find((chat) => chat._id === cid);
	if (!chat) {
		throw new Error(`Chat with id ${cid} not found`);
	}

	const currentTime = new Date().toISOString();
	chat.messages.push({
		_id: tempMID,
		from: getCookie('uid') ?? '',
		text: input,
		sendTime: currentTime,
		isReceived: false
	});

	chat.lastModified = currentTime;
	sortChats();

	const requestId = generateId();
	const apiCall: APICall = {
		api: 'send_message',
		id: requestId,
		token: getCookie('token'),
		payload: {
			cid,
			message: input,
			tempMID
		}
	};
	try {
		const { cid, message, tempMID }: { cid: string; message: Message; tempMID: string } =
			await sendRequest(apiCall);

		const chat = memory.chats.find((chat) => chat._id === cid);
		if (!chat) throw new Error(`Chat with id ${cid} not found`);

		const index = chat.messages.findIndex((msg) => msg._id === tempMID);
		if (index === -1) {
			alert(`Couldn't find message with tempMID: ${tempMID}`);
			return;
		}
		chat.messages[index] = { ...message };

		const currentTime = new Date().toISOString();
		chat.lastModified = currentTime;
		sortChats();
	} catch (error) {
		console.error('Error in sendMessage:', error);
		return Promise.reject(error);
	}
}

export async function addChat(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	const usernameInput = (event.currentTarget as HTMLFormElement).username;
	const username = usernameInput.value;
	if (!username) return;
	usernameInput.value = '';

	const requestId = generateId();
	const message: APICall = {
		api: 'create_chat',
		id: requestId,
		token: getCookie('token'),
		payload: {
			username
		}
	};

	try {
		const { createdChat } = await sendRequest(message);
		memory.chats = [createdChat, ...memory.chats];
		console.log(memory.chats);
	} catch (error) {
		console.error('Error in addChat:', error);
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
		api: 'login',
		id: requestId,
		token: getCookie('token'),
		payload: {
			username,
			password
		}
	};

	try {
		const { uid, token } = await sendRequest(message);
		setCookie('uid', uid, 28);
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
		api: 'signup',
		id: requestId,
		token: getCookie('token'),
		payload: {
			username,
			password
		}
	};

	try {
		const { uid, token } = await sendRequest(message);
		setCookie('uid', uid, 28);
		setCookie('token', token, 28);
		console.log(getCookie('token'));
		goto('/');
	} catch (error) {
		console.error('Error in login:', error);
		return Promise.reject(error);
	}
}

async function sendRequest(message: APICall, timeout: number = 500): Promise<any> {
	const ws = await getWS();
	return new Promise((resolve, reject) => {
		pendingRequests.set(message.id, { resolve, reject });
		ws.send(JSON.stringify(message));

		setTimeout(() => {
			if (pendingRequests.has(message.id)) {
				pendingRequests.delete(message.id);
				reject(new Error('Request timed out'));
			}
		}, timeout);
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
		const { cid, message }: { cid: string; message: Message } = payload;
		const chat = memory.chats.find((chat) => chat._id === cid);
		if (!chat) throw new Error(`Chat with id ${cid} not found`);

		chat.messages.push(message);
		chat.unreadMessagesCount++;
	} else {
		console.warn('Received response for unknown request ID:', id);
	}
}
