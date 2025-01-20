import type { Chat } from '$lib/types';


export let memory: { ws: WebSocket | null, uid: string, chats: Chat[]} = $state({
    ws: null,
    uid: '',
    chats: []
});