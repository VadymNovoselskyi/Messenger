import { get } from 'svelte/store';
import { page } from '$app/stores';
import { goto } from '$app/navigation';
import { memory } from '$lib/stores/memory.svelte';
import { setCookie, getCookie } from '$lib/utils';

export function getWS(): Promise<WebSocket> {
    if(!memory.ws || memory.ws.readyState === WebSocket.CLOSING || memory.ws.readyState === WebSocket.CLOSED) {
        memory.ws = new WebSocket(`${get(page).url.origin}/api/`);
        memory.ws.addEventListener('message', handleServerMessage);
    }

    return new Promise((resolve, reject) => {
        if (memory.ws!.readyState === WebSocket.OPEN) {
            resolve(memory.ws!);
        } else {
            memory.ws!.addEventListener('open', () => resolve(memory.ws!), { once: true });
            memory.ws!.addEventListener('error', (error) => reject(error), { once: true });
        }
    });

}

export async function requestChats(): Promise<void> {
    const ws = await getWS();
    ws.send(JSON.stringify({
        api: 'get_chats',
        token: getCookie("token"),
        payload: {}
    }));
}

export async function sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    const messageInput: HTMLInputElement = (event.currentTarget as HTMLFormElement).message;
    const message = messageInput.value;
    if(!message) return;
    messageInput.value = '';
    
    const ws = await getWS();
    const cid = get(page).params.cid;
    ws.send(JSON.stringify({
        api: 'send_message',
        token: getCookie("token"),
        payload: {
            cid,
            message
        }
    }));

    const chat = memory.chats.find(chat => chat._id === cid)!;
    chat.messages = [...chat.messages, {
        from: memory.uid,
        text: message,
        sendTime: new Date().toISOString()
    }];
}

export async function login(event: SubmitEvent) {
    const { usernameLogin, passwordLogin } = event.currentTarget as HTMLFormElement;
    const username = usernameLogin.value;
    const password = passwordLogin.value;

    usernameLogin.value = '';
    passwordLogin.value = '';

    const ws = await getWS();
    ws.send(JSON.stringify({
        api: 'login',
        payload: {
            username,
            password
        }
    }));
}

export async function signup(event: SubmitEvent) {
    const { usernameSignup, passwordSignup } = event.currentTarget as HTMLFormElement;
    const username = usernameSignup.value;
    const password = passwordSignup.value;

    usernameSignup.value = '';
    passwordSignup.value = '';

    const ws = await getWS();
    ws.send(JSON.stringify({
        api: 'signup',
        payload: {
            username,
            password
        }
    }));
}

export function handleServerMessage(event: MessageEvent): void {
    const response = event.data;
    const data = JSON.parse(response);
    console.log(data);
    if(data.payload.status === 'error') {
        alert(data.payload.message);
        return;
    }

    switch(data.api) {
        case 'get_chats':
            memory.chats = data.payload.chats;
            break;
        
        case 'login':
        case 'signup':
            memory.uid = data.payload.uid
            console.log(data.api)

            setCookie("token", data.payload.token, 28);
            console.log(getCookie("token"));
            goto('/');
            break;
        
        default:
            console.error(`Uknown api call: '${data.api}'`);
    }
}