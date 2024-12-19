import type { Chat } from '$lib/types';


export let memory: { ws: WebSocket | null, chats: Chat[]} = $state({
    ws: null,
    chats: []
});