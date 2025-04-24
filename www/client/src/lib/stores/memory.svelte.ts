import type { UsedChat } from '$lib/types/dataTypes';

export let memory: { ws: WebSocket | null; chats: UsedChat[]; chatsScroll: number } = $state({
	ws: null,
	chats: [],
	chatsScroll: 0
});
