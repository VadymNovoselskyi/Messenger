import type { Chat } from '$lib/types';


export let memory: { ws: WebSocket | null, chats: Chat[], chatsScroll: number} = $state({
    ws: null,
    chats: [],
    chatsScroll: 0
});