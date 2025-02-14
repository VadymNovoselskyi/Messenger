import { get } from 'svelte/store';
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { memory } from '$lib/stores/memory.svelte';
import { generateTempId, setCookie, getCookie, sortChats } from '$lib/utils';
import type { Message } from '$lib/types';

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
	try {
		const ws = await getWS();
		ws.send(
			JSON.stringify({
				api: 'get_chats',
				token: getCookie('token'),
				payload: {}
			})
		);
		return Promise.resolve();
	} catch (error) {
		console.error('Error in requestChats:', error);
		return Promise.reject(error);
	}
}

export async function sendMessage(event: Event): Promise<void> {
	event.preventDefault();
	const messageInput: HTMLInputElement = (event.currentTarget as HTMLFormElement).message;
	const message = messageInput.value;
	if (!message) return;
	messageInput.value = '';

	const ws = await getWS();
	const cid = page.params.cid;
	const tempMID = generateTempId();
	ws.send(
		JSON.stringify({
			api: 'send_message',
			token: getCookie('token'),
			payload: {
				cid,
				message,
				tempMID
			}
		})
	);

	const chat = memory.chats.find((chat) => chat._id === cid);
	if (!chat) {
		throw new Error(`Chat with id ${cid} not found`);
	}

	const currentTime = new Date().toISOString();
	chat.messages.push({
		_id: tempMID,
		from: getCookie('uid') ?? '',
		text: message,
		sendTime: currentTime,
		isReceived: false
	});

	chat.lastModified = currentTime;
	sortChats();
}

export async function addChat(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	const usernameInput = (event.currentTarget as HTMLFormElement).username;
	const username = usernameInput.value;
	if (!username) return;
	usernameInput.value = '';

	const ws = await getWS();
	ws.send(
		JSON.stringify({
			api: 'create_chat',
			token: getCookie('token'),
			payload: {
				username
			}
		})
	);
}

export async function login(event: SubmitEvent): Promise<void> {
	const { usernameLogin, passwordLogin } = event.currentTarget as HTMLFormElement;
	const username = usernameLogin.value;
	const password = passwordLogin.value;

	usernameLogin.value = '';
	passwordLogin.value = '';

	const ws = await getWS();
	ws.send(
		JSON.stringify({
			api: 'login',
			payload: {
				username,
				password
			}
		})
	);
}

export async function signup(event: SubmitEvent): Promise<void> {
	const { usernameSignup, passwordSignup } = event.currentTarget as HTMLFormElement;
	const username = usernameSignup.value;
	const password = passwordSignup.value;

	usernameSignup.value = '';
	passwordSignup.value = '';

	const ws = await getWS();
	ws.send(
		JSON.stringify({
			api: 'signup',
			payload: {
				username,
				password
			}
		})
	);
}

export function handleServerMessage(event: MessageEvent): void {
	const response = event.data;
	const data = JSON.parse(response);
	console.log(data);
	if (data.status === 'error') {
		alert(data.payload.message);
		return;
	}

	switch (data.api) {
		case 'receive_message':
			const { cid, message, tempMID }:
				{ cid: string, message: Message, tempMID?: string }
				= data.payload;

			const chat = memory.chats.find((chat) => chat._id === cid);
			if (!chat) {
				throw new Error(`Chat with id ${cid} not found`);
			}

			if (tempMID) {
				const index = chat.messages.findIndex((msg) => msg._id === tempMID);
				if (index === -1) {
					alert(`Couldn't find message with tempMID: ${tempMID}`);
					return;
				}
				chat.messages[index] = { ...message };
			} else chat.messages.push(message)


			const currentTime = new Date().toISOString();
			chat.lastModified = currentTime;
			sortChats();
			break;

		case 'get_chats':
			memory.chats = data.payload.chats;
			sortChats();
			break;

		case 'create_chat':
			const { createdChat } = data.payload;
			memory.chats = [createdChat, ...memory.chats];
			break;

		case 'login':
		case 'signup':
			setCookie('uid', data.payload.uid, 28);
			setCookie('token', data.payload.token, 28);
			console.log(getCookie('token'));
			goto('/');
			break;

		default:
			console.error(`Uknown api call: '${data.api}'`);
	}
}
