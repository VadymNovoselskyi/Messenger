import { get } from 'svelte/store';
import { page } from '$app/stores';
import { memory } from '$lib/stores/memory.svelte';

export function getWS(): WebSocket {
    if(!memory.ws || memory.ws.readyState === WebSocket.CLOSING || memory.ws.readyState === WebSocket.CLOSED) {
        memory.ws = new WebSocket(`${get(page).url.origin}/api/`);
        memory.ws.addEventListener('message', handleServerMessage);
    }
    return memory.ws;
}

export function requestChats(): void {
    const ws = getWS();
    ws.send(JSON.stringify({
        api: 'get_chats',
        uid: 'me'
    }));
}

export function sendMessage(event: Event): void {
    event.preventDefault();
    const messageInput: HTMLInputElement = (event.currentTarget as HTMLFormElement).message;
    
    const ws = getWS();
    const message = messageInput.value;
    messageInput.value = '';
    const cid = get(page).params.cid;
    ws.send(JSON.stringify({
        api: 'send_message',
        uid: 'me',
        cid,
        message
    }));

    const chat = memory.chats.find(chat => chat._id === cid)!;
    chat.messages.push({
        from: 'me',
        text: message,
        sendTime: new Date().toISOString()
    });
}

export function handleServerMessage(event: MessageEvent): void {
    const response = event.data;
    const data = JSON.parse(response);
    console.log(data);

    switch(data.api) {
        case 'get_chats':
            memory.chats = data.chats;
            break;
        
        default:
            console.error(`Uknown api call: '${data.api}'`);
    }
}